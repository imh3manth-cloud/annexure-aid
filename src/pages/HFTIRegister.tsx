import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Filter, X, Database, Upload, FileSpreadsheet, CheckCircle, Calendar } from 'lucide-react';
import { 
  getAllHFTITransactions, 
  getFilteredHFTITransactions, 
  HFTITransactionRecord, 
  saveHFTITransactions,
  getHFTITransactionCount,
  getHFTIDateRange
} from '@/lib/db';
import { parseHFTIFile, detectBOCode } from '@/lib/fileParser';
import { useToast } from '@/hooks/use-toast';

export const HFTIRegister = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [transactions, setTransactions] = useState<HFTITransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  
  // Upload states
  const [hftiFile, setHftiFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [lastUploadResult, setLastUploadResult] = useState<{ saved: number; skipped: number } | null>(null);
  
  // Date range tracking
  const [dateRange, setDateRange] = useState<{ fromDate: string | null; toDate: string | null }>({
    fromDate: null,
    toDate: null
  });
  
  // Filter states
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    debitCredit: 'all' as 'D' | 'C' | 'all',
    minAmount: '',
    maxAmount: '',
    account: ''
  });

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const data = await getFilteredHFTITransactions({
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
        debitCredit: filters.debitCredit,
        minAmount: filters.minAmount ? parseFloat(filters.minAmount) : undefined,
        maxAmount: filters.maxAmount ? parseFloat(filters.maxAmount) : undefined,
        account: filters.account || undefined
      });
      setTransactions(data);
      
      // Load date range
      const range = await getHFTIDateRange();
      setDateRange(range);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const applyFilters = () => {
    loadTransactions();
  };

  const clearFilters = () => {
    setFilters({
      startDate: '',
      endDate: '',
      debitCredit: 'all',
      minAmount: '',
      maxAmount: '',
      account: ''
    });
    // Load all after clearing
    setTimeout(() => loadTransactions(), 0);
  };

  const hasActiveFilters = filters.startDate || filters.endDate || filters.debitCredit !== 'all' || 
    filters.minAmount || filters.maxAmount || filters.account;

  const stats = useMemo(() => {
    const debitCount = transactions.filter(t => t.debit_credit === 'D').length;
    const creditCount = transactions.filter(t => t.debit_credit === 'C').length;
    const totalDebit = transactions.filter(t => t.debit_credit === 'D').reduce((sum, t) => sum + t.amount, 0);
    const totalCredit = transactions.filter(t => t.debit_credit === 'C').reduce((sum, t) => sum + t.amount, 0);
    return { debitCount, creditCount, totalDebit, totalCredit };
  }, [transactions]);

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
      const parsedTransactions = await parseHFTIFile(hftiFile);
      
      // Transform to HFTI register format
      const hftiRecords = parsedTransactions.map(t => {
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
      await loadTransactions();

      toast({
        title: 'Upload Successful',
        description: `${result.saved} transactions saved successfully${result.skipped > 0 ? ` (${result.skipped} duplicates skipped)` : ''}`
      });

      // Reset file input
      setHftiFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/operations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-3xl font-bold text-foreground">HFTI Transaction Register</h2>
          <p className="text-muted-foreground mt-1">Saved BO transactions (working register)</p>
        </div>
        <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="h-4 w-4 mr-2" />
          Filters
          {hasActiveFilters && <Badge className="ml-2 bg-primary">Active</Badge>}
        </Button>
      </div>

      {/* Stats Cards with Date Range */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold">{transactions.length.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Total Transactions</p>
          </CardContent>
        </Card>
        <Card className="border-red-500/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{stats.debitCount.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Debit (D)</p>
            <p className="text-xs text-muted-foreground">₹{stats.totalDebit.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="border-green-500/20">
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats.creditCount.toLocaleString()}</div>
            <p className="text-sm text-muted-foreground">Credit (C)</p>
            <p className="text-xs text-muted-foreground">₹{stats.totalCredit.toLocaleString()}</p>
          </CardContent>
        </Card>
        <Card className="col-span-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Data Range</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <div>
                <p className="text-muted-foreground">From</p>
                <p className="font-medium">{formatDate(dateRange.fromDate)}</p>
              </div>
              <div className="text-muted-foreground">→</div>
              <div className="text-right">
                <p className="text-muted-foreground">To</p>
                <p className="font-medium">{formatDate(dateRange.toDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Section - Always visible as a button, expandable */}
      <Card className="border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-5 w-5 text-primary" />
              Upload HFTI Transactions
            </CardTitle>
            <Button 
              variant={showUpload ? "secondary" : "default"}
              size="sm"
              onClick={() => setShowUpload(!showUpload)}
            >
              {showUpload ? 'Hide Upload' : 'Upload New Data'}
            </Button>
          </div>
          {!showUpload && (
            <CardDescription>
              Click "Upload New Data" to add more transactions from HFTI Excel files
            </CardDescription>
          )}
        </CardHeader>
        
        {showUpload && (
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="hfti">HFTI Transaction File (Excel) *</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="hfti"
                  ref={fileInputRef}
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
                Both debit and credit transactions will be saved with their D/C flag. Duplicates are automatically skipped.
              </p>
            </div>

            <Button 
              onClick={handleUpload} 
              disabled={processing || !hftiFile}
              className="w-full"
            >
              <Upload className="w-4 h-4 mr-2" />
              {processing ? 'Processing...' : 'Upload & Save Transactions'}
            </Button>

            {/* Last Upload Result */}
            {lastUploadResult && (
              <div className="flex items-center gap-4 p-4 bg-green-500/10 rounded-lg border border-green-500/30">
                <div className="p-2 bg-green-500/20 rounded-full">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-bold text-green-700 dark:text-green-400">
                    {lastUploadResult.saved} transactions saved successfully
                  </h3>
                  {lastUploadResult.skipped > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {lastUploadResult.skipped} duplicate transactions were skipped
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Filters Panel */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              Filters
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" /> Clear
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => setFilters(f => ({ ...f, startDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => setFilters(f => ({ ...f, endDate: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={filters.debitCredit}
                  onValueChange={(value: 'D' | 'C' | 'all') => setFilters(f => ({ ...f, debitCredit: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="D">Debit (D)</SelectItem>
                    <SelectItem value="C">Credit (C)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Min Amount</Label>
                <Input
                  type="number"
                  placeholder="₹"
                  value={filters.minAmount}
                  onChange={(e) => setFilters(f => ({ ...f, minAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Amount</Label>
                <Input
                  type="number"
                  placeholder="₹"
                  value={filters.maxAmount}
                  onChange={(e) => setFilters(f => ({ ...f, maxAmount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Account</Label>
                <Input
                  placeholder="Search..."
                  value={filters.account}
                  onChange={(e) => setFilters(f => ({ ...f, account: e.target.value }))}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={applyFilters}>Apply Filters</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Loading transactions...</div>
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No transactions found</p>
              <p className="text-sm mt-2">Upload HFTI files using the button above</p>
              <Button 
                className="mt-4" 
                onClick={() => setShowUpload(true)}
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload HFTI File
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction Date</TableHead>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>Account Number</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-center">D/C</TableHead>
                    <TableHead>BO Reference</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.slice(0, 100).map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>{txn.txn_date}</TableCell>
                      <TableCell className="font-mono text-sm">{txn.txn_id}</TableCell>
                      <TableCell className="font-mono">{txn.account}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{txn.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={txn.debit_credit === 'D' ? 'destructive' : 'default'}>
                          {txn.debit_credit}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate" title={txn.bo_reference}>
                        {txn.bo_reference || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {transactions.length > 100 && (
                <div className="p-4 text-center text-sm text-muted-foreground border-t">
                  Showing 100 of {transactions.length.toLocaleString()} transactions
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};