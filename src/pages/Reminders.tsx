import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, MemoRecord, bulkUpdateReminders } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { generateReminderPDF, generateOverdueReportPDF } from '@/lib/pdfGenerator';
import { Bell, AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { DespatchDialog } from '@/components/DespatchDialog';
import { ReminderHistoryDialog } from '@/components/ReminderHistoryDialog';

export const Reminders = () => {
  const navigate = useNavigate();
  const [pendingMemos, setPendingMemos] = useState<MemoRecord[]>([]);
  const [overdueMemos, setOverdueMemos] = useState<MemoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [overdueSelected, setOverdueSelected] = useState<Set<string | number>>(new Set());
  const [reminderDate, setReminderDate] = useState(new Date().toISOString().split('T')[0]);
  const [fromSerial, setFromSerial] = useState<string>('');
  const [toSerial, setToSerial] = useState<string>('');
  const [reminderNumber, setReminderNumber] = useState<string>('');
  const [filteredMemos, setFilteredMemos] = useState<MemoRecord[]>([]);
  const [isGeneratingReminder, setIsGeneratingReminder] = useState(false);
  const [reminderProgress, setReminderProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  useEffect(() => {
    loadMemos();
  }, []);

  const loadMemos = async (retryCount = 0) => {
    setLoading(true);
    try {
      const memos = await db.memos
        .where('status')
        .equals('Pending')
        .sortBy('serial');
      
      console.log('Loaded pending memos:', memos.length);
      
      const today = new Date();
      const pending: MemoRecord[] = [];
      const overdue: MemoRecord[] = [];
      
      memos.forEach(memo => {
        if (memo.last_reminder_date && memo.reminder_count > 0) {
          const lastReminder = new Date(memo.last_reminder_date);
          const daysSinceReminder = Math.floor((today.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24));
          if (daysSinceReminder > 15) {
            overdue.push(memo);
          } else {
            pending.push(memo);
          }
        } else {
          pending.push(memo);
        }
      });
      
      setPendingMemos(pending);
      setOverdueMemos(overdue);

      // Auto-suggest serial range: first and last pending memo serials
      if (pending.length > 0) {
        const sortedBySerial = [...pending].sort((a, b) => a.serial - b.serial);
        setFromSerial(String(sortedBySerial[0].serial));
        setToSerial(String(sortedBySerial[sortedBySerial.length - 1].serial));
      }
    } catch (error: any) {
      console.error('Failed to load memos:', error);
      if (retryCount < 2 && error?.message?.includes('lock')) {
        console.log(`Retrying loadMemos (attempt ${retryCount + 1})...`);
        setTimeout(() => loadMemos(retryCount + 1), 500);
        return;
      }
      toast({ title: 'Failed to load memos', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // Filter memos by serial range
  useEffect(() => {
    const from = parseInt(fromSerial);
    const to = parseInt(toSerial);
    if (!isNaN(from) && !isNaN(to) && from > 0 && to >= from) {
      const filtered = pendingMemos.filter(m => m.serial >= from && m.serial <= to);
      setFilteredMemos(filtered);
      setSelected(new Set(filtered.map(m => m.id!)));
    } else {
      setFilteredMemos([]);
      setSelected(new Set());
    }
  }, [fromSerial, toSerial, pendingMemos]);

  const toggleOverdueSelect = (id: string | number) => {
    const newSelected = new Set(overdueSelected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setOverdueSelected(newSelected);
  };

  const toggleOverdueSelectAll = () => {
    if (overdueSelected.size === overdueMemos.length) {
      setOverdueSelected(new Set());
    } else {
      setOverdueSelected(new Set(overdueMemos.map(m => m.id!)));
    }
  };

  const handleGenerateReminder = async () => {
    console.log('Generate reminder clicked', { fromSerial, toSerial, reminderNumber, filteredMemosCount: filteredMemos.length });
    const from = parseInt(fromSerial);
    const to = parseInt(toSerial);
    const remNum = parseInt(reminderNumber);

    if (isNaN(from) || isNaN(to) || from > to) {
      toast({ title: 'Invalid serial range', variant: 'destructive' });
      return;
    }
    if (isNaN(remNum) || remNum < 1) {
      toast({ title: 'Enter a valid reminder number', variant: 'destructive' });
      return;
    }

    const selectedMemos = filteredMemos;
    if (selectedMemos.length === 0) {
      toast({ title: 'No pending memos in this serial range', variant: 'destructive' });
      return;
    }

    setIsGeneratingReminder(true);
    setReminderProgress({ current: 0, total: selectedMemos.length });

    try {
      // Sort by BO then serial for organized output
      const sortedMemos = [...selectedMemos].sort((a, b) => {
        if (a.BO_Name !== b.BO_Name) return a.BO_Name.localeCompare(b.BO_Name);
        return a.serial - b.serial;
      });

      setReminderProgress({ current: 0, total: sortedMemos.length });

      // Bulk update all memos and insert reminder history in batches
      await bulkUpdateReminders(
        sortedMemos,
        remNum,
        reminderDate,
        (current, total) => setReminderProgress({ current, total })
      );

      // Fetch updated memos for PDF
      const updatedMemos = await db.memos.bulkGet(sortedMemos.map(m => m.id!));
      const pdf = generateReminderPDF(updatedMemos.filter(Boolean) as MemoRecord[]);
      pdf.save(`reminder_${remNum}_to_IP_${reminderDate}.pdf`);

      toast({ title: 'Reminder PDF generated', description: `Reminder ${remNum} for serials ${from}-${to} (${sortedMemos.length} memos)` });
      setSelected(new Set());
      loadMemos();
    } catch (error: any) {
      toast({ title: 'Failed to generate reminder', description: error.message, variant: 'destructive' });
    } finally {
      setIsGeneratingReminder(false);
      setReminderProgress({ current: 0, total: 0 });
    }
  };

  const handleGenerateOverdueReport = async () => {
    const selectedMemos = overdueMemos.filter(m => overdueSelected.has(m.id!));
    if (selectedMemos.length === 0) {
      toast({ title: 'No memos selected', variant: 'destructive' });
      return;
    }

    try {
      // Generate PDF addressed to Superintendent
      const pdf = generateOverdueReportPDF(selectedMemos);
      pdf.save(`overdue_report_to_SP_${new Date().toISOString().split('T')[0]}.pdf`);

      toast({ title: 'Overdue Report PDF generated', description: 'Addressed to Superintendent of Post Offices' });
      setOverdueSelected(new Set());
    } catch (error: any) {
      toast({ title: 'Failed to generate report', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/operations')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-3xl font-bold text-foreground">Reminders & Reports</h2>
            <p className="text-muted-foreground mt-1">Generate reminders to IP and overdue reports to SP</p>
          </div>
        </div>
        <DespatchDialog onDespatchSaved={loadMemos} />
      </div>

      <Tabs defaultValue="reminders" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="reminders">
            Reminders to IP ({pendingMemos.length})
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Report to SP ({overdueMemos.length})
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading memos...</p>
          </div>
        ) : (
        <>
        <TabsContent value="reminders" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Reminder to Inspector of Posts
              </CardTitle>
              <CardDescription>
                For pending memos - verification should be returned within 10/30 days
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="fromSerial">From Memo No.</Label>
                  <Input
                    id="fromSerial"
                    type="number"
                    placeholder="e.g. 1"
                    value={fromSerial}
                    onChange={(e) => setFromSerial(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="toSerial">To Memo No.</Label>
                  <Input
                    id="toSerial"
                    type="number"
                    placeholder="e.g. 50"
                    value={toSerial}
                    onChange={(e) => setToSerial(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminderNumber">Reminder No.</Label>
                  <Input
                    id="reminderNumber"
                    type="number"
                    min="1"
                    placeholder="e.g. 1"
                    value={reminderNumber}
                    onChange={(e) => setReminderNumber(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reminderDate">Reminder Date</Label>
                  <Input
                    id="reminderDate"
                    type="date"
                    value={reminderDate}
                    onChange={(e) => setReminderDate(e.target.value)}
                  />
                </div>
              </div>
              {filteredMemos.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  {filteredMemos.length} pending memo(s) found in serial range {fromSerial}–{toSerial}
                </p>
              )}
              <Button
                onClick={handleGenerateReminder}
                disabled={filteredMemos.length === 0 || !reminderNumber || isGeneratingReminder}
              >
                {isGeneratingReminder ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Reminder {reminderNumber || '?'}... ({reminderProgress.current}/{reminderProgress.total})
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4 mr-2" />
                    Generate Reminder {reminderNumber || '?'} to IP ({filteredMemos.length} memos)
                  </>
                )}
              </Button>
              {isGeneratingReminder && reminderProgress.total > 0 && (
                <div className="space-y-2 max-w-md">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Processing reminders...</span>
                    <span>{reminderProgress.current}/{reminderProgress.total}</span>
                  </div>
                  <Progress value={(reminderProgress.current / reminderProgress.total) * 100} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Memos</CardTitle>
              <CardDescription>Total: {pendingMemos.length} pending memos awaiting verification</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Serial</TableHead>
                      <TableHead>Account No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Memo Sent</TableHead>
                      <TableHead>Reminders</TableHead>
                      <TableHead>History</TableHead>
                      <TableHead>Last Reminder</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingMemos.map((memo) => {
                      const inRange = selected.has(memo.id!);
                      return (
                        <TableRow key={memo.id} className={inRange ? 'bg-primary/5' : ''}>
                          <TableCell className="font-medium">{memo.serial}</TableCell>
                          <TableCell className="text-sm">{memo.account}</TableCell>
                          <TableCell className="text-sm max-w-[200px] truncate">{memo.name}</TableCell>
                          <TableCell className="text-sm">{memo.BO_Name}</TableCell>
                          <TableCell className="text-sm font-medium">
                            ₹{memo.amount.toLocaleString('en-IN')}
                          </TableCell>
                          <TableCell className="text-sm">{memo.memo_sent_date || 'N/A'}</TableCell>
                          <TableCell className="text-sm">{memo.reminder_count}</TableCell>
                          <TableCell>
                            <ReminderHistoryDialog memo={memo} onUpdated={loadMemos} />
                          </TableCell>
                          <TableCell className="text-sm">{memo.last_reminder_date || 'None'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overdue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Report to Superintendent of Post Offices
              </CardTitle>
              <CardDescription>
                For cases where no reply received within 15 days from reminder date
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleGenerateOverdueReport}
                disabled={overdueSelected.size === 0}
                variant="destructive"
              >
                <AlertTriangle className="w-4 h-4 mr-2" />
                Generate Report to SP ({overdueSelected.size})
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Overdue Memos</CardTitle>
              <CardDescription>
                {overdueMemos.length} memos overdue (no reply 15+ days after reminder)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={overdueSelected.size === overdueMemos.length && overdueMemos.length > 0}
                          onCheckedChange={toggleOverdueSelectAll}
                        />
                      </TableHead>
                      <TableHead>Serial</TableHead>
                      <TableHead>Account No</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Reminders</TableHead>
                      <TableHead>History</TableHead>
                      <TableHead>Last Reminder</TableHead>
                      <TableHead>Days Overdue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overdueMemos.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                          No overdue memos. Good job!
                        </TableCell>
                      </TableRow>
                    ) : (
                      overdueMemos.map((memo) => {
                        const today = new Date();
                        const lastReminder = memo.last_reminder_date ? new Date(memo.last_reminder_date) : null;
                        const daysOverdue = lastReminder
                          ? Math.floor((today.getTime() - lastReminder.getTime()) / (1000 * 60 * 60 * 24))
                          : 0;

                        return (
                          <TableRow key={memo.id} className="bg-destructive/5">
                            <TableCell>
                              <Checkbox
                                checked={overdueSelected.has(memo.id!)}
                                onCheckedChange={() => toggleOverdueSelect(memo.id!)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">{memo.serial}</TableCell>
                            <TableCell className="text-sm">{memo.account}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{memo.name}</TableCell>
                            <TableCell className="text-sm">{memo.BO_Name}</TableCell>
                            <TableCell className="text-sm font-medium">
                              ₹{memo.amount.toLocaleString('en-IN')}
                            </TableCell>
                            <TableCell className="text-sm">{memo.reminder_count}</TableCell>
                            <TableCell>
                              <ReminderHistoryDialog memo={memo} onUpdated={loadMemos} />
                            </TableCell>
                            <TableCell className="text-sm">{memo.last_reminder_date}</TableCell>
                            <TableCell className="text-sm font-bold text-destructive">{daysOverdue} days</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        </>
        )}
      </Tabs>
    </div>
  );
};