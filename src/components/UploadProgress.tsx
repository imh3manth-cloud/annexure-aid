import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';

interface UploadProgressProps {
  fileName: string;
  processed: number;
  total: number;
  status: 'processing' | 'complete' | 'error';
}

export function UploadProgress({ fileName, processed, total, status }: UploadProgressProps) {
  const percentage = total > 0 ? Math.round((processed / total) * 100) : 0;

  return (
    <div className="space-y-2 p-4 rounded-lg border bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status === 'processing' && (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          )}
          <span className="text-sm font-medium truncate max-w-[200px]" title={fileName}>
            {fileName}
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {processed.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <Progress value={percentage} className="h-2" />
      <p className="text-xs text-muted-foreground text-center">
        {percentage}% complete
      </p>
    </div>
  );
}
