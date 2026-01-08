import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { parseHFTIFile, detectBOCode, LastBalanceRecord } from '@/lib/fileParser';
import { 
  db, 
  MemoRecord, 
  initSettings, 
  getAllLastBalanceRecords, 
  getLastBalanceCount,
  getLastBalanceDate
} from '@/lib/db';
import { Upload as UploadIcon, FileSpreadsheet, Database, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const Upload = () => {
  const [hftiFile, setHftiFile] = useState<File | null>(null);
  const [threshold, setThreshold] = useState(10000);
  const [groupByBO, setGroupByBO] = useState(true);
  const [preview, setPreview] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [savedBalanceInfo, setSavedBalanceInfo] = useState<{ count: number; date: string | null }>({ count: 0, date: null });
  const [missingAccounts, setMissingAccounts] = useState<string[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadSavedBalanceInfo();
  }, []);

  const loadSavedBalanceInfo = async () => {
    const count = await getLastBalanceCount();
    const date = await getLastBalanceDate();
    setSavedBalanceInfo({ count, date });
  };

  const handlePreview = async () => {
    if (!hftiFile) {
      toast({
        title: 'Missing HFTI file',
        description: 'Please upload HFTI transaction file',
        variant: 'destructive'
      });
      return;
    }

    // Check if we have saved balance data
    const savedRecords = await getAllLastBalanceRecords();
    
    if (savedRecords.length === 0) {
      toast({
        title: 'No balance data',
        description: 'Please upload Last Balance files in Account Details first',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      // Parse HFTI
      const transactions = await parseHFTIFile(hftiFile);
      
      // Build account map from saved data first
      const accountMap = new Map<string, LastBalanceRecord>();
      let latestPreparedDate = '';
      
      // Add saved records to map
      savedRecords.forEach(rec => {
        let normalizedAccount = rec.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
        accountMap.set(normalizedAccount, {
          account: rec.account,
          name: rec.name,
          address: rec.address,
          balance: rec.balance,
          balance_date: rec.balance_date,
          bo_name: rec.bo_name,
          scheme_type: rec.scheme_type
        });
        if (!latestPreparedDate || rec.balance_date > latestPreparedDate) {
          latestPreparedDate = rec.balance_date;
        }
      });

      // Filter by threshold and merge data
      const missingAccountsList: string[] = [];
      const candidates = transactions
        .filter(t => t.amount >= threshold)
        .map(t => {
          let normalizedAccount = t.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
          const balanceData = accountMap.get(normalizedAccount);
          const bo = detectBOCode(t.particulars);
          
          if (!balanceData) {
            missingAccountsList.push(t.account);
          }
          
          return {
            txn_date: t.txn_date,
            account: t.account,
            txn_id: t.txn_id,
            amount: t.amount,
            name: balanceData?.name || 'NAME NOT FOUND',
            address: balanceData?.address || 'ADDRESS NOT FOUND',
            balance: balanceData?.balance || 0,
            balance_date: balanceData?.balance_date || latestPreparedDate || t.txn_date,
            BO_Code: bo.code,
            BO_Name: bo.name,
            particulars: t.particulars,
            hasBalanceData: !!balanceData
          };
        });

      setMissingAccounts([...new Set(missingAccountsList)]);

      // Check for duplicates
      const existing = await db.memos.toArray();
      const existingKeys = new Set(existing.map(m => m.memoKey));
      
      const newCandidates = candidates.filter(c => {
        const key = `${c.txn_id}|${c.account}|${c.amount}|${c.txn_date}`;
        return !existingKeys.has(key);
      });

      const duplicates = candidates.length - newCandidates.length;
      const withBalanceData = newCandidates.filter(c => c.hasBalanceData).length;
      const withoutBalanceData = newCandidates.length - withBalanceData;

      setPreview({
        total: candidates.length,
        new: newCandidates.length,
        duplicates,
        withBalanceData,
        withoutBalanceData,
        samples: newCandidates.slice(0, 5),
        preparedDate: latestPreparedDate
      });

      if (missingAccountsList.length > 0) {
        toast({
          title: 'Preview ready with warnings',
          description: `Found ${newCandidates.length} new transactions. ${missingAccountsList.length} accounts missing balance data.`,
          variant: 'default'
        });
      } else {
        toast({
          title: 'Preview ready',
          description: `Found ${newCandidates.length} new transactions (${duplicates} duplicates skipped)`
        });
      }
    } catch (error: any) {
      toast({
        title: 'Preview failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;

    setProcessing(true);
    try {
      await initSettings();
      const settings = await db.settings.get('app');
      let lastSerial = settings?.lastSerial || 0;

      // Parse HFTI again
      const transactions = await parseHFTIFile(hftiFile!);
      
      // Build account map from saved data
      const savedRecords = await getAllLastBalanceRecords();
      const accountMap = new Map<string, LastBalanceRecord>();
      let latestPreparedDate = '';
      
      savedRecords.forEach(rec => {
        let normalizedAccount = rec.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
        accountMap.set(normalizedAccount, {
          account: rec.account,
          name: rec.name,
          address: rec.address,
          balance: rec.balance,
          balance_date: rec.balance_date,
          bo_name: rec.bo_name,
          scheme_type: rec.scheme_type
        });
        if (!latestPreparedDate || rec.balance_date > latestPreparedDate) {
          latestPreparedDate = rec.balance_date;
        }
      });

      // Get existing memos
      const existing = await db.memos.toArray();
      const existingKeys = new Set(existing.map(m => m.memoKey));

      // Build candidates with normalized account lookup
      let candidates = transactions
        .filter(t => t.amount >= threshold)
        .map(t => {
          let normalizedAccount = t.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
          const balanceData = accountMap.get(normalizedAccount);
          const bo = detectBOCode(t.particulars);
          const key = `${t.txn_id}|${t.account}|${t.amount}|${t.txn_date}`;
          
          return {
            memoKey: key,
            account: t.account,
            txn_id: t.txn_id,
            amount: t.amount,
            txn_date: t.txn_date,
            name: balanceData?.name || 'NAME NOT FOUND',
            address: balanceData?.address || 'ADDRESS NOT FOUND',
            balance: balanceData?.balance || 0,
            balance_date: balanceData?.balance_date || latestPreparedDate || t.txn_date,
            BO_Code: bo.code,
            BO_Name: bo.name
          };
        })
        .filter(c => !existingKeys.has(c.memoKey));

      // Sort and assign serials
      if (groupByBO) {
        const groups = new Map<string, typeof candidates>();
        candidates.forEach(c => {
          if (!groups.has(c.BO_Code)) {
            groups.set(c.BO_Code, []);
          }
          groups.get(c.BO_Code)!.push(c);
        });

        const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
          if (a[0] === 'Unknown') return 1;
          if (b[0] === 'Unknown') return -1;
          return a[0].localeCompare(b[0]);
        });

        candidates = [];
        sortedGroups.forEach(([_, group]) => {
          group.sort((a, b) => new Date(a.txn_date).getTime() - new Date(b.txn_date).getTime());
          candidates.push(...group);
        });
      } else {
        candidates.sort((a, b) => new Date(a.txn_date).getTime() - new Date(b.txn_date).getTime());
      }

      // Assign serials and create records
      const memos: MemoRecord[] = candidates.map(c => ({
        serial: ++lastSerial,
        memoKey: c.memoKey,
        account: c.account,
        txn_id: c.txn_id,
        amount: c.amount,
        txn_date: c.txn_date,
        name: c.name,
        address: c.address,
        balance: c.balance,
        balance_date: c.balance_date,
        BO_Code: c.BO_Code,
        BO_Name: c.BO_Name,
        status: 'New',
        printed: false,
        memo_sent_date: null,
        reminder_count: 0,
        last_reminder_date: null,
        verified_date: null,
        reported_date: null,
        remarks: '',
        created_at: new Date().toISOString()
      }));

      // Save to database
      await db.memos.bulkAdd(memos);
      await db.settings.update('app', { lastSerial });

      toast({
        title: 'Success',
        description: `Added ${memos.length} new memos with serials ${memos[0].serial} to ${lastSerial}`
      });

      // Reset
      setHftiFile(null);
      setPreview(null);
      setMissingAccounts([]);
    } catch (error: any) {
      toast({
        title: 'Commit failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/operations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold text-foreground">Upload HFTI</h2>
          <p className="text-muted-foreground mt-1">Upload HFTI transactions for memo generation</p>
        </div>
      </div>

      {/* Saved Balance Data Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-primary" />
            Saved Balance Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          {savedBalanceInfo.count > 0 ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {savedBalanceInfo.count.toLocaleString()} accounts saved
                </p>
                <p className="text-xs text-muted-foreground">
                  Balance date: {savedBalanceInfo.date || 'Unknown'}
                </p>
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={loadSavedBalanceInfo}
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No saved balance data. Go to <a href="/accounts" className="text-primary underline">Account Details</a> to upload Last Balance files.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HFTI Transaction Upload</CardTitle>
          <CardDescription>
            Upload HFTI file to detect high-value withdrawals. Balance data will be matched from saved accounts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="hfti">HFTI Transaction File (Excel) *</Label>
            <div className="flex items-center gap-2">
              <Input
                id="hfti"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setHftiFile(e.target.files?.[0] || null)}
              />
              {hftiFile && <FileSpreadsheet className="w-5 h-5 text-green-500" />}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="threshold">Threshold Amount (₹)</Label>
            <Input
              id="threshold"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="groupbo"
              checked={groupByBO}
              onCheckedChange={setGroupByBO}
            />
            <Label htmlFor="groupbo">Group serials by Branch Office</Label>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handlePreview} 
              disabled={processing || !hftiFile || savedBalanceInfo.count === 0}
            >
              <UploadIcon className="w-4 h-4 mr-2" />
              Preview Detection
            </Button>
            {preview && (
              <Button onClick={handleCommit} disabled={processing} variant="default">
                Commit & Assign Serials
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Missing Accounts Warning */}
      {missingAccounts.length > 0 && (
        <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-500" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium text-amber-700 dark:text-amber-400">
                {missingAccounts.length} accounts not found in balance data
              </p>
              <p className="text-sm text-muted-foreground">
                Upload a Last Balance file containing these accounts to get their name/address/balance info.
              </p>
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  View missing accounts
                </summary>
                <div className="mt-2 p-2 bg-muted rounded max-h-32 overflow-y-auto">
                  {missingAccounts.join(', ')}
                </div>
              </details>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{preview.total}</div>
                  <div className="text-sm text-muted-foreground">Total Detected</div>
                </div>
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{preview.new}</div>
                  <div className="text-sm text-muted-foreground">New Memos</div>
                </div>
                <div className="text-center p-4 bg-green-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{preview.withBalanceData}</div>
                  <div className="text-sm text-muted-foreground">With Balance Data</div>
                </div>
                <div className="text-center p-4 bg-amber-500/10 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">{preview.withoutBalanceData}</div>
                  <div className="text-sm text-muted-foreground">Missing Data</div>
                </div>
              </div>

              {preview.duplicates > 0 && (
                <p className="text-sm text-muted-foreground text-center">
                  {preview.duplicates} duplicate transactions skipped
                </p>
              )}

              {preview.samples.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Sample Records:</h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    {preview.samples.map((s: any, i: number) => (
                      <div key={i} className={`p-2 rounded ${s.hasBalanceData ? 'bg-muted' : 'bg-amber-500/10'}`}>
                        {s.account} - {s.name} - ₹{s.amount} - {s.BO_Name}
                        {!s.hasBalanceData && <span className="ml-2 text-xs text-amber-600">(no balance data)</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
