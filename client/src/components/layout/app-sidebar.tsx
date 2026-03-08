import { Link, useLocation } from "wouter";
import { 
  Building2, 
  Briefcase, 
  CalendarDays, 
  Package, 
  Repeat, 
  User, 
  LogOut,
  Hexagon,
  Users
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useProfile } from "@/hooks/use-profile";
import { Button } from "@/components/ui/button";

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { data: profile } = useProfile();

  const isInternalUser = profile?.role === "admin" || profile?.role === "tenant";

  // External users only see Dashboard, Services, and Bookings
  const navigation = [
    { title: "Dashboard", url: "/", icon: Hexagon },
    ...(isInternalUser ? [{ title: "Teams", url: "/teams", icon: Users }] : []),
    ...(isInternalUser ? [{ title: "Spaces", url: "/spaces", icon: Building2 }] : []),
    { title: "Services", url: "/services", icon: Briefcase },
    { title: "Bookings", url: "/bookings", icon: CalendarDays },
    ...(isInternalUser ? [{ title: "Inventory", url: "/inventory", icon: Package }] : []),
    ...(isInternalUser ? [{ title: "Active Hires", url: "/hires", icon: Repeat }] : []),
  ];

  return (
    <Sidebar className="border-r border-border/50">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2 font-display text-2xl font-bold tracking-tight">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
            <Hexagon size={24} className="fill-current" />
          </div>
          JustSo.
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Workspace
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className={`
                        transition-all duration-200 rounded-xl my-0.5
                        ${isActive ? 'bg-primary/5 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}
                      `}
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-3 py-2.5">
                        <item.icon className={`h-4 w-4 ${isActive ? 'text-primary' : 'opacity-70'}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="rounded-xl">
              <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5">
                <User className="h-4 w-4 opacity-70" />
                <span className="flex-1 truncate">Profile</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive mt-1">
              <button onClick={() => logout()}>
                <LogOut className="h-4 w-4 opacity-70" />
                <span>Log out</span>
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
