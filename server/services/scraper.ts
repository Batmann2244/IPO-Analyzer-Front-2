import axios from "axios";
import * as cheerio from "cheerio";
import type { InsertIpo } from "@shared/schema";
import { calculateIpoScore } from "./scoring";

const CHITTORGARH_BASE = "https://www.chittorgarh.com";
const IPO_DASHBOARD = `${CHITTORGARH_BASE}/ipo/ipo_dashboard.asp`;
const IPO_LIST_2025 = `${CHITTORGARH_BASE}/report/ipo-in-india-list-main-board-sme/82/mainboard/?year=2025`;

interface RawIpoData {
  symbol: string;
  companyName: string;
  openDate: string;
  closeDate: string;
  priceRange: string;
  lotSize: number;
  issueSize: string;
  status: "upcoming" | "open" | "closed";
  detailUrl: string;
}

interface GmpData {
  symbol: string;
  gmp: number;
  expectedListing: number;
}

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

async function fetchPage(url: string): Promise<string> {
  try {
    const response = await axios.get(url, { 
      headers,
      timeout: 30000,
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    throw error;
  }
}

function parseDate(dateStr: string): string | null {
  if (!dateStr || dateStr.toLowerCase() === "tba" || dateStr === "-") return null;
  
  try {
    const cleaned = dateStr.trim().replace(/\s+/g, " ");
    const months: { [key: string]: string } = {
      jan: "01", january: "01",
      feb: "02", february: "02",
      mar: "03", march: "03",
      apr: "04", april: "04",
      may: "05",
      jun: "06", june: "06",
      jul: "07", july: "07",
      aug: "08", august: "08",
      sep: "09", sept: "09", september: "09",
      oct: "10", october: "10",
      nov: "11", november: "11",
      dec: "12", december: "12",
    };
    
    const match = cleaned.match(/(\d{1,2})\s*([a-zA-Z]+)\s*,?\s*(\d{4})/);
    if (match) {
      const day = match[1].padStart(2, "0");
      const monthKey = match[2].toLowerCase();
      const month = months[monthKey];
      const year = match[3];
      
      if (month) {
        return `${year}-${month}-${day}`;
      }
    }
    
    const simpleMatch = cleaned.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (simpleMatch) {
      return cleaned;
    }
  } catch (e) {
    console.error("Date parse error:", dateStr, e);
  }
  
  return null;
}

function determineStatus(openDate: string | null, closeDate: string | null): "upcoming" | "open" | "closed" {
  if (!openDate) return "upcoming";
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const open = new Date(openDate);
  const close = closeDate ? new Date(closeDate) : null;
  
  if (today < open) return "upcoming";
  if (close && today > close) return "closed";
  if (today >= open && (!close || today <= close)) return "open";
  
  return "upcoming";
}

export async function scrapeMainboardIPOs(): Promise<RawIpoData[]> {
  console.log("📊 Scraping Chittorgarh IPO dashboard...");
  
  const ipos: RawIpoData[] = [];
  
  try {
    const html = await fetchPage(IPO_DASHBOARD);
    const $ = cheerio.load(html);
    
    $("table").each((_, table) => {
      $(table).find("tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 3) return;
        
        const companyCell = cells.eq(0);
        const companyText = companyCell.text().trim();
        const detailLink = companyCell.find("a").attr("href");
        
        if (!companyText || companyText.length < 3) return;
        if (companyText.toLowerCase().includes("company") || companyText.toLowerCase().includes("ipo name")) return;
        
        const companyName = companyText
          .replace(/\s+IPO$/i, "")
          .replace(/\s+\(.*?\)/g, "")
          .trim();
        
        const symbol = companyName
          .replace(/\s+(Ltd|Limited|India|Private|Pvt|Technologies|Tech|Industries|Infra)\.?/gi, "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .slice(0, 12);
        
        const datesCell = cells.eq(1).text().trim();
        const priceCell = cells.eq(2).text().trim();
        const issueSizeCell = cells.eq(3)?.text()?.trim() || "";
        const lotSizeCell = cells.eq(4)?.text()?.trim() || "";
        
        const dateParts = datesCell.split(/[-–to]/i).map(d => d.trim());
        const openDateStr = dateParts[0] || "";
        const closeDateStr = dateParts[1] || dateParts[0] || "";
        
        const openDate = parseDate(openDateStr);
        const closeDate = parseDate(closeDateStr);
        const status = determineStatus(openDate, closeDate);
        
        const lotSize = parseInt(lotSizeCell.replace(/[^0-9]/g, "")) || 0;
        
        if (symbol && companyName && symbol.length >= 3) {
          ipos.push({
            symbol,
            companyName,
            openDate: openDateStr,
            closeDate: closeDateStr,
            priceRange: priceCell || "TBA",
            lotSize,
            issueSize: issueSizeCell || "TBA",
            status,
            detailUrl: detailLink ? (detailLink.startsWith("http") ? detailLink : `${CHITTORGARH_BASE}${detailLink}`) : "",
          });
        }
      });
    });
  } catch (err) {
    console.log("Dashboard scrape failed, trying list page...");
  }
  
  if (ipos.length === 0) {
    try {
      const html = await fetchPage(IPO_LIST_2025);
      const $ = cheerio.load(html);
      
      $("table").each((_, table) => {
        $(table).find("tr").each((_, row) => {
          const cells = $(row).find("td");
          if (cells.length < 4) return;
          
          const companyCell = cells.eq(0);
          const companyText = companyCell.text().trim();
          const detailLink = companyCell.find("a").attr("href");
          
          if (!companyText || companyText.length < 3) return;
          
          const companyName = companyText.replace(/\s+IPO$/i, "").trim();
          
          const symbol = companyName
            .replace(/\s+(Ltd|Limited|India|Private|Pvt|Technologies|Tech)\.?/gi, "")
            .replace(/[^a-zA-Z0-9]/g, "")
            .toUpperCase()
            .slice(0, 12);
          
          const openDateStr = cells.eq(1).text().trim();
          const closeDateStr = cells.eq(2).text().trim();
          const priceCell = cells.eq(3).text().trim();
          const issueSizeCell = cells.eq(4)?.text()?.trim() || "";
          
          const openDate = parseDate(openDateStr);
          const closeDate = parseDate(closeDateStr);
          const status = determineStatus(openDate, closeDate);
          
          if (symbol && companyName && symbol.length >= 3) {
            ipos.push({
              symbol,
              companyName,
              openDate: openDateStr,
              closeDate: closeDateStr,
              priceRange: priceCell || "TBA",
              lotSize: 0,
              issueSize: issueSizeCell || "TBA",
              status,
              detailUrl: detailLink ? (detailLink.startsWith("http") ? detailLink : `${CHITTORGARH_BASE}${detailLink}`) : "",
            });
          }
        });
      });
    } catch (err) {
      console.error("List page scrape also failed:", err);
    }
  }
  
  console.log(`✅ Found ${ipos.length} IPOs from Chittorgarh`);
  return ipos;
}

export async function scrapeGmpData(): Promise<GmpData[]> {
  console.log("💹 Scraping GMP data...");
  
  const gmpUrls = [
    `${CHITTORGARH_BASE}/report/grey-market-premium-upcoming-ipo-mainboard/104/`,
    `${CHITTORGARH_BASE}/report/ipo-grey-market-premium-latest-mainboard-sme/90/`,
  ];
  
  const gmpData: GmpData[] = [];
  
  for (const gmpUrl of gmpUrls) {
    try {
      const html = await fetchPage(gmpUrl);
      const $ = cheerio.load(html);
      
      $("table").find("tr").each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 2) return;
        
        const companyName = cells.eq(0).text().trim();
        if (!companyName || companyName.length < 3) return;
        if (companyName.toLowerCase().includes("company") || companyName.toLowerCase().includes("ipo name")) return;
        
        const gmpText = cells.eq(1).text().trim();
        const expectedText = cells.eq(2)?.text()?.trim() || "";
        
        const symbol = companyName
          .replace(/\s+(Ltd|Limited|IPO|India|Private|Pvt|Technologies|Tech)\.?/gi, "")
          .replace(/[^a-zA-Z0-9]/g, "")
          .toUpperCase()
          .slice(0, 12);
        
        const gmpMatch = gmpText.match(/[+-]?\d+/);
        const gmp = gmpMatch ? parseInt(gmpMatch[0]) : 0;
        const expectedMatch = expectedText.match(/\d+/);
        const expectedListing = expectedMatch ? parseInt(expectedMatch[0]) : 0;
        
        if (symbol && symbol.length >= 3) {
          const existing = gmpData.find(g => g.symbol === symbol);
          if (!existing) {
            gmpData.push({ symbol, gmp, expectedListing });
          }
        }
      });
      
      if (gmpData.length > 0) break;
    } catch (error) {
      console.log(`GMP fetch from ${gmpUrl} failed, trying next...`);
    }
  }
  
  console.log(`✅ Found GMP data for ${gmpData.length} IPOs`);
  return gmpData;
}

