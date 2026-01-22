import type { Express } from "express";
import type { Server } from "http";
import { createServer } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertIpoSchema, insertAlertPreferencesSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { z } from "zod";
import { calculateIpoScore } from "./services/scoring";
import { scrapeAndTransformIPOs, testScraper } from "./services/scraper";
import { analyzeIpo } from "./services/ai-analysis";
import { sendIpoEmailAlert } from "./services/email";

export async function registerRoutes(
  httpServer: Server, // Accept httpServer as parameter
  app: Express
): Promise<Server> { // Return Promise<Server>
  
  // Setup Auth
  await setupAuth(app);
  registerAuthRoutes(app);

  // IPO Routes
  app.get(api.ipos.list.path, async (req, res) => {
    const status = req.query.status as string | undefined;
    const sector = req.query.sector as string | undefined;
    const ipos = await storage.getIpos(status, sector);
    res.json(ipos);
  });

  app.get(api.ipos.get.path, async (req, res) => {
    const ipo = await storage.getIpo(Number(req.params.id));
    if (!ipo) {
      return res.status(404).json({ message: "IPO not found" });
    }
    res.json(ipo);
  });

  // Watchlist Routes
  app.get(api.watchlist.list.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = (req.user as any).claims.sub;
    const watchlist = await storage.getWatchlist(userId);
    res.json(watchlist);
  });

  app.post(api.watchlist.add.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
      const { ipoId } = api.watchlist.add.input.parse(req.body);
      const userId = (req.user as any).claims.sub;
      
      const ipo = await storage.getIpo(ipoId);
      if (!ipo) {
        return res.status(404).json({ message: "IPO not found" });
      }

      const item = await storage.addToWatchlist(userId, ipoId);
      res.status(201).json(item);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ 
          message: err.errors[0].message,
          field: err.errors[0].path.join('.')
        });
      }
      throw err;
    }
  });

  app.delete(api.watchlist.remove.path, async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const userId = (req.user as any).claims.sub;
    await storage.removeFromWatchlist(userId, Number(req.params.id));
    res.status(204).send();
  });

  // Admin/Sync Routes - Protected by authentication
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Unauthorized - Please sign in" });
    }
    next();
  };

  app.get("/api/admin/sync/test", requireAuth, async (req, res) => {
    try {
      const result = await testScraper();
      res.json(result);
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  app.post("/api/admin/sync", requireAuth, async (req, res) => {
    try {
      console.log("🔄 Starting IPO data sync from Chittorgarh...");
      
      const scrapedIpos = await scrapeAndTransformIPOs();
      
      let created = 0;
      let updated = 0;
      
      for (const ipo of scrapedIpos) {
        const existing = await storage.getIpoBySymbol(ipo.symbol);
        await storage.upsertIpo(ipo);
        
        if (existing) {
          updated++;
        } else {
          created++;
        }
      }
      
      console.log(`✅ Sync complete: ${created} created, ${updated} updated`);
      
      res.json({
        success: true,
        message: `Synced ${scrapedIpos.length} IPOs`,
        created,
        updated,
        total: scrapedIpos.length,
      });
    } catch (error) {
      console.error("Sync failed:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Sync failed" 
      });
    }
  });

  app.get("/api/admin/stats", requireAuth, async (req, res) => {
    const count = await storage.getIpoCount();
    const ipos = await storage.getIpos();
    
    const stats = {
      total: count,
      upcoming: ipos.filter(i => i.status === "upcoming").length,
      open: ipos.filter(i => i.status === "open").length,
      closed: ipos.filter(i => i.status === "closed").length,
      withScores: ipos.filter(i => i.overallScore !== null).length,
      avgScore: ipos.filter(i => i.overallScore !== null)
        .reduce((sum, i) => sum + (i.overallScore || 0), 0) / 
        (ipos.filter(i => i.overallScore !== null).length || 1),
    };
    
    res.json(stats);
  });

  // AI Analysis Routes
  app.post("/api/ipos/:id/analyze", requireAuth, async (req, res) => {
    try {
      const ipo = await storage.getIpo(Number(req.params.id));
      if (!ipo) {
        return res.status(404).json({ message: "IPO not found" });
      }

      const analysis = await analyzeIpo(ipo);
      
      // Update IPO with AI analysis
      const updated = await storage.updateIpo(ipo.id, {
        aiSummary: analysis.summary,
        aiRecommendation: analysis.recommendation,
      });

      res.json({
        success: true,
        analysis,
        ipo: updated,
      });
    } catch (error) {
      console.error("AI analysis error:", error);
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Analysis failed" 
      });
    }
  });

  // Alert Preferences Routes
  app.get("/api/alerts/preferences", requireAuth, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const prefs = await storage.getAlertPreferences(userId);
    res.json(prefs || {
      emailEnabled: false,
      alertOnNewIpo: true,
      alertOnGmpChange: true,
      alertOnOpenDate: true,
      alertOnWatchlistOnly: false,
    });
  });

  app.post("/api/alerts/preferences", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const validatedData = insertAlertPreferencesSchema.partial().parse(req.body);
      const prefs = await storage.upsertAlertPreferences(userId, validatedData);
      res.json(prefs);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get("/api/alerts/logs", requireAuth, async (req, res) => {
    const userId = (req.user as any).claims.sub;
    const logs = await storage.getAlertLogs(userId, 50);
    res.json(logs);
  });

  // Test alert sending (admin only)
  app.post("/api/admin/test-alert/:id", requireAuth, async (req, res) => {
    try {
      const userId = (req.user as any).claims.sub;
      const ipo = await storage.getIpo(Number(req.params.id));
      if (!ipo) {
        return res.status(404).json({ message: "IPO not found" });
      }

      const prefs = await storage.getAlertPreferences(userId);
      const results = { email: false };

      if (prefs?.emailEnabled && prefs.email) {
        results.email = await sendIpoEmailAlert(prefs.email, ipo, "new_ipo");
        await storage.createAlertLog({
          userId,
          ipoId: ipo.id,
          alertType: "new_ipo",
          channel: "email",
          status: results.email ? "sent" : "failed",
          message: `Test alert for ${ipo.companyName}`,
        });
      }

      res.json({ success: true, results });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: error instanceof Error ? error.message : "Alert failed" 
      });
    }
  });

  // GMP History Routes
  app.get("/api/ipos/:id/gmp-history", async (req, res) => {
    const ipoId = Number(req.params.id);
    const days = Number(req.query.days) || 7;
    const history = await storage.getGmpHistory(ipoId, days);
    res.json(history);
  });

  // Peer Comparison Routes
  app.get("/api/ipos/:id/peers", async (req, res) => {
    const ipoId = Number(req.params.id);
    const peers = await storage.getPeerCompanies(ipoId);
    res.json(peers);
  });

  // Subscription Updates Routes
  app.get("/api/ipos/:id/subscriptions", async (req, res) => {
    const ipoId = Number(req.params.id);
    const updates = await storage.getSubscriptionUpdates(ipoId);
    res.json(updates);
  });

  app.get("/api/ipos/:id/subscription/latest", async (req, res) => {
    const ipoId = Number(req.params.id);
    const latest = await storage.getLatestSubscription(ipoId);
    res.json(latest || null);
  });

  // Fund Utilization Routes
  app.get("/api/ipos/:id/fund-utilization", async (req, res) => {
    const ipoId = Number(req.params.id);
    const utilization = await storage.getFundUtilization(ipoId);
    res.json(utilization);
  });

  // IPO Timeline/Calendar Routes
  app.get("/api/ipos/:id/timeline", async (req, res) => {
    const ipoId = Number(req.params.id);
    const timeline = await storage.getIpoTimeline(ipoId);
    res.json(timeline);
  });

  app.get("/api/calendar/events", async (req, res) => {
    const days = Number(req.query.days) || 30;
    const events = await storage.getAllUpcomingEvents(days);
    res.json(events);
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingIpos = await storage.getIpos();
  if (existingIpos.length === 0) {
    console.log("Seeding database with initial Indian IPOs with financial data...");
    
    const seedIpos = [
      {
        symbol: "SWIGGY",
        companyName: "Swiggy Limited",
        priceRange: "₹371 - ₹390",
        totalShares: "293M",
        expectedDate: new Date("2024-11-13").toISOString(),
        status: "closed",
        description: "India's leading consumer technology platform offering food delivery, quick commerce, and more.",
        sector: "Consumer Technology",
        revenueGrowth: 35.2,
        ebitdaMargin: -8.5,
        patMargin: -12.3,
        roe: -15.2,
        roce: -10.8,
        debtToEquity: 0.4,
        peRatio: null,
        sectorPeMedian: 45,
        issueSize: "₹11,300 Cr",
        freshIssue: 0.42,
        ofsRatio: 0.58,
        lotSize: 38,
        minInvestment: "₹14,820",
        gmp: 8,
        subscriptionQib: 6.02,
        subscriptionHni: 0.41,
        subscriptionRetail: 1.14,
        promoterHolding: 35.5,
        postIpoPromoterHolding: 27.8,
      },
      {
        symbol: "HYUNDAI",
        companyName: "Hyundai Motor India",
        priceRange: "₹1865 - ₹1960",
        totalShares: "142M",
        expectedDate: new Date("2024-10-22").toISOString(),
        status: "closed",
        description: "Subsidiary of Hyundai Motor Company, the second largest automobile manufacturer in India.",
        sector: "Automobile",
        revenueGrowth: 18.5,
        ebitdaMargin: 14.2,
        patMargin: 8.9,
        roe: 28.5,
        roce: 32.1,
        debtToEquity: 0.12,
        peRatio: 26,
        sectorPeMedian: 22,
        issueSize: "₹27,870 Cr",
        freshIssue: 0,
        ofsRatio: 1.0,
        lotSize: 7,
        minInvestment: "₹13,720",
        gmp: -30,
        subscriptionQib: 6.97,
        subscriptionHni: 0.60,
        subscriptionRetail: 0.50,
        promoterHolding: 100,
        postIpoPromoterHolding: 82.5,
      },
      {
        symbol: "WAREE",
        companyName: "Waaree Energies Ltd",
        priceRange: "₹1427 - ₹1503",
        totalShares: "28M",
        expectedDate: new Date("2024-10-28").toISOString(),
        status: "closed",
        description: "Largest manufacturer of solar PV modules in India with focus on renewable energy.",
        sector: "Renewable Energy",
        revenueGrowth: 68.4,
        ebitdaMargin: 18.7,
        patMargin: 11.2,
        roe: 38.5,
        roce: 42.3,
        debtToEquity: 0.28,
        peRatio: 35,
        sectorPeMedian: 42,
        issueSize: "₹4,321 Cr",
        freshIssue: 0.78,
        ofsRatio: 0.22,
        lotSize: 9,
        minInvestment: "₹13,527",
        gmp: 1650,
        subscriptionQib: 209.91,
        subscriptionHni: 362.47,
        subscriptionRetail: 12.14,
        promoterHolding: 77.2,
        postIpoPromoterHolding: 61.5,
      },
      {
        symbol: "ZINKA",
        companyName: "Zinka Logistics Solution (BlackBuck)",
        priceRange: "₹259 - ₹273",
        totalShares: "40M",
        expectedDate: new Date("2024-11-21").toISOString(),
        status: "upcoming",
        description: "India's largest digital platform for truck operators providing payments, telematics, and load marketplace.",
        sector: "Logistics Technology",
        revenueGrowth: 42.8,
        ebitdaMargin: -22.5,
        patMargin: -28.3,
        roe: -18.5,
        roce: -12.4,
        debtToEquity: 0.05,
        peRatio: null,
        sectorPeMedian: 35,
        issueSize: "₹1,114 Cr",
        freshIssue: 0.63,
        ofsRatio: 0.37,
        lotSize: 54,
        minInvestment: "₹14,742",
        gmp: 0,
        promoterHolding: 12.5,
        postIpoPromoterHolding: 8.2,
      },
      {
        symbol: "NTPCGR",
        companyName: "NTPC Green Energy",
        priceRange: "₹102 - ₹108",
        totalShares: "925M",
        expectedDate: new Date("2024-11-27").toISOString(),
        status: "upcoming",
        description: "Renewable energy arm of NTPC focused on solar and wind power projects with 14.7 GW capacity.",
        sector: "Renewable Energy",
        revenueGrowth: 85.2,
        ebitdaMargin: 78.5,
        patMargin: 32.8,
        roe: 8.2,
        roce: 6.8,
        debtToEquity: 2.85,
        peRatio: 218,
        sectorPeMedian: 42,
        issueSize: "₹10,000 Cr",
        freshIssue: 1.0,
        ofsRatio: 0,
        lotSize: 138,
        minInvestment: "₹14,904",
        gmp: 1,
        promoterHolding: 100,
        postIpoPromoterHolding: 89.7,
      },
      {
        symbol: "AFCONS",
        companyName: "Afcons Infrastructure Ltd",
        priceRange: "₹440 - ₹463",
        totalShares: "54M",
        expectedDate: new Date("2024-11-29").toISOString(),
        status: "open",
        description: "Leading infrastructure construction company specializing in marine, oil & gas, and urban infrastructure projects.",
        sector: "Infrastructure",
        revenueGrowth: 22.4,
        ebitdaMargin: 11.8,
        patMargin: 5.2,
        roe: 14.8,
        roce: 18.2,
        debtToEquity: 0.68,
        peRatio: 22,
        sectorPeMedian: 28,
        issueSize: "₹5,430 Cr",
        freshIssue: 0.55,
        ofsRatio: 0.45,
        lotSize: 32,
        minInvestment: "₹14,816",
        gmp: 45,
        subscriptionQib: 12.5,
        subscriptionHni: 8.2,
        subscriptionRetail: 3.8,
        promoterHolding: 78.5,
        postIpoPromoterHolding: 65.2,
      },
      {
        symbol: "SAGILITY",
        companyName: "Sagility India Ltd",
        priceRange: "₹28 - ₹30",
        totalShares: "702M",
        expectedDate: new Date("2024-11-25").toISOString(),
        status: "upcoming",
        description: "Healthcare-focused technology and operations management company providing services to US healthcare payers.",
        sector: "Healthcare IT",
        revenueGrowth: 12.8,
        ebitdaMargin: 22.4,
        patMargin: 11.5,
        roe: 15.2,
        roce: 14.8,
        debtToEquity: 0.42,
        peRatio: 28,
        sectorPeMedian: 32,
        issueSize: "₹2,106 Cr",
        freshIssue: 0,
        ofsRatio: 1.0,
        lotSize: 500,
        minInvestment: "₹15,000",
        gmp: 2,
        promoterHolding: 100,
        postIpoPromoterHolding: 72.5,
      }
    ];

    for (const ipoData of seedIpos) {
      const scores = calculateIpoScore(ipoData);
      await storage.createIpo({
        ...ipoData,
        fundamentalsScore: scores.fundamentalsScore,
        valuationScore: scores.valuationScore,
        governanceScore: scores.governanceScore,
        overallScore: scores.overallScore,
        riskLevel: scores.riskLevel,
        redFlags: scores.redFlags,
        pros: scores.pros,
      });
    }
    console.log("Seeding complete with scores.");
  }
}
