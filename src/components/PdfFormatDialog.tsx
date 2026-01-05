import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PdfFormatConfig, PdfTextConfig, getPdfConfig, savePdfConfig, resetPdfConfig, DEFAULT_PDF_CONFIG, DEFAULT_TEXT_CONFIG, PDF_PRESETS, PresetName, applyPreset } from '@/lib/pdfConfig';
import { RotateCcw, Save, Eye, FileText, Type, MoveVertical, Box, Sparkles, MessageSquare, Settings2 } from 'lucide-react';
import { generateSampleMemoPDF } from '@/lib/pdfGenerator';

interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

const SliderControl = ({ label, value, min, max, step, unit = 'pt', onChange }: SliderControlProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-sm">{label}</Label>
      <span className="text-sm font-medium text-muted-foreground">
        {value}{unit}
      </span>
    </div>
    <div className="flex items-center gap-3">
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0])}
        className="flex-1"
      />
      <Input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || min)}
        className="w-20 h-8 text-sm"
      />
    </div>
  </div>
);

interface PresetButtonProps {
  presetKey: PresetName;
  isActive: boolean;
  onClick: () => void;
}

const PresetButton = ({ presetKey, isActive, onClick }: PresetButtonProps) => {
  const preset = PDF_PRESETS[presetKey];
  return (
    <button
      onClick={onClick}
      className={`flex-1 p-3 rounded-lg border-2 transition-all text-left ${
        isActive 
          ? 'border-primary bg-primary/10' 
          : 'border-border hover:border-primary/50 hover:bg-muted/50'
      }`}
    >
      <div className="font-medium text-sm">{preset.name}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{preset.description}</div>
    </button>
  );
};

interface PdfFormatDialogProps {
  trigger?: React.ReactNode;
}