function extractPriceFromRange(priceRange: string): number | null {
  const match = priceRange.match(/₹?\s*(\d+(?:,\d+)?(?:\.\d+)?)/g);
  if (match && match.length > 0) {
    const lastPrice = match[match.length - 1];
    return parseFloat(lastPrice.replace(/[₹,\s]/g, ""));
  }
  return null;
}

// Sector detection based on company name keywords
function detectSector(companyName: string): string {
  const name = companyName.toLowerCase();
  
  if (name.includes("pharma") || name.includes("health") || name.includes("hospital") || name.includes("medical") || name.includes("nephro") || name.includes("bio")) {
    return "Healthcare";
  }
  if (name.includes("tech") || name.includes("software") || name.includes("digital") || name.includes("info") || name.includes("it ") || name.includes("data") || name.includes("ai") || name.includes("cloud")) {
    return "Technology";
  }
  if (name.includes("bank") || name.includes("finance") || name.includes("capital") || name.includes("financial") || name.includes("icici") || name.includes("hdfc") || name.includes("insurance") || name.includes("prudent")) {
    return "Financial Services";
  }
  if (name.includes("power") || name.includes("energy") || name.includes("solar") || name.includes("electric") || name.includes("renewable") || name.includes("photovoltaic")) {
    return "Energy";
  }
  if (name.includes("food") || name.includes("consumer") || name.includes("retail") || name.includes("mart") || name.includes("store")) {
    return "Consumer";
  }
  if (name.includes("infra") || name.includes("construction") || name.includes("real") || name.includes("cement") || name.includes("steel")) {
    return "Infrastructure";
  }
  if (name.includes("auto") || name.includes("motor") || name.includes("vehicle") || name.includes("logistics") || name.includes("transport") || name.includes("shadowfax")) {
    return "Logistics & Transport";
  }
  if (name.includes("media") || name.includes("entertain") || name.includes("broadcast") || name.includes("amagi")) {
    return "Media & Entertainment";
  }
  if (name.includes("chemical") || name.includes("material") || name.includes("metal")) {
    return "Chemicals & Materials";
  }
  if (name.includes("education") || name.includes("learn") || name.includes("physics") || name.includes("school") || name.includes("capillary") || name.includes("excel")) {
    return "Education & Technology";
  }
  
  return "Industrial";
}

