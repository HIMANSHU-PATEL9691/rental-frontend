import { useMemo, useState, useEffect } from "react";
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

import { Plus, Calendar } from "lucide-react";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";

import type { Rental, RentalStatus } from "@/data/mock";

const schema = z
  .object({
    billNo: z.string().trim().max(40).optional().or(z.literal("")),
    address: z.string().trim().max(200).optional().or(z.literal("")),
    deliveryDate: z.string().min(1),
    startDate: z.string().min(1),
    endDate: z.string().min(1),
    rate: z.coerce.number().min(0),
    discount: z.coerce.number().min(0),
    penalty: z.coerce.number().min(0),
    advance: z.coerce.number().min(0),
    securityAmount: z.coerce.number().min(0),
    remark: z.string().trim().max(300).optional(),
    signature: z.string().optional(),
    status: z.enum(["active", "upcoming", "returned", "overdue"]),
  })
  .refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  });

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / 86400000));
}

function getRentalAmount(rental: Rental, itemPriceFallback = 0) {
  const savedRate = Number((rental as any).rate);
  if (Number.isFinite(savedRate) && savedRate > 0) return savedRate;

  const savedTotal = Number(rental.total);
  const savedDiscount = Number(rental.discount);
  if (Number.isFinite(savedTotal) && savedTotal > 0) {
    return savedTotal + (Number.isFinite(savedDiscount) ? savedDiscount : 0);
  }

  return itemPriceFallback;
}

const DEFAULT_POLICIES = `1. Please return the rented piece on or before the due date to avoid penalty charges.\n2. Any damage, burns, or alterations to the piece will incur additional fees.\n3. Booking advance is strictly non-refundable.\n4. Original ID proof must be deposited at the time of pickup.\n\n1. कृपया पेनल्टी शुल्क से बचने के लिए किराए पर ली गई ड्रेस को नियत तारीख पर या उससे पहले वापस करें।\n2. ड्रेस में किसी भी प्रकार का नुकसान, जलने या बदलाव होने पर अतिरिक्त शुल्क लिया जाएगा।\n3. बुकिंग एडवांस वापस नहीं किया जाएगा।\n4. पिकअप के समय मूल आईडी प्रूफ जमा करना अनिवार्य है।`;
function getPoliciesHtml() {
  const policies = typeof window !== "undefined" ? localStorage.getItem("rental_policies") ?? DEFAULT_POLICIES : DEFAULT_POLICIES;
  return policies.replace(/\n/g, "<br/>");
}

