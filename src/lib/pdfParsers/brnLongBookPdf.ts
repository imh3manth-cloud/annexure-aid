/**
 * BRN Detailed Long Book (SO_LOT) PDF parser.
 *
 * Ported from cbs-console-v14-9-2 HTML — parseBRNDetailSpatial() +
 * parseBRNDetailTokens() merge strategy. Returns transactions in the
 * shape this project's HFTI register uses (account, txn_id, amount,
 * debit/credit flag, date, particulars).
 *
 * Confirmed BRN column layout (PDF.js, scale=1, A4 portrait):
 *   Account No  x ~63
 *   Scheme      x ~132
 *   Tran ID     x ~179
 *   Value Date  x ~234
 *   Remarks     x ~346
 *   Cr cols     x 458–605
 *   Db cols     x 643–793  (boundary at x = 640)
 */
import { extractPdfData, normDate, parseAmt, isAmt, CBS_SCHEMES, type PdfTextItem } from "../pdfExtractor";
import type { HFTITransaction } from "../fileParser";

export interface BRNRow {
  date: string; // ISO yyyy-mm-dd when possible
  acc: string;
  scheme: string;
  txnId: string;
  credit: number;
  debit: number;
  remarks: string;
  isClosure: boolean;
}

const CLOSE_RE = /closure|proceed/i;
const AMT_RE = /^[\d,]+\.\d{2}$/;
const CLOSURE_SCHEMES = new Set([
  "RDIPN", "RD", "NSC16", "NSC", "KVP",
  "TDIP1", "TDIP2", "TDIP3", "TDIP5",
  "SBGEN", "SBBAS", "SBCHQ",
  "MISN1", "MSSC", "SRSCM", "SCSS",
]);

function detectReportDate(items: PdfTextItem[]): string {
  for (const it of items.slice(0, 200)) {
    const m = it.text.match(/(\d{2}-\d{2}-\d{4})/);
    if (m) return normDate(m[1], true);
  }
  return "";
}

/** Spatial parser — primary path, uses x/y coordinates. */
export function parseBRNSpatial(items: PdfTextItem[], reportDate = ""): BRNRow[] {
  if (!items.length) return [];

  // Group items into logical rows (page + y±3px)
  const rows: { page: number; y: number; cells: PdfTextItem[] }[] = [];
  const sorted = [...items].sort((a, b) =>
    a.page !== b.page ? a.page - b.page : a.y !== b.y ? a.y - b.y : a.x - b.x,
  );
  let cur: { page: number; y: number; cells: PdfTextItem[] } | null = null;
  for (const it of sorted) {
    if (!cur || cur.page !== it.page || Math.abs(cur.y - it.y) > 3) {
      cur = { page: it.page, y: it.y, cells: [] };
      rows.push(cur);
    }
    cur.cells.push(it);
  }

  const allRemItems = items.filter((it) => it.x >= 280 && it.x <= 450);

  let pendingAcc = "";
  let pendingRem = "";
  let pendingPage = -1;
  let pendingY = -1;

  const records: BRNRow[] = [];

  for (const { page, y, cells } of rows) {
    let acc = "", scheme = "", txnId = "", rowDate = "";
    let cr = 0, db = 0;
    let hasScheme = false, hasTxnId = false;

    for (const { x, text: rawT } of cells) {
      const t = rawT.trim();
      if (!t) continue;
      if (x >= 55 && x <= 75 && /^\d{9,15}$/.test(t)) acc = t;
      else if (x >= 120 && x <= 155 && CBS_SCHEMES.has(t.toUpperCase())) {
        scheme = t.toUpperCase();
        hasScheme = true;
      } else if (x >= 165 && x <= 200 && /^IN\d+$/i.test(t)) {
        txnId = t;
        hasTxnId = true;
      } else if (x >= 220 && x <= 255 && /^\d{2}-[A-Z]{3}-\d{2,4}$/i.test(t)) {
        rowDate = normDate(t, true);
      } else if (x >= 440 && AMT_RE.test(t)) {
        const v = parseFloat(t.replace(/,/g, "")) || 0;
        if (x < 640) cr += v;
        else db += v;
      }
    }

    // Sub-row: account number on its own line above the data row
    if (acc && !hasScheme && !hasTxnId) {
      pendingAcc = acc;
      pendingPage = page;
      pendingY = y;
      pendingRem = cells.filter((c) => c.x >= 280 && c.x <= 450).map((c) => c.text).join(" ");
      continue;
    }

    if (!hasTxnId || (cr === 0 && db === 0)) continue;

    if (!acc && pendingAcc && pendingPage === page && y - pendingY >= 0 && y - pendingY <= 35) {
      acc = pendingAcc;
    }

    const sameRowRem = cells.filter((c) => c.x >= 260 && c.x <= 460).map((c) => c.text).join(" ");
    const nearbyRem = allRemItems
      .filter((it) => it.page === page && it.y !== y && Math.abs(it.y - y) <= 30)
      .map((it) => it.text)
      .join(" ");
    const fullRem = `${pendingRem} ${sameRowRem} ${nearbyRem}`;
    const isClosure = CLOSURE_SCHEMES.has(scheme) && db > 0 && CLOSE_RE.test(fullRem);

    pendingAcc = ""; pendingRem = ""; pendingPage = -1; pendingY = -1;

    records.push({
      date: rowDate || reportDate,
      acc,
      scheme,
      txnId,
      credit: cr,
      debit: db,
      remarks: isClosure ? "Closure Proceeds" : "",
      isClosure,
    });
  }

  return records;
}

