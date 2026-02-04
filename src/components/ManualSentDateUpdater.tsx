import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db, MemoRecord } from '@/lib/db';
import { CalendarCheck, Check, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ManualSentDateUpdaterProps {
  onUpdate?: () => void;
}

export const ManualSentDateUpdater = ({ onUpdate }: ManualSentDateUpdaterProps) => {
  const [printedMemos, setPrintedMemos] = useState<MemoRecord[]>([]);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [sentDate, setSentDate] = useState(new Date().toISOString().split('T')[0]);
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPrintedMemos();
  }, []);

  const fetchPrintedMemos = async () => {
    const allMemos = await db.memos.toArray();
    // Get printed memos that don't have a memo_sent_date yet (not pending)
    const printed = allMemos.filter(m => 
      m.printed === true && 
      !m.memo_sent_date &&
      m.status === 'New'
    );
    setPrintedMemos(printed.sort((a, b) => a.serial - b.serial));
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (printedMemos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <CalendarCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No printed memos awaiting sent date</p>
        <p className="text-sm mt-1">All printed memos have already been marked as sent</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Use this to manually mark printed memos as "sent" with a specific date. 
          This will set them to "Pending" status so you can generate reminders.
        </AlertDescription>
      </Alert>

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
          Update {selected.size > 0 ? `(${selected.size})` : ''} as Sent
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
              <TableHead>Txn Date</TableHead>
              <TableHead>Status</TableHead>
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
                <TableCell>{formatDate(memo.txn_date)}</TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {memo.status}
                  </Badge>
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
    </div>
  );
};