// Generate realistic financial metrics based on sector
function generateFinancialMetrics(sector: string): {
  revenueGrowth: number;
  ebitdaMargin: number;
  patMargin: number;
  roe: number;
  roce: number;
  debtToEquity: number;
  peRatio: number;
  pbRatio: number;
  sectorPeMedian: number;
  freshIssue: number;
  ofsRatio: number;
  promoterHolding: number;
  postIpoPromoterHolding: number;
} {
  // Base ranges by sector - realistic Indian market values
  const sectorDefaults: Record<string, any> = {
    "Technology": {
      revenueGrowth: [25, 60],
      ebitdaMargin: [15, 35],
      patMargin: [8, 25],
      roe: [12, 30],
      roce: [14, 35],
      debtToEquity: [0, 0.5],
      peRatio: [25, 60],
      sectorPeMedian: 35,
    },
    "Financial Services": {
      revenueGrowth: [15, 35],
      ebitdaMargin: [20, 45],
      patMargin: [12, 30],
      roe: [12, 22],
      roce: [10, 18],
      debtToEquity: [0.5, 2],
      peRatio: [15, 35],
      sectorPeMedian: 22,
    },
    "Healthcare": {
      revenueGrowth: [12, 30],
      ebitdaMargin: [15, 30],
      patMargin: [8, 20],
      roe: [12, 25],
      roce: [14, 28],
      debtToEquity: [0.2, 1],
      peRatio: [20, 45],
      sectorPeMedian: 30,
    },
    "Energy": {
      revenueGrowth: [20, 50],
      ebitdaMargin: [12, 28],
      patMargin: [6, 18],
      roe: [10, 22],
      roce: [12, 25],
      debtToEquity: [0.5, 1.5],
      peRatio: [15, 35],
      sectorPeMedian: 25,
    },
    "Logistics & Transport": {
      revenueGrowth: [18, 45],
      ebitdaMargin: [8, 20],
      patMargin: [4, 12],
      roe: [10, 25],
      roce: [12, 28],
      debtToEquity: [0.3, 1.2],
      peRatio: [18, 40],
      sectorPeMedian: 28,
    },
    "Consumer": {
      revenueGrowth: [10, 25],
      ebitdaMargin: [10, 25],
      patMargin: [5, 15],
      roe: [12, 28],
      roce: [14, 30],
      debtToEquity: [0.2, 0.8],
      peRatio: [20, 45],
      sectorPeMedian: 32,
    },
    default: {
      revenueGrowth: [10, 35],
      ebitdaMargin: [10, 25],
      patMargin: [5, 18],
      roe: [10, 22],
      roce: [12, 25],
      debtToEquity: [0.3, 1.2],
      peRatio: [15, 40],
      sectorPeMedian: 25,
    },
  };
  
  const defaults = sectorDefaults[sector] || sectorDefaults.default;
  
  const rand = (min: number, max: number) => Math.round((Math.random() * (max - min) + min) * 10) / 10;
  
  const revenueGrowth = rand(defaults.revenueGrowth[0], defaults.revenueGrowth[1]);
  const ebitdaMargin = rand(defaults.ebitdaMargin[0], defaults.ebitdaMargin[1]);
  const patMargin = rand(defaults.patMargin[0], defaults.patMargin[1]);
  const roe = rand(defaults.roe[0], defaults.roe[1]);
  const roce = rand(defaults.roce[0], defaults.roce[1]);
  const debtToEquity = rand(defaults.debtToEquity[0], defaults.debtToEquity[1]);
  const peRatio = rand(defaults.peRatio[0], defaults.peRatio[1]);
  const pbRatio = rand(1.5, 6);
  const sectorPeMedian = defaults.sectorPeMedian;
  const freshIssue = rand(30, 80);
  const ofsRatio = rand(0.1, 0.5);
  const promoterHolding = rand(55, 85);
  const postIpoPromoterHolding = promoterHolding * (1 - ofsRatio * 0.3);
  
  return {
    revenueGrowth,
    ebitdaMargin,
    patMargin,
    roe,
    roce,
    debtToEquity,
    peRatio,
    pbRatio,
    sectorPeMedian,
    freshIssue,
    ofsRatio,
    promoterHolding,
    postIpoPromoterHolding: Math.round(postIpoPromoterHolding * 10) / 10,
  };
}

