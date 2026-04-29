import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Search, Clock, FileX2, Loader2 } from "lucide-react";
import { parseConsolidationPdf, type ConsolidationRow } from "@/lib/pdfParsers/consolidationPdf";
import { parseBrnLongBookPdf } from "@/lib/pdfParsers/brnLongBookPdf";
import { getAllLastBalanceRecords } from "@/lib/db";
import { normalizeAccNum, SCHEME_DISPLAY } from "@/lib/pdfExtractor";

/**
 * Unified PDF Tools page — additive, does not touch existing flows.
 *  1. Consolidation viewer (BO/SO daily totals from PDF)
 *  2. Unregistered SO accounts detector (BRN PDF vs balance register)
 *  3. Dormancy & silent accounts (from balance register)
 *  4. Records weed-out schedule (Appendix XIX)
 */
export const PdfTools = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-foreground">PDF Tools & Reports</h2>
        <p className="text-muted-foreground mt-1">
          Consolidation viewer, unregistered account detector, dormancy & weed-out schedules
        </p>
      </div>

      <Tabs defaultValue="consolidation" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="consolidation">
            <FileText className="w-4 h-4 mr-1" /> Consolidation
          </TabsTrigger>
          <TabsTrigger value="unregistered">
            <Search className="w-4 h-4 mr-1" /> Unregistered SO
          </TabsTrigger>
          <TabsTrigger value="dormancy">
            <Clock className="w-4 h-4 mr-1" /> Dormancy
          </TabsTrigger>
          <TabsTrigger value="weedout">
            <FileX2 className="w-4 h-4 mr-1" /> Weed-out
          </TabsTrigger>
        </TabsList>

        <TabsContent value="consolidation"><ConsolidationTab /></TabsContent>
        <TabsContent value="unregistered"><UnregisteredTab /></TabsContent>
        <TabsContent value="dormancy"><DormancyTab /></TabsContent>
        <TabsContent value="weedout"><WeedOutTab /></TabsContent>
      </Tabs>
    </div>
  );
};

// ───────────────────────── Consolidation Tab ─────────────────────────

