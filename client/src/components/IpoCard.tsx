import { type Ipo } from "@shared/schema";
import { format } from "date-fns";
import { ArrowRight, Calendar, Layers, Plus, Check, TrendingUp, AlertTriangle, Shield, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAddToWatchlist, useWatchlist } from "@/hooks/use-ipos";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface IpoCardProps {
  ipo: Ipo;
  compact?: boolean;
}

function ScoreRing({ score, size = "md" }: { score: number | null; size?: "sm" | "md" }) {
  if (score === null || score === undefined) return null;
  
  const percentage = (score / 10) * 100;
  const strokeWidth = size === "sm" ? 3 : 4;
  const radius = size === "sm" ? 16 : 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getScoreColor = (s: number) => {
    if (s >= 7.5) return { stroke: "#10b981", text: "text-emerald-400", glow: "drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]" };
    if (s >= 6) return { stroke: "#3b82f6", text: "text-blue-400", glow: "drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]" };
    if (s >= 4) return { stroke: "#f59e0b", text: "text-amber-400", glow: "drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" };
    return { stroke: "#ef4444", text: "text-red-400", glow: "drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" };
  };
  
  const colors = getScoreColor(score);
  const svgSize = size === "sm" ? 38 : 52;
  
  return (
    <div className={`relative ${colors.glow}`}>
      <svg width={svgSize} height={svgSize} className="-rotate-90">
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={svgSize / 2}
          cy={svgSize / 2}
          r={radius}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center font-mono font-bold ${size === "sm" ? "text-xs" : "text-sm"} ${colors.text}`}>
        {score.toFixed(1)}
      </div>
    </div>
  );
}

function RiskBadge({ riskLevel }: { riskLevel: string | null }) {
  if (!riskLevel) return null;
  
  const styles = {
    conservative: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    moderate: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    aggressive: "bg-red-500/10 text-red-400 border-red-500/20",
  };
  
  return (
    <Badge 
      variant="outline" 
      className={`text-[9px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border ${styles[riskLevel as keyof typeof styles] || styles.moderate}`}
    >
      {riskLevel}
    </Badge>
  );
}

export function IpoCard({ ipo, compact = false }: IpoCardProps) {
  const { mutate: addToWatchlist, isPending } = useAddToWatchlist();
  const { data: watchlist } = useWatchlist();
  const { toast } = useToast();

  const isWatching = watchlist?.some(item => item.ipoId === ipo.id);

  const handleWatch = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isWatching) return;
    
    addToWatchlist(ipo.id, {
      onSuccess: () => {
        toast({
          title: "Added to Watchlist",
          description: `You are now tracking ${ipo.symbol}.`,
        });
      },
      onError: (err) => {
        toast({
          title: "Error",
          description: err.message,
          variant: "destructive",
        });
      }
    });
  };

  const getStatusStyles = (status: string) => {
    switch(status.toLowerCase()) {
      case 'open': 
        return "badge-glow-green";
      case 'upcoming': 
        return "badge-glow-blue";
      case 'closed':
        return "bg-white/[0.05] text-white/50 border-white/[0.08]";
      default: 
        return "bg-white/[0.05] text-white/50 border-white/[0.08]";
    }
  };

  const redFlagsCount = ipo.redFlags?.length || 0;

  if (compact) {
    return (
      <Link href={`/ipos/${ipo.id}`}>
        <div 
          className="group cursor-pointer premium-card p-5 hover-lift"
          data-testid={`card-ipo-compact-${ipo.id}`}
        >
          <div className="flex justify-between items-start mb-3">
            <div>
              <h3 className="font-display font-bold text-lg text-white group-hover:text-purple-400 transition-colors">
                {ipo.symbol}
              </h3>
              <p className="text-sm text-white/40 truncate max-w-[150px]">{ipo.companyName}</p>
            </div>
            <div className="flex items-center gap-2">
              <ScoreRing score={ipo.overallScore} size="sm" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-white/40">
              <Calendar className="w-4 h-4" />
              {ipo.expectedDate ? format(new Date(ipo.expectedDate), "dd MMM yyyy") : "TBA"}
            </div>
            {redFlagsCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {redFlagsCount}
              </div>
            )}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div 
      className="group relative premium-card p-6 flex flex-col min-h-[340px]"
      data-testid={`card-ipo-${ipo.id}`}
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-purple-500/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      
      <div className="flex justify-between items-start gap-3 mb-5 relative z-10">
        <div className="space-y-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display text-xl font-bold tracking-tight text-white group-hover:text-purple-400 transition-colors duration-300">
              {ipo.symbol}
            </span>
            <Badge 
              variant="outline" 
              className={`text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-full border shrink-0 ${getStatusStyles(ipo.status)}`}
            >
              {ipo.status}
            </Badge>
          </div>
          <h3 className="text-sm text-white/50 font-medium line-clamp-1">
            {ipo.companyName}
          </h3>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <ScoreRing score={ipo.overallScore} size="sm" />
          <RiskBadge riskLevel={ipo.riskLevel} />
        </div>
      </div>

      <div className="space-y-3 mb-4 flex-1 relative z-10">
        <div className="grid grid-cols-2 gap-3">
          <div className="stat-card">
            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-semibold mb-1">Price Range</p>
            <p className="font-display font-bold text-sm text-white truncate">{ipo.priceRange}</p>
          </div>
          <div className="stat-card">
            <p className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-semibold mb-1">Issue Size</p>
            <p className="font-display font-bold text-sm text-white truncate">
              {ipo.issueSize || "TBA"}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {ipo.sector && (
            <div className="flex items-center gap-2 text-xs text-white/40 bg-white/[0.02] border border-white/[0.05] px-3 py-2 rounded-lg">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium">{ipo.sector}</span>
            </div>
          )}
          {ipo.gmp !== null && ipo.gmp !== undefined && (
            <div className={`flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border ${
              ipo.gmp > 0 
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                : ipo.gmp < 0 
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-white/[0.02] text-white/40 border-white/[0.05]"
            }`}>
              <TrendingUp className="w-3.5 h-3.5" />
              <span className="font-medium">GMP ₹{ipo.gmp}</span>
            </div>
          )}
        </div>

        {redFlagsCount > 0 && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{redFlagsCount} risk flag{redFlagsCount > 1 ? 's' : ''} detected</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mt-auto relative z-10">
        <Link href={`/ipos/${ipo.id}`} className="flex-1">
          <Button 
            className="w-full h-11 rounded-xl justify-between px-5 bg-white/[0.03] hover:bg-gradient-to-r hover:from-purple-500/20 hover:to-violet-500/10 text-white/70 hover:text-white border border-white/[0.06] hover:border-purple-500/30 transition-all duration-300 group/btn font-semibold"
            variant="ghost"
            data-testid={`button-analyze-${ipo.id}`}
          >
            <span className="flex items-center gap-2">
              <Gauge className="w-4 h-4 text-purple-400" />
              View Analysis
            </span>
            <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform duration-300" />
          </Button>
        </Link>
        <Button
          size="icon"
          variant="ghost"
          className={`h-11 w-11 rounded-xl transition-all duration-300 ${
            isWatching 
              ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30 shadow-lg shadow-purple-500/10' 
              : 'bg-white/[0.03] text-white/40 border border-white/[0.08] hover:bg-white/[0.06] hover:text-white/60 hover:border-white/[0.12]'
          }`}
          onClick={handleWatch}
          disabled={isPending || isWatching}
          data-testid={`button-watch-${ipo.id}`}
        >
          {isWatching ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
