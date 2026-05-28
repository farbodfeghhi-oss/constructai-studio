import { Home, Camera, Search, Settings, Sparkles, FileText, Plus, Languages, KeyRound } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const navItems = [
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Bild-Analyse", url: "/analyse", icon: Camera },
  { title: "Komponenten-Suche", url: "/komponenten", icon: Search },
  { title: "Lösungsvorschläge", url: "/loesung", icon: Settings },
  { title: "AI-Prompts", url: "/prompts", icon: Sparkles },
  { title: "PDF-Übersetzer", url: "/pdf-translate", icon: Languages },
  { title: "Dokumentation", url: "/dokumentation", icon: FileText },
  { title: "API-Schlüssel", url: "/settings", icon: KeyRound },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarContent className="pt-4">
        {!collapsed && (
          <div className="px-4 pb-4 mb-2 border-b border-sidebar-border">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center">
                <Settings className="h-4 w-4 text-accent-foreground" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-sidebar-accent-foreground tracking-wide">MechAI</h2>
                <p className="text-[10px] text-sidebar-foreground/60 uppercase tracking-widest">Engineering Platform</p>
              </div>
            </div>
          </div>
        )}

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 uppercase text-[10px] tracking-widest">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive}
                    >
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="transition-colors"
                        activeClassName="bg-sidebar-accent text-accent font-semibold"
                      >
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed ? (
          <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90 font-semibold gap-2">
            <Plus className="h-4 w-4" />
            Neue Analyse
          </Button>
        ) : (
          <Button size="icon" className="w-full bg-accent text-accent-foreground hover:bg-accent/90" aria-label="Neue Analyse">
            <Plus className="h-4 w-4" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
