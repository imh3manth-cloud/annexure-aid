import { useEffect, useState } from 'react';
import { db, MemoRecord } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export const Reports = () => {
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    verified: 0,
    reported: 0,
    ageing: {
      lessThanMonth: 0,
      oneToThree: 0,
      moreThanThree: 0
    }
  });
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const memos = await db.memos.toArray();
    const pending = memos.filter(m => m.status === 'Pending');
    
    const now = new Date();
    const oneMonth = 30 * 24 * 60 * 60 * 1000;
    const threeMonths = 90 * 24 * 60 * 60 * 1000;
    
    const ageing = {
      lessThanMonth: 0,
      oneToThree: 0,
      moreThanThree: 0
    };
    
    pending.forEach(memo => {
      if (!memo.memo_sent_date) return;
      const age = now.getTime() - new Date(memo.memo_sent_date).getTime();
      if (age <= oneMonth) ageing.lessThanMonth++;
      else if (age <= threeMonths) ageing.oneToThree++;
      else ageing.moreThanThree++;
    });

    setStats({
      total: memos.length,
      pending: pending.length,
      verified: memos.filter(m => m.status === 'Verified').length,
      reported: memos.filter(m => m.status === 'Reported').length,
      ageing
    });
  };

  const exportToExcel = async (filter?: string) => {
    try {
      let memos = await db.memos.toArray();
      if (filter) {
        memos = memos.filter(m => m.status === filter);
      }

      const data = memos.map(m => ({
        'Serial': m.serial,
        'Account No': m.account,
        'Transaction ID': m.txn_id,
        'Name': m.name,
        'Address': m.address,
        'Branch Office': m.BO_Name,
        'Amount': m.amount,
        'Transaction Date': m.txn_date,
        'Status': m.status,
        'Printed': m.printed ? 'Yes' : 'No',
        'Memo Sent Date': m.memo_sent_date || '',
        'Reminders': m.reminder_count,
        'Last Reminder': m.last_reminder_date || '',
        'Verified Date': m.verified_date || '',
        'Reported Date': m.reported_date || '',
        'Remarks': m.remarks
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Memos');
      
      const filename = filter 
        ? `${filter.toLowerCase()}_memos_${new Date().toISOString().split('T')[0]}.xlsx`
        : `all_memos_${new Date().toISOString().split('T')[0]}.xlsx`;
      
      XLSX.writeFile(wb, filename);
      
      toast({ title: 'Export successful' });
    } catch (error: any) {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
    }
  };

  const exportBackup = async () => {
    try {
      const memos = await db.memos.toArray();
      const settings = await db.settings.toArray();
      
      const backup = {
        version: 1,
        timestamp: new Date().toISOString(),
        memos,
        settings
      };
      
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      
      toast({ title: 'Backup created successfully' });
    } catch (error: any) {
      toast({ title: 'Backup failed', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Reports</h2>
        <p className="text-muted-foreground mt-1">Export and analyze verification data</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Summary Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Memos:</span>
              <span className="font-bold">{stats.total}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pending:</span>
              <span className="font-bold text-warning">{stats.pending}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Verified:</span>
              <span className="font-bold text-success">{stats.verified}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reported:</span>
              <span className="font-bold text-destructive">{stats.reported}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ageing Analysis</CardTitle>
            <CardDescription>Pending memos by age</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">≤ 1 month:</span>
              <span className="font-bold">{stats.ageing.lessThanMonth}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">1-3 months:</span>
              <span className="font-bold text-warning">{stats.ageing.oneToThree}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">&gt; 3 months:</span>
              <span className="font-bold text-destructive">{stats.ageing.moreThanThree}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
          <CardDescription>Download data in various formats</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Button onClick={() => exportToExcel()} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              All Memos (Excel)
            </Button>
            <Button onClick={() => exportToExcel('Pending')} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Pending Only (Excel)
            </Button>
            <Button onClick={() => exportToExcel('Verified')} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Verified Only (Excel)
            </Button>
            <Button onClick={() => exportToExcel('Reported')} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Reported Only (Excel)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Backup & Restore</CardTitle>
          <CardDescription>Create full database backup</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={exportBackup}>
            <Download className="w-4 h-4 mr-2" />
            Create Backup (JSON)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
