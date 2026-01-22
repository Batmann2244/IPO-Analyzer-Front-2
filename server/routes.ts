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

  // Auto-sync from scraper on startup if database is empty
  await autoSyncOnStartup();

  return httpServer;
}

async function autoSyncOnStartup() {
  const existingIpos = await storage.getIpos();
  if (existingIpos.length === 0) {
    console.log("Database empty - attempting to fetch real IPO data from Chittorgarh...");
    
    try {
      const scrapedIpos = await scrapeAndTransformIPOs();
      
      if (scrapedIpos.length > 0) {
        for (const ipo of scrapedIpos) {
          await storage.createIpo(ipo);
        }
        console.log(`✅ Auto-synced ${scrapedIpos.length} IPOs from Chittorgarh`);
      } else {
        console.log("⚠️ No IPOs found from scraper. Use Admin panel to manually sync.");
      }
    } catch (error) {
      console.error("❌ Auto-sync failed:", error);
      console.log("💡 Use the Admin panel (/admin) to manually sync IPO data.");
    }
  }
}
