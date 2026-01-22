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
            <Badge variant="outline" className={getStatusColor(ipo.status)}>
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
    <div className="group relative bg-card rounded-3xl border border-card-border/50 p-6 shadow-2xl hover:shadow-[0_0_50px_-12px_rgba(139,92,246,0.3)] hover:border-primary/40 transition-all duration-500 flex flex-col h-full overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="flex justify-between items-start mb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-2xl font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
              {ipo.symbol}
            </span>
            <Badge variant="outline" className={getStatusColor(ipo.status)}>
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
          className={`rounded-full transition-all duration-300 ${isWatching ? 'bg-primary/10 text-primary border-primary/20' : ''}`}
          onClick={handleWatch}
          disabled={isPending || isWatching}
        >
          {isWatching ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </Button>
      </div>

      <div className="space-y-4 mb-6 flex-1">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-secondary/30 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Range</p>
            <p className="font-medium font-mono">{ipo.priceRange}</p>
          </div>
          <div className="bg-secondary/30 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Expected</p>
            <div className="flex items-center gap-1.5 font-medium">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
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
        <Button className="w-full justify-between group-hover:bg-primary group-hover:text-primary-foreground transition-colors" variant="secondary">
          View Analysis
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </Button>
      </Link>
    </div>
  );
}
