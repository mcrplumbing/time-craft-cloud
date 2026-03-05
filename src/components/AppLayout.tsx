import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Clock, FileText, LayoutDashboard, LogOut, Shield, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/time-clock", label: "Time Clock", icon: Clock },
  { to: "/work-orders", label: "Work Orders", icon: FileText },
];

const AppLayout = ({ children }: { children: ReactNode }) => {
  const { signOut, user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="no-print border-b bg-card shadow-sm">
        <div className="container flex items-center justify-between h-14 px-4">
          <Link to="/" className="font-display text-xl font-bold text-foreground">
            MCR Plumbing Tracker
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:inline font-body">
              {user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Bottom nav on mobile, sidebar-ish on desktop */}
      <div className="flex flex-1 flex-col md:flex-row">
        <nav className="no-print order-last md:order-first md:w-56 md:border-r md:bg-card">
          <div className="flex md:flex-col md:p-3 md:gap-1 border-t md:border-t-0">
            {navItems.map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to || (to !== "/" && location.pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex-1 md:flex-none flex flex-col md:flex-row items-center md:gap-3 py-2 md:py-2.5 md:px-3 rounded-md text-xs md:text-sm font-body transition-colors ${
                    active
                      ? "text-accent bg-accent/10 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-5 w-5 md:h-4 md:w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
            {isAdmin && [
              { to: "/admin", label: "Reports", icon: Shield },
              { to: "/trash", label: "Trash", icon: Trash2 },
            ].map(({ to, label, icon: Icon }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex-1 md:flex-none flex flex-col md:flex-row items-center md:gap-3 py-2 md:py-2.5 md:px-3 rounded-md text-xs md:text-sm font-body transition-colors ${
                    active
                      ? "text-accent bg-accent/10 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-5 w-5 md:h-4 md:w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
