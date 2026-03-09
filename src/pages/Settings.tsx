import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { supabase } from '@/integrations/supabase/client';
import { Download, Upload, Trash2, Save, RotateCcw, Building2, Pencil, MapPin } from 'lucide-react';
import { getConfig, DEFAULT_CONFIG, type AppConfig, type OfficeAddress } from '@/lib/config';
import { AddressCardDialog } from '@/components/AddressCardDialog';

const DEFAULT_ADDRESS: OfficeAddress = { name: '', line1: '', line2: '', city: '', pincode: '' };

export const Settings = () => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [boMappingsText, setBoMappingsText] = useState('');
  const [officeDialogOpen, setOfficeDialogOpen] = useState(false);
  const [boDialogOpen, setBoDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = () => {
    const saved = localStorage.getItem('appConfig');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          setConfig({ ...DEFAULT_CONFIG, ...parsed });
          setBoMappingsText(formatBOMappings(parsed.boMappings || DEFAULT_CONFIG.boMappings));
        } else {
          setBoMappingsText(formatBOMappings(DEFAULT_CONFIG.boMappings));
        }
      } catch (e) {
        console.error('Failed to parse saved config:', e);
        localStorage.removeItem('appConfig');
        setBoMappingsText(formatBOMappings(DEFAULT_CONFIG.boMappings));
      }
    } else {
      setBoMappingsText(formatBOMappings(DEFAULT_CONFIG.boMappings));
    }
  };

  const formatBOMappings = (mappings: Record<string, string>) =>
    Object.entries(mappings).map(([code, name]) => `BO2130911100${code}=${name}`).join('\n');

  const parseBOMappings = (text: string): Record<string, string> => {
    const mappings: Record<string, string> = {};
    text.split('\n').forEach(line => {
      const [code, name] = line.split('=').map(s => s.trim());
      if (code && name) {
        const match = code.match(/BO\d+(\d)$/);
        mappings[match ? match[1] : code] = name;
      }
    });
    return mappings;
  };

  const saveConfig = (updated: AppConfig) => {
    const final = { ...updated, boMappings: parseBOMappings(boMappingsText) };
    localStorage.setItem('appConfig', JSON.stringify(final));
    setConfig(final);
    window.dispatchEvent(new Event('configUpdated'));
    toast({ title: 'Settings saved successfully' });
  };

  const handleSave = () => saveConfig(config);

  const handleAddressSave = (key: 'subOfficeAddress' | 'ipOfficeAddress' | 'spoOfficeAddress', addr: OfficeAddress) => {
    const updated = { ...config, [key]: addr };
    setConfig(updated);
    saveConfig(updated);
  };

  const handleAddressClear = (key: 'subOfficeAddress' | 'ipOfficeAddress' | 'spoOfficeAddress') => {
    const updated = { ...config, [key]: DEFAULT_ADDRESS };
    setConfig(updated);
    saveConfig(updated);
  };

  const handleBackup = async () => {
    try {
      const memos = await db.memos.toArray();
      const settings = await db.settings.toArray();
      const backup = { version: 1, timestamp: new Date().toISOString(), config, memos, settings };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `memo-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Backup created successfully' });
    } catch (error: any) {
      toast({ title: 'Backup failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleRestore = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      try {
        const file = e.target.files[0];
        if (!file) return;
        const text = await file.text();
        let backup: any;
        try { backup = JSON.parse(text); } catch {
          toast({ title: 'Restore failed', description: 'Invalid JSON file format', variant: 'destructive' });
          return;
        }
        if (!backup || typeof backup !== 'object') {
          toast({ title: 'Restore failed', description: 'Invalid backup file format', variant: 'destructive' });
          return;
        }
        if (backup.config && typeof backup.config === 'object') {
          const safeConfig = { ...DEFAULT_CONFIG, ...backup.config };
          localStorage.setItem('appConfig', JSON.stringify(safeConfig));
          setConfig(safeConfig);
          setBoMappingsText(formatBOMappings(safeConfig.boMappings || DEFAULT_CONFIG.boMappings));
        }
        if (backup.memos && Array.isArray(backup.memos)) {
          await db.memos.clear();
          await db.memos.bulkAdd(backup.memos);
        }
        if (backup.settings && Array.isArray(backup.settings)) {
          await db.settings.clear();
          await db.settings.bulkAdd(backup.settings);
        }
        toast({ title: 'Restore completed successfully' });
      } catch (error: any) {
        toast({ title: 'Restore failed', description: error.message, variant: 'destructive' });
      }
    };
    input.click();
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all data? This cannot be undone.')) return;
    try {
      await db.memos.clear();
      await db.settings.clear();
      localStorage.removeItem('appConfig');
      setConfig(DEFAULT_CONFIG);
      setBoMappingsText(formatBOMappings(DEFAULT_CONFIG.boMappings));
      toast({ title: 'All data reset successfully' });
    } catch (error: any) {
      toast({ title: 'Reset failed', description: error.message, variant: 'destructive' });
    }
  };

  const handleResetReminders = async () => {
    if (!confirm('This will reset reminder counts and reported status on all pending/reported memos, so you can start fresh with Reminder 1 to IP. Continue?')) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: 'Not authenticated', variant: 'destructive' }); return; }

      const { error: err1 } = await supabase.from('memos').update({ reminder_count: 0, last_reminder_date: null, remarks: '' }).eq('user_id', user.id).in('status', ['Pending', 'Reported']);
      if (err1) throw err1;
      const { error: err2 } = await supabase.from('memos').update({ status: 'Pending', reported_date: null }).eq('user_id', user.id).eq('status', 'Reported');
      if (err2) throw err2;
      const { error: err3 } = await supabase.from('reminder_history').delete().eq('user_id', user.id);
      if (err3) throw err3;

      toast({ title: 'Reminders reset successfully. You can now generate Reminder 1 to IP.' });
    } catch (error: any) {
      toast({ title: 'Reset failed', description: error.message, variant: 'destructive' });
    }
  };

  const boCount = Object.keys(config.boMappings || {}).length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground">Configure your office details, addresses, and manage data</p>
      </div>

      {/* Office Configuration - compact summary card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Office Configuration</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {config.officeName} · {config.subdivision}
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setOfficeDialogOpen(true)}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Office Config Dialog */}
      <Dialog open={officeDialogOpen} onOpenChange={setOfficeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Office Configuration</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Office Name</Label>
              <Input value={config.officeName} onChange={(e) => setConfig({ ...config, officeName: e.target.value })} placeholder="e.g., OLD SOSALE S.O" />
            </div>
            <div className="space-y-1">
              <Label>Subdivision (for reminders to IP)</Label>
              <Input value={config.subdivision} onChange={(e) => setConfig({ ...config, subdivision: e.target.value })} placeholder="e.g., T NARASIPURA SUB DIVISION" />
            </div>
            <div className="space-y-1">
              <Label>Division (for reports to SP)</Label>
              <Input value={config.division || ''} onChange={(e) => setConfig({ ...config, division: e.target.value })} placeholder="e.g., MYSORE DIVISION" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOfficeDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { handleSave(); setOfficeDialogOpen(false); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* BO Mappings - compact card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/50">
                <MapPin className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <CardTitle className="text-base">Branch Office Mappings</CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {boCount} branch office{boCount !== 1 ? 's' : ''} configured
                </CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setBoMappingsText(formatBOMappings(config.boMappings || {})); setBoDialogOpen(true); }}>
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* BO Mappings Dialog */}
      <Dialog open={boDialogOpen} onOpenChange={setBoDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Branch Office Code Mappings</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm text-muted-foreground">
              One mapping per line: <code className="text-xs bg-muted px-1 py-0.5 rounded">BO21309111001=Branch Name</code>
            </p>
            <Textarea value={boMappingsText} onChange={(e) => setBoMappingsText(e.target.value)} rows={8} className="font-mono text-sm" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBoDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => { handleSave(); setBoDialogOpen(false); }}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Office Addresses */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Office Addresses</CardTitle>
          <CardDescription className="text-xs">Used in official letters — hover a card and click ⋮ to edit</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <AddressCardDialog
            title="Sub Office (Your Office)"
            address={config.subOfficeAddress || DEFAULT_ADDRESS}
            onSave={(addr) => handleAddressSave('subOfficeAddress', addr)}
            onClear={() => handleAddressClear('subOfficeAddress')}
          />
          <AddressCardDialog
            title="Inspector of Posts Office"
            address={config.ipOfficeAddress || DEFAULT_ADDRESS}
            onSave={(addr) => handleAddressSave('ipOfficeAddress', addr)}
            onClear={() => handleAddressClear('ipOfficeAddress')}
          />
          <AddressCardDialog
            title="Superintendent of Post Offices"
            address={config.spoOfficeAddress || DEFAULT_ADDRESS}
            onSave={(addr) => handleAddressSave('spoOfficeAddress', addr)}
            onClear={() => handleAddressClear('spoOfficeAddress')}
          />
        </CardContent>
      </Card>

      {/* Reminder Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Reminder Management</CardTitle>
          <CardDescription className="text-xs">Reset reminder counts to start the cycle fresh</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <p className="text-sm text-muted-foreground">
            Resets all Pending/Reported memos to Reminder 0 and clears history, so you can start fresh with Reminder 1 to IP.
          </p>
          <Button onClick={handleResetReminders} variant="outline" size="sm" className="border-amber-500/50 text-amber-700 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset All Reminders
          </Button>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Data Management</CardTitle>
          <CardDescription className="text-xs">Backup, restore, or reset your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleBackup} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Backup
            </Button>
            <Button onClick={handleRestore} variant="outline" size="sm">
              <Upload className="w-4 h-4 mr-2" />
              Restore
            </Button>
            <Button onClick={handleReset} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Reset All
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            All data is stored locally. Use backup to transfer data between devices.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
