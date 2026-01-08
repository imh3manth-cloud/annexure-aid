import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, MemoRecord } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download, FileText, Calendar, ArrowLeft } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import * as XLSX from 'xlsx';

// Get available quarters for selection
const getQuarterOptions = () => {
  const options: { value: string; label: string; start: Date; end: Date }[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  
  // Generate last 8 quarters
  for (let i = 0; i < 8; i++) {
    const year = currentYear - Math.floor(i / 4);
    const quarterOffset = i % 4;
    
    let quarter: number;
    let startMonth: number;
    let endMonth: number;
    let label: string;
    
    // Work backwards from current quarter
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const targetQuarter = (currentQuarter - quarterOffset + 4) % 4;
    const targetYear = year - (quarterOffset > currentQuarter ? 1 : 0);
    
    switch (targetQuarter) {
      case 0: // Jan-Mar (Q4 in fiscal)
        startMonth = 0; endMonth = 2;
        label = `Q4 ${targetYear} (Jan-Mar)`;
        break;
      case 1: // Apr-Jun (Q1 in fiscal)
        startMonth = 3; endMonth = 5;
        label = `Q1 ${targetYear} (Apr-Jun)`;
        break;
      case 2: // Jul-Sep (Q2 in fiscal)
        startMonth = 6; endMonth = 8;
        label = `Q2 ${targetYear} (Jul-Sep)`;
        break;
      default: // Oct-Dec (Q3 in fiscal)
        startMonth = 9; endMonth = 11;
        label = `Q3 ${targetYear} (Oct-Dec)`;
        break;
    }
    
    const start = new Date(targetYear, startMonth, 1);
    const end = new Date(targetYear, endMonth + 1, 0, 23, 59, 59);
    
    options.push({
      value: `${targetYear}-${startMonth}`,
      label,
      start,
      end
    });
  }
  
  return options;
};

export const Reports = () => {
  const navigate = useNavigate();
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
  const [selectedQuarter, setSelectedQuarter] = useState<string>('');
  const quarterOptions = getQuarterOptions();
  const { toast } = useToast();

  useEffect(() => {
    loadStats();
    // Set default quarter to previous quarter
    if (quarterOptions.length > 1) {
      setSelectedQuarter(quarterOptions[1].value);
    }
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
      
      toast({ title: 'Excel export successful' });
    } catch (error: any) {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
    }
  };

  const exportToPDF = async (filter?: string) => {
    try {
      let memos = await db.memos.toArray();
      if (filter) {
        memos = memos.filter(m => m.status === filter);
      }
      
      const { generateConsolidatedPDF } = await import('@/lib/pdfGenerator');
      const doc = generateConsolidatedPDF(memos);
      
      const filename = filter 
        ? `${filter.toLowerCase()}_report_${new Date().toISOString().split('T')[0]}.pdf`
        : `all_memos_report_${new Date().toISOString().split('T')[0]}.pdf`;
      
      doc.save(filename);
      
      toast({ title: 'PDF export successful' });
    } catch (error: any) {
      toast({ title: 'Export failed', description: error.message, variant: 'destructive' });
    }
  };

  const generateQuarterlyReport = async () => {
    if (!selectedQuarter) {
      toast({ title: 'Please select a quarter', variant: 'destructive' });
      return;
    }

    try {
      const quarter = quarterOptions.find(q => q.value === selectedQuarter);
      if (!quarter) return;

      const memos = await db.memos.toArray();
      
      const { generateQuarterlyReportPDF } = await import('@/lib/pdfGenerator');
      const doc = generateQuarterlyReportPDF(memos, quarter.start, quarter.end);
      
      const filename = `quarterly_report_${quarter.label.replace(/\s+/g, '_')}.pdf`;
      doc.save(filename);
      
      toast({ 
        title: 'Quarterly Report Generated', 
        description: `Report for ${quarter.label} ready for submission to SP` 
      });
    } catch (error: any) {
      toast({ title: 'Report generation failed', description: error.message, variant: 'destructive' });
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

  // Get next due date for quarterly report
  const getNextDueDate = () => {
    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    
    // Due dates: Jan 5, Apr 5, Jul 5, Oct 5
    const dueDates = [
      new Date(year, 0, 5), // Jan 5
      new Date(year, 3, 5), // Apr 5
      new Date(year, 6, 5), // Jul 5
      new Date(year, 9, 5), // Oct 5
    ];
    
    for (const due of dueDates) {
      if (due > now) {
        return due.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
      }
    }
    return new Date(year + 1, 0, 5).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/operations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold text-foreground">Reports</h2>
          <p className="text-muted-foreground mt-1">Export and analyze verification data</p>
        </div>
      </div>

      {/* Quarterly Report Card - Highlighted */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Quarterly Report to Superintendent
          </CardTitle>
          <CardDescription>
            Due by 5th of January, April, July, October as per POSB CBS Manual
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Next due date:</span>
            <span className="font-semibold text-primary">{getNextDueDate()}</span>
          </div>
          
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label>Select Quarter</Label>
              <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  {quarterOptions.map(q => (
                    <SelectItem key={q.value} value={q.value}>
                      {q.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={generateQuarterlyReport} className="gap-2">
              <FileText className="w-4 h-4" />
              Generate Quarterly Report
            </Button>
          </div>
          
          <p className="text-xs text-muted-foreground">
            This report certifies that verification of Rs.10,000/- and above withdrawals at Branch Offices 
            has been completed for the selected quarter.
          </p>
        </CardContent>
      </Card>

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
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => exportToExcel()} variant="outline" className="w-full">
              <Download className="mr-2 h-4 w-4" />
              Excel - All
            </Button>
            <Button onClick={() => exportToPDF()} variant="outline" className="w-full">
              <Download className="mr-2 h-4 w-4" />
              PDF - All
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => exportToExcel('Pending')} variant="outline" size="sm" className="w-full">
              <Download className="mr-2 h-3 w-3" />
              Excel - Pending
            </Button>
            <Button onClick={() => exportToPDF('Pending')} variant="outline" size="sm" className="w-full">
              <Download className="mr-2 h-3 w-3" />
              PDF - Pending
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => exportToExcel('Verified')} variant="outline" size="sm" className="w-full">
              <Download className="mr-2 h-3 w-3" />
              Excel - Verified
            </Button>
            <Button onClick={() => exportToPDF('Verified')} variant="outline" size="sm" className="w-full">
              <Download className="mr-2 h-3 w-3" />
              PDF - Verified
            </Button>
          </div>
          <Button onClick={exportBackup} variant="outline" className="w-full mt-2">
            <Download className="mr-2 h-4 w-4" />
            Full Backup (JSON)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};