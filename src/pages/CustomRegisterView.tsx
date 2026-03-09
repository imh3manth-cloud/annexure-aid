import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Trash2, Edit2, Check, X, Upload, Download, Settings2, Wand2 } from 'lucide-react';
import {
  getRegister, updateRegister, getRegisterRows, addRegisterRow,
  updateRegisterRow, deleteRegisterRow, bulkAddRegisterRows, clearRegisterRows,
  CustomRegister, CustomRegisterRow, ColumnDef
} from '@/lib/customRegisterDb';
import { getAllMemos, getAllLastBalanceRecords, getAllHFTITransactions } from '@/lib/db';
import Papa from 'papaparse';

export const CustomRegisterView = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [register, setRegister] = useState<CustomRegister | null>(null);
  const [rows, setRows] = useState<CustomRegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddRow, setShowAddRow] = useState(false);
  const [showColumnEditor, setShowColumnEditor] = useState(false);
  const [showAutoFill, setShowAutoFill] = useState(false);
  const [newRowData, setNewRowData] = useState<Record<string, any>>({});
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editRowData, setEditRowData] = useState<Record<string, any>>({});
  const [editColumns, setEditColumns] = useState<ColumnDef[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [reg, regRows] = await Promise.all([getRegister(id), getRegisterRows(id)]);
      setRegister(reg);
      setRows(regRows);
    } catch (e: any) {
      toast({ title: 'Failed to load', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!register) return <div className="text-center py-16 text-muted-foreground">Register not found</div>;

  const columns = register.columns;

  // ========== Row Operations ==========
  const handleAddRow = async () => {
    try {
      await addRegisterRow(id!, newRowData, rows.length);
      setNewRowData({});
      setShowAddRow(false);
      toast({ title: 'Row added' });
      await load();
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleStartEdit = (row: CustomRegisterRow) => {
    setEditingRowId(row.id);
    setEditRowData({ ...row.row_data });
  };

  const handleSaveEdit = async (rowId: string) => {
    try {
      await updateRegisterRow(rowId, editRowData);
      setEditingRowId(null);
      toast({ title: 'Row updated' });
      await load();
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    }
  };

  const handleDeleteRow = async (rowId: string) => {
    try {
      await deleteRegisterRow(rowId);
      toast({ title: 'Row deleted' });
      await load();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  // ========== CSV Upload ==========
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (!results.data || results.data.length === 0) {
          toast({ title: 'No data found in CSV', variant: 'destructive' });
          return;
        }

        try {
          // Map CSV columns to register columns by matching labels or keys
          const csvHeaders = Object.keys(results.data[0] as any);
          const mappedRows = (results.data as Record<string, any>[]).map(csvRow => {
            const rowData: Record<string, any> = {};
            for (const col of columns) {
              // Try exact label match, then key match, then case-insensitive match
              const matchedHeader = csvHeaders.find(h =>
                h === col.label || h === col.key ||
                h.toLowerCase() === col.label.toLowerCase() ||
                h.toLowerCase() === col.key.toLowerCase()
              );
              if (matchedHeader) {
                let val = csvRow[matchedHeader];
                if (col.type === 'number' && val) val = parseFloat(String(val).replace(/[^0-9.-]/g, '')) || 0;
                rowData[col.key] = val;
              }
            }
            return rowData;
          });

          const count = await bulkAddRegisterRows(id!, mappedRows);
          toast({ title: `${count} rows imported from CSV` });
          await load();
        } catch (err: any) {
          toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
        }
      }
    });

    e.target.value = '';
  };

  // ========== CSV Export ==========
  const handleExport = () => {
    const csvData = rows.map(r => {
      const row: Record<string, any> = {};
      columns.forEach(col => { row[col.label] = r.row_data[col.key] ?? ''; });
      return row;
    });
    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${register.name.replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ========== Auto-Fill from Data ==========
  const handleAutoFill = async (source: string) => {
    try {
      let importRows: Record<string, any>[] = [];

      if (source === 'memos') {
        const memos = await getAllMemos();
        importRows = memos.map((m, i) => {
          const row: Record<string, any> = {};
          columns.forEach(col => {
            const key = col.key.toLowerCase();
            if (key.includes('sl') || key.includes('serial')) row[col.key] = m.serial;
            else if (key.includes('account')) row[col.key] = m.account;
            else if (key.includes('name')) row[col.key] = m.name;
            else if (key.includes('amount')) row[col.key] = m.amount;
            else if (key.includes('date') && key.includes('txn')) row[col.key] = m.txn_date;
            else if (key.includes('bo')) row[col.key] = m.BO_Name;
            else if (key.includes('status') || key.includes('verification')) row[col.key] = m.status;
            else if (key.includes('txn_id') || key.includes('transaction')) row[col.key] = m.txn_id;
            else if (key.includes('remark')) row[col.key] = m.remarks;
          });
          return row;
        });
      } else if (source === 'balance') {
        const records = await getAllLastBalanceRecords();
        importRows = records.map((r, i) => {
          const row: Record<string, any> = {};
          columns.forEach(col => {
            const key = col.key.toLowerCase();
            if (key.includes('sl')) row[col.key] = i + 1;
            else if (key.includes('account')) row[col.key] = r.account;
            else if (key.includes('name')) row[col.key] = r.name;
            else if (key.includes('balance')) row[col.key] = r.balance;
            else if (key.includes('scheme')) row[col.key] = r.scheme_type;
            else if (key.includes('bo')) row[col.key] = r.bo_name;
            else if (key.includes('address')) row[col.key] = r.address;
            else if (key.includes('date')) row[col.key] = r.balance_date;
          });
          return row;
        });
      } else if (source === 'hfti') {
        const txns = await getAllHFTITransactions();
        importRows = txns.map((t, i) => {
          const row: Record<string, any> = {};
          columns.forEach(col => {
            const key = col.key.toLowerCase();
            if (key.includes('sl')) row[col.key] = i + 1;
            else if (key.includes('account')) row[col.key] = t.account;
            else if (key.includes('amount')) row[col.key] = t.amount;
            else if (key.includes('date')) row[col.key] = t.txn_date;
            else if (key.includes('txn_id') || key.includes('transaction')) row[col.key] = t.txn_id;
            else if (key.includes('bo')) row[col.key] = t.bo_reference;
            else if (key.includes('particular')) row[col.key] = t.particulars;
          });
          return row;
        });
      }

      if (importRows.length === 0) {
        toast({ title: 'No data found from this source', variant: 'destructive' });
        return;
      }

      const count = await bulkAddRegisterRows(id!, importRows);
      toast({ title: `${count} rows auto-filled from ${source}` });
      setShowAutoFill(false);
      await load();
    } catch (e: any) {
      toast({ title: 'Auto-fill failed', description: e.message, variant: 'destructive' });
    }
  };

  // ========== Column Editor ==========
  const handleOpenColumnEditor = () => {
    setEditColumns(columns.map(c => ({ ...c })));
    setShowColumnEditor(true);
  };

  const handleSaveColumns = async () => {
    try {
      await updateRegister(id!, { columns: editColumns });
      toast({ title: 'Columns updated' });
      setShowColumnEditor(false);
      await load();
    } catch (e: any) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    }
  };

  const addColumn = () => {
    const key = `col_${Date.now()}`;
    setEditColumns([...editColumns, { key, label: 'New Column', type: 'text' }]);
  };

  const removeColumn = (idx: number) => {
    setEditColumns(editColumns.filter((_, i) => i !== idx));
  };

  const updateColumn = (idx: number, field: keyof ColumnDef, value: any) => {
    const updated = [...editColumns];
    (updated[idx] as any)[field] = value;
    setEditColumns(updated);
  };

  // ========== Filter ==========
  const filteredRows = rows.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return Object.values(r.row_data).some(v => String(v || '').toLowerCase().includes(q));
  });

  // ========== Cell Renderer ==========
  const renderCell = (col: ColumnDef, value: any, isEdit: boolean, onChange: (v: any) => void) => {
    if (!isEdit) {
      if (col.type === 'number' && value != null) return <span className="font-mono">{Number(value).toLocaleString('en-IN')}</span>;
      if (col.type === 'date' && value) return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return String(value ?? '');
    }

    if (col.type === 'select' && col.options) {
      return (
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger className="h-8 w-full min-w-[100px]"><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            {col.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        type={col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'}
        value={value ?? ''}
        onChange={e => onChange(col.type === 'number' ? (e.target.value ? Number(e.target.value) : '') : e.target.value)}
        className="h-8 min-w-[80px]"
      />
    );
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/custom-registers')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <div>
            <h2 className="text-xl font-bold text-foreground">{register.name}</h2>
            <p className="text-muted-foreground text-xs">{register.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleOpenColumnEditor}>
            <Settings2 className="w-4 h-4 mr-1" /> Columns
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAutoFill(true)}>
            <Wand2 className="w-4 h-4 mr-1" /> Auto-Fill
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" /> Import CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <Button size="sm" onClick={() => { setNewRowData({}); setShowAddRow(true); }}>
            <Plus className="w-4 h-4 mr-1" /> Add Row
          </Button>
        </div>
      </div>

      {/* Search */}
      <Input placeholder="Search rows..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="max-w-sm" />

      {/* Stats */}
      <div className="flex gap-2 text-sm">
        <Badge variant="secondary">{rows.length} rows</Badge>
        <Badge variant="outline">{columns.length} columns</Badge>
      </div>

      {/* Table */}
      <ScrollArea className="border rounded-lg" style={{ maxHeight: 'calc(100vh - 320px)' }}>
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead key={col.key} className="whitespace-nowrap">
                  {col.label}
                  {col.required && <span className="text-destructive ml-0.5">*</span>}
                </TableHead>
              ))}
              <TableHead className="w-20 sticky right-0 bg-background">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">
                  No rows yet. Add manually, import CSV, or auto-fill from existing data.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map(row => {
                const isEdit = editingRowId === row.id;
                return (
                  <TableRow key={row.id}>
                    {columns.map(col => (
                      <TableCell key={col.key} className="py-1.5">
                        {renderCell(
                          col,
                          isEdit ? editRowData[col.key] : row.row_data[col.key],
                          isEdit,
                          (v) => setEditRowData({ ...editRowData, [col.key]: v })
                        )}
                      </TableCell>
                    ))}
                    <TableCell className="py-1.5 sticky right-0 bg-background">
                      {isEdit ? (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleSaveEdit(row.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRowId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(row)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteRow(row.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </ScrollArea>

      {/* Clear All */}
      {rows.length > 0 && (
        <div className="flex justify-end">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive">
                <Trash2 className="w-4 h-4 mr-1" /> Clear All Rows
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear all rows?</AlertDialogTitle>
                <AlertDialogDescription>This will permanently delete all {rows.length} rows from this register.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={async () => { await clearRegisterRows(id!); toast({ title: 'All rows cleared' }); await load(); }}>
                  Clear All
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      {/* Add Row Dialog */}
      <Dialog open={showAddRow} onOpenChange={setShowAddRow}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Row</DialogTitle>
            <DialogDescription>Enter data for each column</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {columns.map(col => (
              <div key={col.key} className="space-y-1">
                <Label className="text-sm">{col.label} {col.required && <span className="text-destructive">*</span>}</Label>
                {renderCell(col, newRowData[col.key], true, (v) => setNewRowData({ ...newRowData, [col.key]: v }))}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRow(false)}>Cancel</Button>
            <Button onClick={handleAddRow}>Add Row</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Column Editor Dialog */}
      <Dialog open={showColumnEditor} onOpenChange={setShowColumnEditor}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Columns</DialogTitle>
            <DialogDescription>Add, remove, or rename columns. Existing data won't be lost.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {editColumns.map((col, idx) => (
              <div key={idx} className="flex items-end gap-2 p-2 border rounded-lg">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Label</Label>
                  <Input value={col.label} onChange={e => updateColumn(idx, 'label', e.target.value)} className="h-8" />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={col.type} onValueChange={v => updateColumn(idx, 'type', v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="select">Select</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {col.type === 'select' && (
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Options (comma-separated)</Label>
                    <Input value={(col.options || []).join(', ')} onChange={e => updateColumn(idx, 'options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} className="h-8" />
                  </div>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeColumn(idx)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addColumn} className="w-full">
              <Plus className="w-4 h-4 mr-1" /> Add Column
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowColumnEditor(false)}>Cancel</Button>
            <Button onClick={handleSaveColumns}>Save Columns</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Fill Dialog */}
      <Dialog open={showAutoFill} onOpenChange={setShowAutoFill}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Auto-Fill from Existing Data</DialogTitle>
            <DialogDescription>Import data from your existing registers. Columns are matched automatically by name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={() => handleAutoFill('memos')}>
              <div className="text-left">
                <div className="font-medium">Memo Register</div>
                <div className="text-xs text-muted-foreground">Account, Name, Amount, BO, Status, etc.</div>
              </div>
            </Button>
            <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={() => handleAutoFill('balance')}>
              <div className="text-left">
                <div className="font-medium">Balance Records</div>
                <div className="text-xs text-muted-foreground">Account, Name, Balance, Scheme, Address, etc.</div>
              </div>
            </Button>
            <Button variant="outline" className="w-full justify-start h-auto py-3" onClick={() => handleAutoFill('hfti')}>
              <div className="text-left">
                <div className="font-medium">HFTI Transactions</div>
                <div className="text-xs text-muted-foreground">Account, Amount, Date, Transaction ID, etc.</div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
