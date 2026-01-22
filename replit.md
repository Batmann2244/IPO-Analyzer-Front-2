# IPO Analyzer

## Overview

IPO Analyzer is a full-stack web application for tracking and analyzing Initial Public Offerings (IPOs) in the Indian market. The app functions as an **IPO screener and risk flagging tool** (not investment advice) that analyzes IPOs based on fundamentals, valuation, and governance. Users can browse upcoming, open, and closed IPOs, view computed scores and red flags, and add offerings to a personal watchlist.

## IPO Scoring System

### Score Categories
- **Fundamentals Score (40% weight)**: Revenue growth, ROE, ROCE, EBITDA margins, debt levels
- **Valuation Score (35% weight)**: P/E ratio vs sector median, absolute valuation metrics
- **Governance Score (25% weight)**: OFS ratio, promoter holding, stake dilution

### Risk Levels
- **Conservative**: Overall score >= 7.0 with minimal red flags
- **Moderate**: Overall score 5.0-7.0 or few red flags
- **Aggressive**: Overall score < 5.0 or significant red flags

### Red Flags Detected
- High OFS ratio (promoters aggressively exiting)
- Expensive P/E valuation vs listed peers
- Weak revenue growth
- High debt burden (D/E > 1.5)
- Low promoter holding
- Negative grey market premium
- Below-average ROE/ROCE

### Important Disclaimer
This is a screening tool only. Scores are computed from available data and should not be considered investment advice. Users should review the full DRHP/RHP and consult SEBI-registered advisors.

## User Preferences

Preferred communication style: Simple, everyday language.

## UI Design

