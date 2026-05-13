import { useMemo, useState, useEffect, type ReactNode } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import type { RentalStatus } from "@/data/mock";

import { AddCustomerDialog } from "./AddCustomerDialog";
import { AddPieceDialog } from "./AddPieceDialog";
import { Plus, Trash2, Calendar } from "lucide-react";

const schema = z
  .object({
    billNo: z.string().trim().max(40).optional().or(z.literal("")),

    address: z.string().trim().min(1, "Address required").max(200),
    customerId: z.string().min(1, "Select a client"),
    discount: z.number().min(0, "Discount cannot be negative"),
    advance: z.number().min(0, "Advance cannot be negative"),
    securityAmount: z.number().min(0, "Security amount cannot be negative"),
    signature: z.string().optional(),
    status: z.enum(["active", "upcoming", "returned", "overdue"]),
    pieces: z.array(
      z.object({
        id: z.string(),
        itemId: z.string().min(1, "Select a piece"),
        itemNo: z.string().trim().min(1, "Item number required").max(40),
        deliveryDate: z.string().min(1, "Delivery date required"),
        startDate: z.string().min(1, "Start date required"),
        endDate: z.string().min(1, "End date required"),
        rate: z.number().min(0, "Rate cannot be negative"),
        remark: z.string().trim().max(300).optional(),
      })
    ).min(1, "Add at least one piece"),
  })

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / 86400000));
}

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const DEFAULT_POLICIES = `1. Please return the rented piece on or before the due date to avoid penalty charges.\n2. Any damage, burns, or alterations to the piece will incur additional fees.\n3. Booking advance is strictly non-refundable.\n4. Original ID proof must be deposited at the time of pickup.\n\n1. कृपया पेनल्टी शुल्क से बचने के लिए किराए पर ली गई ड्रेस को नियत तारीख पर या उससे पहले वापस करें।\n2. ड्रेस में किसी भी प्रकार का नुकसान, जलने या बदलाव होने पर अतिरिक्त शुल्क लिया जाएगा।\n3. बुकिंग एडवांस वापस नहीं किया जाएगा।\n4. पिकअप के समय मूल आईडी प्रूफ जमा करना अनिवार्य है।`;
function getPoliciesHtml() {
  const policies = typeof window !== "undefined" ? localStorage.getItem("rental_policies") ?? DEFAULT_POLICIES : DEFAULT_POLICIES;
  return policies.replace(/\n/g, "<br/>");
}