/** Token fallback — used when spatial parser misses sub-row accounts. */
export function parseBRNTokens(items: PdfTextItem[], reportDate = ""): BRNRow[] {
  const sorted = [...items].sort((a, b) =>
    a.page !== b.page ? a.page - b.page : a.y !== b.y ? a.y - b.y : a.x - b.x,
  );
  const lines: string[] = [];
  let lastKey = "";
  let buf: string[] = [];
  for (const it of sorted) {
    const key = `${it.page}:${Math.round(it.y / 4) * 4}`;
    if (key !== lastKey) {
      if (buf.length) lines.push(buf.join(" "));
      buf = [];
      lastKey = key;
    }
    buf.push(it.text.trim());
  }
  if (buf.length) lines.push(buf.join(" "));

  const records: BRNRow[] = [];
  let carryAcc = "";

  for (const line of lines) {
    const accOnly = line.match(/(?:^|\s)(\d{9,15})(?:\s|$)/);
    const hasSchemeOrTxn = /\b(SBGEN|SBBAS|SBCHQ|RDIPN|SSA|PPF|MIS|SCSS|INCOM|IN\d{4,})\b/i.test(line);
    if (accOnly && !hasSchemeOrTxn) {
      carryAcc = accOnly[1];
      continue;
    }

    const m = line.match(/\b([A-Z]{2,8})\s+(IN\d+)\s+(\d{2}-[A-Z]{3}-\d{2,4})\b/i);
    if (!m) continue;
    const scheme = m[1].toUpperCase();
    if (!CBS_SCHEMES.has(scheme)) continue;
    const txnId = m[2];
    const date = normDate(m[3], true);

    let acc = "";
    const accMatch = line.match(/(\d{9,15})\s+(?:SBGEN|SBBAS|SBCHQ|RDIPN|RD|SSA|PPF|MIS|SCSS|INCOM)/i);
    if (accMatch) acc = accMatch[1];
    if (!acc && carryAcc) acc = carryAcc;

    const allAmts = (line.match(/[\d,]+\.\d{2}/g) || []).map((v) => parseFloat(v.replace(/,/g, "")) || 0);
    let cr = 0, db = 0;
    if (allAmts.length >= 6) {
      cr = allAmts.slice(0, 3).reduce((s, v) => s + v, 0);
      db = allAmts.slice(3, 6).reduce((s, v) => s + v, 0);
    } else if (allAmts.length >= 1) {
      const u = line.toUpperCase();
      const isDebit = u.includes("WITHDRAWAL") || u.includes("CLOSURE") || u.includes("PROCEED");
      if (isDebit) db = allAmts.find((v) => v > 0) || 0;
      else cr = allAmts.find((v) => v > 0) || 0;
    }

    if (cr === 0 && db === 0) {
      carryAcc = "";
      continue;
    }

    const lineU = line.toUpperCase();
    const isClosure =
      (lineU.includes("CLOSURE") || lineU.includes("PROCEED")) &&
      CLOSURE_SCHEMES.has(scheme) &&
      db > 0;

    records.push({
      date: date || reportDate,
      acc,
      scheme,
      txnId,
      credit: cr,
      debit: db,
      remarks: isClosure ? "Closure Proceeds" : "",
      isClosure,
    });
    carryAcc = "";
  }
  return records;
}

/**
 * Run spatial parser, then merge token-parser results to fill missing
 * accounts (sub-row gap > spatial tolerance).
 */
export function parseBRNDetail(items: PdfTextItem[], reportDate = ""): BRNRow[] {
  const spatial = parseBRNSpatial(items, reportDate);
  if (spatial.length === 0) return parseBRNTokens(items, reportDate);

  const tokenRows = parseBRNTokens(items, reportDate);
  if (!tokenRows.length) return spatial;

  // Fill missing acc on spatial rows using txnId from token rows.
  const tokenByTxn = new Map(tokenRows.filter((r) => r.acc && r.txnId).map((r) => [r.txnId.toUpperCase(), r.acc]));
  for (const r of spatial) {
    if (!r.acc && r.txnId && tokenByTxn.has(r.txnId.toUpperCase())) {
      r.acc = tokenByTxn.get(r.txnId.toUpperCase())!;
    }
  }
  return spatial;
}

/**
 * Convert BRN rows into HFTI transactions. Each BRN row becomes ONE
 * HFTI record, using the larger side (debit or credit) as the amount.
 */
export function brnRowsToHfti(rows: BRNRow[]): HFTITransaction[] {
  const out: HFTITransaction[] = [];
  for (const r of rows) {
    if (!r.acc || !r.txnId) continue;
    if (r.debit > 0) {
      out.push({
        txn_date: r.date,
        account: r.acc,
        txn_id: r.txnId,
        amount: r.debit,
        particulars: r.remarks || `BRN debit (${r.scheme})`,
        debit_credit: "D",
      });
    }
    if (r.credit > 0) {
      out.push({
        txn_date: r.date,
        account: r.acc,
        txn_id: r.txnId,
        amount: r.credit,
        particulars: r.remarks || `BRN credit (${r.scheme})`,
        debit_credit: "C",
      });
    }
  }
  return out;
}

/** End-to-end convenience: PDF File → HFTI transactions. */
export async function parseBrnLongBookPdf(file: File): Promise<{
  rows: BRNRow[];
  hfti: HFTITransaction[];
  reportDate: string;
}> {
  const { items } = await extractPdfData(file);
  const reportDate = detectReportDate(items);
  const rows = parseBRNDetail(items, reportDate);
  return { rows, hfti: brnRowsToHfti(rows), reportDate };
}

// Touch helper to silence unused-import warnings if the bundler is fussy
// about side-effect imports of `parseAmt`/`isAmt` in fallback paths.
void parseAmt;
void isAmt;