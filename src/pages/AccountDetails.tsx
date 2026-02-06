import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BalanceRecordsViewer } from '@/components/BalanceRecordsViewer';
import { BalancePreviewDialog } from '@/components/BalancePreviewDialog';
import { UploadProgress } from '@/components/UploadProgress';
import { AccountLookup } from '@/components/AccountLookup';
import { extractRawCSVData, RawCSVData, LastBalanceRecord } from '@/lib/fileParser';
import {
  saveLastBalanceRecords,
  getLastBalanceCount,
  getLastBalanceDate,
  getLastBalanceSchemeSummary,
  clearLastBalanceRecords,
  SchemeSummary,
} from '@/lib/db';
import { ArrowLeft, Upload, Database, Trash2, RefreshCw, Eye, FileText, CalendarDays, Search } from 'lucide-react';

// Known scheme codes that can be extracted from filenames
const SCHEME_PATTERNS: Record<string, string> = {
  'SSA': 'SSA',
  'SBCHQ': 'SBCHQ',
  'SBGEN': 'SBGEN',
  'SBBAS': 'SBBAS',
  'RD': 'RD',
  'TD': 'TD',
  'MIS': 'MIS',
  'SCSS': 'SCSS',
  'PPF': 'PPF',
  'NSC': 'NSC',
  'KVP': 'KVP',
};

function extractSchemeFromFilename(filename: string): string {
  const upperName = filename.toUpperCase();
  for (const [pattern, scheme] of Object.entries(SCHEME_PATTERNS)) {
    if (upperName.includes(pattern)) {
      return scheme;
    }
  }
  return '';
}

interface ParsedFileData {
  rawData: RawCSVData;
  fileName: string;
  schemeFromFilename: string;
}

