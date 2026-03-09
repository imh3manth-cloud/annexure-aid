import { useState, useEffect, useCallback } from 'react';
import { db, MemoRecord } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { FileText, Download, Sparkles, CheckCircle2, Clock, AlertTriangle, BarChart3 } from 'lucide-react';
import {
  generateMonthlyReportPDF,
  generateQuarterlyReportPDF,
  generateReminderPDF,
  generateOverdueReportPDF,
} from '@/lib/pdfGenerator';

type LetterFormat = 'monthly' | 'quarterly' | 'overdue' | 'reminder';

interface PeriodOption {
  value: string;
  label: string;
  recommended?: boolean;
}

interface PreviewStats {
  total: number;
  verified: number;
  pending: number;
  reported: number;
  totalAmount: number;
  boCount: number;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const getMonthPeriods = (): PeriodOption[] => {
  const options: PeriodOption[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: `${d.getFullYear()}-${d.getMonth()}`,
      label: `${monthNames[d.getMonth()]} ${d.getFullYear()}`,
      recommended: i === 1, // last completed month
    });
  }
  return options;
};

const getQuarterPeriods = (): PeriodOption[] => {
  const options: PeriodOption[] = [];
  const now = new Date();
  const seen = new Set<string>();

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (i * 3), 1);
    const month = d.getMonth();
    let qStart: Date, qEnd: Date, qLabel: string;

    if (month >= 0 && month <= 2) {
      qStart = new Date(d.getFullYear(), 0, 1);
      qEnd = new Date(d.getFullYear(), 2, 31);
      qLabel = `Q4 (Jan-Mar ${d.getFullYear()})`;
    } else if (month >= 3 && month <= 5) {
      qStart = new Date(d.getFullYear(), 3, 1);
      qEnd = new Date(d.getFullYear(), 5, 30);
      qLabel = `Q1 (Apr-Jun ${d.getFullYear()})`;
    } else if (month >= 6 && month <= 8) {
      qStart = new Date(d.getFullYear(), 6, 1);
      qEnd = new Date(d.getFullYear(), 8, 30);
      qLabel = `Q2 (Jul-Sep ${d.getFullYear()})`;
    } else {
      qStart = new Date(d.getFullYear(), 9, 1);
      qEnd = new Date(d.getFullYear(), 11, 31);
      qLabel = `Q3 (Oct-Dec ${d.getFullYear()})`;
    }

    const value = `${qStart.getFullYear()}-${qStart.getMonth()}-${qEnd.getMonth()}`;
    if (!seen.has(value)) {
      seen.add(value);
      options.push({ value, label: qLabel, recommended: options.length === 1 });
    }
  }
  return options;
};

const formatDescriptions: Record<LetterFormat, { title: string; description: string; icon: typeof FileText }> = {
  monthly: {
    title: 'Monthly Report to SPO',
    description: 'Prefilled formal letter with BO-wise summary and memo details addressed to Superintendent of Post Offices',
    icon: BarChart3,
  },
  quarterly: {
    title: 'Quarterly Verification Report',
    description: 'Quarterly verification summary report as per POSB CBS Manual (due 5th of Jan, Apr, Jul, Oct)',
    icon: CheckCircle2,
  },
  overdue: {
    title: 'Overdue Report to SPO',
    description: 'Report on overdue memos where reminders were sent but no replies received within prescribed time',
    icon: AlertTriangle,
  },
  reminder: {
    title: 'Reminder Letter to IP',
    description: 'Formal reminder letter addressed to Inspector of Posts for pending verification memos',
    icon: Clock,
  },
};

