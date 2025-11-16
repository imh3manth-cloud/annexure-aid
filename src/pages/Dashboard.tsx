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
        <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Memos</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-primary">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-2">All verification records</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-blue-500/20 bg-gradient-to-br from-card via-card to-blue-500/5 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500/10">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-blue-500">{stats.new}</div>
            <p className="text-xs text-muted-foreground mt-2">Ready to print</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-amber-500/20 bg-gradient-to-br from-card via-card to-amber-500/5 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-5 w-5 text-amber-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-amber-500">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-2">Awaiting verification</p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden border-green-500/20 bg-gradient-to-br from-card via-card to-green-500/5 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent" />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <div className="p-2 rounded-lg bg-green-500/10">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
          </CardHeader>
          <CardContent className="relative">
            <div className="text-3xl font-bold text-green-500">{stats.verified}</div>
            <p className="text-xs text-muted-foreground mt-2">Completed successfully</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle>Pending by Branch Office</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {Object.entries(boStats).map(([boName, data]) => (
                <div key={boName} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                  <div className="flex-1">
                    <p className="text-sm font-medium truncate">{boName}</p>
                    <p className="text-xs text-muted-foreground">Total: {data.count}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-amber-500">{data.pending}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-md hover:shadow-lg transition-shadow">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <CardTitle>Aging Analysis</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                <div>
                  <p className="text-sm font-medium">0-7 Days</p>
                  <p className="text-xs text-muted-foreground">Recent</p>
                </div>
                <p className="text-2xl font-bold text-green-500">{agingData.week1}</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10">
                <div>
                  <p className="text-sm font-medium">8-14 Days</p>
                  <p className="text-xs text-muted-foreground">Follow up soon</p>
                </div>
                <p className="text-2xl font-bold text-blue-500">{agingData.week2}</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-500/10">
                <div>
                  <p className="text-sm font-medium">15-21 Days</p>
                  <p className="text-xs text-muted-foreground">Needs attention</p>
                </div>
                <p className="text-2xl font-bold text-amber-500">{agingData.week3}</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                <div>
                  <p className="text-sm font-medium">21+ Days</p>
                  <p className="text-xs text-muted-foreground">Urgent</p>
                </div>
                <p className="text-2xl font-bold text-red-500">{agingData.older}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <p className="text-sm text-muted-foreground">Last updated: {stats.lastUpdated}</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
              <span className="text-sm font-medium">Database Status</span>
              <span className="text-sm text-green-500 flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Online
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
              <span className="text-sm font-medium">Reported Cases</span>
              <span className="text-sm text-red-500 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1" />
                {stats.reported} cases
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
