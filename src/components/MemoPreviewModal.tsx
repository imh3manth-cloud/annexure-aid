import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MemoRecord } from '@/lib/db';
import { Download, Printer } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { getConfig } from '@/lib/config';

interface MemoPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memos: MemoRecord[];
  onConfirm: () => void;
}

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export const MemoPreviewModal = ({ open, onOpenChange, memos, onConfirm }: MemoPreviewModalProps) => {
  const previewRef = useRef<HTMLDivElement>(null);
  const config = getConfig();
  const OFFICE_NAME = config.officeName;

  useEffect(() => {
    if (open && previewRef.current) {
      previewRef.current.scrollTop = 0;
    }
  }, [open]);

  const renderMemo = (memo: MemoRecord) => (
    <div key={memo.id} className="border border-border p-6 mb-6 bg-background rounded-sm min-h-[400px] flex flex-col">
      {/* Header Box */}
      <div className="border border-border p-3 mb-4 text-center bg-muted/30">
        <div className="font-bold text-sm">ANNEXURE-4</div>
        <div className="text-xs">[See para 105]</div>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-2 gap-4">
        {/* Left Column - Memo of Verification */}
        <div className="border-r border-border pr-4 flex flex-col">
          <div className="font-bold text-sm mb-2">Memo of Verification</div>
          
          <div className="text-xs space-y-2 flex-1">
            <p>
              No: <span className="font-medium">{memo.serial}</span> dated at {memo.BO_Name} the {formatDate(memo.txn_date)}
            </p>
            
            <p>
              A withdrawal of Rs <span className="font-medium">{formatAmount(memo.amount)}</span> ({memo.txn_id}) has been effected in Account No <span className="font-medium">{memo.account}</span> at {memo.BO_Name} on {formatDate(memo.txn_date)}.
            </p>
            
            <p className="bg-muted/50 p-1 rounded">
              Balance after transaction as per Last Balance dated <span className="font-medium">{formatDate(memo.balance_date || memo.txn_date)}</span> is Rs <span className="font-medium">{formatAmount(memo.balance || 0)}</span>.
            </p>
            
            <p>The name and address of depositor are as below:</p>
            
            <div className="font-bold">
              {memo.name}
            </div>
            <div>
              {memo.address}
            </div>
            
            <p className="pt-2">
              Kindly verify the genuineness and intimate result within 10/30 days.
            </p>
          </div>

          <div className="text-xs mt-4 pt-4 border-t border-border">
            <div>Sub Postmaster</div>
            <div>{OFFICE_NAME}</div>
          </div>
        </div>

        {/* Right Column - Reply */}
        <div className="pl-4 flex flex-col">
          <div className="font-bold text-sm mb-2">Reply</div>
          
          <div className="text-xs space-y-2 flex-1">
            <p>
              No: <span className="font-medium">{memo.serial}</span> dated at {OFFICE_NAME} the {formatDate(memo.txn_date)}
            </p>
            
            <p>
              The result of verification of the withdrawal particularised in the margin has been found satisfactory/ not satisfactory.
            </p>
            
            <p>Investigation has been taken up.</p>
          </div>

          <div className="text-xs mt-4 pt-4 border-t border-border space-y-1">
            <div className="text-right">THE INSPECTOR OF POSTS</div>
            <div className="text-right">T NARASIPURA SUB DIVISION</div>
            <div className="mt-2">To,</div>
            <div>Sub Postmaster</div>
            <div>{OFFICE_NAME}</div>
          </div>
        </div>
      </div>

      {/* Footer Box */}
      <div className="border border-border p-2 mt-4 text-center bg-muted/30">
        <div className="text-[10px] leading-tight">
          <span className="font-semibold">Note:</span> The verification memo should be returned to the HO within 10 days in case where the place of residence of the depositor lies in the jurisdictions of P.R.I and within 30 days in all other cases.
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Preview Memos ({memos.length})</DialogTitle>
        </DialogHeader>
        
        <div ref={previewRef} className="flex-1 overflow-y-auto p-4 bg-muted/10">
          {memos.map(memo => renderMemo(memo))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
