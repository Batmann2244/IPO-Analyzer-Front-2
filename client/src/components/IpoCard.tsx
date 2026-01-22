import { type Ipo } from "@shared/schema";
import { format } from "date-fns";
import { ArrowRight, Calendar, Layers, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAddToWatchlist, useWatchlist } from "@/hooks/use-ipos";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

interface IpoCardProps {
  ipo: Ipo;
  compact?: boolean;
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

  const getStatusColor = (status: string) => {
    switch(status.toLowerCase()) {
      case 'open': return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800";
      case 'upcoming': return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400 border-gray-200 dark:border-gray-700";
    }
  };

  if (compact) {
    return (
      <Link href={`/ipos/${ipo.id}`}>
        <div className="group cursor-pointer bg-card hover:bg-accent/5 rounded-xl border border-border p-4 transition-all duration-200 hover:border-primary/50">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="font-bold text-lg">{ipo.symbol}</h3>
              <p className="text-sm text-muted-foreground truncate max-w-[150px]">{ipo.companyName}</p>
            </div>
            <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border-white/10 ${getStatusColor(ipo.status)}`}>
              {ipo.status}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
            <Calendar className="w-4 h-4" />
            {ipo.expectedDate ? format(new Date(ipo.expectedDate), "dd-MM-yyyy") : "TBA"}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div className="group relative bg-[#0A0A0B] rounded-[2rem] border border-white/[0.05] p-8 shadow-2xl hover:shadow-[0_0_80px_-15px_rgba(139,92,246,0.4)] hover:border-primary/50 transition-all duration-700 flex flex-col h-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-700" />
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              {ipo.symbol}
            </span>
            <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full border-white/10 ${getStatusColor(ipo.status)}`}>
              {ipo.status}
            </Badge>
          </div>
          <h3 className="text-lg font-medium text-muted-foreground line-clamp-1">
            {ipo.companyName}
          </h3>
        </div>
        <Button
          size="icon"
          variant={isWatching ? "secondary" : "outline"}
          className={`rounded-full border-white/10 transition-all duration-500 hover:scale-110 active:scale-95 ${isWatching ? 'bg-primary/20 text-primary border-primary/30 shadow-[0_0_20px_rgba(139,92,246,0.2)]' : 'hover:bg-primary/10 hover:border-primary/30'}`}
          onClick={handleWatch}
          disabled={isPending || isWatching}
        >
          {isWatching ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      <div className="space-y-4 mb-6 flex-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl backdrop-blur-sm group-hover:bg-white/[0.05] transition-colors duration-500">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-2 opacity-50">Range</p>
            <p className="font-bold font-mono text-lg text-foreground tracking-tight">{ipo.priceRange}</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.05] p-4 rounded-2xl backdrop-blur-sm group-hover:bg-white/[0.05] transition-colors duration-500">
            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-black mb-2 opacity-50">Expected</p>
            <div className="flex items-center gap-2 font-bold text-lg text-foreground tracking-tight">
              <Calendar className="w-4 h-4 text-primary" />
              {ipo.expectedDate ? format(new Date(ipo.expectedDate), "dd-MM-yyyy") : "TBA"}
            </div>
          </div>
        </div>
        
        {ipo.sector && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 p-2 rounded-md w-fit">
            <Layers className="w-4 h-4" />
            {ipo.sector}
          </div>
        )}

        <p className="text-sm text-muted-foreground line-clamp-2">
          {ipo.description || "No description available for this offering."}
        </p>
      </div>

      <Link href={`/ipos/${ipo.id}`} className="block mt-auto">
        <Button className="w-full h-14 rounded-2xl justify-between px-6 bg-white/[0.05] hover:bg-primary text-foreground hover:text-primary-foreground border-white/10 transition-all duration-500 group/btn font-bold tracking-tight" variant="secondary">
          Analyze Opportunity
          <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform duration-500" />
        </Button>
      </Link>
    </div>
  );
}