export function NewRentalDialog({
  trigger,
  open,
  onOpenChange,
}: {
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { items, customers, rentals, addRental } = useStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  const [form, setForm] = useState({
    billNo: "",

    address: "",
    customerId: "",
    discount: 0,
    advance: 0,
    securityAmount: 0,
    signature: "",
    status: "upcoming" as RentalStatus,
    pieces: [
      {
        id: Math.random().toString(),
        itemId: "",
        itemNo: "",
        deliveryDate: today(),
        startDate: today(),
        endDate: today(),
        rate: 0,
        remark: "",
      }
    ]
  });

  const [addPieceOpen, setAddPieceOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === form.customerId),
    [customers, form.customerId],
  );
  const piecesTotal = form.pieces.reduce((acc, p) => {
    return acc + (p.rate || 0);
  }, 0);
  const netTotal = Math.max(0, piecesTotal - form.discount);
  const balanceDue = Math.max(0, netTotal - form.advance);

  const [loading, setLoading] = useState(false);
  const [billNoLoading, setBillNoLoading] = useState(false);


  function handleSignatureUpload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file for the signature");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Signature file must be smaller than 2 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setForm((current) => ({ ...current, signature: reader.result as string }));
      }
    };
    reader.onerror = () => {
      toast.error("Could not read signature file");
    };
    reader.readAsDataURL(file);
  }

  async function ensureBillNo() {
    if (form.billNo?.trim()) return form.billNo;
    setBillNoLoading(true);

    // Find gaps and reuse the lowest available deleted bill number
    const existingNos = rentals
      .map((r) => r.billNo)
      .filter(Boolean)
      .map((b) => {
        const match = String(b).match(/BILL-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);

    const sorted = Array.from(new Set(existingNos)).sort((a, b) => a - b);
    let nextSeq = 1;
    for (const num of sorted) {
      if (num === nextSeq) {
        nextSeq++;
      } else if (num > nextSeq) {
        break;
      }
    }
    const generated = `BILL-${String(nextSeq).padStart(4, "0")}`;

    setForm((c) => ({ ...c, billNo: generated }));
    setBillNoLoading(false);
    return generated;
  }

  function getInvoiceContent() {

    return `
      <style>
        .header { display: flex; align-items: center; border-bottom: 2px solid #d4af37; padding-bottom: 6px; margin-bottom: 10px; }
        .logo { width: 45px; height: 45px; margin-right: 12px; }
        .company-info h1 { margin: 0; font-size: 18px; color: #111; letter-spacing: 1.2px; text-transform: uppercase; }
        .company-info p { margin: 2px 0 0 0; color: #666; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
        .invoice-title { margin-left: auto; text-align: right; }
        .invoice-title h2 { margin: 0; color: #d4af37; font-size: 22px; letter-spacing: 1.2px; text-transform: uppercase; }
        .invoice-title p { margin: 2px 0 0 0; font-size: 11px; color: #555; }
        .grid { display: flex; justify-content: space-between; margin-bottom: 10px; gap: 15px; }
        .col { flex: 1; }
        .label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .value { font-size: 11px; margin: 0 0 2px 0; line-height: 1.3; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #eaeaea; font-size: 11px; }
        th { font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; border-bottom: 2px solid #222; }
        .text-right { text-align: right; }
        .summary-box { width: 50%; margin-left: auto; }
        .row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eaeaea; font-size: 11px; }
        .row.total { font-weight: bold; font-size: 13px; border-top: 2px solid #222; border-bottom: none; padding-top: 6px; margin-top: 4px; color: #d4af37; }
        .signatures { display: flex; justify-content: space-between; margin-top: 20px; page-break-inside: avoid; }
        .sign-box { flex: 0 0 40%; text-align: center; min-height: 50px; border-bottom: 1px solid #222; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 4px; }
        .sign-box p { margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
        .sign-img { max-height: 45px; max-width: 100%; margin: 0 auto 4px auto; object-fit: contain; }
        .invoice-half { min-height: 100%; padding: 5mm 0; box-sizing: border-box; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; }
        tr { page-break-inside: avoid; }
      </style>
      <div class="invoice-half">
        <div class="header">
          <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="#111" rx="8" />
            <text x="50" y="62" text-anchor="middle" font-family="Georgia, serif" font-size="38" fill="#d4af37" font-style="italic">AC</text>
          </svg>
          <div class="company-info">
            <h1>ARIHANT COLLECTION</h1>
            <p>Rental Point</p>
          </div>
          <div class="invoice-title">
            <h2>Booking Invoice</h2>
            <p># ${form.billNo || "DRAFT"}</p>
          </div>
        </div>
        
        <div class="grid">
          <div class="col">
            <div class="label">Billed To</div>
            <p class="value"><strong>${selectedCustomer?.name || "-"}</strong></p>
            <p class="value">${selectedCustomer?.email || ""}</p>
            <p class="value">${selectedCustomer?.phone || ""}</p>
            <p class="value">${form.address || ""}</p>
          </div>
          <div class="col" style="text-align: right;">
            <div class="label">Rental Details</div>
            <p class="value"><strong>Status:</strong> ${form.status.toUpperCase()}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 60px;">Image</th>
              <th>Item Description & Dates</th>
              <th>Item No</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${form.pieces.map(p => {
              const item = items.find(i => i.id === p.itemId);
              const lineTot = p.rate || 0;
              return `<tr>
                <td>${item?.image ? `<img src="${item.image}" style="width: 35px; height: 45px; object-fit: cover; border-radius: 3px;" />` : ""}</td>
                <td><strong>${item?.name || "-"}</strong><br/><span style="font-size: 9px; color: #666;">${item?.designer || ""}</span><br/><span style="font-size: 9px; color: #666;">Del: ${formatDate(p.deliveryDate)} | Return: ${formatDate(p.endDate)}</span></td>
                <td>${p.itemNo || "-"}</td>
                <td class="text-right">${formatCurrencyINR(p.rate ?? 0)}</td>
                <td class="text-right">${formatCurrencyINR(lineTot)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>

        <div class="summary-box">
          <div class="row"><span>Subtotal</span><span>${formatCurrencyINR(piecesTotal)}</span></div>
          <div class="row"><span>Discount</span><span>${formatCurrencyINR(form.discount)}</span></div>
          <div class="row"><span>Advance / Paid</span><span>${formatCurrencyINR(form.advance)}</span></div>
          <div class="row"><span>Security Deposit</span><span>${formatCurrencyINR(form.securityAmount)}</span></div>
          <div class="row total"><span>Balance Due</span><span>${formatCurrencyINR(balanceDue)}</span></div>
        </div>

        <div style="margin-top: 20px; font-size: 10px; color: #555; border-top: 1px solid #eaeaea; padding-top: 10px; line-height: 1.5;">
          <strong style="color: #222; font-size: 11px;">Terms & Conditions:</strong><br/>
          ${getPoliciesHtml()}
        </div>

        <div class="signatures" style="margin-top: 30px;">
          <div class="sign-box">
            ${form.signature ? `<img src="${form.signature}" class="sign-img" />` : ""}
            <p>Authorized Signature</p>
          </div>
          <div class="sign-box">
            <p>Client Signature</p>
          </div>
        </div>
      </div>
    `;
  }

  async function shareOnWhatsApp() {
    toast.info("Generating PDF for WhatsApp...");
    try {
      // @ts-ignore
      const html2pdf = (await import("html2pdf.js")).default;

      const htmlString = `
        <div id="pdf-container" style="background-color: #ffffff; color: #000000; padding: 0; margin: 0; width: 100%;">
          <style>
            #pdf-container, #pdf-container * {
              border-color: #e5e7eb !important;
              outline-color: #e5e7eb !important;
            }
          </style>
          ${getInvoiceContent()}
        </div>
      `;

      const filename = `Invoice-${form.billNo || "DRAFT"}.pdf`;
      const opt = {
        margin: 2,
        filename,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          ignoreElements: (element: Element) => {
            if (element.tagName === "STYLE" || element.tagName === "LINK") {
              const href = (element as HTMLLinkElement).href || "";
              if (href.includes("fonts.googleapis") || href.includes("fonts.gstatic")) return false;
              if (element.closest && element.closest("#pdf-container")) return false;
              return true;
            }
            return false;
          }
        },
        jsPDF: { unit: "mm" as const, format: "a4", orientation: "portrait" as const },
      };

      const pdfBlob = await html2pdf().set(opt).from(htmlString).outputPdf("blob");

      const file = new File([pdfBlob], filename, { type: "application/pdf" });

      // Check if native mobile sharing API supports sharing PDF files directly
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: filename,
          text: "Here is your rental booking invoice from ARIHANT COLLECTION.",
        });
        toast.success("Shared successfully!");
      } else {
        // Desktop fallback: Download the PDF, then open WhatsApp Web
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        toast.success("PDF downloaded! Please attach it in WhatsApp.");
        window.open(
          `https://wa.me/?text=${encodeURIComponent(
            "Here is your rental booking invoice from ARIHANT COLLECTION. Please find the attached PDF."
          )}`,
          "_blank"
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF. Is html2pdf.js installed?");
    }
  }

  function printInvoice() {
    if (typeof window === "undefined") return;

    const invoiceHtml = `
      <html>
        <head>
          <title>Invoice ${form.billNo || ""}</title>
          <style>
                    @page { size: A4; margin: 10mm 15mm; }
                    body { margin: 0; padding: 0; background: #fff; }
          </style>
        </head>
        <body>
          ${getInvoiceContent()}
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) {
      toast.error("Unable to open print window.");
      return;
    }
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Ensure billNo is filled automatically before validation/submission.
    const finalBillNo = await ensureBillNo();
    const parsed = schema.safeParse({ ...form, billNo: finalBillNo });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    if (parsed.data.pieces.some((p) => new Date(p.endDate) < new Date(p.deliveryDate))) {
      toast.error("End date must be after delivery date for all pieces");
      return;
    }

    const piecesData = parsed.data.pieces.map((p) => {
      const item = items.find((i) => i.id === p.itemId);
      const lineTotal = p.rate;
      return { ...p, item, lineTotal };
    });

    if (piecesData.some((p) => !p.item)) {
      toast.error("Select a valid piece for all entries");
      return;
    }

    for (const p of parsed.data.pieces) {
      const newStart = new Date(p.deliveryDate);
      newStart.setHours(0, 0, 0, 0);
      const newEnd = new Date(p.endDate);
      newEnd.setHours(0, 0, 0, 0);

      const overlappingRental = rentals.find((r) => {
        if (r.itemId !== p.itemId) return false;
        if (r.status === "returned") return false;

        const existingStart = new Date(r.startDate || r.deliveryDate || "");
        existingStart.setHours(0, 0, 0, 0);
        const existingEnd = new Date(r.endDate || "");
        existingEnd.setHours(0, 0, 0, 0);

        return newStart.getTime() <= existingEnd.getTime() && newEnd.getTime() >= existingStart.getTime();
      });

      if (overlappingRental) {
        const item = items.find((i) => i.id === p.itemId);
        toast.error(`"${item?.name || p.itemId}" is already booked from ${formatDate(overlappingRental.startDate)} to ${formatDate(overlappingRental.endDate)}.`);
        return;
      }
    }

    setLoading(true);
    try {
      const rentalPromises = piecesData.map((p) => {
        const ratio = piecesTotal > 0 ? p.lineTotal / piecesTotal : 1 / piecesData.length;

        const payload: any = {
          billNo: parsed.data.billNo,
          address: parsed.data.address,
          customerId: parsed.data.customerId,
          discount: Math.round(parsed.data.discount * ratio),
          advance: Math.round(parsed.data.advance * ratio),
          securityAmount: Math.round(parsed.data.securityAmount * ratio),
          remark: p.remark || "",
          signature: parsed.data.signature || "",
          status: parsed.data.status,
          rate: p.rate,

          itemId: p.itemId,
          itemNo: p.itemNo,
          deliveryDate: p.deliveryDate,
          startDate: p.deliveryDate,
          endDate: p.endDate,

          total: Math.max(0, p.lineTotal - Math.round(parsed.data.discount * ratio)),
          category: p.item?.category || "Uncategorized",
          subcategory: (p.item as any)?.subcategory || "Uncategorized",
        };

        return addRental(payload);
      });

      await Promise.all(rentalPromises);

      toast.success(`Booked ${piecesData.length} piece(s) successfully`);
      setForm({
        billNo: "",
        address: "",
        customerId: "",
        discount: 0,
        advance: 0,
        securityAmount: 0,
        signature: "",
        status: "upcoming",
        pieces: [
          {
            id: Math.random().toString(),
            itemId: "",
            itemNo: "",
            deliveryDate: today(),
            startDate: today(),
            endDate: today(),
            rate: 0,
            remark: "",
          }
        ]
      });
      setOpen(false);
    } catch (error) {
      toast.error("Failed to create rental");
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setOpen}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              New Rental
            </DialogTitle>
            <DialogDescription>
              Reserve a piece for a client.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="billNo">Bill No</Label>
              <Input
                id="billNo"
                value={form.billNo}
                onChange={(e) => setForm({ ...form, billNo: e.target.value })}
                placeholder={billNoLoading ? "Generating..." : "Auto-generated on submit"}
                maxLength={40}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="client">Client</Label>
                <button
                  type="button"
                  onClick={() => setAddClientOpen(true)}
                  className="text-[11px] text-gold hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" /> Add client
                </button>
              </div>
              <Select
                value={form.customerId}
                onValueChange={(v) => setForm({ ...form, customerId: v })}
              >
                <SelectTrigger id="client" className="[&>span]:truncate">
                  <SelectValue placeholder="Choose a client..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} - {c.tier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="address">Customer Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Customer street, city, landmark"
                  maxLength={200}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="rstatus">Status</Label>
                <Select
                  value={form.status}
                onValueChange={(v: RentalStatus) => {
                  if (v === "returned") {
                    const confirmed = window.confirm("Are all dues clear? Please confirm that all balances are settled before marking as returned.");
                    if (!confirmed) return;
                  }
                  setForm({ ...form, status: v });
                }}
                >
                  <SelectTrigger id="rstatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(["upcoming", "active", "returned", "overdue"] as const).map(
                      (s) => (
                        <SelectItem key={s} value={s}>
                          {s[0].toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4 pt-2 border-t border-border">
              <div className="text-sm font-semibold text-gold">Rental Pieces</div>
              {form.pieces.map((piece, index) => (
                <div key={piece.id} className="relative rounded-md border border-border p-4 bg-secondary/10">
                  {form.pieces.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setForm(f => ({ ...f, pieces: f.pieces.filter(p => p.id !== piece.id) }));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="grid gap-2 min-w-0">
                      <div className="flex items-center justify-between">
                        <Label>Piece {index + 1}</Label>
                        {index === 0 && (
                          <button
                            type="button"
                            onClick={() => setAddPieceOpen(true)}
                            className="text-[11px] text-gold hover:underline inline-flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" /> Add piece
                          </button>
                        )}
                      </div>
                      <Select
                        value={piece.itemId}
                        onValueChange={(v) => {
                          const item = items.find((i) => i.id === v);
                          setForm(f => {
                            const newPieces = [...f.pieces];
                            newPieces[index] = { ...newPieces[index], itemId: v, itemNo: item?.id ?? "", rate: item?.pricePerDay ?? 0 };
                            return { ...f, pieces: newPieces };
                          });
                        }}
                      >
                        <SelectTrigger className="[&>span]:truncate">
                          <SelectValue placeholder="Choose a piece..." />
                        </SelectTrigger>
                        <SelectContent>
                          {items.map((i) => (
                            <SelectItem key={i.id} value={i.id}>
                              {i.name} - {formatCurrencyINR(i.pricePerDay)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2 min-w-0">
                      <Label>Item No</Label>
                      <Input
                        value={piece.itemNo}
                        onChange={e => {
                          const itemNo = e.target.value;
                          setForm(f => {
                            const newPieces = [...f.pieces];
                            newPieces[index] = { ...newPieces[index], itemNo };
                            // Try to auto-fill if item exists
                            const found = items.find(i => i.customId === itemNo);
                            if (found) {
                              newPieces[index] = {
                                ...newPieces[index],
                                itemId: found.id,
                                rate: found.pricePerDay ?? 0,
                              };
                            }
                            return { ...f, pieces: newPieces };
                          });
                        }}
                        placeholder="Enter Item No"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                     <div className="grid gap-2">
                        <Label>Delivery Date</Label>
                        <div className="relative">
                          <Input value={formatDate(piece.deliveryDate)} readOnly className="pr-8" />
                          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            type="date"
                            value={piece.deliveryDate}
                            onChange={(e) => setForm(f => {
                              const newPieces = [...f.pieces];
                              newPieces[index] = { ...newPieces[index], deliveryDate: e.target.value };
                              return { ...f, pieces: newPieces };
                            })}
                            onClick={(e) => {
                              try {
                                (e.target as HTMLInputElement).showPicker?.();
                              } catch (err) {}
                            }}
                            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                            required
                          />
                        </div>
                     </div>
                     <div className="grid gap-2">
                        <Label>End Date</Label>
                        <div className="relative">
                          <Input value={formatDate(piece.endDate)} readOnly className="pr-8" />
                          <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                          <Input
                            type="date"
                            value={piece.endDate}
                            onChange={(e) => setForm(f => {
                              const newPieces = [...f.pieces];
                              newPieces[index] = { ...newPieces[index], endDate: e.target.value };
                              return { ...f, pieces: newPieces };
                            })}
                            onClick={(e) => {
                              try {
                                (e.target as HTMLInputElement).showPicker?.();
                              } catch (err) {}
                            }}
                            className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                            required
                          />
                        </div>
                     </div>
                     <div className="grid gap-2">
                        <Label>Rate (INR)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={piece.rate}
                          onChange={(e) => setForm(f => {
                            const newPieces = [...f.pieces];
                            newPieces[index] = { ...newPieces[index], rate: Number(e.target.value) };
                            return { ...f, pieces: newPieces };
                          })}
                          required
                        />
                     </div>
                  </div>
                  
                  <div className="grid gap-2 mt-3">
                    <Label>Remark</Label>
                    <Textarea
                      value={piece.remark}
                      onChange={(e) => setForm(f => {
                        const newPieces = [...f.pieces];
                        newPieces[index] = { ...newPieces[index], remark: e.target.value };
                        return { ...f, pieces: newPieces };
                      })}
                      placeholder="Any special notes for this piece"
                      rows={2}
                    />
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                className="w-full border-dashed"
                onClick={() => {
                  setForm(f => ({
                    ...f,
                    pieces: [
                      ...f.pieces,
                      {
                        id: Math.random().toString(),
                        itemId: "",
                        itemNo: "",
                        deliveryDate: f.pieces[f.pieces.length - 1].deliveryDate,
                        startDate: f.pieces[f.pieces.length - 1].startDate,
                        endDate: f.pieces[f.pieces.length - 1].endDate,
                        rate: 0,
                        remark: "",
                      }
                    ]
                  }));
                }}
              >
                <Plus className="h-4 w-4 mr-2" /> Add Another Piece
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="discount">Discount</Label>
                <Input
                  id="discount"
                  type="number"
                  min={0}
                  value={form.discount}
                  onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="advance">Advance</Label>
                <Input
                  id="advance"
                  type="number"
                  min={0}
                  value={form.advance}
                  onChange={(e) => setForm({ ...form, advance: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="securityAmount">Security</Label>
                <Input
                  id="securityAmount"
                  type="number"
                  min={0}
                  value={form.securityAmount}
                  onChange={(e) => setForm({ ...form, securityAmount: Number(e.target.value) })}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="signature">Owner Signature</Label>
              <div className="grid gap-2 rounded-md border border-border bg-secondary/30 p-3">
                {form.signature ? (
                  <img
                    src={form.signature}
                    alt="Owner signature"
                    className="h-24 w-full object-contain border border-border rounded-sm"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Upload an image of the owner signature.
                  </p>
                )}
                <Input
                  id="signature"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSignatureUpload(e.target.files?.[0])}
                />
              </div>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setShowInvoice((current) => !current)}
                className="rounded-full border border-border px-3 py-2 text-sm uppercase tracking-[0.18em] text-muted-foreground hover:bg-secondary/40"
              >
                {showInvoice ? "Hide Invoice" : "Preview Invoice"}
              </button>
              {showInvoice ? (
                <div className="rounded-md border border-border bg-secondary/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                        Booking Invoice
                      </p>
                      <p className="text-sm text-foreground">Bill No: {form.billNo || "—"}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={shareOnWhatsApp}>
                        WhatsApp
                      </Button>
                      <Button type="button" variant="outline" onClick={printInvoice}>
                        Print
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <p>Client: {selectedCustomer?.name || "Not selected"}</p>
                    <div className="mt-2 border-t border-border pt-2 space-y-2">
                      {form.pieces.map((p, idx) => {
                        const item = items.find(i => i.id === p.itemId);
                        return (
                          <div key={p.id}>
                            <p><strong>Piece {idx + 1}:</strong> {item?.name || "Not selected"} (No: {p.itemNo || "—"})</p>
                            <p>Del: {formatDate(p.deliveryDate)} | Return: {formatDate(p.endDate)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid gap-1 text-sm">
                    <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatCurrencyINR(piecesTotal)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>{formatCurrencyINR(form.discount)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Advance</span><span>{formatCurrencyINR(form.advance)}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>Security</span><span>{formatCurrencyINR(form.securityAmount)}</span></div>
                    <div className="flex justify-between text-gold font-semibold"><span>Balance Due</span><span>{formatCurrencyINR(balanceDue)}</span></div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Total for {form.pieces.length} piece{form.pieces.length === 1 ? "" : "s"}
                </p>
                <p className="font-display text-2xl text-gold mt-0.5">
                  {formatCurrencyINR(netTotal)}
                </p>
                {form.discount > 0 ? (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Discount applied: {formatCurrencyINR(form.discount)}
                  </p>
                ) : null}
              </div>
              <div className="flex gap-2">
                {form.pieces.map(p => {
                   const item = items.find(i => i.id === p.itemId);
                   if (!item) return null;
                   return (
                     <img
                        key={p.id}
                        src={item.image}
                        alt={item.name}
                        className="h-14 w-11 object-cover rounded-sm border border-border shrink-0"
                      />
                   );
                })}
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
                {loading ? "Booking..." : "Book Rental"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AddPieceDialog open={addPieceOpen} onOpenChange={setAddPieceOpen} />
      <AddCustomerDialog
        open={addClientOpen}
        onOpenChange={setAddClientOpen}
        onCreated={(id) => setForm((f) => ({ ...f, customerId: id }))}
      />
    </>
  );
}
