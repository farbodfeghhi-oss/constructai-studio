import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30 px-4">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4" />
              <span className="text-sm font-mono text-muted-foreground">MechAI Engineering Platform</span>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {user.email}
                </span>
              )}
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={signOut} aria-label="Abmelden">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
