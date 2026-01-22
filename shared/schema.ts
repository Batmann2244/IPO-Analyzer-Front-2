import { pgTable, text, serial, integer, boolean, timestamp, date, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

// === TABLE DEFINITIONS ===
export const ipos = pgTable("ipos", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull().unique(),
  companyName: text("company_name").notNull(),
  priceRange: text("price_range").notNull(),
  totalShares: text("total_shares"),
  expectedDate: date("expected_date"),
  status: text("status").notNull(), // 'upcoming', 'open', 'closed'
  description: text("description"),
  sector: text("sector"),
  
  // Financial Metrics
  revenueGrowth: real("revenue_growth"), // 3-year CAGR %
  ebitdaMargin: real("ebitda_margin"), // %
  patMargin: real("pat_margin"), // Profit After Tax margin %
  roe: real("roe"), // Return on Equity %
  roce: real("roce"), // Return on Capital Employed %
  debtToEquity: real("debt_to_equity"), // Debt/Equity ratio
  
  // Valuation Metrics
  peRatio: real("pe_ratio"), // Price to Earnings
  pbRatio: real("pb_ratio"), // Price to Book
  sectorPeMedian: real("sector_pe_median"), // Median P/E for sector
  
  // Offer Details
  issueSize: text("issue_size"), // Total issue size in Cr
  freshIssue: real("fresh_issue"), // % of fresh issue
  ofsRatio: real("ofs_ratio"), // Offer for Sale ratio (0-1)
  lotSize: integer("lot_size"),
  minInvestment: text("min_investment"),
  
  // Market Sentiment
  gmp: integer("gmp"), // Grey Market Premium in Rs
  subscriptionQib: real("subscription_qib"), // QIB subscription times
  subscriptionHni: real("subscription_hni"), // HNI subscription times
  subscriptionRetail: real("subscription_retail"), // Retail subscription times
  
  // Promoter Info
  promoterHolding: real("promoter_holding"), // Pre-IPO promoter holding %
  postIpoPromoterHolding: real("post_ipo_promoter_holding"), // Post-IPO %
  
  // Computed Scores (0-10 scale)
  fundamentalsScore: real("fundamentals_score"),
  valuationScore: real("valuation_score"),
  governanceScore: real("governance_score"),
  overallScore: real("overall_score"),
  
  // Risk Assessment
  riskLevel: text("risk_level"), // 'conservative', 'moderate', 'aggressive'
  redFlags: text("red_flags").array(), // Array of red flag strings
  pros: text("pros").array(), // Array of positive points
  
  // AI Analysis
  aiSummary: text("ai_summary"),
  aiRecommendation: text("ai_recommendation"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const watchlist = pgTable("watchlist", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id),
  ipoId: integer("ipo_id").notNull().references(() => ipos.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const iposRelations = relations(ipos, ({ many }) => ({
  watchlistItems: many(watchlist),
}));

export const watchlistRelations = relations(watchlist, ({ one }) => ({
  user: one(users, {
    fields: [watchlist.userId],
    references: [users.id],
  }),
  ipo: one(ipos, {
    fields: [watchlist.ipoId],
    references: [ipos.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertIpoSchema = createInsertSchema(ipos).omit({ id: true, createdAt: true, updatedAt: true });
export const insertWatchlistSchema = createInsertSchema(watchlist).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===
export type Ipo = typeof ipos.$inferSelect;
export type InsertIpo = z.infer<typeof insertIpoSchema>;
export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;

// API Responses
export type IpoResponse = Ipo;
export type WatchlistResponse = WatchlistItem & { ipo: Ipo };

// Score Summary Type for frontend
export type IpoScoreSummary = {
  fundamentals: number;
  valuation: number;
  governance: number;
  overall: number;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  redFlags: string[];
  pros: string[];
};
