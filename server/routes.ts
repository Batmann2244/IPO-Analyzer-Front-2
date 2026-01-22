import type { Express } from "express";
import type { Server } from "http"; // Correct import
import { createServer } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { insertIpoSchema } from "@shared/schema";
import { setupAuth, registerAuthRoutes } from "./replit_integrations/auth";
import { z } from "zod";

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

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingIpos = await storage.getIpos();
  if (existingIpos.length === 0) {
    console.log("Seeding database with initial Indian IPOs...");
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
      },
      {
        symbol: "ZINKA",
        companyName: "Zinka Logistics Solution (BlackBuck)",
        priceRange: "₹259 - ₹273",
        totalShares: "40M",
        expectedDate: new Date("2024-11-21").toISOString(),
        status: "upcoming",
        description: "India's largest digital platform for truck operators.",
        sector: "Logistics",
      },
      {
        symbol: "NTPCGR",
        companyName: "NTPC Green Energy",
        priceRange: "₹102 - ₹108",
        totalShares: "925M",
        expectedDate: new Date("2024-11-27").toISOString(),
        status: "upcoming",
        description: "Renewable energy arm of NTPC focused on solar and wind power projects.",
        sector: "Energy",
      }
    ];

    for (const ipo of seedIpos) {
      await storage.createIpo(ipo);
    }
    console.log("Seeding complete.");
  }
}