const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const SmartReportGenerator = () => {
  const [selectedFormat, setSelectedFormat] = useState<LetterFormat>('monthly');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [allMemos, setAllMemos] = useState<MemoRecord[]>([]);
  const [stats, setStats] = useState<PreviewStats | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  // Load all memos once
  useEffect(() => {
    db.memos.toArray().then(setAllMemos);
  }, []);

  // Get periods based on format
  const periods = selectedFormat === 'monthly' ? getMonthPeriods() :
    selectedFormat === 'quarterly' ? getQuarterPeriods() : [];

  // Auto-select recommended period when format changes
  useEffect(() => {
    if (selectedFormat === 'overdue' || selectedFormat === 'reminder') {
      setSelectedPeriod('all');
      return;
    }
    const recommended = periods.find(p => p.recommended);
    if (recommended) {
      setSelectedPeriod(recommended.value);
    } else if (periods.length > 0) {
      setSelectedPeriod(periods[0].value);
    }
  }, [selectedFormat]);

  // Compute preview stats when period changes
  const computeStats = useCallback(() => {
    if (allMemos.length === 0) return;

    let filtered: MemoRecord[];

    if (selectedFormat === 'overdue') {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
      filtered = allMemos.filter(m =>
        m.status === 'Pending' &&
        m.memo_sent_date &&
        new Date(m.memo_sent_date) <= cutoff
      );
    } else if (selectedFormat === 'reminder') {
      filtered = allMemos.filter(m => m.status === 'Pending');
    } else if (selectedFormat === 'monthly' && selectedPeriod) {
      const [year, month] = selectedPeriod.split('-').map(Number);
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0, 23, 59, 59);
      filtered = allMemos.filter(m => {
        const d = new Date(m.txn_date);
        return d >= start && d <= end;
      });
    } else if (selectedFormat === 'quarterly' && selectedPeriod) {
      const parts = selectedPeriod.split('-').map(Number);
      const start = new Date(parts[0], parts[1], 1);
      const end = new Date(parts[0], parts[2] + 1, 0, 23, 59, 59);
      filtered = allMemos.filter(m => {
        if (!m.memo_sent_date) return false;
        const d = new Date(m.memo_sent_date);
        return d >= start && d <= end;
      });
    } else {
      filtered = [];
    }

    const bos = new Set(filtered.map(m => m.BO_Name).filter(Boolean));
    setStats({
      total: filtered.length,
      verified: filtered.filter(m => m.status === 'Verified').length,
      pending: filtered.filter(m => m.status === 'Pending').length,
      reported: filtered.filter(m => m.status === 'Reported').length,
      totalAmount: filtered.reduce((sum, m) => sum + m.amount, 0),
      boCount: bos.size,
    });
  }, [allMemos, selectedFormat, selectedPeriod]);

  useEffect(() => {
    computeStats();
  }, [computeStats]);

  const generateReport = async () => {
    setIsGenerating(true);
    try {
      let doc;
      let filename: string;

      switch (selectedFormat) {
        case 'monthly': {
          const [year, month] = selectedPeriod.split('-').map(Number);
          doc = generateMonthlyReportPDF(allMemos, month, year);
          filename = `monthly_report_${monthNames[month]}_${year}.pdf`;
          break;
        }
        case 'quarterly': {
          const parts = selectedPeriod.split('-').map(Number);
          const start = new Date(parts[0], parts[1], 1);
          const end = new Date(parts[0], parts[2] + 1, 0);
          doc = generateQuarterlyReportPDF(allMemos, start, end);
          filename = `quarterly_report_${selectedPeriod}.pdf`;
          break;
        }
        case 'overdue': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - 30);
          const overdue = allMemos.filter(m =>
            m.status === 'Pending' &&
            m.memo_sent_date &&
            new Date(m.memo_sent_date) <= cutoff
          );
          doc = generateOverdueReportPDF(overdue);
          filename = `overdue_report_${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        }
        case 'reminder': {
          const pending = allMemos.filter(m => m.status === 'Pending');
          doc = generateReminderPDF(pending);
          filename = `reminder_letter_${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        }
        default:
          throw new Error('Unknown format');
      }

      doc.save(filename);
      toast({ title: 'Report Generated', description: `${formatDescriptions[selectedFormat].title} saved as ${filename}` });
    } catch (error: any) {
      toast({ title: 'Generation failed', description: error.message, variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  const needsPeriod = selectedFormat === 'monthly' || selectedFormat === 'quarterly';
  const FormatIcon = formatDescriptions[selectedFormat].icon;

  return (
    <Card className="relative overflow-hidden shadow-xl border-primary/10">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary" />
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          Smart Letter Generator
        </CardTitle>
        <CardDescription>
          Select a letter format, pick the period, preview stats, and generate a ready-to-print PDF with prefilled addresses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Format Selection */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {(Object.keys(formatDescriptions) as LetterFormat[]).map(fmt => {
            const Icon = formatDescriptions[fmt].icon;
            const isSelected = selectedFormat === fmt;
            return (
              <button
                key={fmt}
                onClick={() => setSelectedFormat(fmt)}
                className={`relative p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-md'
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                }`}
              >
                <Icon className={`h-5 w-5 mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="font-semibold text-sm text-foreground">{formatDescriptions[fmt].title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{formatDescriptions[fmt].description}</p>
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Period Selection */}
        {needsPeriod && (
          <div className="space-y-2">
            <Label>Select {selectedFormat === 'monthly' ? 'Month' : 'Quarter'}</Label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue placeholder={`Select ${selectedFormat === 'monthly' ? 'month' : 'quarter'}`} />
              </SelectTrigger>
              <SelectContent>
                {periods.map(p => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                    {p.recommended ? ' ⭐ Recommended' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {!needsPeriod && (
          <p className="text-sm text-muted-foreground bg-muted/50 px-4 py-3 rounded-lg">
            {selectedFormat === 'overdue'
              ? 'This report automatically includes all pending memos older than 30 days.'
              : 'This letter includes all currently pending verification memos.'}
          </p>
        )}

        {/* Data Preview Stats */}
        {stats && (
          <div className="bg-muted/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">Data Preview</span>
              {stats.total === 0 && (
                <Badge variant="secondary" className="text-xs">No data found</Badge>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="bg-background rounded-lg p-3 text-center border border-border">
                <p className="text-lg font-bold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Memos</p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center border border-border">
                <p className="text-lg font-bold text-green-600">{stats.verified}</p>
                <p className="text-xs text-muted-foreground">Verified</p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center border border-border">
                <p className="text-lg font-bold text-amber-600">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center border border-border">
                <p className="text-lg font-bold text-red-600">{stats.reported}</p>
                <p className="text-xs text-muted-foreground">Reported</p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center border border-border">
                <p className="text-lg font-bold text-foreground">₹{formatAmount(stats.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">Total Amount</p>
              </div>
              <div className="bg-background rounded-lg p-3 text-center border border-border">
                <p className="text-lg font-bold text-foreground">{stats.boCount}</p>
                <p className="text-xs text-muted-foreground">Branch Offices</p>
              </div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={generateReport}
          disabled={isGenerating || (stats?.total === 0)}
          className="w-full gap-2"
          size="lg"
        >
          <Download className="h-4 w-4" />
          {isGenerating ? 'Generating...' : `Generate ${formatDescriptions[selectedFormat].title} PDF`}
        </Button>
      </CardContent>
    </Card>
  );
};
