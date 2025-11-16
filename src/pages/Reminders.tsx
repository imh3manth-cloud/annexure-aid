import { useEffect, useState } from 'react';
import { db, MemoRecord } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { generateReminderPDF } from '@/lib/pdfGenerator';
import { Bell } from 'lucide-react';

export const Reminders = () => {
  const [pendingMemos, setPendingMemos] = useState<MemoRecord[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().split('T')[0]);
  const { toast } = useToast();

  useEffect(() => {
    loadPendingMemos();
  }, []);

  const loadPendingMemos = async () => {
    const memos = await db.memos
      .where('status')
      .equals('Pending')
      .sortBy('serial');
    setPendingMemos(memos);
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
    if (selected.size === pendingMemos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingMemos.map(m => m.id!)));
    }
  };

  const handleGenerateReminder = async () => {
    const selectedMemos = pendingMemos.filter(m => selected.has(m.id!));
    if (selectedMemos.length === 0) {
      toast({ title: 'No memos selected', variant: 'destructive' });
      return;
    }

    try {
      // Group by branch office for continuous display
      const groupedByBO = selectedMemos.reduce((acc, memo) => {
        const key = memo.BO_Name;
        if (!acc[key]) acc[key] = [];
        acc[key].push(memo);
        return acc;
      }, {} as Record<string, MemoRecord[]>);
      
      // Flatten back but grouped
      const sortedMemos: MemoRecord[] = [];
      Object.values(groupedByBO).forEach(group => {
        sortedMemos.push(...group);
      });

      // Update memo records
      for (const memo of sortedMemos) {
        const newReminderCount = memo.reminder_count + 1;
        const newRemarks = memo.remarks
          ? `${memo.remarks}; Reminder ${newReminderCount} on ${reminderDate}`
          : `Reminder ${newReminderCount} on ${reminderDate}`;

        await db.memos.update(memo.id!, {
          reminder_count: newReminderCount,
          last_reminder_date: reminderDate,
          remarks: newRemarks
        });
      }

      // Generate PDF
      const updatedMemos = await db.memos.bulkGet(sortedMemos.map(m => m.id!));
      const pdf = generateReminderPDF(updatedMemos.filter(Boolean) as MemoRecord[]);
      pdf.save(`reminders_${reminderDate}.pdf`);

      toast({ title: 'Reminder PDF generated successfully' });
      setSelected(new Set());
      loadPendingMemos();
    } catch (error: any) {
      toast({ title: 'Failed to generate reminder', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Reminders</h2>
        <p className="text-muted-foreground mt-1">Generate reminder reports for pending memos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reminder Settings</CardTitle>
          <CardDescription>Select pending memos and set reminder date</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="reminderDate">Reminder Date</Label>
              <Input
                id="reminderDate"
                type="date"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
              />
            </div>
            <Button
              onClick={handleGenerateReminder}
              disabled={selected.size === 0}
            >
              <Bell className="w-4 h-4 mr-2" />
              Generate Reminder PDF ({selected.size})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending Memos</CardTitle>
          <CardDescription>Total: {pendingMemos.length} pending memos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selected.size === pendingMemos.length && pendingMemos.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Account No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Memo Sent</TableHead>
                  <TableHead>Reminders</TableHead>
                  <TableHead>Last Reminder</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingMemos.map((memo) => (
                  <TableRow key={memo.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(memo.id!)}
                        onCheckedChange={() => toggleSelect(memo.id!)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{memo.serial}</TableCell>
                    <TableCell className="text-sm">{memo.account}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{memo.name}</TableCell>
                    <TableCell className="text-sm">{memo.BO_Name}</TableCell>
                    <TableCell className="text-sm font-medium">
                      ₹{memo.amount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell className="text-sm">{memo.memo_sent_date || 'N/A'}</TableCell>
                    <TableCell className="text-sm">{memo.reminder_count}</TableCell>
                    <TableCell className="text-sm">{memo.last_reminder_date || 'None'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
