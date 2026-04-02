import jsPDF from "jspdf";
import { format } from "date-fns";

export interface WorkOrderPdfData {
  job_number: string;
  order_number?: number;
  title: string;
  customer_name: string;
  customer_address?: string;
  description?: string;
  job_date?: string;
  created_at?: string;
  status?: string;
  created_by_name?: string;
}

/**
 * Generate a structured PDF for a work order.
 * Returns the jsPDF doc (for saving/uploading) and a Blob.
 */
export function generateWorkOrderPdf(order: WorkOrderPdfData): { doc: jsPDF; blob: Blob; filename: string } {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ── Header ──
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("MCR Plumbing", margin, y);
  y += 7;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Work Order", margin, y);
  y += 2;

  // Header line
  doc.setDrawColor(30, 30, 60);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Job info block ──
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  const jobLabel = `#${order.job_number || order.order_number}`;
  doc.text(jobLabel, margin, y);

  // Status badge on the right
  if (order.status) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);
    const statusW = doc.getTextWidth(statusText) + 6;
    const statusX = pageWidth - margin - statusW;
    if (order.status === "completed") {
      doc.setFillColor(34, 139, 34);
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(59, 130, 246);
      doc.setTextColor(255, 255, 255);
    }
    doc.roundedRect(statusX, y - 4, statusW, 6, 2, 2, "F");
    doc.text(statusText, statusX + 3, y);
    doc.setTextColor(0, 0, 0);
  }
  y += 8;

  // Title
  if (order.title) {
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(order.title, margin, y);
    y += 7;
  }

  // ── Info grid ──
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const infoRows: [string, string][] = [];
  infoRows.push(["Customer", order.customer_name || "—"]);
  if (order.customer_address) infoRows.push(["Address", order.customer_address]);

  const jobDate = order.job_date
    ? format(new Date(order.job_date + "T00:00:00"), "EEEE, MMMM d, yyyy")
    : order.created_at
    ? format(new Date(order.created_at), "EEEE, MMMM d, yyyy")
    : "—";
  infoRows.push(["Job Date", jobDate]);

  if (order.created_by_name) infoRows.push(["Created By", order.created_by_name]);

  for (const [label, value] of infoRows) {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + 30, y);
    y += 6;
  }

  y += 4;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  // ── Description / Work Order Text ──
  if (order.description) {
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Work Order Details", margin, y);
    y += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");

    // Split description into lines that fit within the content width
    const lines = doc.splitTextToSize(order.description, contentWidth);
    const lineHeight = 4.5;
    const pageHeight = doc.internal.pageSize.getHeight();
    const bottomMargin = 20;

    for (const line of lines) {
      if (y + lineHeight > pageHeight - bottomMargin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin, y);
      y += lineHeight;
    }
  }

  // ── Footer ──
  const pageCount = doc.internal.pages.length - 1; // jsPDF uses 1-indexed internally
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.text(
      `MCR Plumbing — Work Order #${order.job_number || order.order_number} — Page ${i} of ${pageCount}`,
      margin,
      footerY
    );
    doc.text(
      `Generated ${format(new Date(), "MMM d, yyyy h:mm a")}`,
      pageWidth - margin - 50,
      footerY
    );
  }

  // ── PDF Metadata ──
  doc.setProperties({
    title: `Work Order ${order.job_number || order.order_number}`,
    subject: `${order.customer_name} - ${order.title || ""}`,
    author: "MCR Plumbing Tracker",
    keywords: `job:${order.job_number || order.order_number},customer:${order.customer_name},date:${order.job_date || ""},status:${order.status || "active"}`,
    creator: "MCR Plumbing Tracker",
  });

  const filename = `Work-Order-${order.job_number || order.order_number}.pdf`;
  const blob = doc.output("blob");
  return { doc, blob, filename };
}

/**
 * Trigger browser download of a work order PDF.
 */
export function downloadWorkOrderPdf(order: WorkOrderPdfData): void {
  const { doc, filename } = generateWorkOrderPdf(order);
  doc.save(filename);
}

/**
 * Get a base64 string of the PDF (for uploading to Dropbox/etc).
 */
export function getWorkOrderPdfBase64(order: WorkOrderPdfData): { base64: string; filename: string } {
  const { doc, filename } = generateWorkOrderPdf(order);
  const base64 = doc.output("datauristring").split(",")[1];
  return { base64, filename };
}
