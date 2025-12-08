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

export const DEFAULT_PDF_CONFIG: PdfFormatConfig = {
  // Page settings
  pageMargin: 10,
  
  // Header settings
  headerFontSize: 12,
  subHeaderFontSize: 10,
  headerHeight: 10,
  
  // Body settings
  bodyFontSize: 8,
  labelFontSize: 8,
  lineSpacing: 3.5,
  
  // Content margins
  contentMargin: 2,
  boxPadding: 3,
  
  // Footer settings
  footerHeight: 10,
  footerFontSize: 8,
  noteFontSize: 7,
  
  // Signature section
  signatureFontSize: 8,
  signatureSpacing: 3
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
  // Dispatch event for other components to react
  window.dispatchEvent(new CustomEvent('pdfConfigUpdated', { detail: config }));
};

export const resetPdfConfig = (): void => {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent('pdfConfigUpdated', { detail: DEFAULT_PDF_CONFIG }));
};
