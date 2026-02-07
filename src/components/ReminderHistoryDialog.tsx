import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { History, X, Pencil, Check, RotateCcw } from 'lucide-react';
import {
  ReminderHistoryRecord,
  MemoRecord,
  getReminderHistory,
  updateReminderDate,
  cancelReminder,
  recalculateMemoReminders,
  addReminderHistoryEntry
} from '@/lib/db';
import { generateReminderPDF } from '@/lib/pdfGenerator';

interface Props {
  memo: MemoRecord;
  onUpdated: () => void;
}

export const ReminderHistoryDialog = ({ memo, onUpdated }: Props) => {
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<ReminderHistoryRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && memo.id) {
      loadHistory();
    }
  }, [open, memo.id]);

  const loadHistory = async () => {
    try {
      const data = await getReminderHistory(memo.id as string);
      setHistory(data);
    } catch (err: any) {
      toast({ title: 'Failed to load history', description: err.message, variant: 'destructive' });
    }
  };

  const handleEditDate = (record: ReminderHistoryRecord) => {
    setEditingId(record.id!);
    setEditDate(record.reminder_date);
  };

  const handleSaveDate = async (record: ReminderHistoryRecord) => {
    setLoading(true);
    try {
      await updateReminderDate(record.id!, editDate);
      await recalculateMemoReminders(memo.id as string);
      setEditingId(null);
      await loadHistory();
      onUpdated();
      toast({ title: 'Reminder date updated' });
    } catch (err: any) {
      toast({ title: 'Update failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (record: ReminderHistoryRecord) => {
    setLoading(true);
    try {
      await cancelReminder(record.id!);
      await recalculateMemoReminders(memo.id as string);
      await loadHistory();
      onUpdated();
      toast({ title: `Reminder ${record.reminder_number} cancelled` });
    } catch (err: any) {
      toast({ title: 'Cancel failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async () => {
    const activeReminders = history.filter(r => r.status === 'Active');
    if (activeReminders.length === 0) {
      toast({ title: 'No active reminders to generate PDF for', variant: 'destructive' });
      return;
    }
    try {
      const pdf = generateReminderPDF([memo]);
      pdf.save(`reminder_memo_${memo.serial}_regenerated.pdf`);
      toast({ title: 'Reminder PDF regenerated' });
    } catch (err: any) {
      toast({ title: 'PDF generation failed', description: err.message, variant: 'destructive' });
    }
  };

  const activeCount = history.filter(r => r.status === 'Active').length;
  const cancelledCount = history.filter(r => r.status === 'Cancelled').length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <History className="w-3 h-3 mr-1" />
          {memo.reminder_count || 0}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Reminder History — Memo #{memo.serial}
            <Badge variant="outline">{memo.account}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 text-sm text-muted-foreground mb-2">
          <span>Active: {activeCount}</span>
          <span>•</span>
          <span>Cancelled: {cancelledCount}</span>
        </div>

        {history.length === 0 ? (
          <p className="text-center text-muted-foreground py-6">No reminders sent yet for this memo.</p>
        ) : (
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reminder #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((record) => (
                  <TableRow key={record.id} className={record.status === 'Cancelled' ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{record.reminder_number}</TableCell>
                    <TableCell>
                      {editingId === record.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="date"
                            value={editDate}
                            onChange={(e) => setEditDate(e.target.value)}
                            className="h-7 w-36 text-xs"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleSaveDate(record)}
                            disabled={loading}
                          >
                            <Check className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        record.reminder_date
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={record.status === 'Active' ? 'default' : 'secondary'}>
                        {record.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {record.status === 'Active' && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => handleEditDate(record)}
                            disabled={loading}
                            title="Edit date"
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            onClick={() => handleCancel(record)}
                            disabled={loading}
                            title="Cancel reminder"
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {activeCount > 0 && (
          <div className="flex justify-end mt-2">
            <Button variant="outline" size="sm" onClick={handleRegenerate}>
              <RotateCcw className="w-3 h-3 mr-1" />
              Regenerate PDF
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
