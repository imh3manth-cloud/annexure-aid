import { useEffect, useState, useMemo } from 'react';
import { db, MemoRecord } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { generateConsolidatedPDF } from '@/lib/pdfGenerator';
import { Printer, FileSpreadsheet, Download, CalendarIcon, X, Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Settings2 } from 'lucide-react';
import { PdfFormatDialog } from '@/components/PdfFormatDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { MemoPreviewModal } from '@/components/MemoPreviewModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';

export const MemoRegister = () => {
  const [memos, setMemos] = useState<MemoRecord[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<'all' | 'New' | 'Pending' | 'Verified' | 'Reported'>('all');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState<string>('serial');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortableHeader = ({ column, children, className }: { column: string; children: React.ReactNode; className?: string }) => (
    <TableHead 
      className={cn("font-semibold cursor-pointer hover:bg-muted/70 select-none", className)}
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortColumn === column ? (
          sortDirection === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </div>
    </TableHead>
  );

  useEffect(() => {
    loadMemos();
  }, []);

  const loadMemos = async () => {
    const allMemos = await db.memos.orderBy('serial').reverse().toArray();
    setMemos(allMemos);
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredMemos.length && filteredMemos.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredMemos.map(m => m.id!)));
    }
  };

  const handlePreview = () => {
    const selectedMemos = memos.filter(m => selected.has(m.id!));
    if (selectedMemos.length === 0) {
      toast({ title: 'No memos selected', variant: 'destructive' });
      return;
    }
    setPreviewOpen(true);
  };

  const handleGeneratePDF = async () => {
    const selectedMemos = memos.filter(m => selected.has(m.id!));

    try {
      const pdf = generateConsolidatedPDF(selectedMemos);
      pdf.save(`memos_${new Date().toISOString().split('T')[0]}.pdf`);

      // Update status to Pending and mark as printed
      const today = new Date().toISOString().split('T')[0];
      for (const memo of selectedMemos) {
        await db.memos.update(memo.id!, {
          status: 'Pending',
          printed: true,
          memo_sent_date: today
        });
      }

      toast({ title: 'PDF generated successfully' });
      setPreviewOpen(false);
      setSelected(new Set());
      loadMemos();
    } catch (error: any) {
      toast({ title: 'Failed to generate PDF', description: error.message, variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      New: 'bg-primary text-primary-foreground',
      Pending: 'bg-warning text-warning-foreground',
      Verified: 'bg-success text-success-foreground',
      Reported: 'bg-destructive text-destructive-foreground'
    };
    
    return (
      <Badge className={colors[status]}>
        {status}
      </Badge>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return dateStr;
  };

  const getVerificationResult = (memo: MemoRecord) => {
    if (memo.status === 'Verified') return 'Verified';
    if (memo.status === 'Reported') return 'Reported to SP';
    return '-';
  };

  const filteredMemos = useMemo(() => {
    let result = filter === 'all' ? memos : memos.filter(m => m.status === filter);
    
    // Date range filter
    if (dateFrom || dateTo) {
      result = result.filter(memo => {
        if (!memo.txn_date) return false;
        const memoDate = parseISO(memo.txn_date);
        if (dateFrom && dateTo) {
          return isWithinInterval(memoDate, { start: dateFrom, end: dateTo });
        }
        if (dateFrom) return memoDate >= dateFrom;
        if (dateTo) return memoDate <= dateTo;
        return true;
      });
    }
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(memo => 
        memo.account.toLowerCase().includes(query) ||
        memo.name.toLowerCase().includes(query)
      );
    }

    // Sorting
    result = [...result].sort((a, b) => {
      let aVal: any, bVal: any;
      
      switch (sortColumn) {
        case 'serial':
          aVal = a.serial;
          bVal = b.serial;
          break;
        case 'txn_date':
          aVal = a.txn_date || '';
          bVal = b.txn_date || '';
          break;
        case 'account':
          aVal = a.account;
          bVal = b.account;
          break;
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'office':
          aVal = (a.BO_Name || a.BO_Code || '').toLowerCase();
          bVal = (b.BO_Name || b.BO_Code || '').toLowerCase();
          break;
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        case 'memo_sent_date':
          aVal = a.memo_sent_date || '';
          bVal = b.memo_sent_date || '';
          break;
        case 'reply_date':
          aVal = a.verified_date || a.reported_date || '';
          bVal = b.verified_date || b.reported_date || '';
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'reminders':
          aVal = a.reminder_count;
          bVal = b.reminder_count;
          break;
        default:
          return 0;
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return result;
  }, [memos, filter, dateFrom, dateTo, searchQuery, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredMemos.length / pageSize);
  const paginatedMemos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMemos.slice(start, start + pageSize);
  }, [filteredMemos, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filter, dateFrom, dateTo, searchQuery]);

  const selectedMemos = memos.filter(m => selected.has(m.id!));

  const clearDateFilter = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  // Calculate summary stats
  const stats = {
    total: memos.length,
    new: memos.filter(m => m.status === 'New').length,
    pending: memos.filter(m => m.status === 'Pending').length,
    verified: memos.filter(m => m.status === 'Verified').length,
    reported: memos.filter(m => m.status === 'Reported').length
  };

  const handleExportExcel = () => {
    const exportData = filteredMemos.map(memo => ({
      'Memo No.': memo.serial,
      'Date of Issue': memo.txn_date || '',
      'Account No.': memo.account,
      'Name of Depositor': memo.name,
      'Address': memo.address || '',
      'Office/Branch': memo.BO_Name || memo.BO_Code || '',
      'Amount (₹)': memo.amount,
      'Date of Despatch': memo.memo_sent_date || '',
      'Date of Reply': memo.verified_date || memo.reported_date || '',
      'Result': getVerificationResult(memo),
      'Reminders': memo.reminder_count,
      'Last Reminder Date': memo.last_reminder_date || '',
      'Remarks': memo.remarks || '',
      'Status': memo.status
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Memo Register');
    
    // Set column widths
    ws['!cols'] = [
      { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 25 }, { wch: 30 },
      { wch: 15 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 15 },
      { wch: 10 }, { wch: 14 }, { wch: 25 }, { wch: 10 }
    ];

    XLSX.writeFile(wb, `memo_register_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Excel exported successfully' });
  };

  return (
    <div className="space-y-6">
      <MemoPreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        memos={selectedMemos}
        onConfirm={handleGeneratePDF}
      />
      
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Register of Verification Memos</h2>
          <p className="text-muted-foreground mt-1">As per POSB CBS Manual format</p>
        </div>
        
        <div className="flex gap-2">
          <PdfFormatDialog />
          <Button onClick={handleExportExcel} size="sm" variant="outline">
            <Download className="w-4 h-4 mr-2" />
            Export Excel
          </Button>
          {selected.size > 0 && (
            <Button onClick={handlePreview} size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Preview & Print ({selected.size})
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="bg-card/50">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-foreground">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total Memos</div>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-primary">{stats.new}</div>
            <div className="text-xs text-muted-foreground">New</div>
          </CardContent>
        </Card>
        <Card className="bg-warning/10 border-warning/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
            <div className="text-xs text-muted-foreground">Pending</div>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-success">{stats.verified}</div>
            <div className="text-xs text-muted-foreground">Verified</div>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-destructive">{stats.reported}</div>
            <div className="text-xs text-muted-foreground">Reported</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5" />
                Verification Memo Register
              </CardTitle>
              <CardDescription>
                Showing {paginatedMemos.length > 0 ? ((currentPage - 1) * pageSize + 1) : 0}-{Math.min(currentPage * pageSize, filteredMemos.length)} of {filteredMemos.length} records
              </CardDescription>
            </div>
            <div className="flex gap-3 flex-wrap items-center">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search account/name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-[180px] h-8"
                />
              </div>

              {/* Date Range Filter */}
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateFrom ? format(dateFrom, "dd/MM/yyyy") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">to</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-[130px] justify-start text-left font-normal", !dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateTo ? format(dateTo, "dd/MM/yyyy") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="pointer-events-auto" />
                  </PopoverContent>
                </Popover>
                {(dateFrom || dateTo) && (
                  <Button variant="ghost" size="sm" onClick={clearDateFilter} className="h-8 w-8 p-0">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Status Filter */}
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'New', 'Pending', 'Verified', 'Reported'] as const).map((status) => (
                  <Button
                    key={status}
                    size="sm"
                    variant={filter === status ? 'default' : 'outline'}
                    onClick={() => setFilter(status)}
                    className="text-xs"
                  >
                    {status === 'all' ? 'All' : status}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10 text-center">
                    <Checkbox
                      checked={selected.size === filteredMemos.length && filteredMemos.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <SortableHeader column="serial" className="text-center w-16">Memo No.</SortableHeader>
                  <SortableHeader column="txn_date">Date of Issue</SortableHeader>
                  <SortableHeader column="account">Account No.</SortableHeader>
                  <SortableHeader column="name">Name of Depositor</SortableHeader>
                  <SortableHeader column="office">Office/Branch</SortableHeader>
                  <SortableHeader column="amount" className="text-right">Amount (₹)</SortableHeader>
                  <SortableHeader column="memo_sent_date">Date of Despatch</SortableHeader>
                  <SortableHeader column="reply_date">Date of Reply</SortableHeader>
                  <SortableHeader column="status">Result</SortableHeader>
                  <SortableHeader column="reminders">Reminders</SortableHeader>
                  <TableHead className="font-semibold max-w-[150px]">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMemos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                      No memos found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedMemos.map((memo) => (
                    <TableRow key={memo.id} className="hover:bg-muted/30">
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selected.has(memo.id!)}
                          onCheckedChange={() => toggleSelect(memo.id!)}
                        />
                      </TableCell>
                      <TableCell className="text-center font-mono font-medium">
                        {memo.serial}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {memo.txn_date}
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {memo.account}
                      </TableCell>
                      <TableCell className="text-sm max-w-[180px] truncate" title={memo.name}>
                        {memo.name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {memo.BO_Name || memo.BO_Code}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">
                        {memo.amount.toLocaleString('en-IN')}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(memo.memo_sent_date)}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(memo.verified_date || memo.reported_date)}
                      </TableCell>
                      <TableCell>
                        {memo.status === 'New' || memo.status === 'Pending' ? (
                          getStatusBadge(memo.status)
                        ) : (
                          <span className={`text-sm font-medium ${
                            memo.status === 'Verified' ? 'text-success' : 'text-destructive'
                          }`}>
                            {getVerificationResult(memo)}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {memo.reminder_count > 0 ? (
                          <Badge variant="outline" className="font-mono">
                            {memo.reminder_count}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate text-muted-foreground" title={memo.remarks}>
                        {memo.remarks || '-'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination Controls */}
          {filteredMemos.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Rows per page:</span>
                <Select value={pageSize.toString()} onValueChange={(v) => { setPageSize(Number(v)); setCurrentPage(1); }}>
                  <SelectTrigger className="h-8 w-[70px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="h-8 w-8 p-0"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
