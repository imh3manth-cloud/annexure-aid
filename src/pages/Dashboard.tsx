import { useEffect, useState } from 'react';
import { db, MemoRecord } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Clock, CheckCircle2, AlertTriangle } from 'lucide-react';

export const Dashboard = () => {
  const [stats, setStats] = useState({
    total: 0,
    new: 0,
    pending: 0,
    verified: 0,
    reported: 0,
    lastUpdated: new Date().toLocaleString()
  });

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
    };

    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground mt-1">Overview of high-value withdrawal verifications</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Memos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">All verification records</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.new}</div>
            <p className="text-xs text-muted-foreground mt-1">Ready to print</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.pending}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting verification</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.verified}</div>
            <p className="text-xs text-muted-foreground mt-1">Completed successfully</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Last updated: {stats.lastUpdated}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Database Status</span>
              <span className="text-sm text-success flex items-center">
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Online
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Reported Cases</span>
              <span className="text-sm text-destructive flex items-center">
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
