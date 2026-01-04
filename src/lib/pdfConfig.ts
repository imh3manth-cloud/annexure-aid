// PDF Format Configuration

export interface PdfFormatConfig {
  // Page settings
  pageMargin: number;
  
  // Header settings
  headerFontSize: number;
  subHeaderFontSize: number;
  headerHeight: number;
  
  // Body settings
  bodyFontSize: number;
  labelFontSize: number;
  lineSpacing: number;
  
  // Content margins
  contentMargin: number;
  boxPadding: number;
  
  // Footer settings
  footerHeight: number;
  footerFontSize: number;
  noteFontSize: number;
  
  // Signature section
  signatureFontSize: number;
  signatureSpacing: number;
}

export type PresetName = 'compact' | 'standard' | 'large';

export interface PdfPreset {
  name: string;
  description: string;
  config: PdfFormatConfig;
}

export const COMPACT_CONFIG: PdfFormatConfig = {
  pageMargin: 8,
  headerFontSize: 10,
  subHeaderFontSize: 8,
  headerHeight: 8,
  bodyFontSize: 7,
  labelFontSize: 7,
  lineSpacing: 2.5,
  contentMargin: 1.5,
  boxPadding: 2,
  footerHeight: 8,
  footerFontSize: 7,
  noteFontSize: 6,
  signatureFontSize: 7,
  signatureSpacing: 2
};

export const DEFAULT_PDF_CONFIG: PdfFormatConfig = {
  pageMargin: 10,
  headerFontSize: 12,
  subHeaderFontSize: 10,
  headerHeight: 10,
  bodyFontSize: 8,
  labelFontSize: 8,
  lineSpacing: 3.5,
  contentMargin: 2,
  boxPadding: 3,
  footerHeight: 10,
  footerFontSize: 8,
  noteFontSize: 7,
  signatureFontSize: 8,
  signatureSpacing: 3
};

export const LARGE_PRINT_CONFIG: PdfFormatConfig = {
  pageMargin: 12,
  headerFontSize: 14,
  subHeaderFontSize: 12,
  headerHeight: 12,
  bodyFontSize: 10,
  labelFontSize: 10,
  lineSpacing: 4.5,
  contentMargin: 3,
  boxPadding: 4,
  footerHeight: 12,
  footerFontSize: 10,
  noteFontSize: 9,
  signatureFontSize: 10,
  signatureSpacing: 4
};

export const PDF_PRESETS: Record<PresetName, PdfPreset> = {
  compact: {
    name: 'Compact',
    description: 'Smaller fonts and tighter spacing for more content per page',
    config: COMPACT_CONFIG
  },
  standard: {
    name: 'Standard',
    description: 'Balanced layout with comfortable reading size',
    config: DEFAULT_PDF_CONFIG
  },
  large: {
    name: 'Large Print',
    description: 'Larger fonts and generous spacing for easy reading',
    config: LARGE_PRINT_CONFIG
  }
};

const STORAGE_KEY = 'pdfFormatConfig';

export const getPdfConfig = (): PdfFormatConfig => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return { ...DEFAULT_PDF_CONFIG, ...JSON.parse(saved) };
    } catch {
      return DEFAULT_PDF_CONFIG;
    }
  }
  return DEFAULT_PDF_CONFIG;
};

export const savePdfConfig = (config: PdfFormatConfig): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent('pdfConfigUpdated', { detail: config }));
};

export const resetPdfConfig = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('pdfConfigUpdated', { detail: DEFAULT_PDF_CONFIG }));
};

export const applyPreset = (presetName: PresetName): PdfFormatConfig => {
  const preset = PDF_PRESETS[presetName];
  savePdfConfig(preset.config);
  return preset.config;
};
