import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { parseHFTIFile, parseLastBalanceCSV, detectBOCode, HFTITransaction, LastBalanceRecord } from '@/lib/fileParser';
import { db, MemoRecord, initSettings } from '@/lib/db';
import { Upload as UploadIcon, FileSpreadsheet } from 'lucide-react';

export const Upload = () => {
  const [hftiFile, setHftiFile] = useState<File | null>(null);
  const [balanceFiles, setBalanceFiles] = useState<File[]>([]);
  const [threshold, setThreshold] = useState(10000);
  const [groupByBO, setGroupByBO] = useState(true);
  const [preview, setPreview] = useState<any>(null);
  const [processing, setProcessing] = useState(false);
  const [uploadHistory, setUploadHistory] = useState<any[]>([]);
  const [useExistingBalance, setUseExistingBalance] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadUploadHistory();
  }, []);

  const loadUploadHistory = async () => {
    const history = await db.lastBalanceUploads.orderBy('uploadDate').reverse().limit(10).toArray();
    setUploadHistory(history);
  };

  const handlePreview = async () => {
    if (!hftiFile || balanceFiles.length === 0) {
      toast({
        title: 'Missing files',
        description: 'Please upload HFTI file and at least one Last Balance file',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      // Parse files
      const transactions = await parseHFTIFile(hftiFile);
      
      const balanceRecords: LastBalanceRecord[] = [];
      let latestPreparedDate = '';
      
      for (const file of balanceFiles) {
        const { records, preparedDate } = await parseLastBalanceCSV(file);
        balanceRecords.push(...records);
        if (!latestPreparedDate || preparedDate > latestPreparedDate) {
          latestPreparedDate = preparedDate;
        }
        
        // Save to upload history
        await db.lastBalanceUploads.add({
          filename: file.name,
          uploadDate: new Date().toISOString(),
          recordCount: records.length
        });
      }
      
      // Reload upload history
      loadUploadHistory();

      // Create account lookup with normalized account numbers (remove leading zeros)
      const accountMap = new Map<string, LastBalanceRecord>();
      balanceRecords.forEach(rec => {
        // Normalize: remove non-numeric and leading zeros
        let normalizedAccount = rec.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
        accountMap.set(normalizedAccount, rec);
        console.log('AccountMap - Adding:', normalizedAccount, '-> Name:', rec.name, 'Balance:', rec.balance, 'Date:', rec.balance_date);
      });
      
      console.log('Total accounts in map:', accountMap.size);

      // Filter by threshold and merge data
      const candidates = transactions
        .filter(t => t.amount >= threshold)
        .map(t => {
          // Normalize: remove non-numeric and leading zeros
          let normalizedAccount = t.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
          const balanceData = accountMap.get(normalizedAccount);
          const bo = detectBOCode(t.particulars);
          
          console.log('Looking up:', normalizedAccount, '-> Found:', balanceData?.name || 'NOT FOUND', 'Balance:', balanceData?.balance);
          
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
            particulars: t.particulars
          };
        });

      // Check for duplicates
      const existing = await db.memos.toArray();
      const existingKeys = new Set(existing.map(m => m.memoKey));
      
      const newCandidates = candidates.filter(c => {
        const key = `${c.txn_id}|${c.account}|${c.amount}|${c.txn_date}`;
        return !existingKeys.has(key);
      });

      const duplicates = candidates.length - newCandidates.length;

      setPreview({
        total: candidates.length,
        new: newCandidates.length,
        duplicates,
        samples: newCandidates.slice(0, 5),
        preparedDate: latestPreparedDate
      });

      toast({
        title: 'Preview ready',
        description: `Found ${newCandidates.length} new transactions (${duplicates} duplicates skipped). Balance date: ${latestPreparedDate}`
      });
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

      // Parse files again
      const transactions = await parseHFTIFile(hftiFile!);
      const balanceRecords: LastBalanceRecord[] = [];
      let latestPreparedDate = '';
      
      for (const file of balanceFiles) {
        const { records, preparedDate } = await parseLastBalanceCSV(file);
        balanceRecords.push(...records);
        if (!latestPreparedDate || preparedDate > latestPreparedDate) {
          latestPreparedDate = preparedDate;
        }
      }

      // Use normalized account numbers for lookup
      const accountMap = new Map<string, LastBalanceRecord>();
      balanceRecords.forEach(rec => {
        let normalizedAccount = rec.account.replace(/\D/g, '').replace(/^0+/, '') || '0';
        accountMap.set(normalizedAccount, rec);
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
      setBalanceFiles([]);
      setPreview(null);
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Upload Files</h2>
        <p className="text-muted-foreground mt-1">Upload HFTI transactions and Last Balance reports</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>File Upload</CardTitle>
          <CardDescription>Select HFTI Excel file and Last Balance CSV files</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="hfti">HFTI Transaction File (Excel)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="hfti"
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setHftiFile(e.target.files?.[0] || null)}
              />
              {hftiFile && <FileSpreadsheet className="w-5 h-5 text-success" />}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="balance">Last Balance Files (CSV - multiple allowed)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="balance"
                type="file"
                accept=".csv"
                multiple
                onChange={(e) => setBalanceFiles(Array.from(e.target.files || []))}
              />
              {balanceFiles.length > 0 && (
                <span className="text-sm text-success">{balanceFiles.length} files</span>
              )}
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
            <Button onClick={handlePreview} disabled={processing || !hftiFile || balanceFiles.length === 0}>
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

      {/* Last Balance Upload History */}
      {uploadHistory.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-accent" />
              Last Balance Upload History
            </CardTitle>
            <CardDescription>Recent last balance file uploads - select to reuse</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="useExisting"
                  checked={useExistingBalance}
                  onChange={(e) => setUseExistingBalance(e.target.checked)}
                  className="h-4 w-4"
                />
                <Label htmlFor="useExisting">Use previously uploaded last balance data</Label>
              </div>
              
              {useExistingBalance && (
                <div className="grid gap-3 mt-4">
                  {uploadHistory.map((upload) => (
                    <div
                      key={upload.id}
                      className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{upload.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(upload.uploadDate).toLocaleDateString()} - {upload.recordCount} records
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            toast({
                              title: 'Using previous data',
                              description: `Using ${upload.filename} for balance information`
                            });
                          }}
                        >
                          Use This
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle>Preview Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{preview.total}</div>
                  <div className="text-sm text-muted-foreground">Total Detected</div>
                </div>
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{preview.new}</div>
                  <div className="text-sm text-muted-foreground">New Memos</div>
                </div>
                <div className="text-center p-4 bg-warning/10 rounded-lg">
                  <div className="text-2xl font-bold text-warning">{preview.duplicates}</div>
                  <div className="text-sm text-muted-foreground">Duplicates</div>
                </div>
              </div>

              {preview.samples.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">Sample Records:</h4>
                  <div className="text-sm space-y-1 text-muted-foreground">
                    {preview.samples.map((s: any, i: number) => (
                      <div key={i} className="p-2 bg-muted rounded">
                        {s.account} - {s.name} - ₹{s.amount} - {s.BO_Name}
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
