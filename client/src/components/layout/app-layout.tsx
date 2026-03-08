import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading, login, isLoggingIn } = useAuth();

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
        
        <div className="glass-panel p-10 rounded-3xl max-w-md w-full text-center relative z-10 shadow-2xl shadow-black/5">
          <h1 className="font-display text-4xl font-bold mb-2">JustSo.</h1>
          <p className="text-muted-foreground mb-8">Studio Booking & Inventory</p>
          <Button 
            className="w-full h-12 text-base rounded-xl"
            onClick={() => login?.()}
            disabled={isLoggingIn}
          >
            {isLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sign in to continue"}
          </Button>
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
