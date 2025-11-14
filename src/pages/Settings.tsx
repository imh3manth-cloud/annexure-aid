import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/db';
import { Download, Upload, Trash2, Save } from 'lucide-react';

interface AppConfig {
  officeName: string;
  subdivision: string;
  boMappings: Record<string, string>;
}

const DEFAULT_CONFIG: AppConfig = {
  officeName: 'OLD SOSALE S.O',
  subdivision: 'T NARASIPURA SUB DIVISION',
  boMappings: {
    '1': 'Chiduravalli BO',
    '2': 'Doddebagilu BO',
    '3': 'Horalahalli BO',
    '4': 'Kolathur BO',
    '5': 'Somanathapura BO',
    '6': 'Ukkalagere BO',
    '7': 'Vyasarajapura BO'
  }
};

export const Settings = () => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [boMappingsText, setBoMappingsText] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = () => {
    const saved = localStorage.getItem('appConfig');
    if (saved) {
      const parsed = JSON.parse(saved);
      setConfig(parsed);
      setBoMappingsText(formatBOMappings(parsed.boMappings));
    } else {
      setBoMappingsText(formatBOMappings(DEFAULT_CONFIG.boMappings));
    }
  };

  const formatBOMappings = (mappings: Record<string, string>) => {
    return Object.entries(mappings)
      .map(([code, name]) => `BO2130911100${code}=${name}`)
      .join('\n');
  };

  const parseBOMappings = (text: string): Record<string, string> => {
    const mappings: Record<string, string> = {};
    text.split('\n').forEach(line => {
      const [code, name] = line.split('=').map(s => s.trim());
      if (code && name) {
        // Extract just the last digit if full BO code provided (e.g., BO21309111001 -> 1)
        const match = code.match(/BO\d+(\d)$/);
        const key = match ? match[1] : code;
        mappings[key] = name;
      }
    });
    return mappings;
  };

  const handleSave = () => {
    const updatedConfig = {
      ...config,
      boMappings: parseBOMappings(boMappingsText)
    };
    localStorage.setItem('appConfig', JSON.stringify(updatedConfig));
    setConfig(updatedConfig);
    toast({ title: 'Settings saved successfully' });
  };

  const handleBackup = async () => {
    try {
      const memos = await db.memos.toArray();
      const settings = await db.settings.toArray();
      const backup = {
        version: 1,
        timestamp: new Date().toISOString(),
        config,
        memos,
        settings
      };

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
        const text = await file.text();
        const backup = JSON.parse(text);

        // Restore config
        if (backup.config) {
          localStorage.setItem('appConfig', JSON.stringify(backup.config));
          setConfig(backup.config);
          setBoMappingsText(formatBOMappings(backup.config.boMappings));
        }

        // Restore memos
        if (backup.memos) {
          await db.memos.clear();
          await db.memos.bulkAdd(backup.memos);
        }

        // Restore settings
        if (backup.settings) {
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Settings</h2>
        <p className="text-muted-foreground">Configure application settings and manage data</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Office Configuration</CardTitle>
          <CardDescription>Customize office name and subdivision details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="officeName">Office Name</Label>
            <Input
              id="officeName"
              value={config.officeName}
              onChange={(e) => setConfig({ ...config, officeName: e.target.value })}
              placeholder="e.g., OLD SOSALE S.O"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="subdivision">Subdivision</Label>
            <Input
              id="subdivision"
              value={config.subdivision}
              onChange={(e) => setConfig({ ...config, subdivision: e.target.value })}
              placeholder="e.g., T NARASIPURA SUB DIVISION"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="boMappings">Branch Office Code Mappings</Label>
            <p className="text-sm text-muted-foreground">
              Enter one mapping per line in format: BO21309111001=Branch Name
            </p>
            <Textarea
              id="boMappings"
              value={boMappingsText}
              onChange={(e) => setBoMappingsText(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Management</CardTitle>
          <CardDescription>Backup, restore, or reset your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button onClick={handleBackup} variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Backup Data
            </Button>

            <Button onClick={handleRestore} variant="outline">
              <Upload className="w-4 h-4 mr-2" />
              Restore Data
            </Button>

            <Button onClick={handleReset} variant="destructive">
              <Trash2 className="w-4 h-4 mr-2" />
              Reset All Data
            </Button>
          </div>

          <div className="bg-muted p-4 rounded-lg space-y-2">
            <h4 className="font-semibold text-sm">Offline Usage</h4>
            <p className="text-sm text-muted-foreground">
              This application works completely offline. All data is stored locally in your browser.
              Use the backup feature to save your data as a JSON file, which you can share with others
              or use on different devices.
            </p>
            <p className="text-sm text-muted-foreground">
              To use this app on another device:
            </p>
            <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1">
              <li>Create a backup on this device</li>
              <li>Open the app on the new device</li>
              <li>Go to Settings and restore the backup file</li>
              <li>Customize office settings if needed</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
