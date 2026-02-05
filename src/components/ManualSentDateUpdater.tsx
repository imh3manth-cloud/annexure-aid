import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db, MemoRecord } from '@/lib/db';
import { CalendarCheck, Check, AlertCircle, Filter, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ManualSentDateUpdaterProps {
  onUpdate?: () => void;
}

export const ManualSentDateUpdater = ({ onUpdate }: ManualSentDateUpdaterProps) => {
  const [printedMemos, setPrintedMemos] = useState<MemoRecord[]>([]);
  const [allPrintedMemos, setAllPrintedMemos] = useState<MemoRecord[]>([]);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [sentDate, setSentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [fromMemo, setFromMemo] = useState('');
  const [toMemo, setToMemo] = useState('');
  const [rangeMode, setRangeMode] = useState<'select' | 'range'>('range');
  const { toast } = useToast();

  useEffect(() => {
    fetchPrintedMemos();
  }, []);

  const fetchPrintedMemos = async () => {
    const allMemos = await db.memos.toArray();
    // Get printed memos that don't have a memo_sent_date yet OR status is still New
    const printed = allMemos.filter(m => 
      m.printed === true && 
      (!m.memo_sent_date || m.status === 'New')
    );
    setPrintedMemos(printed.sort((a, b) => a.serial - b.serial));
    
    // Also keep ALL printed memos for range selection (regardless of status)
    const allPrinted = allMemos.filter(m => m.printed === true);
    setAllPrintedMemos(allPrinted.sort((a, b) => a.serial - b.serial));
  };

  const toggleSelect = (id: string | number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === printedMemos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(printedMemos.map(m => m.id!)));
    }
  };

  const handleUpdateSentDate = async () => {
    if (selected.size === 0) {
      toast({ title: 'Please select memos to update', variant: 'destructive' });
      return;
    }

    if (!sentDate) {
      toast({ title: 'Please enter a sent date', variant: 'destructive' });
      return;
    }

    setIsUpdating(true);
    try {
      let successCount = 0;
      
      for (const id of Array.from(selected)) {
        const memo = printedMemos.find(m => m.id === id);
        if (!memo) continue;

        // Build remarks with sent info
        const sentInfo = `Sent: ${sentDate}`;
        const newRemarks = memo.remarks 
          ? `${memo.remarks}; ${sentInfo}`
          : sentInfo;

        await db.memos.update(id, {
          memo_sent_date: sentDate,
          status: 'Pending',
          remarks: newRemarks
        });
        successCount++;
      }

      toast({ 
        title: 'Memos updated successfully', 
        description: `Updated ${successCount} memo(s) to Pending status with sent date ${sentDate}` 
      });
      
      setSelected(new Set());
      await fetchPrintedMemos();
      onUpdate?.();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRangeUpdate = async () => {
    if (!fromMemo || !toMemo) {
      toast({ title: 'Please enter both From and To memo numbers', variant: 'destructive' });
      return;
    }

    if (!sentDate) {
      toast({ title: 'Please enter a sent date', variant: 'destructive' });
      return;
    }

    const fromSerial = parseInt(fromMemo);
    const toSerial = parseInt(toMemo);

    if (isNaN(fromSerial) || isNaN(toSerial)) {
      toast({ title: 'Invalid memo numbers', variant: 'destructive' });
      return;
    }

    if (fromSerial > toSerial) {
      toast({ title: 'From memo should be less than or equal to To memo', variant: 'destructive' });
      return;
    }

    setIsUpdating(true);
    try {
      // Get ALL memos in the range (regardless of printed or current status)
      const allMemos = await db.memos.toArray();
      const memosInRange = allMemos.filter(m => 
        m.serial >= fromSerial && 
        m.serial <= toSerial
      );

      if (memosInRange.length === 0) {
        toast({ title: 'No memos found in this range', variant: 'destructive' });
        setIsUpdating(false);
        return;
      }

      let successCount = 0;
      for (const memo of memosInRange) {
        const sentInfo = `Sent: ${sentDate}`;
        // Only add sent info if not already there
        const existingRemarks = memo.remarks || '';
        const alreadyHasSent = existingRemarks.includes('Sent:');
        const newRemarks = alreadyHasSent 
          ? existingRemarks 
          : (existingRemarks ? `${existingRemarks}; ${sentInfo}` : sentInfo);

        await db.memos.update(memo.id!, {
          memo_sent_date: sentDate,
          status: 'Pending',
          printed: true, // Also mark as printed
          remarks: newRemarks
        });
        successCount++;
      }

      toast({ 
        title: 'Memos updated successfully', 
        description: `Updated ${successCount} memo(s) from serial ${fromSerial} to ${toSerial} to Pending status` 
      });
      
      setFromMemo('');
      setToMemo('');
      await fetchPrintedMemos();
      onUpdate?.();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClearSentStatus = async (memoId: string | number) => {
    try {
      const memo = printedMemos.find(m => m.id === memoId) || allPrintedMemos.find(m => m.id === memoId);
      if (!memo) return;

      // Remove sent info from remarks
      let cleanedRemarks = memo.remarks || '';
      cleanedRemarks = cleanedRemarks
        .replace(/;?\s*Sent:\s*\d{4}-\d{2}-\d{2}/g, '')
        .replace(/^;\s*/, '')
        .trim();

      await db.memos.update(memoId, {
        memo_sent_date: null,
        status: 'New',
        remarks: cleanedRemarks
      });

      toast({ title: 'Sent status cleared', description: `Memo ${memo.serial} reset to New status` });
      await fetchPrintedMemos();
      onUpdate?.();
    } catch (error: any) {
      toast({ title: 'Failed to clear status', description: error.message, variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Use this to manually mark memos as "sent" with a specific date. 
          This will set them to "Pending" status so you can generate reminders.
        </AlertDescription>
      </Alert>

      <Tabs value={rangeMode} onValueChange={(v) => setRangeMode(v as 'select' | 'range')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="range" className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            By Range (Recommended)
          </TabsTrigger>
          <TabsTrigger value="select" className="flex items-center gap-2">
            <Check className="w-4 h-4" />
            Select Individual
            {printedMemos.length > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                {printedMemos.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="range" className="space-y-4 mt-4">
          <Alert>
            <Filter className="h-4 w-4" />
            <AlertDescription>
              Enter a range of memo serial numbers to update. This will mark ALL memos 
              in the range as "Sent" and change their status to "Pending" (regardless of current status).
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromMemoRange">From Memo No.</Label>
              <Input
                id="fromMemoRange"
                type="number"
                placeholder="e.g., 1"
                value={fromMemo}
                onChange={(e) => setFromMemo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toMemoRange">To Memo No.</Label>
              <Input
                id="toMemoRange"
                type="number"
                placeholder="e.g., 50"
                value={toMemo}
                onChange={(e) => setToMemo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sentDateRange">Sent Date (Memo Sent Date)</Label>
            <Input
              id="sentDateRange"
              type="date"
              value={sentDate}
              onChange={(e) => setSentDate(e.target.value)}
            />
          </div>

          <div className="flex justify-end">
            <Button 
              onClick={handleRangeUpdate} 
              disabled={!fromMemo || !toMemo || isUpdating}
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              {isUpdating ? 'Updating...' : 'Update Range as Sent'}
            </Button>
          </div>

          {allPrintedMemos.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {allPrintedMemos.length} total printed memo(s) available • 
              Serial range: {allPrintedMemos[0]?.serial} to {allPrintedMemos[allPrintedMemos.length - 1]?.serial}
            </p>
          )}
        </TabsContent>

        <TabsContent value="select" className="space-y-4 mt-4">
          {printedMemos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No printed memos awaiting sent date</p>
              <p className="text-sm mt-1">All printed memos have already been marked as sent or use "By Range" to update any memo</p>
            </div>
          ) : (
            <>
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="sentDate">Sent Date (Memo Sent Date)</Label>
                  <Input
                    id="sentDate"
                    type="date"
                    value={sentDate}
                    onChange={(e) => setSentDate(e.target.value)}
                  />
                </div>
                
                <Button 
                  onClick={handleUpdateSentDate} 
                  disabled={selected.size === 0 || isUpdating}
                  className="gap-2"
                >
                  <Check className="w-4 h-4" />
                  {isUpdating ? 'Updating...' : `Update ${selected.size > 0 ? `(${selected.size})` : ''} as Sent`}
                </Button>
              </div>

              <ScrollArea className="h-64 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selected.size === printedMemos.length && printedMemos.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead className="w-20">Serial</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printedMemos.map((memo) => (
                      <TableRow key={memo.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(memo.id!)}
                            onCheckedChange={() => toggleSelect(memo.id!)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{memo.serial}</TableCell>
                        <TableCell>{memo.account}</TableCell>
                        <TableCell className="max-w-32 truncate">{memo.name}</TableCell>
                        <TableCell>₹{memo.amount.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={memo.status === 'Pending' ? 'default' : 'secondary'}>
                            {memo.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {memo.memo_sent_date && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleClearSentStatus(memo.id!)}
                              title="Clear sent status"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <p className="text-xs text-muted-foreground">
                {printedMemos.length} printed memo(s) awaiting sent date • 
                {selected.size > 0 && ` ${selected.size} selected`}
              </p>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
