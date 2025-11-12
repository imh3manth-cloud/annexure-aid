import { useEffect, useState } from 'react';
import { db, MemoRecord } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { generateConsolidatedPDF } from '@/lib/pdfGenerator';
import { Download, FileText } from 'lucide-react';

export const MemoRegister = () => {
  const [memos, setMemos] = useState<MemoRecord[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<'all' | 'New' | 'Pending' | 'Verified' | 'Reported'>('all');
  const { toast } = useToast();

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
    if (selected.size === filteredMemos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredMemos.map(m => m.id!)));
    }
  };

  const handleGeneratePDF = async () => {
    const selectedMemos = memos.filter(m => selected.has(m.id!));
    if (selectedMemos.length === 0) {
      toast({ title: 'No memos selected', variant: 'destructive' });
      return;
    }

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
      setSelected(new Set());
      loadMemos();
    } catch (error: any) {
      toast({ title: 'Failed to generate PDF', description: error.message, variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      New: 'default',
      Pending: 'secondary',
      Verified: 'default',
      Reported: 'destructive'
    };
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

  const filteredMemos = filter === 'all' ? memos : memos.filter(m => m.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Memo Register</h2>
          <p className="text-muted-foreground mt-1">All verification memos</p>
        </div>
        
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button onClick={handleGeneratePDF} size="sm">
              <FileText className="w-4 h-4 mr-2" />
              Generate PDF ({selected.size})
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Verification Records</CardTitle>
              <CardDescription>Total: {filteredMemos.length} memos</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={filter === 'all' ? 'default' : 'outline'}
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                size="sm"
                variant={filter === 'New' ? 'default' : 'outline'}
                onClick={() => setFilter('New')}
              >
                New
              </Button>
              <Button
                size="sm"
                variant={filter === 'Pending' ? 'default' : 'outline'}
                onClick={() => setFilter('Pending')}
              >
                Pending
              </Button>
              <Button
                size="sm"
                variant={filter === 'Verified' ? 'default' : 'outline'}
                onClick={() => setFilter('Verified')}
              >
                Verified
              </Button>
              <Button
                size="sm"
                variant={filter === 'Reported' ? 'default' : 'outline'}
                onClick={() => setFilter('Reported')}
              >
                Reported
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selected.size === filteredMemos.length && filteredMemos.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Account No</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Printed</TableHead>
                  <TableHead>Reminders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMemos.map((memo) => (
                  <TableRow key={memo.id}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(memo.id!)}
                        onCheckedChange={() => toggleSelect(memo.id!)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{memo.serial}</TableCell>
                    <TableCell className="text-sm">{memo.txn_date}</TableCell>
                    <TableCell className="text-sm">{memo.account}</TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{memo.name}</TableCell>
                    <TableCell className="text-sm">{memo.BO_Name}</TableCell>
                    <TableCell className="text-sm font-medium">
                      ₹{memo.amount.toLocaleString('en-IN')}
                    </TableCell>
                    <TableCell>{getStatusBadge(memo.status)}</TableCell>
                    <TableCell>
                      <Badge variant={memo.printed ? 'default' : 'outline'}>
                        {memo.printed ? 'Yes' : 'No'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{memo.reminder_count}</TableCell>
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
