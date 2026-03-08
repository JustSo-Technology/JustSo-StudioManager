import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "./components/layout/app-layout";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import Spaces from "./pages/spaces";
import Services from "./pages/services";
import Bookings from "./pages/bookings";
import Inventory from "./pages/inventory";
import Hires from "./pages/hires";
import Teams from "./pages/teams";
import Profile from "./pages/profile";

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/teams" component={Teams} />
        <Route path="/spaces" component={Spaces} />
        <Route path="/services" component={Services} />
        <Route path="/bookings" component={Bookings} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/hires" component={Hires} />
        <Route path="/profile" component={Profile} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
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
