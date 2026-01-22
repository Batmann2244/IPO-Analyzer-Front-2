import { useRoute, Link } from "wouter";
import { useIpo, useAddToWatchlist, useWatchlist } from "@/hooks/use-ipos";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  Calendar, 
  DollarSign, 
  PieChart, 
  FileText, 
  Briefcase,
  Check,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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

  if (isLoading) return <div className="h-screen bg-background" />;
  if (!ipo) return <div>Not Found</div>;

  return (
    <div className="max-w-4xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      <Link href="/dashboard">
        <Button variant="ghost" className="mb-6 pl-0 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </Link>

      <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden mb-8">
        <div className="p-8 border-b border-border bg-gradient-to-r from-background to-muted/20">
          <div className="flex flex-col md:flex-row justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-display font-bold text-foreground">{ipo.symbol}</h1>
                <Badge className="text-sm px-3 py-0.5 h-6 capitalize">{ipo.status}</Badge>
              </div>
              <h2 className="text-xl text-muted-foreground font-medium">{ipo.companyName}</h2>
            </div>
            <div className="flex items-start gap-3">
              <Button 
                size="lg" 
                className={`rounded-xl shadow-lg ${isWatching ? 'bg-secondary text-secondary-foreground' : 'shadow-primary/20'}`}
                onClick={handleWatch}
                disabled={isWatching || isPending}
              >
                {isWatching ? (
                  <>
                    <Check className="mr-2 h-5 w-5" /> In Watchlist
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-5 w-5" /> Add to Watchlist
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <div className="p-8 grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <section>
              <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Company Overview
              </h3>
              <p className="text-muted-foreground leading-relaxed text-lg">
                {ipo.description || "No description available for this company."}
              </p>
            </section>

            <section className="bg-muted/20 rounded-xl p-6 border border-border/50">
              <h3 className="text-lg font-bold mb-4">Offering Details</h3>
              <div className="grid grid-cols-2 gap-y-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Total Shares</div>
                  <div className="font-mono text-lg">{ipo.totalShares || "TBA"}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Sector</div>
                  <div className="font-medium">{ipo.sector || "Unclassified"}</div>
                </div>
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
              <h4 className="font-bold text-muted-foreground text-sm uppercase tracking-wider mb-4">Key Stats</h4>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-lg text-green-600">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Price Range</div>
                    <div className="font-mono font-bold text-lg">{ipo.priceRange}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg text-blue-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Expected Date</div>
                    <div className="font-medium text-lg">
                      {ipo.expectedDate ? format(new Date(ipo.expectedDate), "dd-MM-yyyy") : "TBA"}
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg text-purple-600">
                    <Briefcase className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Market Cap</div>
                    <div className="font-medium text-lg">--</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-2xl border border-primary/10 p-5">
              <h4 className="font-bold text-primary mb-2 flex items-center gap-2">
                <PieChart className="h-4 w-4" />
                Analysis Tip
              </h4>
              <p className="text-sm text-muted-foreground">
                Always review the full prospectus before investing. IPOs carry significant volatility risk in the first 30 days of trading.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
