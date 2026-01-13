import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { LastBalanceRecord, ColumnMapping, RawCSVData, applyColumnMapping } from '@/lib/fileParser';
import { ColumnMappingPreset, PresetMatch, getPresets, savePreset, deletePreset, findMatchingPresets } from '@/lib/columnPresets';
import { CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet, Settings2, RotateCcw, Save, Trash2, FolderOpen, Sparkles, Zap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ColumnDetection {
  account: boolean;
  name: boolean;
  address: boolean;
  balance: boolean;
  scheme_type: boolean;
  bo_name: boolean;
}

interface BalancePreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawData: RawCSVData;
  fileName: string;
  onConfirm: (records: LastBalanceRecord[], preparedDate: string) => void;
  onCancel: () => void;
}

const FIELD_LABELS: Record<keyof Omit<ColumnMapping, 'name2' | 'status'>, string> = {
  account: 'Account Number',
  name: 'Customer Name',
  address: 'Address',
  balance: 'Balance',
  scheme_type: 'Scheme/Product',
  bo_name: 'BO/Branch Name'
};

export const BalancePreviewDialog = ({
  open,
  onOpenChange,
  rawData,
  fileName,
  onConfirm,
  onCancel
}: BalancePreviewDialogProps) => {
  const [showMapping, setShowMapping] = useState(false);
  const [mapping, setMapping] = useState<ColumnMapping>(rawData.autoMapping);
  const [presets, setPresets] = useState<ColumnMappingPreset[]>([]);
  const [newPresetName, setNewPresetName] = useState('');
  const [showSavePreset, setShowSavePreset] = useState(false);
  const [suggestedPresets, setSuggestedPresets] = useState<PresetMatch[]>([]);
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);
  
  // Load presets on mount
  useEffect(() => {
    setPresets(getPresets());
  }, []);
  
  // Find matching presets when rawData changes
  useEffect(() => {
    if (rawData.headers.length > 0) {
      const matches = findMatchingPresets(rawData.headers, 50);
      setSuggestedPresets(matches);
      
      // Auto-apply best match if score is very high (>85%)
      const bestMatch = matches.find(m => m.score >= 85);
      if (bestMatch && !appliedPresetId) {
        setMapping(bestMatch.preset.mapping);
        setAppliedPresetId(bestMatch.preset.id);
        toast({
          title: 'Preset auto-applied',
          description: `"${bestMatch.preset.name}" matched with ${bestMatch.score}% confidence`
        });
      }
    }
  }, [rawData.headers]);
  
  // Reset mapping when rawData changes
  useEffect(() => {
    if (!appliedPresetId) {
      setMapping(rawData.autoMapping);
    }
  }, [rawData, appliedPresetId]);
  
  // Apply mapping to get records
  const records = useMemo(() => {
    return applyColumnMapping(rawData, mapping);
  }, [rawData, mapping]);
  
  // Analyze detected columns based on actual data
  const analyzeDetectedColumns = (): ColumnDetection => {
    const sample = records.slice(0, 10);
    return {
      account: sample.some(r => r.account && r.account !== '0'),
      name: sample.some(r => r.name && r.name.trim().length > 0),
      address: sample.some(r => r.address && r.address.trim().length > 0),
      balance: sample.some(r => r.balance !== undefined && r.balance > 0),
      scheme_type: sample.some(r => r.scheme_type && r.scheme_type.trim().length > 0),
      bo_name: sample.some(r => r.bo_name && r.bo_name.trim().length > 0),
    };
  };

  const detection = analyzeDetectedColumns();
  const previewRecords = records.slice(0, 10);
  
  // Count issues
  const recordsWithBalance = records.filter(r => r.balance > 0).length;
  const recordsWithScheme = records.filter(r => r.scheme_type && r.scheme_type.trim()).length;
  const balancePercentage = records.length > 0 ? Math.round((recordsWithBalance / records.length) * 100) : 0;
  const schemePercentage = records.length > 0 ? Math.round((recordsWithScheme / records.length) * 100) : 0;
  
  // Check if auto-detection might have failed
  const hasDetectionIssues = !detection.balance || !detection.scheme_type || !detection.bo_name;

  const DetectionBadge = ({ detected, label }: { detected: boolean; label: string }) => (
    <Badge 
      variant={detected ? "default" : "destructive"} 
      className="flex items-center gap-1"
    >
      {detected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );
  
  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setMapping(prev => ({
      ...prev,
      [field]: value === 'none' ? null : parseInt(value)
    }));
    setAppliedPresetId(null); // Clear applied preset when manually changing
  };
  
  const handleResetMapping = () => {
    setMapping(rawData.autoMapping);
    setAppliedPresetId(null);
  };
  
  const handleSavePreset = () => {
    if (!newPresetName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for the preset',
        variant: 'destructive'
      });
      return;
    }
    
    const preset = savePreset(newPresetName, mapping, rawData.headers);
    setPresets(getPresets());
    setNewPresetName('');
    setShowSavePreset(false);
    
    toast({
      title: 'Preset saved',
      description: `"${preset.name}" has been saved and will auto-detect similar CSV formats`
    });
  };
  
  const handleLoadPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      setMapping(preset.mapping);
      setAppliedPresetId(preset.id);
      toast({
        title: 'Preset loaded',
        description: `Applied mapping from "${preset.name}"`
      });
    }
  };
  
  const handleApplySuggestedPreset = (match: PresetMatch) => {
    setMapping(match.preset.mapping);
    setAppliedPresetId(match.preset.id);
    toast({
      title: 'Preset applied',
      description: `"${match.preset.name}" (${match.score}% match)`
    });
  };
  
  const handleDeletePreset = (presetId: string, presetName: string) => {
    deletePreset(presetId);
    setPresets(getPresets());
    setSuggestedPresets(prev => prev.filter(m => m.preset.id !== presetId));
    if (appliedPresetId === presetId) {
      setAppliedPresetId(null);
    }
    toast({
      title: 'Preset deleted',
      description: `"${presetName}" has been removed`
    });
  };
  
  const handleConfirm = () => {
    onConfirm(records, rawData.preparedDate);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Preview Parsed Data
          </DialogTitle>
          <DialogDescription>
            Review the detected columns and parsed records before saving
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Suggested Presets Banner */}
          {suggestedPresets.length > 0 && !appliedPresetId && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary">Matching presets found!</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  This CSV format matches saved presets. Click to apply:
                </p>
                <div className="flex flex-wrap gap-2 mt-2">
                  {suggestedPresets.slice(0, 3).map((match) => (
                    <Button
                      key={match.preset.id}
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5 border-primary/30 hover:bg-primary/10"
                      onClick={() => handleApplySuggestedPreset(match)}
                    >
                      <Zap className="h-3 w-3" />
                      {match.preset.name}
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                        {match.score}%
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Applied Preset Indicator */}
          {appliedPresetId && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-green-500/10 border border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700 dark:text-green-400">
                Using preset: <strong>{presets.find(p => p.id === appliedPresetId)?.name || suggestedPresets.find(m => m.preset.id === appliedPresetId)?.preset.name}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs ml-auto"
                onClick={handleResetMapping}
              >
                Use Auto-detect
              </Button>
            </div>
          )}

          {/* File Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">File:</span>
              <span className="ml-2 font-medium truncate block" title={fileName}>{fileName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Balance Date:</span>
              <span className="ml-2 font-medium">{rawData.preparedDate}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Records:</span>
              <span className="ml-2 font-medium">{records.length.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">CSV Columns:</span>
              <span className="ml-2 font-medium">{rawData.headers.length}</span>
            </div>
          </div>

          {/* Detected Columns */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Detected Columns:</h4>
              <Button
                variant={showMapping ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowMapping(!showMapping)}
                className="gap-1"
              >
                <Settings2 className="h-4 w-4" />
                {showMapping ? 'Hide Mapping' : 'Manual Mapping'}
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <DetectionBadge detected={detection.account} label="Account No" />
              <DetectionBadge detected={detection.name} label="Name" />
              <DetectionBadge detected={detection.address} label="Address" />
              <DetectionBadge detected={detection.balance} label="Balance" />
              <DetectionBadge detected={detection.scheme_type} label="Scheme/Status" />
              <DetectionBadge detected={detection.bo_name} label="BO Name" />
            </div>
          </div>
          
          {/* Manual Column Mapping */}
          {showMapping && (
            <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-sm font-medium">Manual Column Mapping</h4>
                <div className="flex items-center gap-2">
                  {/* Preset Selector */}
                  {presets.length > 0 && (
                    <Select onValueChange={handleLoadPreset}>
                      <SelectTrigger className="h-8 w-[160px] text-xs">
                        <FolderOpen className="h-3 w-3 mr-1" />
                        <SelectValue placeholder="Load Preset" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border">
                        {presets.map(preset => (
                          <div key={preset.id} className="flex items-center justify-between px-2 py-1 hover:bg-muted group">
                            <SelectItem value={preset.id} className="flex-1 p-0">
                              {preset.name}
                            </SelectItem>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeletePreset(preset.id, preset.name);
                              }}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  
                  {/* Save Preset */}
                  {showSavePreset ? (
                    <div className="flex items-center gap-1">
                      <Input
                        placeholder="Preset name"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        className="h-8 w-[140px] text-xs"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSavePreset();
                          if (e.key === 'Escape') {
                            setShowSavePreset(false);
                            setNewPresetName('');
                          }
                        }}
                        autoFocus
                      />
                      <Button variant="default" size="sm" className="h-8" onClick={handleSavePreset}>
                        Save
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8" 
                        onClick={() => {
                          setShowSavePreset(false);
                          setNewPresetName('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 gap-1" 
                      onClick={() => setShowSavePreset(true)}
                    >
                      <Save className="h-3 w-3" />
                      Save Preset
                    </Button>
                  )}
                  
                  <Button variant="ghost" size="sm" onClick={handleResetMapping} className="h-8 gap-1">
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Select which CSV column corresponds to each field. Choose "Not Mapped" if the column doesn't exist.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {(Object.entries(FIELD_LABELS) as [keyof typeof FIELD_LABELS, string][]).map(([field, label]) => (
                  <div key={field} className="space-y-1.5">
                    <Label className="text-xs">{label}</Label>
                    <Select
                      value={mapping[field]?.toString() ?? 'none'}
                      onValueChange={(value) => handleMappingChange(field, value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border max-h-[200px]">
                        <SelectItem value="none" className="text-muted-foreground">
                          Not Mapped
                        </SelectItem>
                        {rawData.headers.map((header, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            {idx}: {header || `Column ${idx + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {/* Additional fields for name2 and status */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Name 2 (Optional)</Label>
                  <Select
                    value={mapping.name2?.toString() ?? 'none'}
                    onValueChange={(value) => handleMappingChange('name2', value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border max-h-[200px]">
                      <SelectItem value="none" className="text-muted-foreground">
                        Not Mapped
                      </SelectItem>
                      {rawData.headers.map((header, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {idx}: {header || `Column ${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Account Status (Optional)</Label>
                  <Select
                    value={mapping.status?.toString() ?? 'none'}
                    onValueChange={(value) => handleMappingChange('status', value)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border max-h-[200px]">
                      <SelectItem value="none" className="text-muted-foreground">
                        Not Mapped
                      </SelectItem>
                      {rawData.headers.map((header, idx) => (
                        <SelectItem key={idx} value={idx.toString()}>
                          {idx}: {header || `Column ${idx + 1}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* Detection Issues Warning */}
          {hasDetectionIssues && !showMapping && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-orange-500/10 border border-orange-500/20">
              <Settings2 className="h-5 w-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-orange-600 dark:text-orange-400">Column Detection Issue</p>
                <p className="mt-1 text-muted-foreground">
                  Some columns couldn't be auto-detected. Click "Manual Mapping" above to map columns manually.
                </p>
              </div>
            </div>
          )}

          {/* Data Quality Warnings */}
          {(balancePercentage < 80 || schemePercentage < 50) && records.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/20">
              <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-600 dark:text-yellow-400">Data Quality Notice:</p>
                <ul className="mt-1 text-muted-foreground list-disc list-inside">
                  {balancePercentage < 80 && (
                    <li>Only {balancePercentage}% of records have balance values</li>
                  )}
                  {schemePercentage < 50 && (
                    <li>Only {schemePercentage}% of records have scheme/status info</li>
                  )}
                </ul>
              </div>
            </div>
          )}

          {/* Preview Table */}
          <div className="border rounded-md flex-1 overflow-hidden">
            <ScrollArea className="h-[280px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Account</TableHead>
                    <TableHead className="w-[150px]">Name</TableHead>
                    <TableHead className="w-[150px]">Address</TableHead>
                    <TableHead className="text-right w-[100px]">Balance</TableHead>
                    <TableHead className="w-[120px]">Scheme/Status</TableHead>
                    <TableHead className="w-[100px]">BO Name</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No valid records found. Try adjusting the column mapping.
                      </TableCell>
                    </TableRow>
                  ) : (
                    previewRecords.map((record, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono text-xs">{record.account}</TableCell>
                        <TableCell className="text-xs truncate max-w-[150px]" title={record.name}>
                          {record.name || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[150px]" title={record.address}>
                          {record.address || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs">
                          {record.balance > 0 ? (
                            `₹${record.balance.toLocaleString()}`
                          ) : (
                            <span className="text-destructive">₹0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[120px]" title={record.scheme_type}>
                          {record.scheme_type || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                        <TableCell className="text-xs truncate max-w-[100px]" title={record.bo_name}>
                          {record.bo_name || <span className="text-muted-foreground">-</span>}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {records.length > 10 && (
            <p className="text-xs text-muted-foreground text-center">
              ... and {(records.length - 10).toLocaleString()} more records
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={records.length === 0}>
            Save {records.length.toLocaleString()} Records
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};