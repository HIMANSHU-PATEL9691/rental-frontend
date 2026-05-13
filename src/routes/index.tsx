import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  ArrowUpRight,
  TrendingUp,
  Package,
  Users,
  Banknote,
  CalendarCheck,
  Clock,
} from "lucide-react";
import heroImg from "@/assets/hero-velvet.jpg";

const PIE_COLORS = ["var(--gold)", "var(--gold-2)", "var(--gold-3)", "var(--gold-4)"];

function formatDayLabel(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short" });
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Dashboard - Velvet Vault" }],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("user_role");
      if (!role) throw redirect({ to: "/login" });
      if (role !== "admin") throw redirect({ to: "/availability" });
    }
  },
  component: DashboardPage,
});

function DashboardPage() {
  const { items, customers, rentals, loading, getItem, getCustomer } = useStore();

  const todayStr = new Date().toISOString().slice(0, 10);
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const dashboardStats = useMemo(() => {
    let todayIncome = 0;
    let todayDue = 0;
    let todayRentalsCount = 0;
    let monthIncome = 0;
    let monthDue = 0;
    let monthRentalsCount = 0;

    rentals.forEach((r) => {
      const rDateObj = new Date(r.startDate || (r as any).createdAt || "");
      if (Number.isNaN(rDateObj.getTime())) return;

      const rDateStr = rDateObj.toISOString().slice(0, 10);
      const isToday = rDateStr === todayStr;
      const isThisMonth =
        rDateObj.getMonth() === currentMonth && rDateObj.getFullYear() === currentYear;

      const income = (r.advance as number) || 0;
      const due = Math.max(0, (r.total as number) || 0 + ((r.penalty as number) || 0) - ((r.advance as number) || 0));

      if (isToday) {
        todayIncome += income;
        todayDue += due;
        todayRentalsCount++;
      }
      if (isThisMonth) {
        monthIncome += income;
        monthDue += due;
        monthRentalsCount++;
      }
    });

    const activeRentals = rentals.filter((r) => r.status === "active").length;
    const availableItems = items.filter((i) => i.status === "available").length;

    const returnsDueToday = rentals.filter(
      (r) => r.status === "active" && (r.endDate || "").slice(0, 10) === todayStr,
    ).length;
    const upcomingRentals = rentals.filter((r) => r.status === "upcoming").length;
    const itemsInCleaning = items.filter((i) => i.status === "cleaning").length;

    const stats = [
      {
        label: "Today's Bookings",
        value: `${todayRentalsCount}`,
        helper: "Rentals starting today",
        icon: CalendarCheck,
      },
      {
        label: "Today's Income",
        value: formatCurrencyINR(todayIncome),
        helper: "Collected today (excl. security)",
        icon: Banknote,
      },
      {
        label: "Today's Due",
        value: formatCurrencyINR(todayDue),
        helper: "Pending from today's bookings",
        icon: Clock,
      },
      {
        label: "Monthly Bookings",
        value: `${monthRentalsCount}`,
        helper: "Rentals starting this month",
        icon: CalendarCheck,
      },
      {
        label: "Monthly Income",
        value: formatCurrencyINR(monthIncome),
        helper: "Collected this month",
        icon: Banknote,
      },
      {
        label: "Monthly Due",
        value: formatCurrencyINR(monthDue),
        helper: "Pending this month",
        icon: Clock,
      },
      {
        label: "Live Rentals",
        value: `${activeRentals}`,
        helper: `${rentals.filter((r) => r.status === "upcoming").length} upcoming`,
        icon: Package,
      },
      {
        label: "Overdue Items",
        value: `${rentals.filter((r) => r.status === "overdue").length}`,
        helper: "Needs immediate action",
        icon: CalendarCheck,
      },
      {
        label: "Clientele",
        value: `${customers.length}`,
        helper: `${customers.filter((c) => c.tier === "Platinum").length} platinum members`,
        icon: Users,
      },
      {
        label: "Available Pieces",
        value: `${availableItems}`,
        helper: `${items.length} total garments`,
        icon: TrendingUp,
      },
    ];

    const revenueByDay = (() => {
      const grouped: Record<string, { date: Date; revenue: number }> = {};
      rentals.forEach((rental) => {
        const date = new Date(rental.startDate || rental.createdAt || "");
        if (Number.isNaN(date.getTime())) return;
        if (date.getMonth() !== currentMonth || date.getFullYear() !== currentYear) return;
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
          date.getDate(),
        ).padStart(2, "0")}`;
        grouped[key] = grouped[key] || { date, revenue: 0 };
        grouped[key].revenue += (rental.advance as number) ?? 0;
      });
      return Object.values(grouped)
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map((entry) => ({
          day: formatDayLabel(entry.date),
          revenue: entry.revenue,
        }));
    })();

    const categoryMix = (() => {
      const counts = items.reduce<Record<string, number>>((acc, item) => {
        const key = item.category || "Uncategorized";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      return Object.entries(counts).map(([name, value]) => ({
        name,
        value: Math.round((value / Math.max(items.length, 1)) * 100),
      }));
    })();

    const recent = [...rentals]
      .sort((a, b) => {
        const aDate = new Date(a.startDate || (a as any).createdAt || "");
        const bDate = new Date(b.startDate || (b as any).createdAt || "");
        return bDate.getTime() - aDate.getTime();
      })
      .slice(0, 5);

    const heroPiece = [...items].sort((a, b) => b.timesRented - a.timesRented)[0];

    return {
      stats,
      revenueByDay,
      categoryMix,
      recent,
      heroPiece,
      returnsDueToday,
      upcomingRentals,
      itemsInCleaning,
    };
  }, [customers, currentMonth, currentYear, items, rentals]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-100 items-center justify-center text-muted-foreground">
          Loading dashboard data...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="glass-panel mb-8 overflow-hidden rounded-xl sm:mb-10">
        <div className="grid min-h-120 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="relative z-10 flex flex-col justify-between px-5 py-7 sm:px-8 sm:py-10 lg:px-12">
            <div>
              <p className="eyebrow">Spring Atelier 2026</p>
              <h1 className="mt-4 max-w-3xl font-display text-4xl leading-[0.95] text-foreground sm:text-6xl lg:text-7xl">
                Rental couture, handled with ceremony.
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
                A polished view of your pieces, bookings, client tiers, returns, and revenue.
              </p>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Returns", `${dashboardStats.returnsDueToday} due today`],
                ["Upcoming", `${dashboardStats.upcomingRentals} bookings`],
                ["Garment Care", `${dashboardStats.itemsInCleaning} in cleaning`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border border-border bg-background/35 p-4"
                >
                  <p className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="mt-2 font-display text-2xl">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative min-h-80">
            <img
              src={heroImg}
              alt="Velvet evening gown in atelier"
              width={1280}
              height={800}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent lg:bg-linear-to-r lg:from-background/85 lg:via-background/20 lg:to-transparent" />
            {dashboardStats.heroPiece && (
              <div className="absolute bottom-5 left-5 right-5 rounded-md border border-border bg-background/65 p-4 backdrop-blur-md lg:left-auto lg:w-72">
                <p className="eyebrow">Most Requested</p>
                <p className="mt-2 font-display text-2xl">{dashboardStats.heroPiece.name}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {dashboardStats.heroPiece.designer} - {dashboardStats.heroPiece.timesRented} rentals
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-2 gap-3 sm:mb-10 sm:gap-5 lg:grid-cols-5">
        {dashboardStats.stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="glass-panel">
              <CardContent className="p-4 sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
                    {s.label}
                  </span>
                  <Icon className="h-4 w-4 shrink-0 text-gold" />
                </div>
                <div className="font-display text-3xl leading-none">{s.value}</div>
                <div className="mt-3 flex items-center text-xs text-emerald">
                  <ArrowUpRight className="mr-1 h-3 w-3" /> {s.helper}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="mb-8 grid gap-4 sm:mb-10 sm:gap-6 lg:grid-cols-3">
        <Card className="glass-panel min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Income Trajectory</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={dashboardStats.revenueByDay}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueGold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--gold)" stopOpacity={0.55} />
                    <stop offset="100%" stopColor="var(--gold)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="var(--gold)"
                  strokeWidth={2}
                  fill="url(#revenueGold)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-panel min-w-0">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Category Mix</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="72%">
              <PieChart>
                <Pie
                  data={dashboardStats.categoryMix}
                  dataKey="value"
                  innerRadius={55}
                  outerRadius={88}
                  paddingAngle={3}
                  stroke="var(--background)"
                  strokeWidth={2}
                >
                  {dashboardStats.categoryMix.map((c, i) => (
                    <Cell
                      key={c.name}
                      fill={PIE_COLORS[i % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {dashboardStats.categoryMix.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="truncate text-muted-foreground">{c.name}</span>
                  <span className="ml-auto text-foreground">{c.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 sm:gap-6 lg:grid-cols-3">
        <Card className="glass-panel min-w-0 lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-display text-2xl">Recent Rentals</CardTitle>
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              <CalendarCheck className="h-3.5 w-3.5 text-gold" /> Live ledger
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {dashboardStats.recent.map((r) => {
                const item = getItem(r.itemId);
                const customer = getCustomer(r.customerId);
                if (!item || !customer) return null;
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/30 sm:gap-4 sm:px-6 sm:py-4"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      width={56}
                      height={72}
                      loading="lazy"
                      className="h-16 w-12 rounded-sm border border-border object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-lg">{item.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {customer.name} - {r.startDate} to {r.endDate}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm">{formatCurrencyINR(r.total)}</p>
                      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {r.id}
                      </p>
                    </div>
                    <StatusBadge status={r.status} kind="rental" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle className="font-display text-2xl">Top Pieces</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...items]
              .sort((a, b) => b.timesRented - a.timesRented)
              .slice(0, 4)
              .map((item, index) => (

                <div key={item.id} className="flex items-center gap-3">
<span className="w-7 font-display text-3xl text-gold">{index + 1}</span>
                  <img
                    src={item.image}
                    alt={item.name}
                    width={44}
                    height={58}
                    loading="lazy"
                    className="h-14 w-11 rounded-sm border border-border object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.timesRented} rentals - Size {item.size}
                    </p>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