export const PdfFormatDialog = ({ trigger }: PdfFormatDialogProps) => {
  const [open, setOpen] = useState(false);
  const [config, setConfig] = useState<PdfFormatConfig>(getPdfConfig());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const [activePreset, setActivePreset] = useState<PresetName | null>(null);
  const { toast } = useToast();

  // Load config when dialog opens
  useEffect(() => {
    if (open) {
      setConfig(getPdfConfig());
    }
  }, [open]);

  // Cleanup preview URL when dialog closes
  useEffect(() => {
    if (!open && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [open, previewUrl]);

  const handleSave = () => {
    savePdfConfig(config);
    toast({
      title: 'Settings Saved',
      description: 'PDF format settings have been saved successfully.',
    });
  };

  const handleReset = () => {
    resetPdfConfig();
    setConfig(DEFAULT_PDF_CONFIG);
    setActivePreset('standard');
    toast({
      title: 'Settings Reset',
      description: 'PDF format settings have been reset to defaults.',
    });
  };

  const handleApplyPreset = (presetKey: PresetName) => {
    const newConfig = applyPreset(presetKey);
    setConfig(newConfig);
    setActivePreset(presetKey);
    toast({
      title: 'Preset Applied',
      description: `${PDF_PRESETS[presetKey].name} preset has been applied.`,
    });
  };

  const updateConfig = <K extends keyof PdfFormatConfig>(key: K, value: PdfFormatConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
    setActivePreset(null);
  };

  const updateTextConfig = <K extends keyof PdfTextConfig>(key: K, value: PdfTextConfig[K]) => {
    setConfig(prev => ({
      ...prev,
      textContent: { ...prev.textContent, [key]: value }
    }));
    setActivePreset(null);
  };

  const generatePreview = useCallback(async () => {
    setIsGeneratingPreview(true);
    try {
      savePdfConfig(config);
      
      const doc = generateSampleMemoPDF();
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(url);
    } catch (error) {
      toast({
        title: 'Preview Error',
        description: 'Failed to generate preview.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPreview(false);
    }
  }, [config, previewUrl, toast]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Settings2 className="w-4 h-4 mr-2" />
            PDF Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF Format Editor
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preset Selector */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4" />
              Quick Presets
            </Label>
            <div className="flex gap-3">
              <PresetButton 
                presetKey="compact" 
                isActive={activePreset === 'compact'} 
                onClick={() => handleApplyPreset('compact')} 
              />
              <PresetButton 
                presetKey="standard" 
                isActive={activePreset === 'standard'} 
                onClick={() => handleApplyPreset('standard')} 
              />
              <PresetButton 
                presetKey="large" 
                isActive={activePreset === 'large'} 
                onClick={() => handleApplyPreset('large')} 
              />
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Settings Panel */}
            <div className="space-y-4">
              <Tabs defaultValue="fonts" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="fonts" className="flex items-center gap-1">
                    <Type className="h-4 w-4" />
                    Fonts
                  </TabsTrigger>
                  <TabsTrigger value="spacing" className="flex items-center gap-1">
                    <MoveVertical className="h-4 w-4" />
                    Spacing
                  </TabsTrigger>
                  <TabsTrigger value="margins" className="flex items-center gap-1">
                    <Box className="h-4 w-4" />
                    Margins
                  </TabsTrigger>
                  <TabsTrigger value="text" className="flex items-center gap-1">
                    <MessageSquare className="h-4 w-4" />
                    Text
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="fonts" className="space-y-4 mt-4">
                  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Header Section</h4>
                    <SliderControl
                      label="Title Font Size (ANNEXURE-4)"
                      value={config.headerFontSize}
                      min={8}
                      max={18}
                      step={0.5}
                      onChange={(v) => updateConfig('headerFontSize', v)}
                    />
                    <SliderControl
                      label="Sub-header Font Size ([See para 105])"
                      value={config.subHeaderFontSize}
                      min={6}
                      max={14}
                      step={0.5}
                      onChange={(v) => updateConfig('subHeaderFontSize', v)}
                    />
                  </div>

                  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Body Content</h4>
                    <SliderControl
                      label="Body Text Font Size"
                      value={config.bodyFontSize}
                      min={6}
                      max={12}
                      step={0.5}
                      onChange={(v) => updateConfig('bodyFontSize', v)}
                    />
                    <SliderControl
                      label="Label Font Size (Name, Address)"
                      value={config.labelFontSize}
                      min={6}
                      max={12}
                      step={0.5}
                      onChange={(v) => updateConfig('labelFontSize', v)}
                    />
                  </div>

                  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Footer & Notes</h4>
                    <SliderControl
                      label="Footer Font Size"
                      value={config.footerFontSize}
                      min={6}
                      max={12}
                      step={0.5}
                      onChange={(v) => updateConfig('footerFontSize', v)}
                    />
                    <SliderControl
                      label="Note Font Size"
                      value={config.noteFontSize}
                      min={5}
                      max={10}
                      step={0.5}
                      onChange={(v) => updateConfig('noteFontSize', v)}
                    />
                    <SliderControl
                      label="Signature Font Size"
                      value={config.signatureFontSize}
                      min={6}
                      max={12}
                      step={0.5}
                      onChange={(v) => updateConfig('signatureFontSize', v)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="spacing" className="space-y-4 mt-4">
                  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Line Spacing</h4>
                    <SliderControl
                      label="Line Height"
                      value={config.lineSpacing}
                      min={2}
                      max={6}
                      step={0.25}
                      unit="mm"
                      onChange={(v) => updateConfig('lineSpacing', v)}
                    />
                    <SliderControl
                      label="Signature Spacing"
                      value={config.signatureSpacing}
                      min={2}
                      max={8}
                      step={0.5}
                      unit="mm"
                      onChange={(v) => updateConfig('signatureSpacing', v)}
                    />
                  </div>

                  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Section Heights</h4>
                    <SliderControl
                      label="Header Height"
                      value={config.headerHeight}
                      min={8}
                      max={20}
                      step={1}
                      unit="mm"
                      onChange={(v) => updateConfig('headerHeight', v)}
                    />
                    <SliderControl
                      label="Footer Height"
                      value={config.footerHeight}
                      min={6}
                      max={16}
                      step={1}
                      unit="mm"
                      onChange={(v) => updateConfig('footerHeight', v)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="margins" className="space-y-4 mt-4">
                  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Page Margins</h4>
                    <SliderControl
                      label="Page Margin"
                      value={config.pageMargin}
                      min={5}
                      max={20}
                      step={1}
                      unit="mm"
                      onChange={(v) => updateConfig('pageMargin', v)}
                    />
                    <SliderControl
                      label="Content Margin"
                      value={config.contentMargin}
                      min={1}
                      max={6}
                      step={0.5}
                      unit="mm"
                      onChange={(v) => updateConfig('contentMargin', v)}
                    />
                  </div>

                  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Box & Padding</h4>
                    <SliderControl
                      label="Box Padding"
                      value={config.boxPadding}
                      min={1}
                      max={8}
                      step={0.5}
                      unit="mm"
                      onChange={(v) => updateConfig('boxPadding', v)}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="text" className="space-y-4 mt-4 max-h-[400px] overflow-y-auto pr-2">
                  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Header Text</h4>
                    <div className="space-y-2">
                      <Label className="text-sm">Title</Label>
                      <Input
                        value={config.textContent.headerTitle}
                        onChange={(e) => updateTextConfig('headerTitle', e.target.value)}
                        placeholder="ANNEXURE-4"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Subtitle</Label>
                      <Input
                        value={config.textContent.headerSubtitle}
                        onChange={(e) => updateTextConfig('headerSubtitle', e.target.value)}
                        placeholder="[See para 105]"
                      />
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Left Column (Memo)</h4>
                    <div className="space-y-2">
                      <Label className="text-sm">Column Title</Label>
                      <Input
                        value={config.textContent.leftColumnTitle}
                        onChange={(e) => updateTextConfig('leftColumnTitle', e.target.value)}
                        placeholder="Memo of Verification"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Address Section Label</Label>
                      <Input
                        value={config.textContent.addressSectionLabel}
                        onChange={(e) => updateTextConfig('addressSectionLabel', e.target.value)}
                        placeholder="The name and address of depositor are as below:"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Verification Instruction</Label>
                      <Textarea
                        value={config.textContent.verificationInstruction}
                        onChange={(e) => updateTextConfig('verificationInstruction', e.target.value)}
                        placeholder="Kindly verify the genuineness..."
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Right Column (Reply)</h4>
                    <div className="space-y-2">
                      <Label className="text-sm">Column Title</Label>
                      <Input
                        value={config.textContent.rightColumnTitle}
                        onChange={(e) => updateTextConfig('rightColumnTitle', e.target.value)}
                        placeholder="Reply"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Reply Text</Label>
                      <Textarea
                        value={config.textContent.replyText}
                        onChange={(e) => updateTextConfig('replyText', e.target.value)}
                        placeholder="The result of verification..."
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Investigation Text</Label>
                      <Input
                        value={config.textContent.investigationText}
                        onChange={(e) => updateTextConfig('investigationText', e.target.value)}
                        placeholder="Investigation has been taken up."
                      />
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg space-y-4 bg-muted/30">
                    <h4 className="font-medium text-sm">Footer & Labels</h4>
                    <div className="space-y-2">
                      <Label className="text-sm">Note Text</Label>
                      <Textarea
                        value={config.textContent.noteText}
                        onChange={(e) => updateTextConfig('noteText', e.target.value)}
                        placeholder="The verification memo should be returned..."
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-2">
                        <Label className="text-sm">To Label</Label>
                        <Input
                          value={config.textContent.toLabel}
                          onChange={(e) => updateTextConfig('toLabel', e.target.value)}
                          placeholder="To"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Inspector Label</Label>
                        <Input
                          value={config.textContent.inspectorLabel}
                          onChange={(e) => updateTextConfig('inspectorLabel', e.target.value)}
                          placeholder="Inspector of Posts,"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">SPM Label</Label>
                        <Input
                          value={config.textContent.subPostmasterLabel}
                          onChange={(e) => updateTextConfig('subPostmasterLabel', e.target.value)}
                          placeholder="Sub Post Master"
                        />
                      </div>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
                <Button variant="outline" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </Button>
                <Button 
                  variant="secondary" 
                  onClick={generatePreview}
                  disabled={isGeneratingPreview}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {isGeneratingPreview ? 'Generating...' : 'Preview'}
                </Button>
              </div>
            </div>

            {/* Preview Panel */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Live Preview</Label>
              <div className="border rounded-lg bg-muted/30 h-[500px] flex items-center justify-center overflow-hidden">
                {previewUrl ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full rounded-lg"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="text-center text-muted-foreground p-8">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Click "Preview" to see how your memo will look</p>
                    <p className="text-xs mt-2">Adjust settings and preview to fine-tune the format</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
