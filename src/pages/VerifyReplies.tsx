import { useEffect, useState } from 'react';
import { db, MemoRecord } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, Search } from 'lucide-react';

export const VerifyReplies = () => {
  const [pendingMemos, setPendingMemos] = useState<MemoRecord[]>([]);
  const [filteredMemos, setFilteredMemos] = useState<MemoRecord[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [verificationDate, setVerificationDate] = useState(new Date().toISOString().split('T')[0]);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    remarks: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    loadPendingMemos();
  }, []);

  useEffect(() => {
    if (pendingMemos.length > 0 && currentIndex < filteredMemos.length) {
      const memo = filteredMemos[currentIndex];
      setFormData({
        name: memo.name,
        address: memo.address,
        remarks: memo.remarks
      });
    }
  }, [currentIndex, filteredMemos, pendingMemos]);

  useEffect(() => {
    // Filter memos based on search query
    if (searchQuery.trim() === '') {
      setFilteredMemos(pendingMemos);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = pendingMemos.filter(memo => 
        String(memo.serial).includes(query) ||
        memo.account.toLowerCase().includes(query) ||
        memo.name.toLowerCase().includes(query)
      );
      setFilteredMemos(filtered);
      setCurrentIndex(0);
    }
  }, [searchQuery, pendingMemos]);

  const loadPendingMemos = async () => {
    const memos = await db.memos
      .where('status')
      .equals('Pending')
      .sortBy('BO_Code');
    setPendingMemos(memos);
    setFilteredMemos(memos);
    setCurrentIndex(0);
  };

  const currentMemo = filteredMemos[currentIndex];

  const handleVerified = async () => {
    if (!currentMemo) return;

    try {
      await db.memos.update(currentMemo.id!, {
        status: 'Verified',
        verified_date: verificationDate,
        name: formData.name,
        address: formData.address,
        remarks: formData.remarks
      });

      toast({ title: 'Marked as Verified' });
      
      // Move to next
      if (currentIndex < filteredMemos.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        loadPendingMemos();
      }
    } catch (error: any) {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    }
  };

  const handleReported = async () => {
    if (!currentMemo) return;

    try {
      await db.memos.update(currentMemo.id!, {
        status: 'Reported',
        reported_date: verificationDate,
        name: formData.name,
        address: formData.address,
        remarks: formData.remarks
      });

      toast({ title: 'Marked as Reported', variant: 'destructive' });
      
      // Move to next
      if (currentIndex < filteredMemos.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        loadPendingMemos();
      }
    } catch (error: any) {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    }
  };

  if (!currentMemo) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Verify Replies</h2>
          <p className="text-muted-foreground mt-1">Process verification responses</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-muted-foreground">No pending memos to verify</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Verify Replies</h2>
          <p className="text-muted-foreground mt-1">
            Processing memo {currentIndex + 1} of {filteredMemos.length}
            {searchQuery && ` (filtered from ${pendingMemos.length})`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Pending memos list with search */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Pending Memos</CardTitle>
            <div className="mt-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search memo # or account..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredMemos.map((memo, idx) => (
                <button
                  key={memo.id}
                  onClick={() => setCurrentIndex(idx)}
                  className={`w-full text-left p-3 rounded-lg border text-sm transition-colors ${
                    idx === currentIndex
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  <div className="font-medium">#{memo.serial}</div>
                  <div className="text-xs text-muted-foreground truncate">{memo.account}</div>
                  <div className="text-xs text-muted-foreground">{memo.BO_Name}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Right: Verification form */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Memo Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">Serial No</Label>
                <div className="font-bold text-lg">{currentMemo.serial}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Account No</Label>
                <div className="font-medium">{currentMemo.account}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Amount</Label>
                <div className="font-medium">₹{currentMemo.amount.toLocaleString('en-IN')}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Branch Office</Label>
                <div className="font-medium">{currentMemo.BO_Name}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Transaction Date</Label>
                <div className="font-medium">{currentMemo.txn_date}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Memo Sent Date</Label>
                <div className="font-medium">{currentMemo.memo_sent_date || 'N/A'}</div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verifyDate">Verification Date</Label>
                <Input
                  id="verifyDate"
                  type="date"
                  value={verificationDate}
                  onChange={(e) => setVerificationDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name (Editable)</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Address (Editable)</Label>
                <Textarea
                  id="address"
                  rows={3}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  rows={3}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Enter any additional remarks..."
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={handleVerified} className="flex-1 bg-success hover:bg-success/90">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Satisfactory / Verified
              </Button>
              <Button onClick={handleReported} variant="destructive" className="flex-1">
                <XCircle className="w-4 h-4 mr-2" />
                Not Satisfactory / Reported
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
