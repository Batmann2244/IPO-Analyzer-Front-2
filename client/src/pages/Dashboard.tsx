import { useState } from "react";
import { useIpos } from "@/hooks/use-ipos";
import { IpoCard } from "@/components/IpoCard";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Search, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const [filter, setFilter] = useState<'upcoming' | 'open' | 'closed' | 'all'>('all');
  const [sector, setSector] = useState<string>('');
  const [search, setSearch] = useState('');

  const { data: ipos, isLoading } = useIpos(
    filter === 'all' ? undefined : { status: filter }
  );

  const filteredIpos = ipos?.filter(ipo => {
    const matchesSearch = 
      ipo.symbol.toLowerCase().includes(search.toLowerCase()) || 
      ipo.companyName.toLowerCase().includes(search.toLowerCase());
    const matchesSector = sector && sector !== 'all' ? ipo.sector === sector : true;
    return matchesSearch && matchesSector;
  });

  const uniqueSectors = Array.from(new Set(ipos?.map(i => i.sector).filter(Boolean)));

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000">
      <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-card to-card/50 p-10 border border-card-border/50 shadow-2xl">
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-primary/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-accent/10 rounded-full blur-[80px] pointer-events-none" />
        <h1 className="text-5xl md:text-7xl font-display font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-foreground via-foreground to-foreground/40 mb-4">
          Market Intelligence
        </h1>
        <p className="text-muted-foreground text-xl font-medium max-w-2xl leading-relaxed">
          Premium IPO analysis for the discerning Indian investor. Track Mainboard and SME offerings with precision.
        </p>
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search by symbol or company..." 
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <Select value={filter} onValueChange={(val: any) => setFilter(val)}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sector} onValueChange={setSector}>
            <SelectTrigger className="w-[160px] bg-background">
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sectors</SelectItem>
              {uniqueSectors.map(s => (
                <SelectItem key={s} value={s as string}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIpos?.length === 0 ? (
            <div className="col-span-full text-center py-20 bg-muted/20 rounded-2xl border border-dashed border-border">
              <p className="text-muted-foreground text-lg">No IPOs found matching your criteria.</p>
              <p className="text-sm text-muted-foreground/60 mt-2">Try adjusting your filters.</p>
            </div>
          ) : (
            filteredIpos?.map((ipo, index) => (
              <motion.div
                key={ipo.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <IpoCard ipo={ipo} />
              </motion.div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
