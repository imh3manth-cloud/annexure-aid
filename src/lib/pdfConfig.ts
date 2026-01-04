// PDF Format Configuration

export interface PdfTextConfig {
  // Headers
  headerTitle: string;
  headerSubtitle: string;
  
  // Left column (Memo of Verification)
  leftColumnTitle: string;
  verificationInstruction: string;
  addressSectionLabel: string;
  
  // Right column (Reply)
  rightColumnTitle: string;
  replyText: string;
  investigationText: string;
  
  // Footer note
  noteText: string;
  
  // Signature labels
  toLabel: string;
  inspectorLabel: string;
  subPostmasterLabel: string;
}

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
  
  // Text content
  textContent: PdfTextConfig;
}

export type PresetName = 'compact' | 'standard' | 'large';

export interface PdfPreset {
  name: string;
  description: string;
  config: PdfFormatConfig;
}

export const DEFAULT_TEXT_CONFIG: PdfTextConfig = {
  headerTitle: 'ANNEXURE-4',
  headerSubtitle: '[See para 105]',
  leftColumnTitle: 'Memo of Verification',
  verificationInstruction: 'Kindly verify the genuineness of the withdrawal by contacting the depositor and intimate result within 10/30 days.',
  addressSectionLabel: 'The name and address of depositor are as below:',
  rightColumnTitle: 'Reply',
  replyText: 'The result of verification of the withdrawal particularised in the margin has been found satisfactory / not satisfactory.',
  investigationText: 'Investigation has been taken up.',
  noteText: 'The verification memo should be returned to the HO/SO within 10 days in case where the place of residence of the depositor lies in the jurisdiction of a Public Relations Inspector and within 30 days in all other cases.',
  toLabel: 'To',
  inspectorLabel: 'Inspector of Posts,',
  subPostmasterLabel: 'Sub Post Master'
};

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
  signatureSpacing: 2,
  textContent: DEFAULT_TEXT_CONFIG
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
  signatureSpacing: 3,
  textContent: DEFAULT_TEXT_CONFIG
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
  signatureSpacing: 4,
  textContent: DEFAULT_TEXT_CONFIG
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
      const parsed = JSON.parse(saved);
      return { 
        ...DEFAULT_PDF_CONFIG, 
        ...parsed,
        textContent: { ...DEFAULT_TEXT_CONFIG, ...parsed.textContent }
      };
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
