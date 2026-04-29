/**
 * CBS Last Balance Report PDF parser.
 * Ported from cbs-console-v14-9-2 HTML — parseLBReportPDFItems().
 *
 * Handles the two known CBS layouts:
 *  - TDA  (MISN1, SRSCM, TDIP*)        balance≈x690, status≈x851, BO≈x1047
 *  - SBA  (SBGEN, SBCHQ, SBBAS, PPF)   balance≈x708, status≈x875, BO≈x1046
 * Auto-detects scheme from filename or page 1 content, and auto-detects
 * column X positions from the header row so it survives the small layout
 * variations CBS produces between report types.
 */
import { extractPdfData, normalizeAccNum, normDate, type PdfTextItem } from "../pdfExtractor";
import type { LastBalanceRecord } from "../fileParser";

const SCHEME_NAMES: Record<string, string> = {
  SBBAS: "SB Basic Saving Account",
  SBGEN: "SB General (No Cheque Book)",
  SBCHQ: "SB General (With Cheque Book)",
  SSA: "Sukanya Samriddhi Yojana",
  TDIP1: "Term Deposit – 1 Year",
  TDIP2: "Term Deposit – 2 Year",
  TDIP3: "Term Deposit – 3 Year",
  TDIP5: "Term Deposit – 5 Year",
  MIS: "Monthly Income Scheme",
  MISN1: "Monthly Income Scheme",
  SCSS: "Senior Citizens Savings Scheme",
  SRSCM: "Senior Citizens Savings Scheme",
  PPF: "Public Provident Fund",
  RD: "Recurring Deposit",
  NSC: "National Savings Certificate",
  KVP: "Kisan Vikas Patra",
  TD1: "Term Deposit – 1 Year",
  TD2: "Term Deposit – 2 Year",
  TD3: "Term Deposit – 3 Year",
  TD5: "Term Deposit – 5 Year",
};

function detectSchemeFromFilename(filename: string): string {
  const fn = filename.toUpperCase();
  if (fn.includes("MISN1") || fn.includes("MISN")) return "MIS";
  if (fn.includes("SRSCM") || fn.includes("SCSS")) return "SCSS";
  if (fn.includes("SBBAS")) return "SBBAS";
  if (fn.includes("SBCHQ")) return "SBCHQ";
  if (fn.includes("SBGEN")) return "SBGEN";
  if (fn.includes("SSA")) return "SSA";
  if (fn.includes("TDIP5")) return "TD5";
  if (fn.includes("TDIP3")) return "TD3";
  if (fn.includes("TDIP2")) return "TD2";
  if (fn.includes("TDIP1")) return "TD1";
  if (fn.includes("PPF")) return "PPF";
  if (fn.includes("MIS")) return "MIS";
  if (fn.includes("RD")) return "RD";
  return "";
}

interface RowGroup {
  page: number;
  y: number;
  cells: { x: number; text: string }[];
}

/**
 * Parse PDF spatial items into Last Balance records.
 * `schemeHint` overrides scheme detection (e.g. from filename).
 */
