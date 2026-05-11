import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useMemo, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Filter, UserCheck, UserX, Trash2, Calendar } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  if (parts.length === 2) return `${parts[1]}/${parts[0]}`;
  return dateStr;
}

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports - Velvet Vault" },
      {
        name: "description",
        content: "Daily and monthly financial reports.",
      },
    ],
  }),
  beforeLoad: () => {
    if (typeof window !== "undefined") {
      const role = localStorage.getItem("user_role");
      if (!role) {
        throw redirect({ to: "/login" });
      }
      if (role !== "admin") {
        throw redirect({ to: "/availability" });
      }
    }
  },
  component: ReportsPage,
});

function ReportsPage() {
  const { rentals, items, customers, loading } = useStore();
  const [reportType, setReportType] = useState<"daily" | "monthly" | "items" | "staff">("daily");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [staffList, setStaffList] = useState<any[]>([]);

  const pendingStaff = staffList.filter((s: any) => s.status === 'pending' || !s.status);
  const approvedStaff = staffList.filter((s: any) => s.status !== 'pending' && s.status);

  const filteredRentals = useMemo(() => {
    if (reportType === "daily") {
      return rentals.filter(r => (r.createdAt || r.startDate || "").slice(0, 10) === selectedDate);
    } else {
      return rentals.filter(r => (r.createdAt || r.startDate || "").slice(0, 7) === selectedMonth);
    }
  }, [rentals, reportType, selectedDate, selectedMonth]);

  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalDiscount = 0;
    let totalAdvance = 0;
    let newRentalsCount = filteredRentals.length;

    filteredRentals.forEach(r => {
      totalIncome += (r.total || 0) + (r.penalty || 0);
      totalDiscount += r.discount || 0;
      totalAdvance += r.advance || 0;
    });

    return { totalIncome, totalDiscount, totalAdvance, newRentalsCount };
  }, [filteredRentals]);

  const itemStats = useMemo(() => {
    if (reportType !== "items") return [];
    return items.map(item => {
      const itemRentals = rentals.filter(r => r.itemId === item.id);
      const revenue = itemRentals.reduce((sum, r) => sum + (r.total || 0) + (r.penalty || 0), 0);
      return {
        ...item,
        revenue,
        rentalCount: itemRentals.length
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [items, rentals, reportType]);

  const loadUsers = async () => {
    try {
      console.log("[Staff Report] Fetching users...");
      const res = await fetch("http://localhost:3011/api/auth/users", { headers: { 'x-user-role': localStorage.getItem('user_role') || '' } });
      if (res.ok) {
        const data = await res.json();
        console.log("[Staff Report] Users fetched:", data);
        const userArray = Array.isArray(data) ? data : data.users || [];
        // Map MongoDB _id to id for compatibility
        const formattedData = userArray.map((u: any) => ({ ...u, id: u.id || u._id }));
        setStaffList(formattedData.filter((u: any) => u.role !== "admin"));
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error("[Staff Report] Failed to fetch users:", errData);
        toast.error(errData.error || "Failed to load staff list from backend. (Check backend routes)");
      }
    } catch (err) {
      console.error("Failed to load users", err);
      toast.error("Could not connect to backend to load staff.");
    }
  };

  useEffect(() => {
    if (reportType === "staff") {
      loadUsers();
    }
  }, [reportType]);

  const updateUserStatus = async (identifier: string, status: string, message: string) => {
    try {
      console.log(`[Staff Report] Updating user status: ${identifier} -> ${status}`);
      const res = await fetch(`http://localhost:3011/api/auth/users/${identifier}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        console.log(`[Staff Report] User status updated successfully.`);
        toast.success(message);
        loadUsers();
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error(`[Staff Report] Failed to update user status:`, errData);
        toast.error(errData.error || "Failed to update status on server.");
      }
    } catch (err) {
      console.error(`[Staff Report] Error updating user status:`, err);
      toast.error("Error connecting to server.");
    }
  };

  const removeUser = async (identifier: string, message: string) => {
    try {
      console.log(`[Staff Report] Removing user: ${identifier}`);
      const res = await fetch(`http://localhost:3011/api/auth/users/${identifier}`, {
        method: "DELETE"
      });
      if (res.ok) {
        console.log(`[Staff Report] User removed successfully.`);
        toast.success(message);
        loadUsers();
      } else {
        const errData = await res.json().catch(() => ({}));
        console.error(`[Staff Report] Failed to remove user:`, errData);
        toast.error(errData.error || "Failed to delete user on server.");
      }
    } catch (err) {
      console.error(`[Staff Report] Error removing user:`, err);
      toast.error("Error connecting to server.");
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading reports...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Financial</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl flex items-center gap-3">
            <FileText className="w-8 h-8 text-gold" />
            Reports
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            View daily and monthly booking and revenue reports.
          </p>
        </div>
      </div>

      <Tabs value={reportType} onValueChange={(v) => setReportType(v as "daily" | "monthly" | "items" | "staff")} className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between gap-4">
          <TabsList>
            <TabsTrigger value="daily">Daily Report</TabsTrigger>
            <TabsTrigger value="monthly">Monthly Report</TabsTrigger>
            <TabsTrigger value="items">Item Report</TabsTrigger>
            <TabsTrigger value="staff">Staff Report</TabsTrigger>
          </TabsList>
          
          {reportType !== "items" && reportType !== "staff" && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              {reportType === "daily" ? (
                <div className="relative w-full sm:w-40 shrink-0">
                  <Input value={formatDate(selectedDate)} readOnly className="pr-8 bg-card border-border" />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                    onClick={(e) => {
                      try { (e.target as HTMLInputElement).showPicker?.(); } catch (err) {}
                    }}
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              ) : (
                <div className="relative w-full sm:w-40 shrink-0">
                  <Input value={formatDate(selectedMonth)} readOnly className="pr-8 bg-card border-border" />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    onClick={(e) => {
                      try { (e.target as HTMLInputElement).showPicker?.(); } catch (err) {}
                    }}
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {reportType === "staff" ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="glass-panel overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-gold" />
                  Pending Requests ({pendingStaff.length})
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto border-t border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-secondary/40">
                      <TableHead className="text-xs uppercase tracking-wider">Employee Details</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingStaff.length === 0 ? (
                      <TableRow className="border-border hover:bg-transparent">
                        <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                          No pending signup requests.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingStaff.map((staff, i) => (
                        <TableRow key={i} className="border-border hover:bg-secondary/30">
                          <TableCell>
                            <div className="font-medium">{staff.name}</div>
                            <div className="text-xs text-muted-foreground mb-1">{staff.phone || staff.email}</div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-medium bg-gold/10 text-gold border border-gold/20">Pending</span>
                          </TableCell>
                          <TableCell className="text-right align-top pt-4">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90 h-8" onClick={() => updateUserStatus(staff.id || staff.phone || staff.email, "active", `Approved ${staff.name}`)}>
                                <UserCheck className="w-4 h-4 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="destructive" className="h-8" onClick={() => window.confirm(`Reject ${staff.name}?`) && removeUser(staff.id || staff.phone || staff.email, `Rejected ${staff.name}`)}>
                                <UserX className="w-4 h-4 mr-1" /> Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card className="glass-panel overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-emerald-500" />
                  Approved Employees ({approvedStaff.length})
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto border-t border-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border bg-secondary/40">
                      <TableHead className="text-xs uppercase tracking-wider">Staff Member</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedStaff.length === 0 ? (
                      <TableRow className="border-border hover:bg-transparent">
                        <TableCell colSpan={2} className="py-10 text-center text-muted-foreground">
                          No approved employees found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      approvedStaff.map((staff, i) => (
                        <TableRow key={i} className="border-border hover:bg-secondary/30">
                          <TableCell>
                            <div className="font-medium">{staff.name}</div>
                            <div className="text-xs text-muted-foreground mb-1">{staff.phone || staff.email}</div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Approved Active</span>
                          </TableCell>
                          <TableCell className="text-right align-top pt-4">
                            <div className="flex justify-end items-center gap-2">
                              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => updateUserStatus(staff.id || staff.phone || staff.email, "pending", `Revoked access for ${staff.name}`)}>
                                Revoke
                              </Button>
                              <Button size="icon" variant="destructive" className="h-8 w-8" onClick={() => window.confirm(`Completely delete ${staff.name}?`) && removeUser(staff.id || staff.phone || staff.email, `Deleted account for ${staff.name}`)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        ) : reportType === "items" ? (
          <Card className="glass-panel overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">All-Time Item Performance</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs uppercase tracking-wider">Item ID</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Piece</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Category</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">Total Rentals</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">Revenue Generated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemStats.length === 0 ? (
                    <TableRow className="border-border hover:bg-transparent">
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No items found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itemStats.map(item => (
                      <TableRow key={item.id} className="border-border hover:bg-secondary/30">
                        <TableCell className="whitespace-nowrap text-muted-foreground">{item.id}</TableCell>
                        <TableCell>
                          <div className="truncate max-w-50 font-medium">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground">{item.designer}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{item.category}</div>
                          <div className="text-[10px] text-muted-foreground">{item.subcategory}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.rentalCount}</TableCell>
                        <TableCell className="text-right text-gold font-medium">{formatCurrencyINR(item.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="glass-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-normal">
                    Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-3xl">{stats.newRentalsCount}</div>
                </CardContent>
              </Card>
              <Card className="glass-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-normal">
                    Total Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-3xl text-gold">{formatCurrencyINR(stats.totalIncome)}</div>
                </CardContent>
              </Card>
              <Card className="glass-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-normal">
                    Advance Collected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-3xl text-emerald-500">{formatCurrencyINR(stats.totalAdvance)}</div>
                </CardContent>
              </Card>
              <Card className="glass-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-normal">
                    Discounts Given
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-3xl">{formatCurrencyINR(stats.totalDiscount)}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="glass-panel overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">
                  {reportType === "daily" ? `Bookings on ${formatDate(selectedDate)}` : `Bookings in ${formatDate(selectedMonth)}`}
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs uppercase tracking-wider">Date</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Bill No</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Client</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Piece</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Value</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Advance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRentals.length === 0 ? (
                      <TableRow className="border-border hover:bg-transparent">
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No bookings found for the selected period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRentals.map(r => {
                        const client = customers.find(c => c.id === r.customerId);
                        const item = items.find(i => i.id === r.itemId);
                        return (
                          <TableRow key={r.id} className="border-border hover:bg-secondary/30">
                            <TableCell className="whitespace-nowrap">{formatDate((r.createdAt || r.startDate || "").slice(0, 10))}</TableCell>
                            <TableCell>{r.billNo || r.id}</TableCell>
                            <TableCell>{client?.name || "Unknown"}</TableCell>
                            <TableCell>
                              <div className="truncate max-w-50">{item?.name || "Unknown"}</div>
                              <div className="text-[10px] text-muted-foreground">{r.itemNo || r.itemId}</div>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrencyINR(r.total || 0)}</TableCell>
                            <TableCell className="text-right text-emerald-500">{formatCurrencyINR(r.advance || 0)}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </>
        )}
      </Tabs>
    </AppShell>
  );
}