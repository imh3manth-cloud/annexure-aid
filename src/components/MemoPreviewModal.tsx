import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MemoRecord } from '@/lib/db';
import { Download, Printer, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { generateConsolidatedPDF } from '@/lib/pdfGenerator';

interface MemoPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memos: MemoRecord[];
  onConfirm: () => void;
}

export const MemoPreviewModal = ({ open, onOpenChange, memos, onConfirm }: MemoPreviewModalProps) => {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [isLoading, setIsLoading] = useState(false);

  const generatePreviewPDF = useCallback(() => {
    if (memos.length === 0) return;
    
    setIsLoading(true);
    try {
      const doc = generateConsolidatedPDF(memos);
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      
      // Calculate total pages: 1 cover + ceil(memos/2) memo pages + 1 summary
      const memoPages = Math.ceil(memos.length / 2);
      setTotalPages(1 + memoPages + 1);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error generating PDF preview:', error);
    } finally {
      setIsLoading(false);
    }
  }, [memos]);

  useEffect(() => {
    if (open && memos.length > 0) {
      generatePreviewPDF();
    }
    
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [open, memos, generatePreviewPDF]);

  const handleDownload = () => {
    onConfirm();
  };

  const handlePrint = () => {
    if (pdfUrl) {
      const printWindow = window.open(pdfUrl);
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 25, 50));
  };

  const handleResetZoom = () => {
    setZoom(100);
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="bg-primary text-primary-foreground px-4 py-3 rounded-t-lg">
          <DialogTitle className="text-lg font-semibold">
            Verification Memos Preview ({memos.length} memos)
          </DialogTitle>
        </DialogHeader>
        
        {/* PDF Toolbar */}
        <div className="bg-muted/80 border-b border-border px-4 py-2 flex items-center justify-between gap-2">
          {/* Left: Page navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrevPage}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[80px] text-center">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleNextPage}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Center: Zoom controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomOut}
              disabled={zoom <= 50}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[50px] text-center">
              {zoom}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomIn}
              disabled={zoom >= 200}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleResetZoom}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handlePrint}
              title="Print"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleDownload}
              title="Download"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        {/* PDF Viewer */}
        <div className="flex-1 overflow-auto bg-muted/30 flex items-start justify-center p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Generating preview...</div>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#page=${currentPage}`}
              className="bg-background shadow-lg rounded border border-border"
              style={{
                width: `${(210 * zoom) / 100 * 3}px`,
                height: `${(297 * zoom) / 100 * 3}px`,
                maxWidth: '100%',
                transformOrigin: 'top center',
              }}
              title="Memo Preview"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">No memos to preview</div>
            </div>
          )}
        </div>
        
        {/* Footer with actions */}
        <div className="bg-muted/50 border-t border-border px-4 py-3 flex items-center justify-end gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDownload}>
            <Download className="w-4 h-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