### Design System (January 2026)
- **Style**: Clean, light IPOAlerts-inspired design
- **Background**: White/light colors (not dark theme)
- **Primary Color**: Orange (#F26522) - used for buttons, accents, highlights
- **Font**: Inter (sans-serif)
- **Cards**: Clean white cards with subtle borders and shadows
- **Status Badges**: Color-coded (green for Open, blue for Upcoming, gray for Closed)

### Key Pages
- **Landing** (`/`): Dark scrolling ticker with GMP%, hero section, API JSON preview, status tabs, FAQ accordion
- **Dashboard** (`/dashboard`): Stats cards, search, filters, IPO card grid
- **IPO Detail** (`/ipos/:id`): Score ring visualization, metrics cards, AI analysis section, GMP trend chart, peer comparison radar, subscription tracker, fund utilization chart
- **Calendar** (`/calendar`): Interactive calendar with IPO events, upcoming dates, alerts integration
- **Watchlist** (`/watchlist`): Tracked IPOs table with remove functionality
- **Settings** (`/settings`): Profile info, email alert preferences
- **Admin** (`/admin`): Data sync controls, database stats

### Landing Page Features (January 2026)
- **Dark Ticker Bar**: Scrolling bar showing IPO names with GMP percentages (e.g., "SAMPLE1 +25%")
- **API Preview Section**: Terminal-style code block displaying live JSON response with status tabs
- **FAQ Accordion**: Frequently Asked Questions with expandable accordion items
- **Hero Section**: "The near real-time API for IPOs in India" headline with CTAs

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Build Tool**: Vite with HMR support

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript (ESM modules)
- **API Design**: RESTful endpoints defined in shared route contracts (`shared/routes.ts`)
- **Validation**: Zod schemas for request/response validation
- **Session Management**: Express sessions with PostgreSQL store

### Data Layer
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Location**: `shared/schema.ts` for database models
- **Migrations**: Drizzle Kit for schema push (`npm run db:push`)

### Authentication
- **Provider**: Replit Auth (OpenID Connect)
- **Session Storage**: PostgreSQL-backed sessions via `connect-pg-simple`
- **User Management**: Automatic user upsert on login with profile sync

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # Reusable UI components
│   ├── hooks/           # Custom React hooks
│   ├── pages/           # Route page components
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── routes.ts        # API route definitions
│   ├── storage.ts       # Database operations
│   └── replit_integrations/auth/  # Auth module
├── shared/              # Shared types and schemas
│   ├── schema.ts        # Drizzle table definitions
│   ├── routes.ts        # API contract definitions
│   └── models/          # Domain models
└── migrations/          # Database migrations
```

### Key Design Patterns
- **Shared Types**: Database schemas and API contracts are defined in `shared/` and imported by both frontend and backend
- **Type-Safe API**: Zod schemas validate inputs and parse responses on both sides
- **Component Library**: shadcn/ui provides accessible, customizable primitives
- **Protected Routes**: Frontend `PrivateRoute` wrapper checks auth state before rendering

## Data Scraping & Sync

### Data Sources
- **Chittorgarh IPO Dashboard**: Main source for IPO listings, dates, issue size, price bands
- **Chittorgarh GMP Page**: Live Grey Market Premium data

### Scraper Service (`server/services/scraper.ts`)
- Uses axios + cheerio for HTML parsing
- Extracts IPO data: company name, symbol, dates, prices, lot size
- Fetches GMP data and merges with IPO records
- Automatically computes scores using the scoring engine

### Admin API Endpoints (Protected)
- `GET /api/admin/sync/test` - Test scraper connection
- `POST /api/admin/sync` - Trigger full data sync (upserts by symbol)
- `GET /api/admin/stats` - Get database statistics

### Admin UI
- Navigate to `/admin` after signing in
- View database stats (total, open, upcoming IPOs)
- Test connection to data source
- Manually trigger data sync

## AI Analysis

### Multi-Provider AI (`server/services/ai-analysis.ts`)
- Supports multiple LLM providers: **Gemini**, **Mistral**, or **OpenAI**
- Automatically detects which API key is configured (checks in order: GEMINI_API_KEY, MISTRAL_API_KEY, then OpenAI)
- Analyzes IPO fundamentals, valuation, and governance
- Generates summary, recommendation, and key insights
- Stores analysis in `aiSummary` and `aiRecommendation` fields

### AI Analysis Endpoint
- `POST /api/ipos/:id/analyze` - Generate AI analysis for specific IPO

## Alert Notifications

### Email Alerts (`server/services/email.ts`)
- Uses Resend API for email delivery
- Requires `RESEND_API_KEY` environment variable
- Sends formatted HTML emails with IPO details and scores

### Alert Preferences API
- `GET /api/alerts/preferences` - Get user alert settings
- `POST /api/alerts/preferences` - Update alert settings
- `GET /api/alerts/logs` - Get alert history

## Advanced Analytics Features

### GMP Trend Tracking
- `GET /api/ipos/:id/gmp-history` - Get 7-day GMP history for an IPO
- Displays daily GMP changes with trend visualization
- Helps investors understand market sentiment evolution

### Peer Comparison Engine
- `GET /api/ipos/:id/peers` - Get listed peer companies for comparison
- Compares revenue growth, ROE, ROCE, P/E, EBITDA margin
- Radar chart visualization for easy comparison

### Live Subscription Tracker
- `GET /api/ipos/:id/subscriptions` - Get subscription update history
- `GET /api/ipos/:id/subscription/latest` - Get latest subscription data
- Tracks QIB, NII/HNI, and Retail subscription ratios

### Fund Utilization Tracking
- `GET /api/ipos/:id/fund-utilization` - Get fund utilization breakdown
- Shows planned allocation: debt repayment, capex, working capital, etc.
- Track actual vs planned utilization post-listing

### IPO Calendar
- `GET /api/calendar/events` - Get all upcoming IPO events
- `GET /api/ipos/:id/timeline` - Get timeline for specific IPO
- Tracks DRHP filing, price band, open/close dates, allotment, listing

### Alert Types
- New IPO announcements
- GMP (Grey Market Premium) changes
- IPO opening date reminders
- AI analysis completion

## External Dependencies

### Database
- **PostgreSQL**: Primary data store (connection via `DATABASE_URL` environment variable)
- **Tables**: `users`, `sessions`, `ipos`, `watchlist`, `alert_preferences`, `alert_logs`, `gmp_history`, `peer_companies`, `subscription_updates`, `fund_utilization`, `ipo_timeline`

### Authentication
- **Replit Auth**: OpenID Connect provider (`ISSUER_URL`, `REPL_ID` environment variables)
- **Session Secret**: Required via `SESSION_SECRET` environment variable

### Third-Party Libraries
- **UI Components**: Radix UI primitives (dialog, dropdown, select, etc.)
- **Date Handling**: date-fns for formatting
- **HTTP Client**: Native fetch with TanStack Query wrappers

### Development Tools
- **Vite Plugins**: Replit-specific plugins for dev experience (cartographer, dev-banner, error overlay)
- **Build**: esbuild for server bundling, Vite for client

### Environment Variables Required
- `DATABASE_URL` - PostgreSQL connection string
- `SESSION_SECRET` - Secret for session encryption
- `REPL_ID` - Replit environment identifier (auto-set on Replit)
- `ISSUER_URL` - OpenID Connect issuer (defaults to Replit's OIDC)
- `RESEND_API_KEY` - (Optional) Resend API key for email alerts
- `GEMINI_API_KEY` - (Optional) Google Gemini API key for AI analysis
- `MISTRAL_API_KEY` - (Optional) Mistral API key for AI analysis