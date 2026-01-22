import { useRoute, Link } from "wouter";
import { useIpo, useAddToWatchlist, useWatchlist } from "@/hooks/use-ipos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Calendar, 
  IndianRupee, 
  PieChart, 
  FileText, 
  Briefcase,
  Check,
  Plus,
  Layers,
  TrendingUp,
  AlertTriangle,
  Shield,
  Gauge,
  BarChart3,
  Users,
  Target,
  CheckCircle2,
  XCircle,
  Percent,
  Building2
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

function ScoreBar({ label, score, icon: Icon }: { label: string; score: number | null; icon: React.ElementType }) {
  if (score === null || score === undefined) return null;
  
  const percentage = (score / 10) * 100;
  
  const getColor = (s: number) => {
    if (s >= 7.5) return { bg: "bg-emerald-500", glow: "shadow-emerald-500/30" };
    if (s >= 6) return { bg: "bg-blue-500", glow: "shadow-blue-500/30" };
    if (s >= 4) return { bg: "bg-amber-500", glow: "shadow-amber-500/30" };
    return { bg: "bg-red-500", glow: "shadow-red-500/30" };
  };
  
  const colors = getColor(score);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-white/60">{label}</span>
        </div>
        <span className="font-mono font-bold text-white">{score.toFixed(1)}/10</span>
      </div>
      <div className="h-2 bg-white/[0.05] rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full ${colors.bg} shadow-lg ${colors.glow} transition-all duration-700 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function OverallScoreRing({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  
  const percentage = (score / 10) * 100;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getScoreColor = (s: number) => {
    if (s >= 7.5) return { stroke: "#10b981", text: "text-emerald-400", label: "Strong" };
    if (s >= 6) return { stroke: "#3b82f6", text: "text-blue-400", label: "Good" };
    if (s >= 4) return { stroke: "#f59e0b", text: "text-amber-400", label: "Fair" };
    return { stroke: "#ef4444", text: "text-red-400", label: "Weak" };
  };
  
  const colors = getScoreColor(score);
  
  return (
    <div className="relative flex flex-col items-center">
      <svg width="140" height="140" className="-rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
        />
        <circle
          cx="70"
          cy="70"
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out drop-shadow-lg"
          style={{ filter: `drop-shadow(0 0 12px ${colors.stroke}50)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono font-bold text-4xl ${colors.text}`}>{score.toFixed(1)}</span>
        <span className="text-xs text-white/40 uppercase tracking-wider mt-1">{colors.label}</span>
      </div>
    </div>
  );
}

function RiskBadge({ riskLevel }: { riskLevel: string | null }) {
  if (!riskLevel) return null;
  
  const config = {
    conservative: { 
      bg: "bg-emerald-500/10", 
      border: "border-emerald-500/30", 
      text: "text-emerald-400",
      icon: Shield,
      label: "Conservative Risk"
    },
    moderate: { 
      bg: "bg-amber-500/10", 
      border: "border-amber-500/30", 
      text: "text-amber-400",
      icon: Target,
      label: "Moderate Risk"
    },
    aggressive: { 
      bg: "bg-red-500/10", 
      border: "border-red-500/30", 
      text: "text-red-400",
      icon: AlertTriangle,
      label: "Aggressive Risk"
    },
  };
  
  const style = config[riskLevel as keyof typeof config] || config.moderate;
  const Icon = style.icon;
  
  return (
    <div className={`${style.bg} ${style.border} border rounded-xl p-4 flex items-center gap-3`}>
      <Icon className={`w-5 h-5 ${style.text}`} />
      <div>
        <div className={`font-semibold ${style.text}`}>{style.label}</div>
        <div className="text-xs text-white/40">Based on fundamentals & valuation</div>
      </div>
    </div>
  );
}

function MetricRow({ label, value, suffix = "", highlight = false }: { 
  label: string; 
  value: number | string | null | undefined; 
  suffix?: string;
  highlight?: boolean;
}) {
  if (value === null || value === undefined) return null;
  
  const displayValue = typeof value === 'number' ? value.toFixed(1) : value;
  const isNegative = typeof value === 'number' && value < 0;
  
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.05] last:border-0">
      <span className="text-sm text-white/50">{label}</span>
      <span className={`font-mono font-medium ${
        highlight 
          ? isNegative ? "text-red-400" : "text-emerald-400"
          : "text-white"
      }`}>
        {displayValue}{suffix}
      </span>
    </div>
  );
}

