import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { LastBalanceRecord } from '@/lib/fileParser';
import { CheckCircle2, XCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react';

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
  records: LastBalanceRecord[];
  preparedDate: string;
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const BalancePreviewDialog = ({
  open,
  onOpenChange,
  records,
  preparedDate,
  fileName,
  onConfirm,
  onCancel
}: BalancePreviewDialogProps) => {
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
  const balancePercentage = Math.round((recordsWithBalance / records.length) * 100);
  const schemePercentage = Math.round((recordsWithScheme / records.length) * 100);

  const DetectionBadge = ({ detected, label }: { detected: boolean; label: string }) => (
    <Badge 
      variant={detected ? "default" : "destructive"} 
      className="flex items-center gap-1"
    >
      {detected ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {label}
    </Badge>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
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
          {/* File Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">File:</span>
              <span className="ml-2 font-medium">{fileName}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Balance Date:</span>
              <span className="ml-2 font-medium">{preparedDate}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Total Records:</span>
              <span className="ml-2 font-medium">{records.length.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Preview:</span>
              <span className="ml-2 font-medium">First 10 records</span>
            </div>
          </div>

          {/* Detected Columns */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Detected Columns:</h4>
            <div className="flex flex-wrap gap-2">
              <DetectionBadge detected={detection.account} label="Account No" />
              <DetectionBadge detected={detection.name} label="Name" />
              <DetectionBadge detected={detection.address} label="Address" />
              <DetectionBadge detected={detection.balance} label="Balance" />
              <DetectionBadge detected={detection.scheme_type} label="Scheme/Status" />
              <DetectionBadge detected={detection.bo_name} label="BO Name" />
            </div>
          </div>

          {/* Data Quality Warnings */}
          {(balancePercentage < 80 || schemePercentage < 50) && (
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
            <ScrollArea className="h-[300px]">
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
                  {previewRecords.map((record, idx) => (
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
                  ))}
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
          <Button onClick={onConfirm}>
            Save {records.length.toLocaleString()} Records
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
