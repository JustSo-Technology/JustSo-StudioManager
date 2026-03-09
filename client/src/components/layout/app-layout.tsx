import { ReactNode, useState } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, signIn, isSigningIn, signUp, isSigningUp, loginAdmin, isLoggingInAdmin } = useAuth();
  const [studioName, setStudioName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative overflow-hidden">
        {/* Abstract creative studio background */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="glass-panel p-10 rounded-3xl max-w-3xl w-full text-center relative z-10 shadow-2xl shadow-black/5">
          <img
            src="/justso-logo.png"
            alt="JustSo. Studio Manager"
            className="mx-auto mb-6 h-auto w-full max-w-[760px] object-contain"
          />
          <p className="text-muted-foreground mb-8">Tenant backend for publishing, bookings, spaces, and equipment.</p>
          <div className="mx-auto max-w-md space-y-3">
            <Input
              className="h-12 rounded-xl bg-background"
              placeholder="Studio name"
              value={studioName}
              onChange={(event) => setStudioName(event.target.value)}
            />
            <Input
              className="h-12 rounded-xl bg-background"
              type="email"
              placeholder="Email address"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Input
              className="h-12 rounded-xl bg-background"
              type="password"
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {authError ? <p className="text-sm text-destructive">{authError}</p> : null}
            <Button 
              className="w-full h-12 text-base rounded-xl"
              onClick={() =>
                signIn(
                  { email, password },
                  {
                    onError: (error) => setAuthError(error.message),
                    onSuccess: () => setAuthError(""),
                  },
                )
              }
              disabled={isSigningIn || isSigningUp}
            >
              {isSigningIn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in to continue"}
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl"
              onClick={() =>
                signUp(
                  { studioName, email, password },
                  {
                    onError: (error) => setAuthError(error.message),
                    onSuccess: () => setAuthError(""),
                  },
                )
              }
              disabled={isSigningIn || isSigningUp}
            >
              {isSigningUp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create studio account"}
            </Button>
            {import.meta.env.DEV && (
              <Button
                variant="outline"
                className="mt-3 w-full h-12 rounded-xl"
                onClick={() => loginAdmin?.()}
                disabled={isLoggingInAdmin}
              >
                {isLoggingInAdmin ? <Loader2 className="h-4 w-4 animate-spin" /> : "Open local admin demo"}
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center px-4 border-b border-border/50 sticky top-0 bg-background/80 backdrop-blur-md z-30">
            <SidebarTrigger className="hover-elevate" />
          </header>
          <main className="flex-1 p-6 md:p-8 lg:p-10 max-w-7xl mx-auto w-full">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
