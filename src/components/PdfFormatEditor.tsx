import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { PdfFormatConfig, getPdfConfig, savePdfConfig, resetPdfConfig, DEFAULT_PDF_CONFIG } from '@/lib/pdfConfig';
import { RotateCcw, Save, Eye, FileText, Type, MoveVertical, Box } from 'lucide-react';
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

export const PdfFormatEditor = () => {
  const [config, setConfig] = useState<PdfFormatConfig>(getPdfConfig());
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const { toast } = useToast();

  const updateConfig = <K extends keyof PdfFormatConfig>(key: K, value: PdfFormatConfig[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

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
    toast({
      title: 'Settings Reset',
      description: 'PDF format settings have been reset to defaults.',
    });
  };

  const generatePreview = useCallback(async () => {
    setIsGeneratingPreview(true);
    try {
      // Save current config temporarily for preview
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

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            PDF Format Editor
          </CardTitle>
          <CardDescription>
            Customize font sizes, spacing, and margins for generated memo PDFs. 
            Changes will apply to all future PDF generations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Settings Panel */}
            <div className="space-y-4">
              <Tabs defaultValue="fonts" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
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
              <div className="border rounded-lg bg-muted/30 h-[600px] flex items-center justify-center overflow-hidden">
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
        </CardContent>
      </Card>
    </div>
  );
};
