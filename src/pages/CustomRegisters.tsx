import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, BookOpen, Trash2, ArrowLeft, FileSpreadsheet } from 'lucide-react';
import { getAllRegisters, createRegister, deleteRegister, REGISTER_PRESETS, CustomRegister } from '@/lib/customRegisterDb';
import { useFocusRefresh } from '@/hooks/useFocusRefresh';

export const CustomRegisters = () => {
  const [registers, setRegisters] = useState<CustomRegister[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('blank');
  const [customName, setCustomName] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const loadRegisters = useCallback(async () => {
    try {
      const data = await getAllRegisters();
      setRegisters(data);
    } catch (e: any) {
      toast({ title: 'Failed to load registers', description: e.message, variant: 'destructive' });
    }
  }, []);

  useFocusRefresh(loadRegisters);

  const handleCreate = async () => {
    const preset = REGISTER_PRESETS[selectedPreset];
    const name = customName.trim() || preset.name;
    if (!name) {
      toast({ title: 'Please enter a name', variant: 'destructive' });
      return;
    }

    setIsCreating(true);
    try {
      const id = await createRegister({
        name,
        description: customDesc.trim() || preset.description,
        columns: preset.columns,
        presets: selectedPreset
      });
      toast({ title: 'Register created', description: name });
      setShowCreate(false);
      setCustomName('');
      setCustomDesc('');
      setSelectedPreset('blank');
      navigate(`/custom-register/${id}`);
    } catch (e: any) {
      toast({ title: 'Failed to create', description: e.message, variant: 'destructive' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteRegister(id);
      toast({ title: 'Register deleted' });
      await loadRegisters();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/operations')}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Operations
          </Button>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Custom Registers</h2>
            <p className="text-muted-foreground text-sm">Create and manage official postal registers</p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Register
        </Button>
      </div>

      {registers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileSpreadsheet className="w-16 h-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No registers yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first register from a preset or start from scratch</p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Register
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {registers.map(reg => (
            <Card key={reg.id} className="group hover:shadow-lg transition-all cursor-pointer" onClick={() => navigate(`/custom-register/${reg.id}`)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    <CardTitle className="text-base">{reg.name}</CardTitle>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={e => e.stopPropagation()}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={e => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete "{reg.name}"?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete the register and all its data.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(reg.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                <CardDescription className="line-clamp-2">{reg.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary" className="text-xs">{reg.columns.length} columns</Badge>
                  {reg.presets && (
                    <Badge variant="outline" className="text-xs">{REGISTER_PRESETS[reg.presets]?.name?.split(' ')[0] || reg.presets}</Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(reg.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Register</DialogTitle>
            <DialogDescription>Choose a preset template or start blank. You can customize columns later.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Template</Label>
              <Select value={selectedPreset} onValueChange={(v) => {
                setSelectedPreset(v);
                const preset = REGISTER_PRESETS[v];
                if (preset && v !== 'blank') {
                  setCustomName(preset.name);
                  setCustomDesc(preset.description);
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REGISTER_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center gap-2">
                        <span>{preset.name}</span>
                        <span className="text-xs text-muted-foreground">({preset.columns.length} cols)</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Register Name</Label>
              <Input value={customName} onChange={e => setCustomName(e.target.value)} placeholder={REGISTER_PRESETS[selectedPreset]?.name} />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input value={customDesc} onChange={e => setCustomDesc(e.target.value)} placeholder={REGISTER_PRESETS[selectedPreset]?.description} />
            </div>

            {/* Preview columns */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Columns Preview</Label>
              <div className="flex flex-wrap gap-1.5">
                {REGISTER_PRESETS[selectedPreset]?.columns.map(col => (
                  <Badge key={col.key} variant="outline" className="text-xs">
                    {col.label}
                    {col.required && <span className="text-destructive ml-0.5">*</span>}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Register'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
