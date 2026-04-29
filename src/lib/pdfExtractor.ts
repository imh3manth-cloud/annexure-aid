/**
 * Offline PDF text + spatial extractor.
 *
 * Wraps pdfjs-dist (bundled, no CDN) and exposes a normalized
 * { text, items } structure that the spatial parsers can consume.
 *
 * Ported from the cbs-console-v14-9-2 HTML: extractPDFData() and the
 * normalizeAccNum / normDate / parseAmt helpers used by every parser.
 */
import * as pdfjsLib from "pdfjs-dist";
// Vite-friendly worker import — produces a hashed URL at build time.
// The `?url` suffix tells Vite to emit the worker as a static asset.
// eslint-disable-next-line import/no-unresolved
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

// One-time worker setup. Safe to run repeatedly — pdfjs caches the value.
let workerConfigured = false;
function ensureWorker() {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  workerConfigured = true;
}

export interface PdfTextItem {
  page: number; // zero-indexed
  x: number;
  y: number; // y=0 at top
  text: string;
}

export interface ExtractedPdf {
  text: string;
  items: PdfTextItem[];
  pageCount: number;
}

/**
 * Extract a flat token list with x/y coordinates from every page.
 *
 * The parsers in `src/lib/pdfParsers/*` consume the `items` array directly;
 * the `text` string is a fallback for token-mode parsers when spatial
 * grouping fails (matches pdfminer line-per-token output).
 */
export async function extractPdfData(file: File | ArrayBuffer): Promise<ExtractedPdf> {
  ensureWorker();
  const ab = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;

  let plainText = "";
  const items: PdfTextItem[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();

    const pageItems: PdfTextItem[] = [];
    for (const item of content.items as Array<{ transform: number[]; str: string }>) {
      const tx = item.transform;
      const x = Math.round(tx[4]);
      const y = Math.round(vp.height - tx[5]); // flip so y=0 is at top
      const t = (item.str || "").trim();
      if (!t) continue;
      const rec: PdfTextItem = { page: p - 1, x, y, text: t };
      pageItems.push(rec);
      items.push(rec);
    }

    // pdfminer-style line-per-token text (each token on its own line, sorted top→bottom, left→right)
    pageItems.sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
    for (const it of pageItems) plainText += "\n" + it.text;
    plainText += "\n\f"; // page break sentinel
  }

  return { text: plainText, items, pageCount: pdf.numPages };
}

// ───────────────────────── Shared helpers ─────────────────────────

/**
 * Normalize CBS account numbers to canonical DB format.
 * 11-digit accounts that start with "100" get a leading "0"
 * (matches the existing project rule of stripping non-numeric chars,
 * but additionally restoring a missing leading zero common in PDFs).
 */
export function normalizeAccNum(num: string | number | null | undefined): string {
  if (num === null || num === undefined) return "";
  const d = String(num).replace(/[^\d]/g, "");
  if (d.length === 11 && d.startsWith("100")) return "0" + d;
  return d;
}

/** Parse Indian-formatted money string like "1,23,456.78" → 123456.78 */
export function parseAmt(s: string | undefined | null): number {
  if (!s) return 0;
  const cleaned = String(s).replace(/[,\s]/g, "").split("/")[0];
  return parseFloat(cleaned) || 0;
}

/** True if string looks like an Indian-formatted money value e.g. "1,500.00" */
export function isAmt(s: string | undefined | null): boolean {
  if (!s) return false;
  return /^\d[\d,]*\.\d{2}/.test(String(s).replace(/,/g, "").split("/")[0].trim());
}

/**
 * Universal date normaliser.
 * Accepts dd/mm/yyyy, dd.mm.yy, dd-mm-yy, ISO yyyy-mm-dd,
 * dd-Mon-yy, ddmmyyyy. Returns dd-mm-yyyy.
 * Returns ISO yyyy-mm-dd when `iso=true` (useful for Supabase date columns).
 */
export function normDate(raw: string | null | undefined, iso = false): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";

  let d = "", m = "", y = "";

  const isoM = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (isoM) {
    [, y, m, d] = isoM;
  } else {
    const dmy = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
    if (dmy) {
      d = dmy[1]; m = dmy[2]; y = dmy[3];
    } else {
      const MON: Record<string, string> = {
        jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
        jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
      };
      const dmy2 = s.match(/^(\d{1,2})[/\-\s]([A-Za-z]{3})[/\-\s](\d{2,4})$/);
      if (dmy2) {
        d = dmy2[1]; m = MON[dmy2[2].toLowerCase()] || "01"; y = dmy2[3];
      } else {
        const d8 = s.match(/^(\d{2})(\d{2})(\d{4})$/);
        if (d8) { d = d8[1]; m = d8[2]; y = d8[3]; }
      }
    }
  }

  if (!d || !m || !y) return s;
  d = d.padStart(2, "0");
  m = m.padStart(2, "0");
  if (y.length === 2) y = (parseInt(y, 10) > 50 ? "19" : "20") + y;

  return iso ? `${y}-${m}-${d}` : `${d}-${m}-${y}`;
}

/** Known CBS scheme codes, used by every Long Book parser. */
export const CBS_SCHEMES = new Set([
  "SBGEN", "SBBAS", "SBCHQ", "SBPWC",
  "RDIPN", "RD",
  "SSA", "OAP",
  "TD", "TDIP1", "TDIP2", "TDIP3", "TDIP5",
  "NSC16", "NSC", "KVP",
  "INCOM", "MIS", "MISN1", "MSSC",
  "PPF", "SCSS", "SRSCM",
  "LARD", "EXPNS",
]);

/** Display label for a scheme code. */
export const SCHEME_DISPLAY: Record<string, string> = {
  SBBAS: "SB Basic Saving",
  SBGEN: "SB General (No Cheque)",
  SBCHQ: "SB General (With Cheque)",
  SBPWC: "SB (PWC)",
  SSA: "Sukanya Samriddhi",
  TDIP1: "TD 1 Year",
  TDIP2: "TD 2 Year",
  TDIP3: "TD 3 Year",
  TDIP5: "TD 5 Year",
  TD1: "TD 1 Year",
  TD2: "TD 2 Year",
  TD3: "TD 3 Year",
  TD5: "TD 5 Year",
  MIS: "Monthly Income",
  MISN1: "Monthly Income Scheme",
  SCSS: "Senior Citizens SS",
  SRSCM: "Senior Citizens SS",
  MSSC: "Mahila Samman SC",
  PPF: "Public Provident Fund",
  RD: "Recurring Deposit",
  RDIPN: "Recurring Deposit",
  NSC: "Nat. Savings Certificate",
  NSC16: "NSC VIII Issue",
  KVP: "Kisan Vikas Patra",
  OAP: "Office Account (OAP)",
  INCOM: "Income (Commission/Fee)",
  EXPNS: "Expense Account",
};