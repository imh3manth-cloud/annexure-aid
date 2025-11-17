import { useEffect, useState } from 'react';
import { db, MemoRecord } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Clock, CheckCircle2, AlertTriangle, TrendingUp, Calendar } from 'lucide-react';

export const Dashboard = () => {
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

  useEffect(() => {
    const loadStats = async () => {
      const memos = await db.memos.toArray();
      setStats({
        total: memos.length,
        new: memos.filter(m => m.status === 'New').length,
        pending: memos.filter(m => m.status === 'Pending').length,
        verified: memos.filter(m => m.status === 'Verified').length,
        reported: memos.filter(m => m.status === 'Reported').length,
        lastUpdated: new Date().toLocaleString()
      });
      
      // Calculate BO-wise stats
      const boData: Record<string, { count: number; pending: number }> = {};
      memos.forEach(memo => {
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
      memos.filter(m => m.status === 'Pending' && m.memo_sent_date).forEach(memo => {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Overview of high-value withdrawal verifications</p>
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