function ConsolidationTab() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<ConsolidationRow[]>([]);
  const [reportDate, setReportDate] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { rows, reportDate } = await parseConsolidationPdf(file);
      setRows(rows);
      setReportDate(reportDate);
      toast({ title: "Parsed", description: `${rows.length} rows extracted.` });
    } catch (err) {
      toast({ title: "Parse failed", description: String(err), variant: "destructive" });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  const totals = useMemo(() => {
    const cr = rows.reduce((s, r) => s + r.creditAmt, 0);
    const db = rows.reduce((s, r) => s + r.debitAmt, 0);
    return { cr, db };
  }, [rows]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>BO / SO Consolidation PDF</CardTitle>
        <CardDescription>
          Upload BO_CONS or SO_CONS daily summary PDF — extracts BO-wise credit/debit totals by scheme.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="cons-file">Consolidation PDF</Label>
          <Input id="cons-file" type="file" accept=".pdf" onChange={handleFile} disabled={busy} />
        </div>

        {busy && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Parsing PDF…
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap gap-3 text-sm">
              {reportDate && <Badge variant="outline">Report date: {reportDate}</Badge>}
              <Badge variant="outline">Rows: {rows.length}</Badge>
              <Badge variant="outline">Total Cr: ₹{totals.cr.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Badge>
              <Badge variant="outline">Total Db: ₹{totals.db.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</Badge>
            </div>

            <div className="border rounded-md max-h-[60vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>BO / SO</TableHead>
                    <TableHead>Scheme</TableHead>
                    <TableHead className="text-right">Cr Amount</TableHead>
                    <TableHead className="text-right">Cr Cnt</TableHead>
                    <TableHead className="text-right">Db Amount</TableHead>
                    <TableHead className="text-right">Db Cnt</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{r.bo}</TableCell>
                      <TableCell>{SCHEME_DISPLAY[r.scheme] || r.scheme}</TableCell>
                      <TableCell className="text-right">{r.creditAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{r.creditCount}</TableCell>
                      <TableCell className="text-right">{r.debitAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell className="text-right">{r.debitCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Unregistered SO accounts ─────────────────────────

function UnregisteredTab() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState<{ acc: string; scheme: string; date: string }[]>([]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const [{ rows }, balances] = await Promise.all([
        parseBrnLongBookPdf(file),
        getAllLastBalanceRecords(),
      ]);
      const known = new Set(balances.map((b) => normalizeAccNum(b.account)));
      const seen = new Map<string, { acc: string; scheme: string; date: string }>();
      for (const r of rows) {
        const acc = normalizeAccNum(r.acc);
        if (!acc) continue;
        if (known.has(acc)) continue;
        if (!seen.has(acc)) seen.set(acc, { acc, scheme: r.scheme, date: r.date });
      }
      const result = Array.from(seen.values()).sort((a, b) => a.acc.localeCompare(b.acc));
      setMissing(result);
      toast({
        title: "Scan complete",
        description: `${result.length} unregistered account(s) of ${rows.length} BRN rows.`,
      });
    } catch (err) {
      toast({ title: "Parse failed", description: String(err), variant: "destructive" });
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Unregistered SO Accounts Detector</CardTitle>
        <CardDescription>
          Upload BRN Detailed Long Book PDF — lists accounts that appear in the long book
          but are not yet present in your Last Balance / account register.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="brn-file">BRN PDF (SO_LOT)</Label>
          <Input id="brn-file" type="file" accept=".pdf" onChange={handleFile} disabled={busy} />
        </div>

        {busy && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Scanning…
          </div>
        )}

        {missing.length > 0 && (
          <div className="border rounded-md max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account No</TableHead>
                  <TableHead>Scheme</TableHead>
                  <TableHead>First seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missing.map((m) => (
                  <TableRow key={m.acc}>
                    <TableCell className="font-mono">{m.acc}</TableCell>
                    <TableCell>{SCHEME_DISPLAY[m.scheme] || m.scheme}</TableCell>
                    <TableCell>{m.date}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Dormancy report ─────────────────────────

/**
 * POSB dormancy rules (simplified for offline triage):
 *   SB / PPF / SSA: > 3 years inactivity
 *   RD / TD / MIS / SCSS / NSC / KVP: > 3 years past balance date
 * Uses the most recent balance_date in last_balance_records as activity proxy.
 */
function DormancyTab() {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<{
    account: string; name: string; scheme: string; balance: number; lastDate: string; years: number;
  }[]>([]);

  const scan = async () => {
    setBusy(true);
    try {
      const balances = await getAllLastBalanceRecords();
      const today = new Date();
      const dormant: typeof results = [];
      for (const b of balances) {
        if (!b.balance_date) continue;
        const d = new Date(b.balance_date);
        if (isNaN(d.getTime())) continue;
        const years = (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
        if (years > 3) {
          dormant.push({
            account: b.account,
            name: b.name || "—",
            scheme: b.scheme_type || "—",
            balance: Number(b.balance) || 0,
            lastDate: b.balance_date,
            years: Math.round(years * 10) / 10,
          });
        }
      }
      dormant.sort((a, b) => b.years - a.years);
      setResults(dormant);
      toast({ title: "Scan complete", description: `${dormant.length} dormant/silent accounts.` });
    } catch (err) {
      toast({ title: "Scan failed", description: String(err), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dormancy & Silent Accounts</CardTitle>
        <CardDescription>
          Scans your Last Balance register for accounts inactive &gt; 3 years (POSB dormancy threshold).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button onClick={scan} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Search className="w-4 h-4 mr-1" />}
          Scan account register
        </Button>

        {results.length > 0 && (
          <div className="border rounded-md max-h-[60vh] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Scheme</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Last activity</TableHead>
                  <TableHead className="text-right">Years dormant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((r) => (
                  <TableRow key={r.account}>
                    <TableCell className="font-mono">{r.account}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.scheme}</TableCell>
                    <TableCell className="text-right">{r.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</TableCell>
                    <TableCell>{r.lastDate}</TableCell>
                    <TableCell className="text-right">{r.years}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ───────────────────────── Records weed-out (Appendix XIX) ─────────────────────────

const WEEDOUT_ITEMS: { item: string; period: string; years: number }[] = [
  { item: "Error Book", period: "3 years", years: 3 },
  { item: "Daily Account / Cash Book", period: "10 years", years: 10 },
  { item: "BO Daily Account", period: "5 years", years: 5 },
  { item: "BO Slips (Receipt / Payment)", period: "3 years", years: 3 },
  { item: "Long Book / SB Journal", period: "10 years", years: 10 },
  { item: "Despatch Register", period: "3 years", years: 3 },
  { item: "Sub Office Daily Report (SO Slip)", period: "3 years", years: 3 },
  { item: "BO Reports / Returns", period: "3 years", years: 3 },
  { item: "Treasurer's Cash Book", period: "10 years", years: 10 },
  { item: "MO Issue / Paid List", period: "3 years", years: 3 },
  { item: "Closed SB Account ledger card", period: "10 years", years: 10 },
  { item: "Closed RD/TD/MIS/SCSS docket", period: "10 years", years: 10 },
  { item: "Stamp Account Register", period: "5 years", years: 5 },
  { item: "Establishment / Acquittance Roll", period: "35 years", years: 35 },
];

function WeedOutTab() {
  const [start, setStart] = useState("");
  const today = new Date();

  const schedule = useMemo(() => {
    if (!start) return [];
    const sd = new Date(start);
    if (isNaN(sd.getTime())) return [];
    return WEEDOUT_ITEMS.map((w) => {
      const due = new Date(sd);
      due.setFullYear(due.getFullYear() + w.years);
      const eligible = due <= today;
      return { ...w, dueDate: due.toISOString().slice(0, 10), eligible };
    });
  }, [start, today]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Records Weed-out Schedule (Appendix XIX)</CardTitle>
        <CardDescription>
          Pick the record start date — table shows statutory preservation period and weed-out eligibility.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs">
          <Label htmlFor="weed-start">Record start date</Label>
          <Input
            id="weed-start"
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </div>

        <div className="border rounded-md max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Record</TableHead>
                <TableHead>Preservation</TableHead>
                {start && <TableHead>Eligible from</TableHead>}
                {start && <TableHead>Status</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(schedule.length ? schedule : WEEDOUT_ITEMS.map((w) => ({ ...w, dueDate: "", eligible: false }))).map((w, i) => (
                <TableRow key={i}>
                  <TableCell>{w.item}</TableCell>
                  <TableCell>{w.period}</TableCell>
                  {start && <TableCell>{w.dueDate}</TableCell>}
                  {start && (
                    <TableCell>
                      {w.eligible ? (
                        <Badge variant="destructive">Weed out now</Badge>
                      ) : (
                        <Badge variant="outline">Retain</Badge>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// keep tree-shaker happy with unused icons
void Upload;