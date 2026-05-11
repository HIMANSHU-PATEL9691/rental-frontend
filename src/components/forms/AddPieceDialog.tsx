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
import { formatCurrencyINR } from "@/lib/utils";
import { X } from "lucide-react";
import type { ItemStatus } from "@/data/mock";

const CATEGORIES = {
  MENS: "Mens",
  WOMENS: "Women's",
};

const SUBCATEGORY_BY_CATEGORY = {
  "Mens": [
    "Suit", 
    "Jodhpuri", 
    "Sherwani",
    "Accessories"
  ],
  "Women's": [
    "Lehanga", 
    "Sider jewellery", 
    "Bridal jewellery",
    "Accessories"
  ]
};

const schema = z.object({
  customId: z.string().trim().min(1, "Required").max(40),
  name: z.string().trim().min(1, "Required").max(80),
  designer: z.string().trim().min(1, "Required").max(60),
  category: z.string().trim().min(1, "Required").max(20),
  subcategory: z.string().trim().min(1, "Required").max(40),
  size: z.string().trim().min(1, "Required").max(8),
  color: z.string().trim().min(1, "Required").max(30),
  pricePerDay: z.coerce.number().min(0),
  retailValue: z.coerce.number().min(0).optional(),
  status: z.enum(["available", "rented", "cleaning", "reserved"]),
  images: z.array(z.string()).optional(),
});

const FALLBACK_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 400'><rect width='300' height='400' fill='%23eee'/><text x='150' y='200' text-anchor='middle' font-family='serif' font-size='28' fill='%23999'>Velvet Vault</text></svg>`,
  );

export function AddPieceDialog({
  trigger,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { addItem } = useStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const [form, setForm] = useState({
    customId: "",
    name: "",
    designer: "",
    category: CATEGORIES.WOMENS,
    subcategory: SUBCATEGORY_BY_CATEGORY[CATEGORIES.WOMENS as keyof typeof SUBCATEGORY_BY_CATEGORY][0],
    size: "M",
    color: "",
    pricePerDay: "",
    retailValue: "",
    status: "available" as ItemStatus,
    images: [] as string[],
  });

  function reset() {
    setForm({
      customId: "",
      name: "",
      designer: "",
      category: CATEGORIES.WOMENS,
      subcategory: SUBCATEGORY_BY_CATEGORY[CATEGORIES.WOMENS as keyof typeof SUBCATEGORY_BY_CATEGORY][0],
      size: "M",
      color: "",
      pricePerDay: "",
      retailValue: "",
      status: "available",
      images: [],
    });
  }

  const [loading, setLoading] = useState(false);

  function handleImagesUpload(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`File ${file.name} is not an image`);
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`Image ${file.name} must be smaller than 2 MB`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          setForm((current) => ({ ...current, images: [...current.images, reader.result as string] }));
        }
      };
      reader.onerror = () => {
        toast.error(`Could not read image file ${file.name}`);
      };
      reader.readAsDataURL(file);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    console.info("[AddPieceDialog] submit started", form);
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      console.warn("[AddPieceDialog] validation failed", parsed.error.issues);
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      console.info("[AddPieceDialog] calling addItem");
      const item = await addItem({
        ...parsed.data,
        retailValue: parsed.data.retailValue ?? 0,
        image: parsed.data.images?.[0] || FALLBACK_IMG,
        images: parsed.data.images || [],
      } as any);
      console.info("[AddPieceDialog] addItem success", item);
      toast.success(`Added ${item.name} to the vault`);
      reset();
      setOpen(false);
    } catch (error) {
      console.error("[AddPieceDialog] addItem failed", error);
      toast.error("Failed to add item");
    } finally {
      setLoading(false);
      console.info("[AddPieceDialog] submit finished");
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add a Piece</DialogTitle>
          <DialogDescription>Catalog a new item in the vault.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="customId">Item No</Label>
              <Input
                id="customId"
                value={form.customId}
                onChange={(e) => setForm({ ...form, customId: e.target.value })}
                placeholder="e.g. VV-1234"
                maxLength={40}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Onyx Tuxedo Coat"
                maxLength={80}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="designer">Designer</Label>
              <Input
                id="designer"
                value={form.designer}
                onChange={(e) => setForm({ ...form, designer: e.target.value })}
                placeholder="Maison Noir"
                maxLength={60}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => {
                  const firstSubcategory = SUBCATEGORY_BY_CATEGORY[v as keyof typeof SUBCATEGORY_BY_CATEGORY][0];
                  setForm({ ...form, category: v, subcategory: firstSubcategory });
                }}
              >
                <SelectTrigger id="category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.values(CATEGORIES).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="subcategory">Subcategory</Label>
            <Select
              value={form.subcategory}
              onValueChange={(v) => setForm({ ...form, subcategory: v })}
            >
              <SelectTrigger id="subcategory">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBCATEGORY_BY_CATEGORY[form.category as keyof typeof SUBCATEGORY_BY_CATEGORY]?.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="size">Size</Label>
              <Select
                value={form.size}
                onValueChange={(v) => setForm({ ...form, size: v })}
              >
                <SelectTrigger id="size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["XS", "S", "M", "L", "XL"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 col-span-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                placeholder="Emerald"
                maxLength={30}
                required
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="price">Rental value (INR)</Label>
            <Input
              id="price"
              type="number"
              min={0}
              value={form.pricePerDay}
              onChange={(e) =>
                setForm({ ...form, pricePerDay: e.target.value })
              }
              placeholder={formatCurrencyINR(95)}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(v: ItemStatus) =>
                setForm({ ...form, status: v })
              }
            >
              <SelectTrigger id="status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["available", "rented", "cleaning", "reserved"] as const).map(
                  (s) => (
                    <SelectItem key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="image">Upload Image</Label>
            <div className="grid gap-3 rounded-md border border-border bg-secondary/30 p-4">
              {form.images && form.images.length > 0 ? (
                <div className="flex flex-wrap gap-3">
                  {form.images.map((img, idx) => (
                    <div key={idx} className="relative group shrink-0">
                      <img
                        src={img}
                        alt={`Preview ${idx + 1}`}
                        className="h-20 w-16 rounded-sm border border-border object-cover shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setForm(c => ({ ...c, images: c.images.filter((_, i) => i !== idx) }))}
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Add a clear garment photo. JPG, PNG, or WEBP up to 2 MB.
                </p>
              )}
              <Input
                id="image"
                type="file"
                multiple
                accept="image/*"
                onChange={(e) => handleImagesUpload(e.target.files)}
              />
            </div>
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
              {loading ? "Adding..." : "Add Piece"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