export function EditRentalDialog({
  rental,
  onUpdated,
  trigger,
  disabled,
}: {
  rental: Rental;
  onUpdated?: (updated: Rental) => void;
  trigger: React.ReactNode;
  disabled?: boolean;
}) {
  const { items, getItem, getCustomer, updateRental, rentals } = useStore();

  const rentalItem = useMemo(() => getItem(rental.itemId), [getItem, rental.itemId]);
  const customer = useMemo(() => getCustomer(rental.customerId), [getCustomer, rental.customerId]);

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);

  const [form, setForm] = useState({
    billNo: rental.billNo ?? "",
    address: rental.address ?? "",
    deliveryDate: rental.deliveryDate ? rental.deliveryDate.slice(0, 10) : today(),
    startDate: rental.startDate ? rental.startDate.slice(0, 10) : today(),
    endDate: rental.endDate ? rental.endDate.slice(0, 10) : today(),
    rate: getRentalAmount(
      rental,
      rentalItem ? rentalItem.pricePerDay * daysBetween(rental.startDate || today(), rental.endDate || today()) : 0,
    ),
    discount: rental.discount ?? 0,
    penalty: rental.penalty ?? 0,
    advance: rental.advance ?? 0,
    securityAmount: rental.securityAmount ?? 0,
    remark: rental.remark ?? "",
    signature: (rental.signature as string | undefined) ?? "",
    status: (rental.status ?? "upcoming") as RentalStatus,
  });

  const [billNoLoading, setBillNoLoading] = useState(false);

  async function ensureBillNo() {
    if (form.billNo?.trim()) return;
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

    setForm((c) => ({ ...c, billNo: `BILL-${String(nextSeq).padStart(4, "0")}` }));
    setBillNoLoading(false);
  }

  useEffect(() => {
    if (open && !form.billNo) {
      ensureBillNo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const subtotal = form.rate || 0;
  const totalAfterDiscount = Math.max(0, subtotal - form.discount);
  const totalWithPenalty = totalAfterDiscount + form.penalty;
  const finalDue = Math.max(0, totalWithPenalty - form.advance);
  const isReturned = form.status === "returned";

  const relatedRentals = useMemo(() => {
    if (rental.billNo) {
      return rentals.filter((r) => r.billNo === rental.billNo);
    }
    return [rental];
  }, [rentals, rental.billNo, rental.id]);

  let aggSubtotal = 0;
  let aggDiscount = 0;
  let aggPenalty = 0;
  let aggAdvance = 0;
  let aggSecurity = 0;

  const piecesData = relatedRentals.map((r) => {
    const isCurrent = r.id === rental.id;
    const rItem = getItem(r.itemId);
    const rStartDate = isCurrent ? form.startDate : (r.startDate || "");
    const rEndDate = isCurrent ? form.endDate : (r.endDate || "");
    const rDeliveryDate = isCurrent ? form.deliveryDate : (r.deliveryDate || "");
    const d = daysBetween(rStartDate, rEndDate);
    const rRate = isCurrent
      ? form.rate
      : getRentalAmount(r, rItem ? rItem.pricePerDay * daysBetween(rStartDate, rEndDate) : 0);
    const rSubtotal = rRate;
    
    aggSubtotal += rSubtotal;
    aggDiscount += isCurrent ? form.discount : (r.discount ?? 0);
    aggPenalty += isCurrent ? form.penalty : (r.penalty ?? 0);
    aggAdvance += isCurrent ? form.advance : (r.advance ?? 0);
    aggSecurity += isCurrent ? form.securityAmount : (r.securityAmount ?? 0);

    return { r, rItem, isCurrent, rStartDate, rEndDate, rDeliveryDate, d, rRate, rSubtotal };
  });
  const aggTotalAfterDiscount = Math.max(0, aggSubtotal - aggDiscount);
  const aggTotalWithPenalty = aggTotalAfterDiscount + aggPenalty;
  const aggFinalDue = Math.max(0, aggTotalWithPenalty - aggAdvance);

  function renderThermalBody() {
    let invoiceTitle = "INVOICE";
    if (form.status === "upcoming") invoiceTitle = "BOOKING INVOICE";
    else if (form.status === "active") invoiceTitle = "DELIVERY INVOICE";
    else if (form.status === "returned") invoiceTitle = "FINAL INVOICE";
    else if (form.status === "overdue") invoiceTitle = "OVERDUE FINAL BILL";

    const thermalPiecesHtml = piecesData.map(({ r, rItem, rDeliveryDate, rEndDate, rRate }) => `
      ${rItem?.image ? `<div style="text-align: center; margin-bottom: 6px;"><img src="${rItem.image}" style="max-height: 80px; max-width: 100%; border-radius: 4px; object-fit: cover;" /></div>` : ""}
      <div class="thermal-item-name">${rItem?.name || "Unknown item"}</div>
      <div class="thermal-row"><span>Item No</span><span>${r.itemNo || r.itemId}</span></div>
      <div class="thermal-row"><span>Dates</span><span>Del: ${formatDate(rDeliveryDate.slice(0, 10))} | Return: ${formatDate(rEndDate.slice(0, 10))}</span></div>
      <div class="thermal-row"><span>Rate</span><span>${formatCurrencyINR(rRate)}</span></div>
      <div class="thermal-divider"></div>
    `).join("");

    return `
      <div class="thermal">
        <div class="thermal-title">${invoiceTitle}</div>
        <div class="thermal-row"><span>Invoice</span><span># ${rental.billNo || rental.id}</span></div>
        <div class="thermal-row"><span>Client</span><span>${customer?.name || rental.customerId}</span></div>
        <div class="thermal-divider"></div>

        ${thermalPiecesHtml}

        <div class="thermal-row"><span>Subtotal</span><span>${formatCurrencyINR(aggSubtotal)}</span></div>
        <div class="thermal-row"><span>Discount</span><span>${formatCurrencyINR(aggDiscount)}</span></div>
        <div class="thermal-row"><span>Penalty</span><span>${formatCurrencyINR(aggPenalty)}</span></div>
        <div class="thermal-row"><span>Advance/Paid</span><span>${formatCurrencyINR(aggAdvance)}</span></div>
        <div class="thermal-row thermal-total"><span>Balance Due</span><span>${formatCurrencyINR(aggFinalDue)}</span></div>

        <div class="thermal-divider"></div>
        <div style="font-size: 9px; margin-top: 10px; color: #444;">
          <strong style="font-size: 10px; color: #111;">Terms & Conditions:</strong><br/>
          ${getPoliciesHtml()}
        </div>

        <div class="thermal-signs">
          <div class="thermal-sign-box">
            ${form.signature ? `<img src="${form.signature}" class="thermal-sign-img" />` : ""}
            <div class="thermal-sign-line">Authorized Signature</div>
          </div>
        </div>

        <div class="thermal-footer">Thank you for choosing ARIHANT COLLECTION!</div>

      </div>
    `;
  }

  const invoiceNote = (form.status === "returned" || form.status === "overdue")
    ? "Final dues will include any penalty charges and the remaining balance."
    : form.status === "active"
    ? "Delivery invoice reflects the current balance. Set status to Returned for the final bill."
    : "Booking invoice reflects the advance paid. Change status to Active for delivery or Returned for the final bill.";

  const handleStatusChange = (v: RentalStatus) => {
    if (v === "returned") {
      const confirmed = window.confirm("Are all dues clear? Please confirm that all balances are settled before marking as returned.");
      if (!confirmed) return;
    }

    let newPenalty = form.penalty;
    let newAdvance = form.advance;


    if ((v === "returned" || v === "overdue") && rentalItem) {
      const end = new Date(form.endDate).getTime();
      const now = new Date(today()).getTime();
      if (now > end) {
        const overdueDays = Math.floor((now - end) / 86400000);
        if (overdueDays > 0) {
          newPenalty = overdueDays * rentalItem.pricePerDay;
          if (newPenalty !== form.penalty) {
            toast.info(
              `Added overdue charge of ${formatCurrencyINR(newPenalty)} for ${overdueDays} day(s)`,
            );
          }
        }
      }
    }

    if (v === "returned") {
      const totalWithPenalty = totalAfterDiscount + newPenalty;
      if (newAdvance !== totalWithPenalty) {
        newAdvance = totalWithPenalty;
        toast.success("Balance cleared for final bill");
      }
    }

    const nextFinalDue = (() => {
      const afterDiscount = Math.max(0, subtotal - form.discount);
      const totalWithPenalty = afterDiscount + newPenalty;
      return Math.max(0, totalWithPenalty - newAdvance);
    })();

    if (v === "returned" && nextFinalDue > 0) {
      toast.error("All dues must be cleared before marking as returned");
      return;
    }

    setForm((c) => ({ ...c, status: v, penalty: newPenalty, advance: newAdvance }));
  };

  const handleSignatureUpload = (file: File | undefined) => {
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
        setForm((c) => ({ ...c, signature: (reader.result as string) ?? "" }));
      }
    };
    reader.onerror = () => toast.error("Could not read signature file");
    reader.readAsDataURL(file);
  };

  function shareOnWhatsApp() {
    let invoiceTitle = "Invoice";
    if (form.status === "upcoming") invoiceTitle = "Booking Invoice";
    else if (form.status === "active") invoiceTitle = "Delivery Invoice";
    else if (form.status === "returned") invoiceTitle = "Final Invoice";
    else if (form.status === "overdue") invoiceTitle = "Overdue Final Bill";

    const message = `*ARIHANT COLLECTION - ${invoiceTitle}*
      
*Invoice:* ${rental.billNo || rental.id}
*Client:* ${customer?.name || rental.customerId}
*Pieces:* 
${piecesData.map(p => `- ${p.rItem?.name || "Unknown"} (${p.r.itemNo || p.r.itemId}) [Del: ${formatDate(p.rDeliveryDate.slice(0, 10))} | Return: ${formatDate(p.rEndDate.slice(0, 10))}] - ${formatCurrencyINR(p.rRate)}`).join("\n")}

*Subtotal:* ${formatCurrencyINR(aggSubtotal)}
*Discount:* ${formatCurrencyINR(aggDiscount)}
*Penalty:* ${formatCurrencyINR(aggPenalty)}
*Advance / Paid:* ${formatCurrencyINR(aggAdvance)}
*Security:* ${formatCurrencyINR(aggSecurity)}
*Final Balance Due:* ${formatCurrencyINR(aggFinalDue)}

Thank you for choosing ARIHANT COLLECTION!`;


    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  type InvoiceMode = "A4" | "THERMAL";

  function getInvoiceContent() {
    let invoiceTitle = "Invoice";
    if (form.status === "upcoming") invoiceTitle = "Booking Invoice";
    else if (form.status === "active") invoiceTitle = "Delivery Invoice";
    else if (form.status === "returned") invoiceTitle = "Final Invoice";
    else if (form.status === "overdue") invoiceTitle = "Overdue Final Bill";

    const piecesHtml = piecesData.map(({ r, rItem, rStartDate, rEndDate, rDeliveryDate, rRate, rSubtotal }) => `
      <tr>
        <td>${rItem?.image ? `<img src="${rItem.image}" style="width: 35px; height: 45px; object-fit: cover; border-radius: 3px;" />` : ""}</td>
        <td><strong>${rItem?.name || "Unknown item"}</strong><br/><span style="font-size: 9px; color: #666;">Del: ${formatDate(rDeliveryDate.slice(0, 10))} | Return: ${formatDate(rEndDate.slice(0, 10))}</span></td>
        <td>${r.itemNo || r.itemId}</td>
        <td class="text-right">${formatCurrencyINR(rRate)}</td>
        <td class="text-right">${formatCurrencyINR(rSubtotal)}</td>
      </tr>
    `).join("");

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
            <h2>${invoiceTitle}</h2>
            <p># ${rental.billNo || rental.id}</p>
          </div>
        </div>
        
        <div class="grid">
          <div class="col">
            <div class="label">Billed To</div>
            <p class="value"><strong>${customer?.name || rental.customerId}</strong></p>
            <p class="value">${customer?.email || ""}</p>
            <p class="value">${customer?.phone || ""}</p>
            <p class="value">${form.address || rental.address || ""}</p>
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
            ${piecesHtml}
          </tbody>
        </table>

        <div class="summary-box">
          <div class="row"><span>Subtotal</span><span>${formatCurrencyINR(aggSubtotal)}</span></div>
          <div class="row"><span>Discount</span><span>${formatCurrencyINR(aggDiscount)}</span></div>
          <div class="row"><span>Penalty</span><span>${formatCurrencyINR(aggPenalty)}</span></div>
          <div class="row"><span>Advance / Paid</span><span>${formatCurrencyINR(aggAdvance)}</span></div>
          <div class="row"><span>Security Deposit</span><span>${formatCurrencyINR(aggSecurity)}</span></div>
          <div class="row total"><span>Balance Due</span><span>${formatCurrencyINR(aggFinalDue)}</span></div>
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

  function getInvoiceHtml(mode: InvoiceMode = "A4") {
    if (mode === "THERMAL") {
      return `
        <html>
          <head>
            <title>Invoice ${rental.id}</title>
            <style>
              @page { size: 80mm auto; margin: 0; }
              body { margin: 0; padding: 0; }
              .thermal { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 10px 6px; color: #111; font-size: 11px; }
              .thermal-title { text-align: center; font-weight: 800; letter-spacing: 1px; margin-bottom: 6px; }
              .thermal-row { display: flex; justify-content: space-between; gap: 10px; margin: 3px 0; }
              .thermal-divider { border-top: 1px dashed #bbb; margin: 10px 0; }
              .thermal-item-name { font-weight: 800; margin-top: 6px; }
              .thermal-item-sub { margin-top: 2px; color: #666; font-size: 10px; }
              .thermal-total { font-weight: 800; }
              .thermal-signs { margin-top: 14px; }
              .thermal-sign-box { border-top: 1px solid #222; padding-top: 12px; display: flex; flex-direction: column; align-items: center; }
              .thermal-sign-img { max-height: 50px; max-width: 100%; margin-bottom: 4px; }
              .thermal-sign-line { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #666; margin-top: 2px; }
              .thermal-footer { text-align: center; margin-top: 12px; font-size: 10px; color: #555; }
            </style>
          </head>
          <body>
            ${renderThermalBody()}
          </body>
        </html>
      `;
    }

    return `
      <html>
        <head>
          <title>Invoice ${rental.id}</title>
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
  }

  async function downloadBill() {
    if (typeof window === "undefined") return;

    toast.info("Generating PDF...");

    // @ts-ignore
    const html2pdf = (await import("html2pdf.js")).default;

    const filenameSafe = `${rental.billNo || "Invoice"}-${rental.id}`.replace(
      /[^a-z0-9-_]/gi,
      "-",
    );
    const filename = `Invoice-${filenameSafe}.pdf`;

    try {
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

      await html2pdf()
        .set({
          margin: 10,
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
            ignoreElements: (element: Element) => {
              if (element.tagName === "STYLE" || element.tagName === "LINK") {
                const href = (element as HTMLLinkElement).href || "";
                if (href.includes("fonts.googleapis") || href.includes("fonts.gstatic")) return false;
                if (element.closest && element.closest("#pdf-container")) return false;
                return true;
              }
              return false;
            },
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(htmlString)
        .save();


      toast.success("Bill downloaded as PDF");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF bill");
    }
  }

  function printInvoice() {
    if (typeof window === "undefined") return;

    const invoiceHtml = getInvoiceHtml("A4");

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await ensureBillNo();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    if (!rentalItem) {
      toast.error("Selected piece not found");
      return;
    }

    const newStart = new Date(parsed.data.startDate || parsed.data.deliveryDate);
    newStart.setHours(0, 0, 0, 0);
    const newEnd = new Date(parsed.data.endDate);
    newEnd.setHours(0, 0, 0, 0);

    const overlappingRental = rentals.find((r) => {
      if (r.id === rental.id) return false;
      if (r.itemId !== rental.itemId) return false;
      if (r.status === "returned") return false;

      const existingStart = new Date(r.startDate || r.deliveryDate || "");
      existingStart.setHours(0, 0, 0, 0);
      const existingEnd = new Date(r.endDate || "");
      existingEnd.setHours(0, 0, 0, 0);

      return newStart.getTime() <= existingEnd.getTime() && newEnd.getTime() >= existingStart.getTime();
    });

    if (overlappingRental) {
      toast.error(`This piece is already booked from ${formatDate(overlappingRental.startDate)} to ${formatDate(overlappingRental.endDate)}.`);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        billNo: parsed.data.billNo ?? "",
        address: parsed.data.address ?? "",
        deliveryDate: parsed.data.deliveryDate,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        rate: parsed.data.rate,
        discount: parsed.data.discount,
        penalty: parsed.data.penalty,
        advance: parsed.data.advance,
        securityAmount: parsed.data.securityAmount,
        remark: parsed.data.remark ?? "",
        signature: parsed.data.signature ?? "",
        status: parsed.data.status,
        total: totalAfterDiscount,
      };

      const updated = await updateRental(rental.id, payload);
      onUpdated?.(updated);
      toast.success(`Rental ${rental.id} updated`);
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update rental ${rental.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-3xl max-h-[95vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Edit Rental</DialogTitle>
          <DialogDescription>Update the rental details and ledger totals.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="billNo">Bill No</Label>
              <Input
                id="billNo"
                value={form.billNo}
                onChange={(e) => setForm((c) => ({ ...c, billNo: e.target.value }))}
                placeholder={billNoLoading ? "Generating..." : "Enter bill number"}
                maxLength={40}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="deliveryDate">Delivery Date</Label>
              <div className="relative">
                <Input value={formatDate(form.deliveryDate)} readOnly className="pr-8" />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="deliveryDate"
                  type="date"
                  value={form.deliveryDate}
                  onChange={(e) => setForm((c) => ({ ...c, deliveryDate: e.target.value }))}
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
              <Label htmlFor="status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => handleStatusChange(v as RentalStatus)}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(["upcoming", "active", "returned", "overdue"] as const).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="md:col-span-2 grid gap-2">
              <Label htmlFor="address">Delivery Address</Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))}
                placeholder="Street, city, landmark"
                maxLength={200}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="startDate">Start</Label>
              <div className="relative">
                <Input value={formatDate(form.startDate)} readOnly className="pr-8" />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="startDate"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm((c) => ({ ...c, startDate: e.target.value }))}
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
              <Label htmlFor="endDate">End</Label>
              <div className="relative">
                <Input value={formatDate(form.endDate)} readOnly className="pr-8" />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="endDate"
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm((c) => ({ ...c, endDate: e.target.value }))}
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
              <Label htmlFor="rate">Rate (INR)</Label>
              <Input
                id="rate"
                type="number"
                min={0}
                value={form.rate}
                onChange={(e) => setForm((c) => ({ ...c, rate: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="discount">Discount</Label>
              <Input
                id="discount"
                type="number"
                min={0}
                value={form.discount}
                onChange={(e) => setForm((c) => ({ ...c, discount: Number(e.target.value) }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="penalty">Penalty</Label>
              <Input
                id="penalty"
                type="number"
                min={0}
                value={form.penalty}
                onChange={(e) => setForm((c) => ({ ...c, penalty: Number(e.target.value) }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="advance">Advance / Paid</Label>
              <Input
                id="advance"
                type="number"
                min={0}
                value={form.advance}
                onChange={(e) => setForm((c) => ({ ...c, advance: Number(e.target.value) }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="securityAmount">Security</Label>
              <Input
                id="securityAmount"
                type="number"
                min={0}
                value={form.securityAmount}
                onChange={(e) => setForm((c) => ({ ...c, securityAmount: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="remark">Remark</Label>
              <Textarea
                id="remark"
                value={form.remark}
                onChange={(e) => setForm((c) => ({ ...c, remark: e.target.value }))}
                placeholder="Any special notes"
                rows={4}
              />
            </div>

            <div className="grid gap-2 sm:max-w-sm">
              <Label htmlFor="signature">Owner Signature</Label>
              <div className="grid gap-2 rounded-md border border-border bg-secondary/30 p-2">
                {form.signature ? (
                  <img
                    src={form.signature}
                    alt="Owner signature"
                    className="h-10 w-full object-contain border border-border rounded-sm"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground mb-1">
                    Upload image.
                  </p>
                )}
                <Input
                  id="signature"
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSignatureUpload(e.target.files?.[0])}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  Computed total (Bill)
                </p>
                <p className="font-display text-2xl text-gold mt-0.5">
                  {formatCurrencyINR(aggTotalAfterDiscount)}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  {relatedRentals.length} piece(s)
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                Subtotal: {formatCurrencyINR(aggSubtotal)}
              </div>
            </div>

            <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 flex flex-col justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground leading-tight">
                  {invoiceNote}
                </p>
              </div>
              <div className="flex items-center justify-between mt-2 gap-2">
                <div className="text-sm shrink-0">
                  <p className="text-muted-foreground text-xs">Balance due (Bill)</p>
                  <p className="font-semibold text-gold">{formatCurrencyINR(aggFinalDue)}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-1.5">
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={shareOnWhatsApp}>
                    WA
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={printInvoice}>
                    Print
                  </Button>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs px-2" onClick={downloadBill}>
                    PDF
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-gold text-gold-foreground hover:bg-gold/90"
              disabled={loading || disabled}
            >
              {loading ? "Updating..." : "Update Rental"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
