import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db, MemoRecord, saveDespatchRecord, getAllDespatchRecords, getDaysSinceLastDespatch, DespatchRecord, deleteDespatchRecord, bulkUpdateMemosById } from '@/lib/db';
import { Send, Bell, Calendar, Clock, Settings, CalendarCheck, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DespatchManager } from './DespatchManager';
import { ManualSentDateUpdater } from './ManualSentDateUpdater';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

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
  const [despatchHistory, setDespatchHistory] = useState<DespatchRecord[]>([]);
  const [daysSinceLastDespatch, setDaysSinceLastDespatch] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingMemos();
    fetchDespatchHistory();
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
    const allMemos = await db.memos.toArray();
    const printedMemos = allMemos.filter(m => m.printed === true && !m.remarks?.includes('Post No:'));
    setPendingMemos(printedMemos);
    
    // Auto-fill from/to if there are pending memos
    if (printedMemos.length > 0) {
      const serials = printedMemos.map(m => m.serial).sort((a, b) => a - b);
      setFromMemo(serials[0].toString());
      setToMemo(serials[serials.length - 1].toString());
    }
  };

  const fetchDespatchHistory = async () => {
    const records = await getAllDespatchRecords();
    setDespatchHistory(records);
    const days = await getDaysSinceLastDespatch();
    setDaysSinceLastDespatch(days);
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

    if (isSaving) return;
    setIsSaving(true);

    try {
      const allMemos = await db.memos.toArray();
      const memosInRange = allMemos.filter(m => 
        m.serial >= fromSerial && 
        m.serial <= toSerial && 
        !m.remarks?.includes('Post No:')
      );

      if (memosInRange.length === 0) {
        const allInRange = allMemos.filter(m => m.serial >= fromSerial && m.serial <= toSerial);
        if (allInRange.length > 0) {
          toast({ title: 'All memos in this range already have despatch details', variant: 'destructive' });
        } else {
          toast({ title: 'No memos found in this range', variant: 'destructive' });
        }
        setIsSaving(false);
        return;
      }

      // Build batch updates
      const despatchInfo = `Post No: ${postNumber}, Despatch: ${despatchDate}`;
      const updates = memosInRange.map(memo => ({
        id: memo.id!,
        changes: {
          memo_sent_date: despatchDate,
          remarks: memo.remarks ? `${memo.remarks}; ${despatchInfo}` : despatchInfo
        } as Partial<MemoRecord>
      }));

      await bulkUpdateMemosById(updates);

      // Save despatch record
      await saveDespatchRecord({
        from_memo: fromSerial,
        to_memo: toSerial,
        post_number: postNumber,
        despatch_date: despatchDate,
        memo_count: memosInRange.length
      });

      toast({ 
        title: 'Despatch details saved', 
        description: `Updated ${memosInRange.length} memos (${fromSerial} to ${toSerial})` 
      });

      setFromMemo('');
      setToMemo('');
      setPostNumber('');
      setDespatchDate(new Date().toISOString().split('T')[0]);
      setOpen(false);
      
      await fetchPendingMemos();
      await fetchDespatchHistory();
      onDespatchSaved?.();
    } catch (error: any) {
      toast({ title: 'Failed to save despatch details', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); if (isOpen) { fetchPendingMemos(); fetchDespatchHistory(); } }}>
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
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Enter Despatch Details
          </DialogTitle>
          <DialogDescription>
          Record postal despatch details for printed memos
        </DialogDescription>
      </DialogHeader>

      {/* Days since last despatch */}
      {daysSinceLastDespatch !== null && (
        <div className="flex items-center gap-2 p-3 bg-muted/50 border rounded-lg">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm">
            <span className="font-medium">{daysSinceLastDespatch}</span> day(s) since last despatch
            {despatchHistory.length > 0 && (
              <span className="text-muted-foreground ml-1">
                (Last: {formatDate(despatchHistory[0].despatch_date)})
              </span>
            )}
          </span>
        </div>
      )}

      <Tabs defaultValue="new" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Send className="w-4 h-4" />
            New Despatch
            {pendingMemos.length > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {pendingMemos.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4" />
            Mark as Sent
          </TabsTrigger>
          <TabsTrigger value="manage" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Manage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="new" className="space-y-4 mt-4">
          {pendingMemos.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                <Bell className="w-4 h-4 text-warning animate-bounce" />
                <span className="text-sm font-medium text-warning">
                  {pendingMemos.length} printed memo(s) awaiting despatch details
                </span>
              </div>
              
              <ScrollArea className="h-32 border rounded-lg">
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

          <div className="space-y-4">
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

          {/* Despatch History */}
          {despatchHistory.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Recent Despatch History
              </h4>
              <ScrollArea className="h-32 border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>From-To</TableHead>
                      <TableHead>Post No.</TableHead>
                      <TableHead>Despatch Date</TableHead>
                      <TableHead className="text-right">Memos</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {despatchHistory.slice(0, 10).map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.from_memo} - {record.to_memo}</TableCell>
                        <TableCell>{record.post_number}</TableCell>
                        <TableCell>{formatDate(record.despatch_date)}</TableCell>
                        <TableCell className="text-right">{record.memo_count}</TableCell>
                        <TableCell>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete despatch record?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will delete the despatch record (Post No: {record.post_number}, Memos: {record.from_memo}-{record.to_memo}). 
                                  Note: This only removes the record from history, it does NOT affect the memo data.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={async () => {
                                    await deleteDespatchRecord(record.id!);
                                    toast({ title: 'Despatch record deleted' });
                                    await fetchDespatchHistory();
                                    onDespatchSaved?.();
                                  }}
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={pendingMemos.length === 0 && !fromMemo}>
              <Send className="w-4 h-4 mr-2" />
              Save Details
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="manual" className="mt-4">
          <ManualSentDateUpdater onUpdate={() => {
            fetchPendingMemos();
            fetchDespatchHistory();
            onDespatchSaved?.();
          }} />
        </TabsContent>

        <TabsContent value="manage" className="mt-4">
          <DespatchManager onUpdate={() => {
            fetchPendingMemos();
            fetchDespatchHistory();
            onDespatchSaved?.();
          }} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
);
};