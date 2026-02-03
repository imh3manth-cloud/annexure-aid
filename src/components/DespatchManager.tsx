import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db, MemoRecord } from '@/lib/db';
import { Trash2, Edit2, Check, X, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

interface DespatchManagerProps {
  onUpdate?: () => void;
}

export const DespatchManager = ({ onUpdate }: DespatchManagerProps) => {
  const [despatchedMemos, setDespatchedMemos] = useState<MemoRecord[]>([]);
  const [selected, setSelected] = useState<Set<string | number>>(new Set());
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editPostNo, setEditPostNo] = useState('');
  const [editDate, setEditDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchDespatchedMemos();
  }, []);

  const fetchDespatchedMemos = async () => {
    const allMemos = await db.memos.toArray();
    const withDespatch = allMemos.filter(m => m.remarks?.includes('Post No:'));
    setDespatchedMemos(withDespatch.sort((a, b) => b.serial - a.serial));
  };

  const extractDespatchInfo = (remarks: string | null) => {
    if (!remarks) return { postNo: '', date: '' };
    
    // Get the last despatch info entry
    const matches = remarks.match(/Post No:\s*([^,]+),\s*Despatch:\s*(\d{4}-\d{2}-\d{2})/g);
    if (!matches || matches.length === 0) return { postNo: '', date: '' };
    
    const lastMatch = matches[matches.length - 1];
    const postNoMatch = lastMatch.match(/Post No:\s*([^,]+)/);
    const dateMatch = lastMatch.match(/Despatch:\s*(\d{4}-\d{2}-\d{2})/);
    
    return {
      postNo: postNoMatch?.[1]?.trim() || '',
      date: dateMatch?.[1] || ''
    };
  };

  const removeDespatchInfo = (remarks: string | null) => {
    if (!remarks) return '';
    // Remove all despatch info patterns
    return remarks
      .replace(/;\s*Post No:[^;]*/g, '')
      .replace(/^Post No:[^;]*;?\s*/g, '')
      .replace(/Post No:[^;]*/g, '')
      .trim()
      .replace(/^;\s*/, '')
      .replace(/;\s*$/, '');
  };

  const handleStartEdit = (memo: MemoRecord) => {
    const info = extractDespatchInfo(memo.remarks);
    setEditingId(memo.id!);
    setEditPostNo(info.postNo);
    setEditDate(info.date);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditPostNo('');
    setEditDate('');
  };

  const handleSaveEdit = async (memo: MemoRecord) => {
    if (!editPostNo.trim() || !editDate) {
      toast({ title: 'Please fill all fields', variant: 'destructive' });
      return;
    }

    try {
      // Remove old despatch info and add new
      const cleanRemarks = removeDespatchInfo(memo.remarks);
      const newDespatchInfo = `Post No: ${editPostNo.trim()}, Despatch: ${editDate}`;
      const newRemarks = cleanRemarks ? `${cleanRemarks}; ${newDespatchInfo}` : newDespatchInfo;

      await db.memos.update(memo.id!, {
        memo_sent_date: editDate,
        remarks: newRemarks
      });

      toast({ title: 'Despatch details updated' });
      handleCancelEdit();
      await fetchDespatchedMemos();
      onUpdate?.();
    } catch (error: any) {
      toast({ title: 'Update failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleRemoveDespatch = async (memoIds: (string | number)[]) => {
    try {
      for (const id of memoIds) {
        const memo = despatchedMemos.find(m => m.id === id);
        if (!memo) continue;

        const cleanRemarks = removeDespatchInfo(memo.remarks);
        await db.memos.update(id, {
          memo_sent_date: null,
          remarks: cleanRemarks,
          printed: true // Keep as printed but remove despatch
        });
      }

      toast({ 
        title: 'Despatch details removed', 
        description: `Cleared despatch info from ${memoIds.length} memo(s)` 
      });
      setSelected(new Set());
      await fetchDespatchedMemos();
      onUpdate?.();
    } catch (error: any) {
      toast({ title: 'Remove failed', description: error.message, variant: 'destructive' });
    }
  };

  const toggleSelect = (id: string | number) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredMemos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredMemos.map(m => m.id!)));
    }
  };

  const filteredMemos = despatchedMemos.filter(memo => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      memo.serial.toString().includes(query) ||
      memo.account.toLowerCase().includes(query) ||
      memo.name.toLowerCase().includes(query) ||
      memo.remarks?.toLowerCase().includes(query)
    );
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (despatchedMemos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No memos with despatch details found
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by serial, account, name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        
        {selected.size > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="w-4 h-4 mr-2" />
                Remove ({selected.size})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove despatch details?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will clear the despatch information (post number and date) from {selected.size} memo(s). 
                  The memos will remain printed but will appear as pending despatch again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => handleRemoveDespatch(Array.from(selected))}>
                  Remove Details
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <ScrollArea className="h-64 border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={selected.size === filteredMemos.length && filteredMemos.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-20">Serial</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Post No.</TableHead>
              <TableHead>Despatch Date</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMemos.map((memo) => {
              const info = extractDespatchInfo(memo.remarks);
              const isEditing = editingId === memo.id;

              return (
                <TableRow key={memo.id}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(memo.id!)}
                      onCheckedChange={() => toggleSelect(memo.id!)}
                      disabled={isEditing}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{memo.serial}</TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{memo.account}</div>
                      <div className="text-muted-foreground text-xs">{memo.name}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={editPostNo}
                        onChange={(e) => setEditPostNo(e.target.value)}
                        className="h-8 w-32"
                        placeholder="Post number"
                      />
                    ) : (
                      <Badge variant="outline" className="font-mono">
                        {info.postNo}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        className="h-8 w-36"
                      />
                    ) : (
                      formatDate(info.date)
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-success"
                          onClick={() => handleSaveEdit(memo)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={handleCancelEdit}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleStartEdit(memo)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove despatch details?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Clear despatch info from memo #{memo.serial}? It will appear as pending despatch again.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleRemoveDespatch([memo.id!])}>
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>

      <p className="text-xs text-muted-foreground">
        {filteredMemos.length} memo(s) with despatch details
      </p>
    </div>
  );
};
