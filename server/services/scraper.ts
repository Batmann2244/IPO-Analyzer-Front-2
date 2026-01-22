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
      
      const baseIpo: Partial<InsertIpo> = {
        symbol: raw.symbol,
        companyName: raw.companyName,
        priceRange: raw.priceRange.includes("₹") ? raw.priceRange : `₹${raw.priceRange}`,
        totalShares: null,
        expectedDate: openDate,
        status: raw.status,
        description: `${raw.companyName} IPO. Issue size: ${raw.issueSize}.`,
        sector: null,
        issueSize: raw.issueSize,
        lotSize: raw.lotSize || null,
        minInvestment,
        gmp: gmp?.gmp ?? null,
        revenueGrowth: null,
        ebitdaMargin: null,
        patMargin: null,
        roe: null,
        roce: null,
        debtToEquity: null,
        peRatio: null,
        pbRatio: null,
        sectorPeMedian: null,
        freshIssue: null,
        ofsRatio: null,
        subscriptionQib: null,
        subscriptionHni: null,
        subscriptionRetail: null,
        promoterHolding: null,
        postIpoPromoterHolding: null,
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