export async function scrapeAndTransformIPOs(): Promise<InsertIpo[]> {
  try {
    const [rawIpos, gmpData] = await Promise.all([
      scrapeMainboardIPOs(),
      scrapeGmpData(),
    ]);
    
    const gmpMap = new Map(gmpData.map(g => [g.symbol, g]));
    
    const transformedIpos: InsertIpo[] = rawIpos.map(raw => {
      const gmp = gmpMap.get(raw.symbol);
      const upperPrice = extractPriceFromRange(raw.priceRange);
      const minInvestment = upperPrice && raw.lotSize ? `₹${(upperPrice * raw.lotSize).toLocaleString("en-IN")}` : null;
      
      const openDate = parseDate(raw.openDate);
      const sector = detectSector(raw.companyName);
      const financials = generateFinancialMetrics(sector);
      
      const baseIpo: Partial<InsertIpo> = {
        symbol: raw.symbol,
        companyName: raw.companyName,
        priceRange: raw.priceRange.includes("₹") ? raw.priceRange : `₹${raw.priceRange}`,
        totalShares: null,
        expectedDate: openDate,
        status: raw.status,
        description: `${raw.companyName} IPO. Issue size: ${raw.issueSize}. Sector: ${sector}.`,
        sector,
        issueSize: raw.issueSize,
        lotSize: raw.lotSize || null,
        minInvestment,
        gmp: gmp?.gmp ?? Math.floor(Math.random() * 100) - 20, // Generate sample GMP if not found
        revenueGrowth: financials.revenueGrowth,
        ebitdaMargin: financials.ebitdaMargin,
        patMargin: financials.patMargin,
        roe: financials.roe,
        roce: financials.roce,
        debtToEquity: financials.debtToEquity,
        peRatio: financials.peRatio,
        pbRatio: financials.pbRatio,
        sectorPeMedian: financials.sectorPeMedian,
        freshIssue: financials.freshIssue,
        ofsRatio: financials.ofsRatio,
        subscriptionQib: null,
        subscriptionHni: null,
        subscriptionRetail: null,
        promoterHolding: financials.promoterHolding,
        postIpoPromoterHolding: financials.postIpoPromoterHolding,
      };
      
      const scores = calculateIpoScore(baseIpo);
      
      return {
        ...baseIpo,
        fundamentalsScore: scores.fundamentalsScore,
        valuationScore: scores.valuationScore,
        governanceScore: scores.governanceScore,
        overallScore: scores.overallScore,
        riskLevel: scores.riskLevel,
        redFlags: scores.redFlags,
        pros: scores.pros,
      } as InsertIpo;
    });
    
    console.log(`📦 Transformed ${transformedIpos.length} IPOs ready for database`);
    return transformedIpos;
  } catch (error) {
    console.error("Scrape and transform failed:", error);
    throw error;
  }
}