export const AccountDetails = () => {
  const navigate = useNavigate();
  const [balanceFiles, setBalanceFiles] = useState<File[]>([]);
  const [processing, setProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ processed: 0, total: 0, currentFile: '' });
  const [savedBalanceInfo, setSavedBalanceInfo] = useState<{
    count: number;
    date: string | null;
    schemeSummary: SchemeSummary[];
  }>({
    count: 0,
    date: null,
    schemeSummary: [],
  });
  
  // Multi-file processing state
  const [parsedFiles, setParsedFiles] = useState<ParsedFileData[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [totalSavedCount, setTotalSavedCount] = useState(0);
  
  const { toast } = useToast();

  useEffect(() => {
    loadSavedBalanceInfo();
  }, []);

  const loadSavedBalanceInfo = async () => {
    const count = await getLastBalanceCount();
    const date = await getLastBalanceDate();
    const schemeSummary = await getLastBalanceSchemeSummary();
    setSavedBalanceInfo({ count, date, schemeSummary });
  };

  const handleClearSavedBalance = async () => {
    if (confirm('Are you sure you want to clear all saved balance data? You will need to upload again.')) {
      await clearLastBalanceRecords();
      await loadSavedBalanceInfo();
      toast({
        title: 'Cleared',
        description: 'Saved balance data has been cleared',
      });
    }
  };

  const handleParseAllFiles = async () => {
    if (balanceFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select Last Balance CSV file(s)',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    const parsed: ParsedFileData[] = [];

    try {
      for (const file of balanceFiles) {
        const rawData = await extractRawCSVData(file);
        const schemeFromFilename = extractSchemeFromFilename(file.name);
        // Prefer scheme detected from file content, fallback to filename
        const schemeFromFile = rawData.detectedScheme || schemeFromFilename;
        
        if (rawData.rows.length > 0) {
          parsed.push({
            rawData,
            fileName: file.name,
            schemeFromFilename: schemeFromFile,
          });
        }
      }

      if (parsed.length === 0) {
        toast({
          title: 'No data found',
          description: 'Could not find any data rows in the selected file(s)',
          variant: 'destructive',
        });
        return;
      }

      setParsedFiles(parsed);
      setCurrentFileIndex(0);
      setTotalSavedCount(0);
      setShowPreview(true);
    } catch (error: any) {
      toast({
        title: 'Parse failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleConfirmSave = async (records: LastBalanceRecord[], preparedDate: string) => {
    const currentFile = parsedFiles[currentFileIndex];
    if (!currentFile) return;

    setProcessing(true);
    setUploadProgress({ processed: 0, total: records.length, currentFile: currentFile.fileName });

    try {
      // Apply scheme from filename to all records that don't have one
      const recordsWithScheme = records.map(r => ({
        account: r.account,
        name: r.name,
        address: r.address,
        balance: r.balance,
        balance_date: preparedDate,
        // Use scheme from record if available, otherwise use filename-extracted scheme
        scheme_type: r.scheme_type || currentFile.schemeFromFilename,
        // Use BO name from record
        bo_name: r.bo_name || '',
      }));

      const savedCount = await saveLastBalanceRecords(
        recordsWithScheme,
        (processed, total) => {
          setUploadProgress({ processed, total, currentFile: currentFile.fileName });
        }
      );

      setTotalSavedCount(prev => prev + savedCount);

      // Check if there are more files to process
      if (currentFileIndex < parsedFiles.length - 1) {
        setCurrentFileIndex(prev => prev + 1);
        toast({
          title: `File ${currentFileIndex + 1} saved`,
          description: `${savedCount} records from ${currentFile.fileName}. Processing next file...`,
        });
      } else {
        // All files processed
        await loadSavedBalanceInfo();
        
        toast({
          title: 'All files processed',
          description: `Total ${totalSavedCount + savedCount} records saved from ${parsedFiles.length} file(s)`,
        });

        // Reset state
        setBalanceFiles([]);
        setParsedFiles([]);
        setCurrentFileIndex(0);
        setShowPreview(false);
        
        const fileInput = document.getElementById('balance-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (error: any) {
      toast({
        title: 'Save failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
      setUploadProgress({ processed: 0, total: 0, currentFile: '' });
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setParsedFiles([]);
    setCurrentFileIndex(0);
  };

  const currentParsedFile = parsedFiles[currentFileIndex];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/operations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Account Details</h1>
          <p className="text-muted-foreground">Manage saved balance data for account verification</p>
        </div>
      </div>

      {/* Tabs Interface */}
      <Tabs defaultValue="lookup" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="lookup" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Account Lookup
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Data
          </TabsTrigger>
          <TabsTrigger value="records" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Saved Records
          </TabsTrigger>
        </TabsList>

        {/* Account Lookup Tab */}
        <TabsContent value="lookup" className="mt-6">
          <AccountLookup />
        </TabsContent>

        {/* Upload Data Tab */}
        <TabsContent value="upload" className="mt-6 space-y-6">
          {/* Saved Balance Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">Saved Balance Summary</CardTitle>
                </div>
                {savedBalanceInfo.count > 0 && (
                  <Button variant="outline" size="sm" onClick={handleClearSavedBalance}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear Data
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {savedBalanceInfo.count > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-2xl font-bold">{savedBalanceInfo.count.toLocaleString()}</p>
                      <p className="text-sm text-muted-foreground">accounts saved</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        Last Balance Dated
                      </div>
                      <p className="font-medium text-lg">{savedBalanceInfo.date || 'Unknown'}</p>
                    </div>
                  </div>
                  
                  {/* Scheme Summary */}
                  {savedBalanceInfo.schemeSummary.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Accounts by Scheme</p>
                      <div className="flex flex-wrap gap-2">
                        {savedBalanceInfo.schemeSummary.map(({ scheme, count }) => (
                          <Badge key={scheme} variant="secondary" className="text-sm px-3 py-1">
                            {scheme}: {count.toLocaleString()}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <Button variant="outline" onClick={loadSavedBalanceInfo}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  No saved balance data. Upload Last Balance file(s) below.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Last Balance
              </CardTitle>
              <CardDescription>
                Upload Last Balance CSV files. Scheme type (SSA, SBCHQ, etc.) will be extracted from filenames automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="balance-upload">Last Balance Files (CSV/Excel)</Label>
                <Input
                  id="balance-upload"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  multiple
                  onChange={(e) => setBalanceFiles(Array.from(e.target.files || []))}
                />
                {balanceFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{balanceFiles.length} file(s) selected:</p>
                    <div className="flex flex-wrap gap-2">
                      {balanceFiles.map((file, i) => {
                        const scheme = extractSchemeFromFilename(file.name);
                        return (
                          <div key={i} className="flex items-center gap-1 text-xs bg-muted/50 px-2 py-1 rounded">
                            <FileText className="h-3 w-3" />
                            <span>{file.name}</span>
                            {scheme && <Badge variant="secondary" className="text-xs">{scheme}</Badge>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">
                Tip: Name your files with scheme codes (e.g., "LastBal_SSA.csv") to auto-assign schemes to all accounts in that file.
              </p>

              {processing && uploadProgress.total > 0 && (
                <UploadProgress
                  fileName={uploadProgress.currentFile}
                  processed={uploadProgress.processed}
                  total={uploadProgress.total}
                  status="processing"
                />
              )}

              <Button onClick={handleParseAllFiles} disabled={balanceFiles.length === 0 || processing}>
                <Eye className="w-4 h-4 mr-2" />
                {processing ? 'Parsing...' : 'Preview & Upload'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Saved Records Tab */}
        <TabsContent value="records" className="mt-6">
          {savedBalanceInfo.count > 0 ? (
            <BalanceRecordsViewer />
          ) : (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>No saved balance data.</p>
                  <p className="text-sm">Upload Last Balance files from the "Upload Data" tab.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview Dialog - process one file at a time */}
      {currentParsedFile && (
        <BalancePreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          rawData={currentParsedFile.rawData}
          fileName={`${currentParsedFile.fileName}${currentParsedFile.schemeFromFilename ? ` (Scheme: ${currentParsedFile.schemeFromFilename})` : ''} [File ${currentFileIndex + 1}/${parsedFiles.length}]`}
          onConfirm={handleConfirmSave}
          onCancel={handleCancelPreview}
        />
      )}
    </div>
  );
};
