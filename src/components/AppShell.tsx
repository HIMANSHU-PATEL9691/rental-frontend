import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Shirt,
  CalendarDays,
  Users,
  ClipboardList,
  Search,
  Bell,
  Plus,
  Menu,
  Clock,
  Settings,
  CalendarCheck,
  LogOut,
  FileText,
  Package,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { NewRentalDialog } from "@/components/forms/NewRentalDialog";
import { useStore } from "@/data/store";
import brandLogo from "@/assets/logo.png";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true, roles: ["admin"] },
  { to: "/inventory", label: "Inventory", icon: Shirt, exact: false, roles: ["admin", "employee"] },
  { to: "/rentals", label: "Rentals", icon: ClipboardList, exact: false, roles: ["admin"] },
  { to: "/customers", label: "Customers", icon: Users, exact: false, roles: ["admin"] },
  { to: "/availability", label: "Availability", icon: CalendarCheck, exact: false, roles: ["admin", "employee"] },
  { to: "/deliveries", label: "Deliveries", icon: Package, exact: false, roles: ["admin", "employee"] },
  { to: "/return-items", label: "Return Items", icon: Clock, exact: false, roles: ["admin"] },
  { to: "/calendar", label: "Calendar", icon: CalendarDays, exact: false, roles: ["admin", "employee"] },
  { to: "/reports", label: "Reports", icon: FileText, exact: false, roles: ["admin"] },
  { to: "/settings", label: "Settings", icon: Settings, exact: false, roles: ["admin", "employee"] },
] as const;


function NavList({ pathname, role, onNavigate }: { pathname: string; role: string; onNavigate?: () => void }) {
  const visibleNav = nav.filter(item => (item.roles as readonly string[]).includes(role));
  return (
    <nav className="flex-1 px-3 py-6 space-y-1">
      {visibleNav.map((item) => {
        const Icon = item.icon;
        const active = item.exact
            ? pathname === item.to
          : pathname.startsWith(item.to);

        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`group flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-sidebar-accent text-foreground shadow-glow"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-foreground"
            }`}
          >
            <Icon
              className={`h-4 w-4 ${
                active ? "text-gold" : "text-sidebar-foreground/60 group-hover:text-gold"
              }`}
            />
            <span className="tracking-wide">{item.label}</span>
            {active && <span className="ml-auto h-1 w-1 rounded-full bg-gold" />}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <img

        src={brandLogo}
        alt="ARIHANT COLLECTION logo"
        width={40}
        height={40}
        className="h-10 w-10 rounded-md border border-gold/30 bg-background/50 object-contain"
      />
      <span className="flex flex-col">
        <span className="text-[10px] uppercase tracking-[0.32em] text-gold">
          Rental point
        </span>
        <span className="font-display text-2xl leading-none">ARIHANT COLLECTION</span>
      </span>
    </Link>
  );
}


export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { searchQuery, setSearchQuery, rentals } = useStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [role, setRole] = useState("");
  const [userName, setUserName] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaysFittings = rentals?.filter((r) => {
    const isDelivery = (r.deliveryDate || r.startDate || "").slice(0, 10) === todayStr;
    const isReturn = (r.endDate || "").slice(0, 10) === todayStr;
    return isDelivery || isReturn;
  }).length || 0;

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    // For demonstration, read the simulated role from local storage.
    // In production, this should be fetched from your auth context/store.
    const savedRole = localStorage.getItem("user_role")?.trim().toLowerCase();
    if (!savedRole) {
      window.location.href = "/login";
    } else {
      setRole(savedRole);
      setUserName(localStorage.getItem("user_name") || savedRole);
    }
  }, []);

  function handleSearchChange(value: string) {
    console.info("[AppShell] search changed", { value });
    setSearchQuery(value);
  }

  function handleLogout() {
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_name");
    window.location.href = "/login";
  }

  return (
    <div className="flex min-h-screen w-full">
      <aside className="hidden h-screen w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/90 backdrop-blur-xl md:flex lg:w-64 sticky top-0">
        <div className="px-6 py-7">
          <Brand />
        </div>
        <div className="hairline mx-6" />
        <NavList pathname={pathname} role={role} />
        
        {role === "admin" && (
          <div className="mx-6 mb-5 rounded-md border border-sidebar-border bg-sidebar-accent p-4">
            <p className="eyebrow">Today</p>
            <p className="mt-2 font-display text-2xl">{todaysFittings} fitting{todaysFittings !== 1 ? 's' : ''}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Confirm pickups, returns, and final garment checks before 7 PM.
            </p>
          </div>
        )}
        <div className="border-t border-sidebar-border px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-9 w-9 border border-gold/40 shrink-0">
              <AvatarFallback className="bg-secondary text-xs text-gold uppercase font-medium">
                {userName.slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-xs pr-2">
              <p className="text-foreground font-medium truncate">{userName}</p>
              <p className="truncate text-muted-foreground">{role}@velvetvault.co</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="px-6 py-7">
            <Brand />
          </div>
          <div className="hairline mx-6" />
          <NavList pathname={pathname} role={role} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 min-h-14 border-b border-border bg-background/55 backdrop-blur-xl sm:min-h-16">
          <div className="flex h-14 items-center gap-2 px-4 sm:h-16 sm:gap-4 sm:px-6 lg:px-10">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 text-foreground md:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <Link to="/" className="font-display text-lg leading-none md:hidden">
              ARIHANT COLLECTION
            </Link>

            <div className="relative hidden max-w-md flex-1 sm:block">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search gowns, rentals, clients..."
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.currentTarget.value)}
                className="border-border bg-secondary/50 pl-9 focus-visible:ring-gold/40"
              />
            </div>

            <div className="ml-auto flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground sm:hidden"
                aria-label="Search"
                onClick={() => setMobileSearchOpen((open) => !open)}
              >
                <Search className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="relative text-muted-foreground hover:text-foreground"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-gold" />
              </Button>
              {role === "admin" && (
                <NewRentalDialog
                  trigger={
                    <Button className="hidden bg-gold text-gold-foreground shadow-glow hover:bg-gold/90 sm:inline-flex">
                      <Plus className="mr-1.5 h-4 w-4" /> New Rental
                    </Button>
                  }
                />
              )}
              {role === "admin" && (
                <NewRentalDialog
                  trigger={
                    <Button
                      size="icon"
                      className="bg-gold text-gold-foreground hover:bg-gold/90 sm:hidden"
                      aria-label="New rental"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  }
                />
              )}
            </div>
          </div>
          {mobileSearchOpen && (
            <div className="border-t border-border px-4 py-2 sm:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  autoFocus
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  className="border-border bg-secondary/50 pl-9 focus-visible:ring-gold/40"
                />
              </div>
            </div>
          )}
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