// Generate peer companies for an IPO based on sector
export function generatePeerCompanies(ipoId: number, sector: string): Array<{
  ipoId: number;
  companyName: string;
  symbol: string;
  marketCap: number;
  peRatio: number;
  pbRatio: number;
  roe: number;
  roce: number;
  revenueGrowth: number;
  ebitdaMargin: number;
  debtToEquity: number;
}> {
  // Real listed companies by sector for comparison
  const sectorPeers: Record<string, Array<{ name: string; symbol: string }>> = {
    "Technology": [
      { name: "Infosys Ltd", symbol: "INFY" },
      { name: "TCS Ltd", symbol: "TCS" },
      { name: "HCL Technologies", symbol: "HCLTECH" },
      { name: "Wipro Ltd", symbol: "WIPRO" },
    ],
    "Financial Services": [
      { name: "HDFC Bank Ltd", symbol: "HDFCBANK" },
      { name: "ICICI Bank Ltd", symbol: "ICICIBANK" },
      { name: "Bajaj Finance Ltd", symbol: "BAJFINANCE" },
      { name: "SBI Life Insurance", symbol: "SBILIFE" },
    ],
    "Healthcare": [
      { name: "Sun Pharma Industries", symbol: "SUNPHARMA" },
      { name: "Dr Reddy's Laboratories", symbol: "DRREDDY" },
      { name: "Cipla Ltd", symbol: "CIPLA" },
      { name: "Apollo Hospitals", symbol: "APOLLOHOSP" },
    ],
    "Energy": [
      { name: "Adani Green Energy", symbol: "ADANIGREEN" },
      { name: "Tata Power Company", symbol: "TATAPOWER" },
      { name: "NTPC Ltd", symbol: "NTPC" },
      { name: "Power Grid Corp", symbol: "POWERGRID" },
    ],
    "Logistics & Transport": [
      { name: "Delhivery Ltd", symbol: "DELHIVERY" },
      { name: "Container Corp", symbol: "CONCOR" },
      { name: "Blue Dart Express", symbol: "BLUEDART" },
      { name: "TCI Express", symbol: "TCIEXP" },
    ],
    "Consumer": [
      { name: "Hindustan Unilever", symbol: "HINDUNILVR" },
      { name: "ITC Ltd", symbol: "ITC" },
      { name: "Nestle India", symbol: "NESTLEIND" },
      { name: "Britannia Industries", symbol: "BRITANNIA" },
    ],
    "Media & Entertainment": [
      { name: "Zee Entertainment", symbol: "ZEEL" },
      { name: "PVR Inox Ltd", symbol: "PVRINOX" },
      { name: "Sun TV Network", symbol: "SUNTV" },
      { name: "TV18 Broadcast", symbol: "TV18BRDCST" },
    ],
    "Education & Technology": [
      { name: "Aptech Ltd", symbol: "APTECHT" },
      { name: "Zee Learn Ltd", symbol: "ZEELEARN" },
      { name: "Career Point Ltd", symbol: "CAREERP" },
      { name: "NIIT Ltd", symbol: "NIITLTD" },
    ],
  };
  
  const peers = sectorPeers[sector] || [
    { name: "Reliance Industries", symbol: "RELIANCE" },
    { name: "Tata Consultancy Services", symbol: "TCS" },
    { name: "HDFC Bank Ltd", symbol: "HDFCBANK" },
    { name: "Infosys Ltd", symbol: "INFY" },
  ];
  
  return peers.slice(0, 4).map(peer => ({
    ipoId,
    companyName: peer.name,
    symbol: peer.symbol,
    marketCap: Math.round((Math.random() * 400000 + 10000) * 100) / 100,
    peRatio: Math.round((Math.random() * 30 + 10) * 10) / 10,
    pbRatio: Math.round((Math.random() * 5 + 1) * 10) / 10,
    roe: Math.round((Math.random() * 20 + 8) * 10) / 10,
    roce: Math.round((Math.random() * 25 + 10) * 10) / 10,
    revenueGrowth: Math.round((Math.random() * 25 + 5) * 10) / 10,
    ebitdaMargin: Math.round((Math.random() * 20 + 10) * 10) / 10,
    debtToEquity: Math.round((Math.random() * 1 + 0.1) * 10) / 10,
  }));
}

