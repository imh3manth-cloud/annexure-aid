import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { parseHFTIFile, detectBOCode } from '@/lib/fileParser';
import { 
  saveHFTITransactions,
  getHFTITransactionCount
} from '@/lib/db';
import { Upload as UploadIcon, FileSpreadsheet, Database, ArrowLeft, CheckCircle } from 'lucide-react';

export const Upload = () => {
  const [hftiFile, setHftiFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [lastUploadResult, setLastUploadResult] = useState<{ saved: number; skipped: number } | null>(null);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadTotalCount();
  }, []);

  const loadTotalCount = async () => {
    const count = await getHFTITransactionCount();
    setTotalTransactions(count);
  };

  const handleUpload = async () => {
    if (!hftiFile) {
      toast({
        title: 'Missing HFTI file',
        description: 'Please select an HFTI transaction file',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      // Parse HFTI file
      const transactions = await parseHFTIFile(hftiFile);
      
      // Transform to HFTI register format
      const hftiRecords = transactions.map(t => {
        const bo = detectBOCode(t.particulars);
        return {
          txn_date: t.txn_date,
          txn_id: t.txn_id,
          account: t.account,
          amount: t.amount,
          debit_credit: t.debit_credit,
          bo_reference: bo.code !== 'Unknown' ? `${bo.code} - ${bo.name}` : '',
          particulars: t.particulars,
          source_file: hftiFile.name
        };
      });

      // Save to HFTI register (append mode, no duplicates)
      const result = await saveHFTITransactions(hftiRecords, hftiFile.name);
      
      setLastUploadResult(result);
      await loadTotalCount();

      toast({
        title: 'Upload Successful',
        description: `${result.saved} transactions saved successfully${result.skipped > 0 ? ` (${result.skipped} duplicates skipped)` : ''}`
      });

      // Reset file input
      setHftiFile(null);
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/operations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold text-foreground">Upload HFTI</h2>
          <p className="text-muted-foreground mt-1">Upload HFTI transactions to the master register</p>
        </div>
      </div>

      {/* Current Register Status */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-primary" />
            HFTI Transaction Register
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">{totalTransactions.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total transactions saved</p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={() => navigate('/hfti-register')}
            >
              View Register
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>HFTI Transaction Upload</CardTitle>
          <CardDescription>
            Upload HFTI Excel file to save all BO transactions permanently. 
            Each upload appends new data without overwriting existing records.
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
                onChange={(e) => {
                  setHftiFile(e.target.files?.[0] || null);
                  setLastUploadResult(null);
                }}
              />
              {hftiFile && <FileSpreadsheet className="w-5 h-5 text-green-500" />}
            </div>
            <p className="text-xs text-muted-foreground">
              Both debit and credit transactions will be saved with their D/C flag
            </p>
          </div>

          <Button 
            onClick={handleUpload} 
            disabled={processing || !hftiFile}
            className="w-full"
          >
            <UploadIcon className="w-4 h-4 mr-2" />
            {processing ? 'Processing...' : 'Upload & Save Transactions'}
          </Button>
        </CardContent>
      </Card>

      {/* Last Upload Result */}
      {lastUploadResult && (
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/20 rounded-full">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-green-700 dark:text-green-400">
                  {lastUploadResult.saved} transactions saved successfully
                </h3>
                {lastUploadResult.skipped > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {lastUploadResult.skipped} duplicate transactions were skipped
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How it works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>• <strong>Upload</strong> = Data ingestion only (saves raw transactions)</p>
          <p>• <strong>HFTI Register</strong> = Master working data with filters</p>
          <p>• <strong>Memo Register, Verify, Reminders</strong> = Derived views from saved data</p>
          <p>• Duplicate transactions are automatically detected and skipped</p>
          <p>• All data is stored offline and persists between sessions</p>
        </CardContent>
      </Card>
    </div>
  );
};
