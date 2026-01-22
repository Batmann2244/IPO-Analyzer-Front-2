import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Loader2 } from "lucide-react";

import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Watchlist from "@/pages/Watchlist";
import IpoDetail from "@/pages/IpoDetail";
import Settings from "@/pages/Settings";
import Admin from "@/pages/Admin";
import ApiDashboard from "@/pages/ApiDashboard";
import ApiKeys from "@/pages/ApiKeys";
import Billing from "@/pages/Billing";
import NotFound from "@/pages/not-found";

function PrivateRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Landing />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="pt-14 lg:pt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Component />
        </div>
      </main>
      <Footer />
    </div>
  );
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={user ? () => <PrivateRoute component={Dashboard} /> : Landing} />
      <Route path="/dashboard" component={() => <PrivateRoute component={Dashboard} />} />
      <Route path="/watchlist" component={() => <PrivateRoute component={Watchlist} />} />
      <Route path="/ipos/:id" component={() => <PrivateRoute component={IpoDetail} />} />
      <Route path="/settings" component={() => <PrivateRoute component={Settings} />} />
      <Route path="/admin" component={() => <PrivateRoute component={Admin} />} />
      <Route path="/api-dashboard" component={() => <PrivateRoute component={ApiDashboard} />} />
      <Route path="/api-keys" component={() => <PrivateRoute component={ApiKeys} />} />
      <Route path="/billing" component={() => <PrivateRoute component={Billing} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
