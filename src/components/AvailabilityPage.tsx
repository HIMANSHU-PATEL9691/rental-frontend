import { useMemo, useState } from "react";
import { useStore } from "@/data/store";
import { CalendarDays, Search, Calendar, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function AvailabilityPage() {
  const { items, rentals, customers } = useStore();
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  const availabilityData = useMemo(() => {
    const query = search.toLowerCase();
    const targetStartStr = startDate <= endDate ? startDate.slice(0, 10) : endDate.slice(0, 10);
    const targetEndStr = startDate <= endDate ? endDate.slice(0, 10) : startDate.slice(0, 10);
    
    return items
      .filter((item) => {
        const searchable = [item.name, item.id, item.category, item.designer].join(" ").toLowerCase();
        return !query || searchable.includes(query);
      })
      .map((item) => {
        const itemRentals = rentals.filter((r) => r.itemId === item.id && (r.status === "active" || r.status === "upcoming" || r.status === "overdue"));
        
        itemRentals.sort((a, b) => (a.startDate || "").localeCompare(b.startDate || ""));
        
        let currentRental = null;
        let nextAvailable = null;

        if (itemRentals.length > 0) {
          currentRental = itemRentals.find(r => {
            const startStr = (r.startDate || "").slice(0, 10);
            const endStr = (r.endDate || "").slice(0, 10);
            
            if (r.status === "overdue") {
              return startStr <= targetEndStr;
            }

            return startStr <= targetEndStr && endStr >= targetStartStr;
          });
          
          if (currentRental) {
             nextAvailable = new Date(currentRental.endDate);
             nextAvailable.setDate(nextAvailable.getDate() + 1);
          }
        }

        return {
          item,
          rentals: itemRentals,
          currentRental,
          nextAvailable
        };
      });
  }, [items, rentals, search, startDate, endDate]);

  const targetStartStr = startDate <= endDate ? startDate.slice(0, 10) : endDate.slice(0, 10);
  const targetEndStr = startDate <= endDate ? endDate.slice(0, 10) : startDate.slice(0, 10);
  const displayDateRange = targetStartStr === targetEndStr 
    ? formatDate(targetStartStr) 
    : `${formatDate(targetStartStr)} to ${formatDate(targetEndStr)}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Timeline</p>
          <h1 className="mt-2 text-3xl font-display font-bold flex items-center gap-3">
            <CalendarDays className="w-8 h-8 text-gold" />
            Availability
          </h1>
          <p className="text-muted-foreground mt-1">
            Check product booking schedules and availability status.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-32">
              <Input value={formatDate(startDate)} readOnly className="pr-8 bg-card border-border" placeholder="Start" />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input 
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.target as HTMLInputElement).showPicker?.();
                  } catch (err) {}
                }}
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-muted-foreground text-sm">to</span>
            <div className="relative w-full sm:w-32">
              <Input value={formatDate(endDate)} readOnly className="pr-8 bg-card border-border" placeholder="End" />
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input 
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                onClick={(e) => {
                  try {
                    (e.target as HTMLInputElement).showPicker?.();
                  } catch (err) {}
                }}
                className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search products..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-card border-border"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {availabilityData.length === 0 ? (
           <div className="p-8 text-center text-muted-foreground border border-border rounded-lg bg-card">
             No products found matching your search.
           </div>
        ) : (
          availabilityData.map(({ item, rentals: itemRentals, currentRental, nextAvailable }) => {
            const isAvailable = !currentRental;
            
            return (
              <Card key={item.id} className="overflow-hidden glass-panel p-0 gap-0">
                <div className="flex flex-col md:flex-row">
                  <div className="md:w-48 shrink-0 bg-secondary/20 border-r border-border p-5 flex flex-col items-center justify-center text-center">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="h-32 w-24 object-cover rounded-md shadow-sm border border-border mb-3" />
                    ) : (
                      <div className="h-32 w-24 bg-secondary border border-border rounded-md shadow-sm mb-3 flex items-center justify-center text-xs text-muted-foreground">No Image</div>
                    )}
                    <h3 className="font-semibold text-sm line-clamp-2">{item.name}</h3>
                    <p className="text-xs text-muted-foreground mt-1">{item.id}</p>
                    <Badge variant={isAvailable ? "default" : "destructive"} className="mt-3">
                      {isAvailable ? "Available" : "Busy"}
                    </Badge>
                  </div>
                  <div className="p-5 flex-1">
                    <div className="mb-5">
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Status: {displayDateRange}</h4>
                      <div className="flex items-center gap-3">
                        {isAvailable ? (
                          <>
                            <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-emerald-500">Available {targetStartStr === targetEndStr ? 'on' : 'from'} {displayDateRange}</p>
                              <p className="text-xs text-muted-foreground">{itemRentals.length > 0 ? "Has upcoming bookings on other dates." : "No upcoming bookings."}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-8 h-8 text-destructive shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-destructive">Busy {targetStartStr === targetEndStr ? 'on' : 'during'} {displayDateRange}</p>
                              {currentRental && (
                                <p className="text-xs text-muted-foreground">Rented from {formatDate(currentRental.startDate)} to {formatDate(currentRental.endDate)}</p>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">Booking Schedule</h4>
                      {itemRentals.length === 0 ? (
                        <p className="text-sm text-muted-foreground bg-secondary/20 p-3 rounded-md border border-border">No active or upcoming bookings for this item.</p>
                      ) : (
                        <div className="space-y-2">
                          {itemRentals.map(rental => {
                             const customer = customers?.find(c => c.id === rental.customerId);
                             const rStartStr = (rental.startDate || "").slice(0, 10);
                             const rEndStr = (rental.endDate || "").slice(0, 10);
                             
                             const isPast = rEndStr < targetStartStr;
                             const isCurrent = rStartStr <= targetEndStr && rEndStr >= targetStartStr;
                             
                             return (
                               <div key={rental.id} className={`p-3 rounded-md border text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${isCurrent ? 'bg-gold/10 border-gold/30' : 'bg-secondary/20 border-border'}`}>
                                 <div>
                                   <div className="font-medium text-foreground">{formatDate(rental.startDate)} <span className="text-muted-foreground mx-1">to</span> {formatDate(rental.endDate)}</div>
                                   <div className="text-xs text-muted-foreground mt-0.5">Bill No: {rental.billNo || rental.id}</div>
                                 </div>
                                 <div className="sm:text-right">
                                   <div className="font-medium text-foreground">{customer?.name || 'Unknown Client'}</div>
                                   <div className="text-xs text-muted-foreground mt-0.5">{customer?.phone || ''}</div>
                                 </div>
                                 <div className="shrink-0">
                                    <Badge variant="outline" className="capitalize">{rental.status}</Badge>
                                 </div>
                               </div>
                             );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}