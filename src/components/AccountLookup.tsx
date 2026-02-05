import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  getAllLastBalanceRecords,
  getAllMemos,
  getAllHFTITransactions,
  LastBalanceRecord, 
  MemoRecord, 
  HFTITransactionRecord 
} from '@/lib/db';
import {
  Search,
  User,
  MapPin,
  Building2,
  Wallet,
  CalendarDays,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface AccountLookupData {
  balance: LastBalanceRecord | null;
  memos: MemoRecord[];
  hftiTransactions: HFTITransactionRecord[];
}

export function AccountLookup() {
  const [accountQuery, setAccountQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [data, setData] = useState<AccountLookupData | null>(null);

  const normalizeAccount = (acc: string) => acc.replace(/\D/g, '').replace(/^0+/, '') || '0';

  const handleSearch = async () => {
    let query = accountQuery.trim();
    if (!query) return;

    setLoading(true);
    setSearched(true);

    try {
      const normalizedQuery = normalizeAccount(query);
      
      // Get all records and filter client-side for flexible matching
      const [balanceRecords, memoRecords, hftiRecords] = await Promise.all([
        getAllLastBalanceRecords(),
        getAllMemos(),
        getAllHFTITransactions()
      ]);

      // Find matching balance record
      const balanceRecord = balanceRecords.find(r => 
        normalizeAccount(r.account) === normalizedQuery
      );

      // Find matching memos
      const matchingMemos = memoRecords.filter(m => 
        normalizeAccount(m.account) === normalizedQuery
      );

      // Find matching HFTI transactions
      const matchingHfti = hftiRecords.filter(t => 
        normalizeAccount(t.account) === normalizedQuery
      );

      setData({
        balance: balanceRecord || null,
        memos: matchingMemos,
        hftiTransactions: matchingHfti,
      });
    } catch (error) {
      console.error('Search failed:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'New':
        return <Clock className="h-4 w-4" />;
      case 'Pending':
        return <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />;
      case 'Verified':
        return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />;
      case 'Reported':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusBadgeVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'Verified':
        return 'default';
      case 'Reported':
        return 'destructive';
      case 'Pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const memoStats = data?.memos ? {
    total: data.memos.length,
    highValue: data.memos.filter(m => m.amount >= 10000).length,
    verified: data.memos.filter(m => m.status === 'Verified').length,
    pending: data.memos.filter(m => m.status === 'Pending').length,
  } : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Account Lookup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search Input */}
        <div className="flex gap-2">
          <Input
            placeholder="Enter account number..."
            value={accountQuery}
            onChange={(e) => setAccountQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button onClick={handleSearch} disabled={loading || !accountQuery.trim()}>
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {/* Results */}
        {searched && !loading && (
          <>
            {!data?.balance && data?.memos.length === 0 && data?.hftiTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No records found for this account number.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Account Details from Last Balance */}
                {data?.balance && (
                  <div className="space-y-4">
                    <h3 className="font-semibold text-lg">Account Details</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <User className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Name</p>
                          <p className="font-medium">{data.balance.name}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <MapPin className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Address</p>
                          <p className="font-medium">{data.balance.address || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <Wallet className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Balance</p>
                          <p className="font-medium">₹{data.balance.balance.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <CalendarDays className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">Balance Date</p>
                          <p className="font-medium">{data.balance.balance_date || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                        <Building2 className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">BO / Scheme</p>
                          <p className="font-medium">
                            {data.balance.bo_name || 'N/A'} 
                            {data.balance.scheme_type && (
                              <Badge variant="secondary" className="ml-2">{data.balance.scheme_type}</Badge>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Memos */}
                {data?.memos && data.memos.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">Memos ({data.memos.length})</h3>
                        {memoStats && (
                          <div className="flex gap-2">
                            {memoStats.verified > 0 && (
                              <Badge variant="default">{memoStats.verified} Verified</Badge>
                            )}
                            {memoStats.pending > 0 && (
                              <Badge variant="secondary">{memoStats.pending} Pending</Badge>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        {data.memos.map((memo) => (
                          <div key={memo.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div className="flex items-center gap-3">
                              {getStatusIcon(memo.status)}
                              <div>
                                <p className="font-medium">
                                  Memo #{memo.serial} - ₹{memo.amount.toLocaleString()}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {memo.txn_date} • {memo.BO_Name || 'Unknown BO'}
                                </p>
                              </div>
                            </div>
                            <Badge variant={getStatusBadgeVariant(memo.status)}>
                              {memo.status}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* HFTI Transactions */}
                {data?.hftiTransactions && data.hftiTransactions.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">
                        HFTI Transactions ({data.hftiTransactions.length})
                      </h3>
                      <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {data.hftiTransactions.slice(0, 20).map((txn) => (
                          <div key={txn.id} className="flex items-center justify-between p-3 rounded-lg border">
                            <div>
                              <p className="font-medium">
                                {txn.debit_credit === 'D' ? 'Debit' : 'Credit'} - ₹{txn.amount.toLocaleString()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {txn.txn_date} • {txn.particulars?.slice(0, 50) || 'N/A'}
                              </p>
                            </div>
                            <Badge variant={txn.debit_credit === 'D' ? 'destructive' : 'default'}>
                              {txn.debit_credit === 'D' ? 'DR' : 'CR'}
                            </Badge>
                          </div>
                        ))}
                        {data.hftiTransactions.length > 20 && (
                          <p className="text-sm text-muted-foreground text-center py-2">
                            Showing first 20 of {data.hftiTransactions.length} transactions
                          </p>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
