import { useState } from 'react';
import { db, MemoRecord } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, FileText, Calendar, CalendarDays, Building2, TrendingUp } from 'lucide-react';
import * as XLSX from 'xlsx';
import { generateConsolidatedPDF } from '@/lib/pdfGenerator';

type ReportType = 'all' | 'aging' | 'branch' | 'date' | 'status';
type ExportFormat = 'excel' | 'pdf';

// Generate month options (last 12 months)
const getMonthOptions = () => {
  const options: { value: string; label: string; month: number; year: number }[] = [];
  const now = new Date();
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      month: d.getMonth(),
      year: d.getFullYear()
    });
  }
  return options;
};

export const ReportsNew = () => {
  const [reportType, setReportType] = useState<ReportType>('all');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('excel');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBO, setSelectedBO] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [agingDays, setAgingDays] = useState('30');
  const [reportData, setReportData] = useState<MemoRecord[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(getMonthOptions()[1]?.value || '');
  const { toast } = useToast();
  const monthOptions = getMonthOptions();

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      let memos = await db.memos.toArray();

      // Filter based on report type
      switch (reportType) {
        case 'aging':
          const days = parseInt(agingDays);
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - days);
          memos = memos.filter(m => 
            m.status === 'Pending' && 
            m.memo_sent_date && 
            new Date(m.memo_sent_date) <= cutoffDate
          );
          break;

        case 'branch':
          if (selectedBO) {
            memos = memos.filter(m => m.BO_Code === selectedBO || m.BO_Name === selectedBO);
          }
          break;

        case 'date':
          if (startDate && endDate) {
            memos = memos.filter(m => {
              const txnDate = new Date(m.txn_date);
              return txnDate >= new Date(startDate) && txnDate <= new Date(endDate);
            });
          }
          break;

        case 'status':
          if (selectedStatus) {
            memos = memos.filter(m => m.status === selectedStatus);
          }
          break;
      }

      setReportData(memos);
      toast({ title: `Report generated with ${memos.length} records` });
    } catch (error: any) {
      toast({ title: 'Failed to generate report', description: error.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const exportReport = () => {
    if (reportData.length === 0) {
      toast({ title: 'No data to export', description: 'Please generate a report first', variant: 'destructive' });
      return;
    }

    if (exportFormat === 'excel') {
      exportToExcel();
    } else {
      exportToPDF();
    }
  };

  const exportToExcel = () => {
    const data = reportData.map(m => ({
      'Serial': m.serial,
      'Account No': m.account,
      'Transaction ID': m.txn_id,
      'Name': m.name,
      'Address': m.address,
      'Branch Office': m.BO_Name,
      'Amount': m.amount,
      'Balance': m.balance,
      'Balance Date': m.balance_date,
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
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    
    const filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, filename);
    
    toast({ title: 'Excel export successful' });
  };

  const exportToPDF = () => {
    const doc = generateConsolidatedPDF(reportData);
    const filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
    toast({ title: 'PDF export successful' });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Reports & Analytics</h2>
        <p className="text-muted-foreground mt-1">Generate detailed reports and export data</p>
      </div>

      {/* Report Configuration */}
      <Card className="relative overflow-hidden shadow-xl border-primary/10">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            Report Configuration
          </CardTitle>
          <CardDescription>Select report type and filters</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label>Report Type</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Memos</SelectItem>
                  <SelectItem value="aging">Aging Analysis</SelectItem>
                  <SelectItem value="branch">Branch Office Wise</SelectItem>
                  <SelectItem value="date">Date Range</SelectItem>
                  <SelectItem value="status">By Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Export Format</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="excel">Excel (.xlsx)</SelectItem>
                  <SelectItem value="pdf">PDF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Report-specific filters */}
          {reportType === 'aging' && (
            <div>
              <Label>Pending For (Days)</Label>
              <Input
                type="number"
                value={agingDays}
                onChange={(e) => setAgingDays(e.target.value)}
                placeholder="Enter number of days"
              />
            </div>
          )}

          {reportType === 'branch' && (
            <div>
              <Label>Branch Office</Label>
              <Input
                value={selectedBO}
                onChange={(e) => setSelectedBO(e.target.value)}
                placeholder="Enter branch office code or name"
              />
            </div>
          )}

          {reportType === 'date' && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {reportType === 'status' && (
            <div>
              <Label>Status</Label>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Verified">Verified</SelectItem>
                  <SelectItem value="Reported">Reported</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button onClick={generateReport} disabled={isGenerating} className="flex-1">
              <TrendingUp className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
            <Button onClick={exportReport} disabled={reportData.length === 0} variant="secondary" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Export {exportFormat === 'excel' ? 'Excel' : 'PDF'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Report Preview */}
      {reportData.length > 0 && (
        <Card className="relative overflow-hidden shadow-xl border-accent/10">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent via-primary to-accent" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-accent/10">
                <FileSpreadsheet className="h-5 w-5 text-accent" />
              </div>
              Report Preview
            </CardTitle>
            <CardDescription>{reportData.length} records found</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Serial</th>
                      <th className="px-4 py-3 text-left font-semibold">Account</th>
                      <th className="px-4 py-3 text-left font-semibold">Name</th>
                      <th className="px-4 py-3 text-left font-semibold">Branch Office</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      <th className="px-4 py-3 text-left font-semibold">Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.slice(0, 50).map((memo, idx) => (
                      <tr key={memo.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                        <td className="px-4 py-2">{memo.serial}</td>
                        <td className="px-4 py-2">{memo.account}</td>
                        <td className="px-4 py-2">{memo.name}</td>
                        <td className="px-4 py-2">{memo.BO_Name}</td>
                        <td className="px-4 py-2 text-right">₹{memo.amount.toFixed(2)}</td>
                        <td className="px-4 py-2">{new Date(memo.txn_date).toLocaleDateString()}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            memo.status === 'Verified' ? 'bg-green-500/10 text-green-500' :
                            memo.status === 'Pending' ? 'bg-amber-500/10 text-amber-500' :
                            memo.status === 'Reported' ? 'bg-red-500/10 text-red-500' :
                            'bg-blue-500/10 text-blue-500'
                          }`}>
                            {memo.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {reportData.length > 50 && (
                <div className="p-3 bg-muted/30 text-center text-sm text-muted-foreground border-t">
                  Showing first 50 of {reportData.length} records. Export to see all data.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
