/**
 * BO_CONS / SO_CONS daily consolidation PDF parser.
 *
 * Ported from cbs-console-v14-9-2 HTML — parseConsolidationSpatial().
 * Each row in the consolidation report is one BO + scheme + day with
 * credit / debit totals and txn counts.
 */
import { extractPdfData, normDate, CBS_SCHEMES, type PdfTextItem } from "../pdfExtractor";

export interface ConsolidationRow {
  date: string;        // ISO yyyy-mm-dd
  bo: string;          // BO/SO name
  scheme: string;
  creditAmt: number;
  creditCount: number;
  debitAmt: number;
  debitCount: number;
}

const AMT_RE = /^[\d,]+\.\d{2}$/;
const INT_RE = /^\d{1,5}$/;

function detectReportDate(items: PdfTextItem[]): string {
  for (const it of items.slice(0, 250)) {
    const m = it.text.match(/(\d{2}-\d{2}-\d{4})/);
    if (m) return normDate(m[1], true);
  }
  return "";
}

/**
 * Group items into y-aligned rows, then assign cells to columns by x-position.
 * Consolidation PDFs typically have:
 *   BO/SO Name (x ~40-200)  Scheme (x ~210-280)  Cr Amt / Cr Cnt / Db Amt / Db Cnt
 */
export function parseConsolidationSpatial(items: PdfTextItem[], reportDate = ""): ConsolidationRow[] {
  if (!items.length) return [];

  const sorted = [...items].sort((a, b) =>
    a.page !== b.page ? a.page - b.page : a.y !== b.y ? a.y - b.y : a.x - b.x,
  );

  const rows: { page: number; y: number; cells: PdfTextItem[] }[] = [];
  let cur: { page: number; y: number; cells: PdfTextItem[] } | null = null;
  for (const it of sorted) {
    if (!cur || cur.page !== it.page || Math.abs(cur.y - it.y) > 3) {
      cur = { page: it.page, y: it.y, cells: [] };
      rows.push(cur);
    }
    cur.cells.push(it);
  }

  let pendingBo = "";
  const out: ConsolidationRow[] = [];

  for (const { cells } of rows) {
    // BO name = leftmost text tokens (x < 200) joined
    const boTokens = cells.filter((c) => c.x < 200).map((c) => c.text);
    const boText = boTokens.join(" ").trim();

    // Scheme = first CBS scheme code in row
    const scheme = cells
      .map((c) => c.text.toUpperCase())
      .find((t) => CBS_SCHEMES.has(t)) || "";

    if (!scheme) {
      // Row that's only a BO name — carry forward to next row
      if (boText && /[A-Z]/i.test(boText) && boText.length > 2 && !/^page|^date|^total/i.test(boText)) {
        pendingBo = boText;
      }
      continue;
    }

    const bo = boText && boText.length > 2 ? boText : pendingBo;
    if (!bo) continue;

    // Numeric tokens to the right of scheme
    const numTokens = cells
      .filter((c) => c.x > 280)
      .sort((a, b) => a.x - b.x)
      .map((c) => c.text);

    const amts: number[] = [];
    const counts: number[] = [];
    for (const t of numTokens) {
      if (AMT_RE.test(t)) amts.push(parseFloat(t.replace(/,/g, "")) || 0);
      else if (INT_RE.test(t)) counts.push(parseInt(t, 10) || 0);
    }

    // Heuristic: [crAmt, dbAmt, crCnt, dbCnt]  (some reports interleave)
    const creditAmt = amts[0] || 0;
    const debitAmt = amts[1] || 0;
    const creditCount = counts[0] || 0;
    const debitCount = counts[1] || 0;

    if (creditAmt === 0 && debitAmt === 0) continue;

    out.push({
      date: reportDate,
      bo,
      scheme,
      creditAmt,
      creditCount,
      debitAmt,
      debitCount,
    });
  }

  return out;
}

export async function parseConsolidationPdf(file: File): Promise<{
  rows: ConsolidationRow[];
  reportDate: string;
}> {
  const { items } = await extractPdfData(file);
  const reportDate = detectReportDate(items);
  const rows = parseConsolidationSpatial(items, reportDate);
  return { rows, reportDate };
}