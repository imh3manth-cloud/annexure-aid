import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, Pencil, Trash2, MapPin } from 'lucide-react';
import type { OfficeAddress } from '@/lib/config';

interface AddressCardDialogProps {
  title: string;
  address: OfficeAddress;
  onSave: (address: OfficeAddress) => void;
  onClear: () => void;
}

const DEFAULT_ADDRESS: OfficeAddress = { name: '', line1: '', line2: '', city: '', pincode: '' };

export const AddressCardDialog = ({ title, address, onSave, onClear }: AddressCardDialogProps) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<OfficeAddress>(address);

  const hasData = address.name || address.line1;

  const handleOpen = () => {
    setDraft({ ...address });
    setOpen(true);
  };

  const handleSave = () => {
    onSave(draft);
    setOpen(false);
  };

  const handleClear = () => {
    onClear();
  };

  const formatPreview = (addr: OfficeAddress) => {
    const parts = [addr.name, addr.line1, addr.line2, [addr.city, addr.pincode].filter(Boolean).join(' - ')].filter(Boolean);
    return parts.join(', ');
  };

  return (
    <>
      <Card className="group hover:border-primary/30 transition-colors">
        <CardContent className="p-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-lg bg-primary/10 mt-0.5 shrink-0">
              <MapPin className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">{title}</p>
              {hasData ? (
                <p className="text-xs text-muted-foreground mt-1 truncate">{formatPreview(address)}</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1 italic">Not configured</p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleOpen}>
                <Pencil className="h-4 w-4 mr-2" />
                {hasData ? 'Edit' : 'Add'} Address
              </DropdownMenuItem>
              {hasData && (
                <DropdownMenuItem onClick={handleClear} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Address
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>Designation</Label>
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g., The Sub Postmaster" />
            </div>
            <div className="space-y-1">
              <Label>Office / Line 1</Label>
              <Input value={draft.line1} onChange={(e) => setDraft({ ...draft, line1: e.target.value })} placeholder="e.g., Old Sosale S.O" />
            </div>
            <div className="space-y-1">
              <Label>Line 2</Label>
              <Input value={draft.line2} onChange={(e) => setDraft({ ...draft, line2: e.target.value })} placeholder="e.g., T Narasipura Taluk" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>City</Label>
                <Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} placeholder="City" />
              </div>
              <div className="space-y-1">
                <Label>Pincode</Label>
                <Input value={draft.pincode} onChange={(e) => setDraft({ ...draft, pincode: e.target.value })} placeholder="570001" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
