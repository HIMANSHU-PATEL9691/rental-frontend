import { useState, type ReactNode } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/data/store";

const schema = z.object({
  name: z.string().trim().min(1, "Name required").max(100),
  email: z.string().trim().email("Invalid email").max(255),
  phone: z.string().trim().min(4, "Phone required").max(40),
  tier: z.enum(["Standard", "Gold", "Platinum"]),
});

export function AddCustomerDialog({
  trigger,
  open,
  onOpenChange,
  onCreated,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (id: string) => void;
}) {
  const { addCustomer } = useStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    tier: "Standard" as "Standard" | "Gold" | "Platinum",
  });

  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      const customer = await addCustomer(parsed.data);
      toast.success(`Welcomed ${customer.name}`);
      setForm({ name: "", email: "", phone: "", tier: "Standard" });
      setOpen(false);
      onCreated?.(customer.id);
    } catch (error) {
      toast.error("Failed to add customer");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add a Client</DialogTitle>
          <DialogDescription>
            Welcome a new member to the maison.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="cname">Name</Label>
            <Input
              id="cname"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Eloise Marchand"
              maxLength={100}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cemail">Email</Label>
            <Input
              id="cemail"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="eloise@example.com"
              maxLength={255}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cphone">Phone</Label>
            <Input
              id="cphone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+33 6 21 44 80 12"
              maxLength={40}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ctier">Tier</Label>
            <Select
              value={form.tier}
              onValueChange={(v: "Standard" | "Gold" | "Platinum") =>
                setForm({ ...form, tier: v })
              }
            >
              <SelectTrigger id="ctier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["Standard", "Gold", "Platinum"] as const).map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
