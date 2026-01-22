import { pgTable, text, serial, integer, boolean, timestamp, date, real } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";
export * from "./models/chat";

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

export const alertPreferences = pgTable("alert_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id).unique(),
  emailEnabled: boolean("email_enabled").default(false),
  email: text("email"),
  telegramEnabled: boolean("telegram_enabled").default(false),
  telegramChatId: text("telegram_chat_id"),
  alertOnNewIpo: boolean("alert_on_new_ipo").default(true),
  alertOnGmpChange: boolean("alert_on_gmp_change").default(true),
  alertOnOpenDate: boolean("alert_on_open_date").default(true),
  alertOnWatchlistOnly: boolean("alert_on_watchlist_only").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const alertLogs = pgTable("alert_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  ipoId: integer("ipo_id").references(() => ipos.id),
  alertType: text("alert_type").notNull(), // 'new_ipo', 'gmp_change', 'open_date', 'ai_analysis'
  channel: text("channel").notNull(), // 'email'
  status: text("status").notNull(), // 'sent', 'failed', 'pending'
  message: text("message"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow(),
});

// GMP History for trend tracking
export const gmpHistory = pgTable("gmp_history", {
  id: serial("id").primaryKey(),
  ipoId: integer("ipo_id").notNull().references(() => ipos.id),
  gmp: integer("gmp").notNull(),
  gmpPercentage: real("gmp_percentage"),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// Peer companies for comparison
export const peerCompanies = pgTable("peer_companies", {
  id: serial("id").primaryKey(),
  ipoId: integer("ipo_id").notNull().references(() => ipos.id),
  companyName: text("company_name").notNull(),
  symbol: text("symbol").notNull(),
  marketCap: real("market_cap"), // in Cr
  peRatio: real("pe_ratio"),
  pbRatio: real("pb_ratio"),
  roe: real("roe"),
  roce: real("roce"),
  revenueGrowth: real("revenue_growth"),
  ebitdaMargin: real("ebitda_margin"),
  debtToEquity: real("debt_to_equity"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Subscription updates (live tracking)
export const subscriptionUpdates = pgTable("subscription_updates", {
  id: serial("id").primaryKey(),
  ipoId: integer("ipo_id").notNull().references(() => ipos.id),
  qibSubscription: real("qib_subscription"),
  niiSubscription: real("nii_subscription"), // HNI/NII
  retailSubscription: real("retail_subscription"),
  totalSubscription: real("total_subscription"),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// Fund utilization tracking
export const fundUtilization = pgTable("fund_utilization", {
  id: serial("id").primaryKey(),
  ipoId: integer("ipo_id").notNull().references(() => ipos.id),
  category: text("category").notNull(), // 'debt_repayment', 'capex', 'working_capital', 'acquisitions', 'general_corporate'
  plannedAmount: real("planned_amount"), // in Cr
  plannedPercentage: real("planned_percentage"),
  actualAmount: real("actual_amount"), // in Cr (tracked post-listing)
  actualPercentage: real("actual_percentage"),
  status: text("status"), // 'planned', 'in_progress', 'completed'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// IPO Timeline/Calendar events
export const ipoTimeline = pgTable("ipo_timeline", {
  id: serial("id").primaryKey(),
  ipoId: integer("ipo_id").notNull().references(() => ipos.id),
  eventType: text("event_type").notNull(), // 'drhp_filing', 'price_band', 'open_date', 'close_date', 'allotment', 'refund', 'listing'
  eventDate: date("event_date"),
  eventTime: text("event_time"), // e.g., "10:00 AM"
  description: text("description"),
  isConfirmed: boolean("is_confirmed").default(false),
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
export const insertAlertPreferencesSchema = createInsertSchema(alertPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAlertLogSchema = createInsertSchema(alertLogs).omit({ id: true, createdAt: true });
export const insertGmpHistorySchema = createInsertSchema(gmpHistory).omit({ id: true, recordedAt: true });
export const insertPeerCompanySchema = createInsertSchema(peerCompanies).omit({ id: true, createdAt: true });
export const insertSubscriptionUpdateSchema = createInsertSchema(subscriptionUpdates).omit({ id: true, recordedAt: true });
export const insertFundUtilizationSchema = createInsertSchema(fundUtilization).omit({ id: true, createdAt: true, updatedAt: true });
export const insertIpoTimelineSchema = createInsertSchema(ipoTimeline).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===
export type Ipo = typeof ipos.$inferSelect;
export type InsertIpo = z.infer<typeof insertIpoSchema>;
export type WatchlistItem = typeof watchlist.$inferSelect;
export type InsertWatchlistItem = z.infer<typeof insertWatchlistSchema>;
export type AlertPreferences = typeof alertPreferences.$inferSelect;
export type InsertAlertPreferences = z.infer<typeof insertAlertPreferencesSchema>;
export type AlertLog = typeof alertLogs.$inferSelect;
export type InsertAlertLog = z.infer<typeof insertAlertLogSchema>;
export type GmpHistoryEntry = typeof gmpHistory.$inferSelect;
export type InsertGmpHistory = z.infer<typeof insertGmpHistorySchema>;
export type PeerCompany = typeof peerCompanies.$inferSelect;
export type InsertPeerCompany = z.infer<typeof insertPeerCompanySchema>;
export type SubscriptionUpdate = typeof subscriptionUpdates.$inferSelect;
export type InsertSubscriptionUpdate = z.infer<typeof insertSubscriptionUpdateSchema>;
export type FundUtilizationEntry = typeof fundUtilization.$inferSelect;
export type InsertFundUtilization = z.infer<typeof insertFundUtilizationSchema>;
export type IpoTimelineEvent = typeof ipoTimeline.$inferSelect;
export type InsertIpoTimeline = z.infer<typeof insertIpoTimelineSchema>;

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
