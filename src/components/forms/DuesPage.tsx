import { useMemo } from "react";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / 86400000));
}

export function DuesPage() {
  const { rentals, items, customers } = useStore();

  const duesList = useMemo(() => {
    const list = rentals
      .map((rental) => {
        const item = items.find((i) => i.id === rental.itemId);
        const customer = customers.find((c) => c.id === rental.customerId);
        
        const subtotal = (rental as any).rate ?? (item ? item.pricePerDay * daysBetween(rental.startDate, rental.endDate) : 0);
        const discount = rental.discount || 0;
        const advance = rental.advance || 0;

        // Keep price stable for upcoming/active.
        // Only compute penalty dynamically for overdue.
        const dynamicPenalty = (() => {
          if (rental.status !== "overdue") return rental.penalty || 0;

          let penalty = rental.penalty || 0;
          const end = new Date(rental.endDate).getTime();
          const now = new Date(today()).getTime();

          if (item && now > end) {
            const overdueDays = Math.floor((now - end) / 86400000);
            if (overdueDays > 0) {
              penalty = Math.max(penalty, overdueDays * item.pricePerDay);
            }
          }

          return penalty;
        })();

        const totalAfterDiscount = Math.max(0, subtotal - discount);
        const totalWithPenalty = totalAfterDiscount + dynamicPenalty;
        const finalDue = Math.max(0, totalWithPenalty - advance);


        return {
          ...rental,
          customer,
          item,
          finalDue,
        };
      })
      .filter((r) => r.finalDue > 0);

    // Sort by highest due amount first
    return list.sort((a, b) => b.finalDue - a.finalDue);
  }, [rentals, items, customers]);

  const handleWhatsApp = (phone: string, name: string, due: number, billNo: string) => {
    const message = `Hello ${name}, this is a gentle reminder from ARIHANT COLLECTION regarding your pending balance of ${formatCurrencyINR(due)} for Bill No: ${billNo || "N/A"}. Please clear your dues at the earliest. Thank you!`;
    
    // Strip non-numeric characters from the phone number for the WhatsApp URL
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-gold">Pending Dues</h1>
        <p className="text-muted-foreground mt-1">
          List of all customers with outstanding balances and overdue penalties.
        </p>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        <div className="w-full overflow-x-auto">
<table className="w-full min-w-200 caption-bottom text-sm">

            <thead className="[&_tr]:border-b bg-secondary/40">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Bill No</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Customer</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Phone</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Balance Due</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {duesList.length === 0 ? (
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <td colSpan={6} className="p-4 align-middle text-center py-8 text-muted-foreground">
                    No pending dues found. Everyone is cleared!
                  </td>
                </tr>
              ) : (
                duesList.map((due) => (
                  <tr key={due.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                    <td className="p-4 align-middle font-medium">{due.billNo || due.id}</td>
                    <td className="p-4 align-middle">
                      <div className="font-semibold">{due.customer?.name || "Unknown"}</div>
                      <div className="text-[10px] text-muted-foreground">{due.item?.name || "Unknown item"}</div>
                    </td>
                    <td className="p-4 align-middle">{due.customer?.phone || "N/A"}</td>
                    <td className="p-4 align-middle capitalize">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        due.status === 'overdue' ? 'bg-red-500/10 text-red-500' :
                        due.status === 'active' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-secondary text-secondary-foreground'
                      }`}>
                        {due.status}
                      </span>
                    </td>
                    <td className="p-4 align-middle text-right font-bold text-red-500">
                      {formatCurrencyINR(due.finalDue)}
                    </td>
                    <td className="p-4 align-middle text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!due.customer?.phone}
                        onClick={() =>
                          handleWhatsApp(
                            due.customer!.phone,
                            due.customer!.name,
                            due.finalDue,
                            due.billNo || due.id
                          )
                        }
                        className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                      >
                        <MessageCircle className="w-4 h-4" />
                        WhatsApp
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}