import { useNavigate } from 'react-router-dom';
import { menuItems } from '@/components/Layout';
import { useEffect, useState } from 'react';
import { db } from '@/lib/db';
import { Badge } from '@/components/ui/badge';

interface PendingCounts {
  upload: number;
  register: number;
  verify: number;
  reminders: number;
  reports: number;
}

export const Operations = () => {
  const navigate = useNavigate();
  const [counts, setCounts] = useState<PendingCounts>({
    upload: 0,
    register: 0,
    verify: 0,
    reminders: 0,
    reports: 0
  });

  useEffect(() => {
    const loadCounts = async () => {
      const allMemos = await db.memos.toArray();
      
      // New memos not yet printed
      const newMemos = allMemos.filter(m => m.status === 'New' && !m.printed);
      
      // Printed but pending verification
      const pendingVerify = allMemos.filter(m => m.status === 'Pending');
      
      // Memos that need reminders (pending > 15 days old)
      const today = new Date();
      const remindersNeeded = allMemos.filter(m => {
        if (m.status !== 'Pending') return false;
        const sentDate = m.memo_sent_date ? new Date(m.memo_sent_date) : null;
        if (!sentDate) return false;
        const daysSinceSent = Math.floor((today.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24));
        return daysSinceSent > 15;
      });

      setCounts({
        upload: 0, // Upload doesn't have pending items
        register: newMemos.length,
        verify: pendingVerify.length,
        reminders: remindersNeeded.length,
        reports: 0 // Reports doesn't have pending items
      });
    };

    loadCounts();
  }, []);

  const getCountForRoute = (route: string): number => {
    switch (route) {
      case '/upload': return counts.upload;
      case '/register': return counts.register;
      case '/verify': return counts.verify;
      case '/reminders': return counts.reminders;
      case '/reports': return counts.reports;
      default: return 0;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Operations</h2>
          <p className="text-muted-foreground mt-1">Select an operation to proceed</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {menuItems.map((item) => {
          const count = getCountForRoute(item.to);
          return (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className={`relative overflow-hidden rounded-xl p-6 text-white bg-gradient-to-r ${item.color} 
                transition-all duration-300 transform hover:scale-105 hover:shadow-2xl hover:-translate-y-1
                group cursor-pointer text-left`}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              
              {count > 0 && (
                <Badge 
                  className="absolute top-3 right-3 bg-white text-gray-800 font-bold px-2.5 py-1 text-sm shadow-lg"
                >
                  {count}
                </Badge>
              )}
              
              <div className="relative flex items-center gap-4">
                <div className="p-3 bg-white/20 rounded-full group-hover:scale-110 transition-transform">
                  <item.icon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">{item.label}</h3>
                  <p className="text-sm text-white/80">{item.description}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