export default function IpoDetail() {
  const [match, params] = useRoute("/ipos/:id");
  const id = parseInt(params?.id || "0");
  const { data: ipo, isLoading } = useIpo(id);
  const { data: watchlist } = useWatchlist();
  const { mutate: addToWatchlist, isPending } = useAddToWatchlist();
  const { toast } = useToast();

  const isWatching = watchlist?.some(item => item.ipoId === id);

  const handleWatch = () => {
    if (isWatching || !ipo) return;
    addToWatchlist(ipo.id, {
      onSuccess: () => {
        toast({ title: "Added to Watchlist", description: `Tracking ${ipo.symbol}` });
      }
    });
  };

  const getStatusStyles = (status: string) => {
    switch(status.toLowerCase()) {
      case 'open': return "badge-glow-green";
      case 'upcoming': return "badge-glow-blue";
      default: return "bg-white/[0.05] text-white/50 border-white/[0.08]";
    }
  };

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center">
      <div className="relative">
        <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full" />
        <TrendingUp className="w-8 h-8 animate-pulse text-purple-400 relative z-10" />
      </div>
    </div>
  );
  
  if (!ipo) return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <p className="text-white/60 text-lg">IPO not found</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto animate-in fade-in duration-500 pb-12">
      <Link href="/dashboard">
        <Button 
          variant="ghost" 
          className="mb-6 pl-0 text-white/40 hover:text-white hover:bg-transparent"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>

      {/* Header Card */}
      <div className="premium-card mb-6">
        <div className="p-8 border-b border-white/[0.05] bg-gradient-to-r from-white/[0.02] to-transparent">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-4xl font-display font-bold text-white">{ipo.symbol}</h1>
                <Badge 
                  variant="outline"
                  className={`text-xs font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full border capitalize ${getStatusStyles(ipo.status)}`}
                >
                  {ipo.status}
                </Badge>
              </div>
              <h2 className="text-xl text-white/50 font-medium mb-4">{ipo.companyName}</h2>
              <div className="flex flex-wrap items-center gap-3">
                {ipo.sector && (
                  <Badge variant="outline" className="bg-white/[0.02] border-white/[0.08] text-white/60">
                    <Layers className="w-3 h-3 mr-1.5 text-cyan-400" />
                    {ipo.sector}
                  </Badge>
                )}
                {ipo.issueSize && (
                  <Badge variant="outline" className="bg-white/[0.02] border-white/[0.08] text-white/60">
                    <Building2 className="w-3 h-3 mr-1.5 text-purple-400" />
                    {ipo.issueSize}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Button 
                size="lg" 
                className={`rounded-xl transition-all duration-300 ${
                  isWatching 
                    ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' 
                    : 'bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-400 hover:to-violet-500 text-white border-0 shadow-lg shadow-purple-500/20'
                }`}
                onClick={handleWatch}
                disabled={isWatching || isPending}
                data-testid="button-add-watchlist"
              >
                {isWatching ? (
                  <><Check className="mr-2 h-5 w-5" /> In Watchlist</>
                ) : (
                  <><Plus className="mr-2 h-5 w-5" /> Add to Watchlist</>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-white/[0.05]">
          <div className="bg-[#0a0a0a] p-5">
            <div className="text-xs text-white/40 mb-1">Price Range</div>
            <div className="font-mono font-bold text-lg text-white">{ipo.priceRange}</div>
          </div>
          <div className="bg-[#0a0a0a] p-5">
            <div className="text-xs text-white/40 mb-1">Expected Date</div>
            <div className="font-medium text-lg text-white">
              {ipo.expectedDate ? format(new Date(ipo.expectedDate), "dd MMM yyyy") : "TBA"}
            </div>
          </div>
          <div className="bg-[#0a0a0a] p-5">
            <div className="text-xs text-white/40 mb-1">Lot Size</div>
            <div className="font-mono font-bold text-lg text-white">{ipo.lotSize || "TBA"} shares</div>
          </div>
          <div className="bg-[#0a0a0a] p-5">
            <div className="text-xs text-white/40 mb-1">Min Investment</div>
            <div className="font-mono font-bold text-lg text-white">{ipo.minInvestment || "TBA"}</div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Left Column - Analysis */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Score Breakdown */}
          <div className="premium-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-display font-bold text-white flex items-center gap-2">
                <Gauge className="w-5 h-5 text-purple-400" />
                IPO Score Analysis
              </h3>
              <div className="text-xs text-white/40 bg-white/[0.03] px-3 py-1.5 rounded-full border border-white/[0.05]">
                Screener Tool Only - Not Investment Advice
              </div>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="flex justify-center items-center">
                <OverallScoreRing score={ipo.overallScore} />
              </div>
              <div className="space-y-5">
                <ScoreBar label="Fundamentals" score={ipo.fundamentalsScore} icon={BarChart3} />
                <ScoreBar label="Valuation" score={ipo.valuationScore} icon={Target} />
                <ScoreBar label="Governance" score={ipo.governanceScore} icon={Shield} />
              </div>
            </div>
            
            <div className="mt-6">
              <RiskBadge riskLevel={ipo.riskLevel} />
            </div>
          </div>

          {/* Red Flags & Positives */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Red Flags */}
            {ipo.redFlags && ipo.redFlags.length > 0 && (
              <div className="premium-card p-6 border-red-500/20">
                <h3 className="text-base font-display font-bold text-red-400 mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5" />
                  Risk Flags ({ipo.redFlags.length})
                </h3>
                <ul className="space-y-3">
                  {ipo.redFlags.map((flag, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-white/60">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                      {flag}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Positives */}
            {ipo.pros && ipo.pros.length > 0 && (
              <div className="premium-card p-6 border-emerald-500/20">
                <h3 className="text-base font-display font-bold text-emerald-400 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5" />
                  Positives ({ipo.pros.length})
                </h3>
                <ul className="space-y-3">
                  {ipo.pros.map((pro, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-white/60">
                      <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                      {pro}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Company Overview */}
          <div className="premium-card p-6">
            <h3 className="text-lg font-display font-bold text-white mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-purple-400" />
              Company Overview
            </h3>
            <p className="text-white/50 leading-relaxed text-base">
              {ipo.description || "Detailed prospectus information will be available closer to the offering date."}
            </p>
          </div>
        </div>

        {/* Right Column - Metrics */}
        <div className="space-y-6">
          {/* Financial Metrics */}
          <div className="premium-card p-6">
            <h4 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-purple-400" />
              Financial Metrics
            </h4>
            <div className="space-y-1">
              <MetricRow label="Revenue Growth (CAGR)" value={ipo.revenueGrowth} suffix="%" highlight />
              <MetricRow label="EBITDA Margin" value={ipo.ebitdaMargin} suffix="%" highlight />
              <MetricRow label="PAT Margin" value={ipo.patMargin} suffix="%" highlight />
              <MetricRow label="ROE" value={ipo.roe} suffix="%" highlight />
              <MetricRow label="ROCE" value={ipo.roce} suffix="%" highlight />
              <MetricRow label="Debt/Equity" value={ipo.debtToEquity} />
            </div>
          </div>

          {/* Valuation */}
          <div className="premium-card p-6">
            <h4 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-purple-400" />
              Valuation
            </h4>
            <div className="space-y-1">
              <MetricRow label="P/E Ratio" value={ipo.peRatio} suffix="x" />
              <MetricRow label="P/B Ratio" value={ipo.pbRatio} suffix="x" />
              <MetricRow label="Sector P/E Median" value={ipo.sectorPeMedian} suffix="x" />
            </div>
          </div>

          {/* Offer Structure */}
          <div className="premium-card p-6">
            <h4 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-purple-400" />
              Offer Structure
            </h4>
            <div className="space-y-1">
              <MetricRow label="Fresh Issue" value={ipo.freshIssue !== null && ipo.freshIssue !== undefined ? (ipo.freshIssue * 100) : null} suffix="%" />
              <MetricRow label="OFS Ratio" value={ipo.ofsRatio !== null && ipo.ofsRatio !== undefined ? (ipo.ofsRatio * 100) : null} suffix="%" />
              <MetricRow label="Promoter Holding (Pre)" value={ipo.promoterHolding} suffix="%" />
              <MetricRow label="Promoter Holding (Post)" value={ipo.postIpoPromoterHolding} suffix="%" />
            </div>
          </div>

          {/* Subscription Data */}
          {(ipo.subscriptionQib || ipo.subscriptionHni || ipo.subscriptionRetail) && (
            <div className="premium-card p-6">
              <h4 className="font-bold text-white text-sm mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Subscription Data
              </h4>
              <div className="space-y-1">
                <MetricRow label="QIB" value={ipo.subscriptionQib} suffix="x" />
                <MetricRow label="HNI" value={ipo.subscriptionHni} suffix="x" />
                <MetricRow label="Retail" value={ipo.subscriptionRetail} suffix="x" />
              </div>
            </div>
          )}

          {/* GMP */}
          {ipo.gmp !== null && ipo.gmp !== undefined && (
            <div className={`premium-card p-6 ${ipo.gmp > 0 ? 'border-emerald-500/20' : ipo.gmp < 0 ? 'border-red-500/20' : ''}`}>
              <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                Grey Market Premium
              </h4>
              <div className={`text-3xl font-mono font-bold ${
                ipo.gmp > 0 ? 'text-emerald-400' : ipo.gmp < 0 ? 'text-red-400' : 'text-white/50'
              }`}>
                {ipo.gmp > 0 ? '+' : ''}₹{ipo.gmp}
              </div>
              <p className="text-xs text-white/40 mt-2">
                Unofficial market sentiment indicator
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="bg-amber-500/5 rounded-xl border border-amber-500/20 p-5">
            <h4 className="font-bold text-amber-400 mb-2 flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4" />
              Screener Disclaimer
            </h4>
            <p className="text-xs text-white/50 leading-relaxed">
              This is a screening tool only. Scores are computed from available data and should not be considered investment advice. Always review the full DRHP/RHP and consult a SEBI-registered advisor before investing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