export function parseLastBalancePdfItems(
  allItems: PdfTextItem[],
  schemeHint = "",
): { records: Omit<LastBalanceRecord, "scheme_type"> & { scheme_type: string }[]; preparedDate: string; scheme: string } {
  let scheme = schemeHint;
  let schemeName = SCHEME_NAMES[scheme] || "";

  // Step 1: group tokens into rows by (page, y±5px)
  const sorted = [...allItems].sort((a, b) =>
    a.page !== b.page ? a.page - b.page : a.y - b.y,
  );
  const rows: RowGroup[] = [];
  let cur: RowGroup | null = null;
  for (const it of sorted) {
    if (!cur || cur.page !== it.page || Math.abs(cur.y - it.y) > 5) {
      cur = { page: it.page, y: it.y, cells: [] };
      rows.push(cur);
    }
    cur.cells.push({ x: it.x, text: it.text });
  }
  rows.forEach((r) => r.cells.sort((a, b) => a.x - b.x));

  // Step 2: detect scheme from first 2 pages if not hinted
  if (!scheme) {
    for (const r of rows) {
      if (r.page > 1) break;
      const line = r.cells.map((c) => c.text).join(" ").toUpperCase();
      if (line.includes("MISN1") || line.includes("MONTHLY INCOME")) scheme = "MIS";
      else if (line.includes("SRSCM") || line.includes("SENIOR CITIZEN")) scheme = "SCSS";
      else if (line.includes("SBBAS") || line.includes("BASIC SAVING")) scheme = "SBBAS";
      else if (line.includes("SBCHQ") || line.includes("WITH CHEQUE")) scheme = "SBCHQ";
      else if (line.includes("SBGEN") || line.includes("WITHOUT CHEQUE")) scheme = "SBGEN";
      else if (line.includes("TDIP5") || line.includes("FIVE YEAR")) scheme = "TD5";
      else if (line.includes("TDIP3") || line.includes("THREE YEAR")) scheme = "TD3";
      else if (line.includes("TDIP2") || line.includes("TWO YEAR")) scheme = "TD2";
      else if (line.includes("TDIP1") || line.includes("ONE YEAR")) scheme = "TD1";
      else if (line.includes("PPF") || line.includes("PUBLIC PROVIDENT")) scheme = "PPF";
      else if (line.includes("SSA") || line.includes("SUKANYA")) scheme = "SSA";
      else if (line.includes("RD") || line.includes("RECURRING")) scheme = "RD";
      if (scheme) break;
    }
    schemeName = SCHEME_NAMES[scheme] || scheme;
  }

  // Detect prepared date — first dd-Mon-yy / dd-mm-yyyy on page 1 near "Prepared"
  let preparedDate = "";
  for (const r of rows) {
    if (r.page > 1) break;
    const lineU = r.cells.map((c) => c.text).join(" ").toUpperCase();
    if (lineU.includes("PREPARED")) {
      const m = lineU.match(/(\d{1,2}[-/][A-Z]{3}[-/]\d{2,4})|(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/);
      if (m) {
        preparedDate = normDate(m[0], true);
        break;
      }
    }
  }

  // Step 3: auto-detect column X positions from header row
  const X = { acc: 55, name: 145, cif1: 220, addr: 490, acctype: 641, baldate: 690, status: 851, frz: 904, loan: 982, bo: 1047 };
  let hasCIFCol = false;

  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri];
    if (r.page > 1) break;
    const joined = r.cells.map((c) => c.text.toUpperCase()).join(" ");
    if (!joined.includes("ACCOUNT") || !joined.includes("NUMBER")) continue;

    // Header spans up to 4 rows — pull adjacent rows on the same page
    const hAll = [...r.cells];
    for (let k = 1; k <= 3; k++) {
      if (ri + k < rows.length && rows[ri + k].page === r.page) hAll.push(...rows[ri + k].cells);
    }
    if (ri > 0 && rows[ri - 1].page === r.page) hAll.push(...rows[ri - 1].cells);
    hAll.sort((a, b) => a.x - b.x);

    let prev = "";
    for (const tk of hAll) {
      const t = tk.text.toUpperCase().trim();
      if (t === "ADDRESS") X.addr = tk.x;
      if (t === "TYPE" && tk.x > 600 && tk.x < 750) X.acctype = tk.x;
      if (t === "BALANCE" && tk.x > 600 && !prev.includes("LAST")) X.baldate = tk.x;
      if (t === "STATUS" && tk.x > 700) X.status = tk.x;
      if ((t.startsWith("FRZD") || t.startsWith("PLDGD")) && tk.x > 700) X.frz = tk.x;
      if (t === "LOAN" && tk.x > 800) X.loan = tk.x;
      if (t === "BO" && tk.x > 900) X.bo = tk.x;
      if ((t === "CIF" || (t.includes("CIF") && t.includes("ID"))) && tk.x > 150 && tk.x < 500) {
        X.cif1 = tk.x;
        hasCIFCol = true;
      }
      if (t === "ID" && tk.x > 150 && tk.x < 500 && prev.includes("CIF")) {
        X.cif1 = tk.x;
        hasCIFCol = true;
      }
      prev = t;
    }
    const hdrText = hAll.map((t) => t.text).join(" ").toUpperCase();
    if (hdrText.includes("CIF") && hdrText.includes("ID")) hasCIFCol = true;
    break;
  }

  // Step 4: flat list helper
  const flat: { page: number; y: number; x: number; text: string }[] = [];
  for (const r of rows) for (const c of r.cells) flat.push({ page: r.page, y: r.y, x: c.x, text: c.text });
  flat.sort((a, b) => (a.page !== b.page ? a.page - b.page : a.y !== b.y ? a.y - b.y : a.x - b.x));

  const inX = (band: typeof flat, x1: number, x2: number) => {
    const toks = band.filter((t) => t.x >= x1 && t.x < x2).sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
    if (!toks.length) return "";
    let result = toks[0].text;
    for (let i = 1; i < toks.length; i++) {
      const p = toks[i - 1], c = toks[i];
      const sameCol = Math.abs(c.x - p.x) <= 2;
      const nextLine = c.y > p.y + 3;
      const prevEndsLetter = /[A-Za-z]$/.test(p.text);
      const curStartsLetter = /^[A-Za-z]/.test(c.text);
      const prevIsAbbrev = p.text.includes("/") || p.text.endsWith(",");
      const curIsOldSosale = /^(OLD|SOSALE|S\.O|H\.O|B\.O)\b/i.test(c.text.trim());
      const isWordWrap = sameCol && nextLine && prevEndsLetter && curStartsLetter && !prevIsAbbrev && !curIsOldSosale;
      result += (isWordWrap ? "" : " ") + c.text;
    }
    return result.trim();
  };

  const MON = "JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC";
  const BAL_RE = /([\d,]+\.\d{2})/;
  const DATE_RE = new RegExp("(\\d{2}-(?:" + MON + ")-\\d{2,4})", "i");
  const STAT_RE = /(Active|Freezed|FREEZED[^\s]*\s*PLEDGED?|FROZEN|AUTOMATIC\s*RENEWAL|OVERDUE|Dormant|DISCONT)/i;
  const SKIP =
    /INDIA\s+POST|LAST\s+BALANCE\s+REPORT|PREPARED\s+DATE|TOTAL\s+NO\s+OF|SOL\s+ID|ACCOUNT\s+NUMBER|CUST1\s+NAME|BALANCE\s+AFTER|DATE\s+OF\s+LAST|BO\s+NAME|PAGE\s+\d+\s+OF/i;

  // Step 5: parse data rows
  const records: (Omit<LastBalanceRecord, "scheme_type"> & { scheme_type: string })[] = [];
  let currentBO = "";

  for (let ri = 0; ri < rows.length; ri++) {
    const r = rows[ri];
    const cells = r.cells;
    if (!cells.length) continue;
    const lineText = cells.map((c) => c.text).join(" ");
    const lineU = lineText.toUpperCase();
    if (SKIP.test(lineU)) continue;

    if (/^Branch\s+Id/i.test(lineText.trim())) {
      const boToks = cells.filter((c) => c.x >= 200).map((c) => c.text.trim()).filter(Boolean);
      currentBO = boToks.length ? boToks.join(" ").trim() : "";
      continue;
    }
    if (cells[0] && /^Sol/i.test(cells[0].text)) {
      currentBO = "";
      continue;
    }

    const firstTxt = cells[0].text.trim();
    const isSerial = /^\d{1,4}$/.test(firstTxt);
    const isMergedSerial = /^\d{14,18}$/.test(firstTxt);
    if (!isSerial && !isMergedSerial) continue;

    // Vertical band: from this row to the next serial row
    let yNext = Math.min(r.y + 80, 540);
    for (let rj = ri + 1; rj < rows.length; rj++) {
      const nr = rows[rj];
      if (nr.page !== r.page) break;
      if (nr.y > 540) break;
      if (nr.cells.length && /^\d{1,4}$/.test(nr.cells[0].text.trim())) {
        yNext = nr.y - 1;
        break;
      }
    }
    const band = flat.filter((it) => it.page === r.page && it.y >= r.y - 2 && it.y < yNext && it.y < 540);

    // Account number
    let accTk = band.find((t) => t.x >= X.acc - 10 && t.x < X.name + 30 && /^\d{10,16}$/.test(t.text.trim()));
    if (!accTk) {
      const merged = band.find((t) => t.x < X.acc + 5 && /^\d{14,18}$/.test(t.text.trim()));
      if (merged) accTk = { ...merged, text: merged.text.slice(merged.text.length - 10) };
    }
    if (!accTk) continue;
    const acc = normalizeAccNum(accTk.text.trim());

    // CIF (optional)
    let cifId = "";
    {
      const cifX1 = X.name + 60;
      const cifX2 = X.addr - 20;
      const cifTk = band.find((t) => t.x >= cifX1 && t.x < cifX2 && /^\d{6,12}$/.test(t.text.trim()));
      if (cifTk) cifId = cifTk.text.trim();
    }

    const nameEnd = cifId ? X.cif1 - 5 : 228;
    const name = inX(band, X.name, nameEnd);
    const addrRaw = inX(band, X.addr, X.acctype);

    // Right side via regex on joined string
    const boInCol = inX(band, X.bo - 20, 9999);
    const boRaw = boInCol || currentBO;
    const rightStr = band
      .filter((t) => t.x >= X.baldate - 20 && t.x < X.frz - 15)
      .sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x))
      .map((t) => t.text)
      .join(" ");

    const balM = rightStr.replace(/\s/g, "").match(BAL_RE);
    const balance = balM ? parseFloat(balM[1].replace(/,/g, "")) : 0;
    const dateM = rightStr.match(DATE_RE);
    const lastDate = dateM ? normDate(dateM[1], true) : "";
    const statM = rightStr.match(STAT_RE);
    const rawStat = statM ? statM[1] : "Active";
    const su = rawStat.toUpperCase();
    let status = "Active";
    if (su.includes("DORMANT") || su.includes("SILENT")) status = "Dormant";
    else if (
      su.includes("FREEZE") ||
      su.includes("PLEDG") ||
      su.includes("DISCONT") ||
      su.includes("FROZEN") ||
      su.includes("AUTOMATIC") ||
      su.includes("RENEWAL") ||
      su.includes("OVERDUE")
    )
      status = "Frozen";

    const cleanAddress = addrRaw
      .replace(/\s*(SELF|JOINT\s*[AB]?|MINOR[^,]*)$/i, "")
      .replace(/\s+/g, " ")
      .trim();

    records.push({
      account: acc,
      name: name.replace(/\s+/g, " ").trim(),
      address: cleanAddress,
      balance,
      balance_date: lastDate || preparedDate || "",
      bo_name: boRaw.replace(/\s+/g, " ").trim(),
      scheme_type: scheme || "",
      // augment fields available on LastBalanceRecord:
      ...(cifId ? { cif_id: cifId } : {}),
      ...(status ? { status } : {}),
    } as unknown as Omit<LastBalanceRecord, "scheme_type"> & { scheme_type: string });
  }

  return { records, preparedDate, scheme };
}

/**
 * High-level convenience: read a PDF File and return parsed records.
 * Mirrors the shape the existing CSV importer returns so callers can
 * substitute one for the other transparently.
 */
export async function parseLastBalancePdf(
  file: File,
): Promise<{ records: ReturnType<typeof parseLastBalancePdfItems>["records"]; preparedDate: string; scheme: string }> {
  const { items } = await extractPdfData(file);
  const hint = detectSchemeFromFilename(file.name);
  return parseLastBalancePdfItems(items, hint);
}

export const _internal = { detectSchemeFromFilename, SCHEME_NAMES };