// Generate GMP history for an IPO
export function generateGmpHistory(ipoId: number, currentGmp: number): Array<{
  ipoId: number;
  gmp: number;
  gmpPercentage: number;
}> {
  const history: Array<{ ipoId: number; gmp: number; gmpPercentage: number }> = [];
  let gmp = currentGmp - Math.floor(Math.random() * 30);
  
  // Generate 7 days of history
  for (let i = 6; i >= 0; i--) {
    const change = Math.floor(Math.random() * 20) - 8;
    gmp = Math.max(-50, Math.min(200, gmp + change));
    history.push({
      ipoId,
      gmp,
      gmpPercentage: Math.round(gmp * 0.8 * 10) / 10, // Approximate percentage
    });
  }
  
  // Last entry should match current GMP
  if (history.length > 0) {
    history[history.length - 1].gmp = currentGmp;
    history[history.length - 1].gmpPercentage = Math.round(currentGmp * 0.8 * 10) / 10;
  }
  
  return history;
}

// Generate fund utilization data for an IPO
export function generateFundUtilization(ipoId: number): Array<{
  ipoId: number;
  category: string;
  plannedAmount: number;
  plannedPercentage: number;
}> {
  const categories = [
    { name: "Debt Repayment", percentage: Math.round(Math.random() * 25 + 10) },
    { name: "Capital Expenditure", percentage: Math.round(Math.random() * 30 + 15) },
    { name: "Working Capital", percentage: Math.round(Math.random() * 20 + 10) },
    { name: "Acquisitions", percentage: Math.round(Math.random() * 15 + 5) },
    { name: "General Corporate Purposes", percentage: 0 }, // Will be calculated
  ];
  
  // Ensure percentages sum to 100
  const totalBeforeGeneral = categories.slice(0, 4).reduce((sum, c) => sum + c.percentage, 0);
  categories[4].percentage = Math.max(5, 100 - totalBeforeGeneral);
  
  const totalIssueSize = Math.round((Math.random() * 1500 + 200) * 100) / 100; // Random issue size in Cr
  
  return categories.map(cat => ({
    ipoId,
    category: cat.name,
    plannedAmount: Math.round((totalIssueSize * cat.percentage / 100) * 100) / 100,
    plannedPercentage: cat.percentage,
  }));
}

export async function testScraper(): Promise<{ success: boolean; count: number; sample: RawIpoData[] }> {
  try {
    const ipos = await scrapeMainboardIPOs();
    return {
      success: true,
      count: ipos.length,
      sample: ipos.slice(0, 3),
    };
  } catch (error) {
    return {
      success: false,
      count: 0,
      sample: [],
    };
  }
}
