import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "./components/layout/app-layout";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import Calendars from "./pages/calendars";
import Spaces from "./pages/spaces";
import Services from "./pages/services";
import Bookings from "./pages/bookings";
import Inventory from "./pages/inventory";
import Hires from "./pages/hires";
import Teams from "./pages/teams";
import Profile from "./pages/profile";
import UserProfile from "./pages/user-profile";
import PublicPage from "./pages/public-page";
import TenantPublicPage from "./pages/tenant-public";
import EmailSettingsPage from "./pages/email-settings";
import AccessPage from "./pages/access";

function Router() {
  return (
    <Switch>
      <Route path="/u/:slug" component={TenantPublicPage} />
      <Route>
        <AppLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/teams" component={Teams} />
            <Route path="/spaces" component={Spaces} />
            <Route path="/services" component={Services} />
            <Route path="/bookings" component={Bookings} />
            <Route path="/inventory" component={Inventory} />
            <Route path="/hires" component={Hires} />
            <Route path="/calendars" component={Calendars} />
            <Route path="/public-page" component={PublicPage} />
            <Route path="/access" component={AccessPage} />
            <Route path="/settings/email" component={EmailSettingsPage} />
            <Route path="/profile" component={Profile} />
            <Route path="/me" component={UserProfile} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
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
