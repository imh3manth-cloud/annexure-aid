import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { parseLastBalanceCSV, LastBalanceRecord } from '@/lib/fileParser';
import { 
  saveLastBalanceRecords, 
  getLastBalanceCount,
  getLastBalanceDate,
  clearLastBalanceRecords 
} from '@/lib/db';
import { Upload, Database, Trash2, RefreshCw } from 'lucide-react';
import { BalanceRecordsViewer } from '@/components/BalanceRecordsViewer';

export const AccountDetails = () => {
  const [balanceFiles, setBalanceFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [savedBalanceInfo, setSavedBalanceInfo] = useState<{ count: number; date: string | null }>({ count: 0, date: null });
  const { toast } = useToast();

  useEffect(() => {
    loadSavedBalanceInfo();
  }, []);

  const loadSavedBalanceInfo = async () => {
    const count = await getLastBalanceCount();
    const date = await getLastBalanceDate();
    setSavedBalanceInfo({ count, date });
  };

  const handleClearSavedBalance = async () => {
    if (confirm('Are you sure you want to clear all saved balance data? You will need to upload again.')) {
      await clearLastBalanceRecords();
      await loadSavedBalanceInfo();
      toast({
        title: 'Cleared',
        description: 'Saved balance data has been cleared'
      });
    }
  };

  const handleUploadBalance = async () => {
    if (balanceFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select Last Balance CSV file(s)',
        variant: 'destructive'
      });
      return;
    }

    setProcessing(true);
    try {
      const newBalanceRecords: LastBalanceRecord[] = [];
      
      for (const file of balanceFiles) {
        const { records } = await parseLastBalanceCSV(file);
        newBalanceRecords.push(...records);
      }

      if (newBalanceRecords.length > 0) {
        const savedCount = await saveLastBalanceRecords(newBalanceRecords.map(r => ({
          account: r.account,
          name: r.name,
          address: r.address,
          balance: r.balance,
          balance_date: r.balance_date,
          bo_name: r.bo_name,
          scheme_type: r.scheme_type
        })));

        await loadSavedBalanceInfo();

        toast({
          title: 'Balance data saved',
          description: `Saved ${savedCount} balance records`
        });

        setBalanceFiles([]);
        // Reset the file input
        const fileInput = document.getElementById('balance-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
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
      <div>
        <h2 className="text-3xl font-bold text-foreground">Account Details</h2>
        <p className="text-muted-foreground mt-1">Manage saved balance data for account verification</p>
      </div>

      {/* Saved Balance Data Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="h-5 w-5 text-primary" />
            Saved Balance Summary
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
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={loadSavedBalanceInfo}
                  title="Refresh"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={handleClearSavedBalance}
                  title="Clear saved data"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No saved balance data. Upload Last Balance file(s) below.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Upload Last Balance */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Last Balance</CardTitle>
          <CardDescription>
            Upload Last Balance CSV files to save account details for memo generation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="balance-upload">Last Balance Files (CSV)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="balance-upload"
                type="file"
                accept=".csv"
                multiple
                onChange={(e) => setBalanceFiles(Array.from(e.target.files || []))}
              />
              {balanceFiles.length > 0 && (
                <span className="text-sm text-green-500">{balanceFiles.length} files</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Uploading new files will add/update the saved balance data
            </p>
          </div>

          <Button 
            onClick={handleUploadBalance} 
            disabled={processing || balanceFiles.length === 0}
          >
            <Upload className="w-4 h-4 mr-2" />
            {processing ? 'Processing...' : 'Upload & Save'}
          </Button>
        </CardContent>
      </Card>

      {/* Balance Records Viewer */}
      <BalanceRecordsViewer />
    </div>
  );
};
