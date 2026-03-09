import { Link, useLocation } from "wouter";
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CalendarDays,
  CalendarRange,
  LayoutDashboard,
  LogOut,
  Mail,
  Package,
  PanelTop,
  Repeat,
  User,
  Users,
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

export function AppSidebar() {
  const [location] = useLocation();
  const { logout, workspaces, activeWorkspaceId, switchWorkspace, isSwitchingWorkspace } = useAuth();
  const { data: profile } = useProfile();

  const navigation = [
    { title: "Overview", url: "/", icon: LayoutDashboard },
    { title: "Bookings", url: "/bookings", icon: CalendarDays },
    { title: "Services", url: "/services", icon: Briefcase },
    { title: "Spaces", url: "/spaces", icon: Building2 },
    { title: "Inventory", url: "/inventory", icon: Package },
    { title: "Calendars", url: "/calendars", icon: CalendarRange },
    { title: "Public Page", url: "/public-page", icon: PanelTop },
    { title: "Teams", url: "/teams", icon: Users },
    { title: "Active Hires", url: "/hires", icon: Repeat },
  ];

  const adminNavigation =
    profile?.role === "admin"
      ? [
          { title: "Workspace Access", url: "/access", icon: Users },
          { title: "Email Settings", url: "/settings/email", icon: Mail },
        ]
      : [];

  return (
    <Sidebar className="border-r border-border/50">
      <SidebarHeader className="p-6">
        <div className="space-y-3">
          <div className="w-full">
            <img
              src="/justso-mark.png"
              alt="JustSo. Studio Manager"
              className="block h-auto w-full max-w-none object-contain"
            />
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/40 px-3 py-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <BadgeCheck className="h-4 w-4 text-primary" />
              {profile?.displayName || profile?.tenantName || "Workspace"}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Publish your page, assign calendars to every offering, and keep reservations organised.
            </p>
            {workspaces.length > 1 ? (
              <select
                className="mt-3 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                value={activeWorkspaceId || ""}
                onChange={(event) => switchWorkspace(event.target.value)}
                disabled={isSwitchingWorkspace}
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>
                    {workspace.displayName || workspace.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Tenant Workspace
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
                      className={`transition-all duration-200 rounded-xl my-0.5 ${
                        isActive ? "bg-primary/5 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <Link href={item.url} className="flex items-center gap-3 px-3 py-2.5">
                        <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "opacity-70"}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        {adminNavigation.length > 0 ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Platform Controls
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminNavigation.map((item) => {
                  const isActive = location === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        className={`transition-all duration-200 rounded-xl my-0.5 ${
                          isActive ? "bg-primary/5 text-primary font-medium" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                        }`}
                      >
                        <Link href={item.url} className="flex items-center gap-3 px-3 py-2.5">
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : "opacity-70"}`} />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-border/50">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="rounded-xl">
              <Link href="/profile" className="flex items-center gap-3 px-3 py-2.5">
                <User className="h-4 w-4 opacity-70" />
                <span className="flex-1 truncate">Workspace Profile</span>
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
