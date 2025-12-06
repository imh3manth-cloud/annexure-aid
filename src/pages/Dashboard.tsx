import { useEffect, useState, useMemo } from 'react';
import { db, MemoRecord } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { FileText, Clock, CheckCircle2, AlertTriangle, TrendingUp, Calendar, Download, FileSpreadsheet, Printer, Eye, Bell } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import { getConfig } from '@/lib/config';

// Get next quarterly report due date
const getNextQuarterlyDueDate = (): { dueDate: Date; quarterLabel: string } => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Due dates: 5th of Jan, Apr, Jul, Oct
  const dueDates = [
    { month: 0, day: 5, label: 'Q3 (Oct-Dec)' },   // Jan 5
    { month: 3, day: 5, label: 'Q4 (Jan-Mar)' },   // Apr 5
    { month: 6, day: 5, label: 'Q1 (Apr-Jun)' },   // Jul 5
    { month: 9, day: 5, label: 'Q2 (Jul-Sep)' },   // Oct 5
  ];
  
  for (const dd of dueDates) {
    const dueDate = new Date(year, dd.month, dd.day);
    if (dueDate > now) {
      return { dueDate, quarterLabel: dd.label };
    }
  }
  
  // Next year's first due date
  return { 
    dueDate: new Date(year + 1, 0, 5), 
    quarterLabel: 'Q3 (Oct-Dec)' 
  };
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    pending: 0,
    verified: 0,
    reported: 0,
    lastUpdated: new Date().toLocaleString()
  });
  
  const [boStats, setBoStats] = useState<Record<string, { count: number; pending: number }>>({});
  const [agingData, setAgingData] = useState({ week1: 0, week2: 0, week3: 0, older: 0 });
  const [memos, setMemos] = useState<MemoRecord[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();
  
  // Check if quarterly report is due within 7 days
  const quarterlyAlert = useMemo(() => {
    const { dueDate, quarterLabel } = getNextQuarterlyDueDate();
    const now = new Date();
    const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilDue <= 7 && daysUntilDue >= 0) {
      return {
        show: true,
        daysLeft: daysUntilDue,
        dueDate: dueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        quarterLabel
      };
    }
    return { show: false, daysLeft: 0, dueDate: '', quarterLabel: '' };
  }, []);

  useEffect(() => {
    const loadStats = async () => {
      const allMemos = await db.memos.toArray();
      setMemos(allMemos);
      
      setStats({
        total: allMemos.length,
        new: allMemos.filter(m => m.status === 'New').length,
        pending: allMemos.filter(m => m.status === 'Pending').length,
        verified: allMemos.filter(m => m.status === 'Verified').length,
        reported: allMemos.filter(m => m.status === 'Reported').length,
        lastUpdated: new Date().toLocaleString()
      });
      
      // Calculate BO-wise stats
      const boData: Record<string, { count: number; pending: number }> = {};
      allMemos.forEach(memo => {
        if (!boData[memo.BO_Name]) {
          boData[memo.BO_Name] = { count: 0, pending: 0 };
        }
        boData[memo.BO_Name].count++;
        if (memo.status === 'Pending') {
          boData[memo.BO_Name].pending++;
        }
      });
      setBoStats(boData);
      
      // Calculate aging data
      const now = new Date();
      const aging = { week1: 0, week2: 0, week3: 0, older: 0 };
      allMemos.filter(m => m.status === 'Pending' && m.memo_sent_date).forEach(memo => {
        const sentDate = new Date(memo.memo_sent_date!);
        const daysDiff = Math.floor((now.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysDiff <= 7) aging.week1++;
        else if (daysDiff <= 14) aging.week2++;
        else if (daysDiff <= 21) aging.week3++;
        else aging.older++;
      });
      setAgingData(aging);
    };

    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  const pendingMemos = memos.filter(m => m.status === 'Pending');

  const exportToExcel = () => {
    const config = getConfig();
    const data = Object.entries(boStats).map(([boName, stats]) => ({
      'Branch Office': boName,
      'Total Memos': stats.count,
      'Pending': stats.pending,
      'Verified': stats.count - stats.pending
    }));
    
    // Add aging summary
    const agingSummary = [
      { 'Aging Period': '0-7 Days', 'Count': agingData.week1 },
      { 'Aging Period': '8-14 Days', 'Count': agingData.week2 },
      { 'Aging Period': '15-21 Days', 'Count': agingData.week3 },
      { 'Aging Period': '21+ Days', 'Count': agingData.older },
    ];
    
    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(data);
    const ws2 = XLSX.utils.json_to_sheet(agingSummary);
    XLSX.utils.book_append_sheet(wb, ws1, 'BO Summary');
    XLSX.utils.book_append_sheet(wb, ws2, 'Aging Analysis');
    XLSX.writeFile(wb, `pendency_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Excel exported successfully' });
  };

  const exportToPDF = () => {
    const config = getConfig();
    const doc = new jsPDF();
    
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Pendency Consolidated Report', 105, 15, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`${config.officeName} - ${config.subdivision}`, 105, 22, { align: 'center' });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 105, 28, { align: 'center' });
    
    // Summary stats
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 15, 40);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Total Memos: ${stats.total}`, 15, 48);
    doc.text(`Pending: ${stats.pending}`, 15, 54);
    doc.text(`Verified: ${stats.verified}`, 15, 60);
    doc.text(`Reported: ${stats.reported}`, 15, 66);
    
    // BO Summary table
    let yPos = 80;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Branch Office Wise Pendency', 15, yPos);
    yPos += 8;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Branch Office', 15, yPos);
    doc.text('Total', 100, yPos);
    doc.text('Pending', 130, yPos);
    doc.line(15, yPos + 2, 160, yPos + 2);
    yPos += 8;
    
    doc.setFont('helvetica', 'normal');
    Object.entries(boStats).forEach(([boName, data]) => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(boName.substring(0, 40), 15, yPos);
      doc.text(String(data.count), 100, yPos);
      doc.text(String(data.pending), 130, yPos);
      yPos += 6;
    });
    
    // Aging Analysis
    yPos += 10;
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Aging Analysis', 15, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`0-7 Days: ${agingData.week1}`, 15, yPos);
    doc.text(`8-14 Days: ${agingData.week2}`, 70, yPos);
    yPos += 6;
    doc.text(`15-21 Days: ${agingData.week3}`, 15, yPos);
    doc.text(`21+ Days: ${agingData.older}`, 70, yPos);
    
    doc.save(`pendency_report_${new Date().toISOString().split('T')[0]}.pdf`);
    toast({ title: 'PDF exported successfully' });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Pendency Consolidated Report</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {/* Summary */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-primary/10 text-center">
                <div className="text-2xl font-bold text-primary">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
              <div className="p-4 rounded-lg bg-amber-500/10 text-center">
                <div className="text-2xl font-bold text-amber-500">{stats.pending}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="p-4 rounded-lg bg-green-500/10 text-center">
                <div className="text-2xl font-bold text-green-500">{stats.verified}</div>
                <div className="text-xs text-muted-foreground">Verified</div>
              </div>
              <div className="p-4 rounded-lg bg-red-500/10 text-center">
                <div className="text-2xl font-bold text-red-500">{stats.reported}</div>
                <div className="text-xs text-muted-foreground">Reported</div>
              </div>
            </div>
            
            {/* BO Summary Table */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Branch Office Summary</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Branch Office</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.entries(boStats).sort().map(([boName, data]) => (
                    <TableRow key={boName}>
                      <TableCell>{boName}</TableCell>
                      <TableCell className="text-right">{data.count}</TableCell>
                      <TableCell className="text-right font-semibold text-amber-500">{data.pending}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            
            {/* Aging Summary */}
            <div>
              <h3 className="font-semibold mb-3">Aging Analysis</h3>
              <div className="grid grid-cols-4 gap-4">
                <div className="p-3 rounded-lg bg-green-500/10 text-center">
                  <div className="text-xl font-bold text-green-500">{agingData.week1}</div>
                  <div className="text-xs text-muted-foreground">0-7 Days</div>
                </div>
                <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                  <div className="text-xl font-bold text-blue-500">{agingData.week2}</div>
                  <div className="text-xs text-muted-foreground">8-14 Days</div>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                  <div className="text-xl font-bold text-amber-500">{agingData.week3}</div>
                  <div className="text-xs text-muted-foreground">15-21 Days</div>
                </div>
                <div className="p-3 rounded-lg bg-red-500/10 text-center">
                  <div className="text-xl font-bold text-red-500">{agingData.older}</div>
                  <div className="text-xs text-muted-foreground">21+ Days</div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>Close</Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={exportToExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button onClick={exportToPDF}>
              <Download className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quarterly Report Due Alert */}
      {quarterlyAlert.show && (
        <Alert className="border-amber-500/50 bg-amber-500/10">
          <Bell className="h-5 w-5 text-amber-500" />
          <AlertTitle className="text-amber-600 dark:text-amber-400 font-semibold">
            Quarterly Report Due {quarterlyAlert.daysLeft === 0 ? 'Today' : `in ${quarterlyAlert.daysLeft} day${quarterlyAlert.daysLeft > 1 ? 's' : ''}`}!
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {quarterlyAlert.quarterLabel} report submission to Divisional Superintendent is due by {quarterlyAlert.dueDate}.
            </span>
            <Button 
              size="sm" 
              variant="outline" 
              className="ml-4 border-amber-500/50 hover:bg-amber-500/20"
              onClick={() => navigate('/reports')}
            >
              Generate Report
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
          <p className="text-muted-foreground mt-1">Overview of high-value withdrawal verifications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPreview(true)}>
            <Eye className="w-4 h-4 mr-2" />
            Preview & Export
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-primary/20 shadow-2xl hover:shadow-primary/20 transition-all duration-500 hover:-translate-y-2 hover:scale-105 group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/5 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Total Memos</CardTitle>
            <div className="p-3 rounded-xl bg-primary/20 group-hover:bg-primary/30 transition-all group-hover:rotate-12 group-hover:scale-110">
              <FileText className="h-6 w-6 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-2">All verification records</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-blue-500/20 shadow-2xl hover:shadow-blue-500/20 transition-all duration-500 hover:-translate-y-2 hover:scale-105 group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-blue-500/5 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">New</CardTitle>
            <div className="p-3 rounded-xl bg-blue-500/20 group-hover:bg-blue-500/30 transition-all group-hover:rotate-12 group-hover:scale-110">
              <FileText className="h-6 w-6 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold bg-gradient-to-br from-blue-500 to-blue-400 bg-clip-text text-transparent">{stats.new}</div>
            <p className="text-xs text-muted-foreground mt-2">Ready to print</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-amber-500/20 shadow-2xl hover:shadow-amber-500/20 transition-all duration-500 hover:-translate-y-2 hover:scale-105 group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-amber-500/5 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Pending</CardTitle>
            <div className="p-3 rounded-xl bg-amber-500/20 group-hover:bg-amber-500/30 transition-all group-hover:rotate-12 group-hover:scale-110">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold bg-gradient-to-br from-amber-500 to-amber-400 bg-clip-text text-transparent">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-2">Awaiting verification</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-green-500/20 shadow-2xl hover:shadow-green-500/20 transition-all duration-500 hover:-translate-y-2 hover:scale-105 group">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 via-green-500/5 to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-green-500/5 to-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-foreground">Verified</CardTitle>
            <div className="p-3 rounded-xl bg-green-500/20 group-hover:bg-green-500/30 transition-all group-hover:rotate-12 group-hover:scale-110">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-4xl font-bold bg-gradient-to-br from-green-500 to-green-400 bg-clip-text text-transparent">{stats.verified}</div>
            <p className="text-xs text-muted-foreground mt-2">Completed successfully</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="relative overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 border-primary/10">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary" />
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <CardTitle>Pending by Branch Office</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {Object.entries(boStats).map(([boName, data]) => (
                <div key={boName} className="relative group">
                  <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-muted/30 to-muted/50 hover:from-muted/50 hover:to-muted/70 transition-all duration-300 border border-border/50 hover:border-primary/30 hover:shadow-md">
                    <div className="flex-1">
                      <p className="text-sm font-semibold truncate text-foreground">{boName}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total: {data.count}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold bg-gradient-to-br from-amber-500 to-amber-600 bg-clip-text text-transparent">{data.pending}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden shadow-xl hover:shadow-2xl transition-all duration-300 border-primary/10">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-accent via-primary to-accent" />
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-accent/10">
                <Calendar className="h-5 w-5 text-accent" />
              </div>
              <CardTitle>Aging Analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="relative group overflow-hidden rounded-xl p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 hover:border-green-500/40 hover:shadow-lg hover:shadow-green-500/10 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">0-7 Days</p>
                    <p className="text-xs text-muted-foreground mt-1">Recent</p>
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-br from-green-500 to-green-600 bg-clip-text text-transparent">{agingData.week1}</p>
                </div>
              </div>
              <div className="relative group overflow-hidden rounded-xl p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">8-14 Days</p>
                    <p className="text-xs text-muted-foreground mt-1">Follow up soon</p>
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-br from-blue-500 to-blue-600 bg-clip-text text-transparent">{agingData.week2}</p>
                </div>
              </div>
              <div className="relative group overflow-hidden rounded-xl p-4 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">15-21 Days</p>
                    <p className="text-xs text-muted-foreground mt-1">Needs attention</p>
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-br from-amber-500 to-amber-600 bg-clip-text text-transparent">{agingData.week3}</p>
                </div>
              </div>
              <div className="relative group overflow-hidden rounded-xl p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 hover:border-red-500/40 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">21+ Days</p>
                    <p className="text-xs text-muted-foreground mt-1">Urgent</p>
                  </div>
                  <p className="text-3xl font-bold bg-gradient-to-br from-red-500 to-red-600 bg-clip-text text-transparent">{agingData.older}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="relative overflow-hidden shadow-xl border-primary/10">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary" />
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            System Status
          </CardTitle>
          <p className="text-sm text-muted-foreground">Last updated: {stats.lastUpdated}</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 hover:shadow-lg transition-all duration-300">
              <span className="text-sm font-semibold text-foreground">Database Status</span>
              <span className="text-sm font-bold text-green-500 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Online
              </span>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 hover:shadow-lg transition-all duration-300">
              <span className="text-sm font-semibold text-foreground">Reported Cases</span>
              <span className="text-sm font-bold text-red-500 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                {stats.reported} cases
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
