import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  getAllLastBalanceRecords, 
  getLastBalanceCount,
  clearLastBalanceRecords,
  LastBalanceRecord 
} from '@/lib/db';
import { Database, Search, Download, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const ITEMS_PER_PAGE = 20;

export const BalanceRecordsViewer = () => {
  const [records, setRecords] = useState<LastBalanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const { toast } = useToast();

  useEffect(() => {
    loadRecords();
  }, []);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = await getAllLastBalanceRecords();
      setRecords(data);
    } catch (error) {
      console.error('Failed to load records:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter records based on search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    
    const query = searchQuery.toLowerCase();
    return records.filter(record => 
      record.account.toLowerCase().includes(query) ||
      record.name.toLowerCase().includes(query) ||
      record.address.toLowerCase().includes(query) ||
      record.bo_name.toLowerCase().includes(query)
    );
  }, [records, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / ITEMS_PER_PAGE);
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredRecords.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleExport = () => {
    if (records.length === 0) {
      toast({
        title: 'No data to export',
        variant: 'destructive'
      });
      return;
    }

    const headers = ['Account', 'Name', 'Address', 'Balance', 'Balance Date', 'BO Name', 'Uploaded At'];
    const csvContent = [
      headers.join(','),
      ...records.map(r => [
        `"${r.account}"`,
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.address.replace(/"/g, '""')}"`,
        r.balance,
        `"${r.balance_date}"`,
        `"${r.bo_name.replace(/"/g, '""')}"`,
        `"${r.uploaded_at}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `balance-records-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: 'Export complete',
      description: `Exported ${records.length} records to CSV`
    });
  };

  const handleClear = async () => {
    if (!confirm('Are you sure you want to clear all saved balance records? You will need to upload again.')) {
      return;
    }

    try {
      await clearLastBalanceRecords();
      setRecords([]);
      toast({
        title: 'Cleared',
        description: 'All balance records have been removed'
      });
    } catch (error: any) {
      toast({
        title: 'Failed to clear',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Saved Balance Records
        </CardTitle>
        <CardDescription>
          View and search through {records.length.toLocaleString()} saved last balance records
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by account, name, address, or BO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExport} disabled={records.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button variant="destructive" size="sm" onClick={handleClear} disabled={records.length === 0}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </div>

        {/* Results info */}
        {searchQuery && (
          <p className="text-sm text-muted-foreground">
            Showing {filteredRecords.length} of {records.length} records
          </p>
        )}

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : records.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No saved balance records. Upload Last Balance files to save data.
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No records match your search.
          </div>
        ) : (
          <>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Account</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Address</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="hidden lg:table-cell">BO</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="font-mono text-xs">{record.account}</TableCell>
                      <TableCell className="max-w-[200px] truncate" title={record.name}>
                        {record.name}
                      </TableCell>
                      <TableCell className="hidden md:table-cell max-w-[200px] truncate" title={record.address}>
                        {record.address}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ₹{record.balance.toLocaleString()}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                        {record.balance_date}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[150px]" title={record.bo_name}>
                        {record.bo_name}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
