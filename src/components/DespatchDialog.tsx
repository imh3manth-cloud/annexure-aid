import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db, MemoRecord } from '@/lib/db';
import { Send, AlertCircle, Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DespatchDialogProps {
  onDespatchSaved?: () => void;
}

export const DespatchDialog = ({ onDespatchSaved }: DespatchDialogProps) => {
  const [open, setOpen] = useState(false);
  const [fromMemo, setFromMemo] = useState('');
  const [toMemo, setToMemo] = useState('');
  const [postNumber, setPostNumber] = useState('');
  const [despatchDate, setDespatchDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingMemos, setPendingMemos] = useState<MemoRecord[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingMemos();
  }, []);

  useEffect(() => {
    // Show notification toast if there are pending memos
    if (pendingMemos.length > 0 && !open) {
      toast({
        title: `${pendingMemos.length} printed memo(s) awaiting despatch`,
        description: 'Click "Despatch Details" to enter post number and date',
        duration: 5000,
      });
    }
  }, [pendingMemos.length]);

  const fetchPendingMemos = async () => {
    // Get printed memos without despatch details (printed=true, no post_number in remarks)
    const printedMemos = await db.memos
      .filter(m => m.printed === true && !m.remarks?.includes('Post No:'))
      .toArray();
    setPendingMemos(printedMemos);
    
    // Auto-fill from/to if there are pending memos
    if (printedMemos.length > 0) {
      const serials = printedMemos.map(m => m.serial).sort((a, b) => a - b);
      setFromMemo(serials[0].toString());
      setToMemo(serials[serials.length - 1].toString());
    }
  };

  const handleSave = async () => {
    if (!fromMemo || !toMemo || !postNumber || !despatchDate) {
      toast({ title: 'Please fill all fields', variant: 'destructive' });
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

    try {
      // Find memos in the range
      const memosInRange = await db.memos
        .where('serial')
        .between(fromSerial, toSerial, true, true)
        .toArray();

      if (memosInRange.length === 0) {
        toast({ title: 'No memos found in this range', variant: 'destructive' });
        return;
      }

      // Update each memo with despatch details
      for (const memo of memosInRange) {
        const despatchInfo = `Post No: ${postNumber}, Despatch: ${despatchDate}`;
        const newRemarks = memo.remarks 
          ? `${memo.remarks}; ${despatchInfo}`
          : despatchInfo;

        await db.memos.update(memo.id!, {
          memo_sent_date: despatchDate,
          remarks: newRemarks
        });
      }

      toast({ 
        title: 'Despatch details saved', 
        description: `Updated ${memosInRange.length} memos (${fromSerial} to ${toSerial})` 
      });

      // Reset form
      setFromMemo('');
      setToMemo('');
      setPostNumber('');
      setDespatchDate(new Date().toISOString().split('T')[0]);
      setOpen(false);
      
      // Refresh pending memos
      await fetchPendingMemos();
      
      // Callback
      onDespatchSaved?.();
    } catch (error: any) {
      toast({ title: 'Failed to save despatch details', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (isOpen) fetchPendingMemos(); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <Send className="w-4 h-4 mr-2" />
          Despatch Details
          {pendingMemos.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse"
            >
              {pendingMemos.length > 99 ? '99+' : pendingMemos.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Enter Despatch Details
          </DialogTitle>
          <DialogDescription>
            Record postal despatch details for printed memos
          </DialogDescription>
        </DialogHeader>

        {pendingMemos.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
              <Bell className="w-4 h-4 text-warning animate-bounce" />
              <span className="text-sm font-medium text-warning">
                {pendingMemos.length} printed memo(s) awaiting despatch details
              </span>
            </div>
            
            <ScrollArea className="h-40 border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">Serial</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Printed Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingMemos.map((memo) => (
                    <TableRow key={memo.id}>
                      <TableCell className="font-medium">{memo.serial}</TableCell>
                      <TableCell>{memo.account}</TableCell>
                      <TableCell>{memo.name}</TableCell>
                      <TableCell>{memo.memo_sent_date || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="fromMemo">From Memo No.</Label>
              <Input
                id="fromMemo"
                type="number"
                placeholder="e.g., 1"
                value={fromMemo}
                onChange={(e) => setFromMemo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="toMemo">To Memo No.</Label>
              <Input
                id="toMemo"
                type="number"
                placeholder="e.g., 10"
                value={toMemo}
                onChange={(e) => setToMemo(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="postNumber">Post Number / Article No.</Label>
            <Input
              id="postNumber"
              placeholder="e.g., RG123456789IN"
              value={postNumber}
              onChange={(e) => setPostNumber(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="despatchDate">Date of Despatch</Label>
            <Input
              id="despatchDate"
              type="date"
              value={despatchDate}
              onChange={(e) => setDespatchDate(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pendingMemos.length === 0 && !fromMemo}>
            <Send className="w-4 h-4 mr-2" />
            Save Details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};