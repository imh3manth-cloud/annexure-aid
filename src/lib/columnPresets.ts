import { ColumnMapping } from './fileParser';

export interface ColumnMappingPreset {
  id: string;
  name: string;
  mapping: ColumnMapping;
  headerPattern: string[]; // Normalized headers for matching
  columnCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PresetMatch {
  preset: ColumnMappingPreset;
  score: number; // 0-100 match percentage
  matchedHeaders: number;
  totalHeaders: number;
}

const PRESETS_STORAGE_KEY = 'csv_column_mapping_presets';

// Normalize header for comparison (lowercase, trim, remove special chars)
const normalizeHeader = (header: string): string => {
  return header.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
};

// Create a fingerprint from headers for matching
const createHeaderPattern = (headers: string[]): string[] => {
  return headers.map(normalizeHeader).filter(h => h.length > 0);
};

export const getPresets = (): ColumnMappingPreset[] => {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!stored) return [];
    const presets = JSON.parse(stored);
    // Migrate old presets without headerPattern
    return presets.map((p: ColumnMappingPreset) => ({
      ...p,
      headerPattern: p.headerPattern || [],
      columnCount: p.columnCount || 0
    }));
  } catch (error) {
    console.error('Failed to load column mapping presets:', error);
    return [];
  }
};

export const savePreset = (name: string, mapping: ColumnMapping, headers: string[]): ColumnMappingPreset => {
  const presets = getPresets();
  const now = new Date().toISOString();
  
  const newPreset: ColumnMappingPreset = {
    id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    mapping,
    headerPattern: createHeaderPattern(headers),
    columnCount: headers.length,
    createdAt: now,
    updatedAt: now
  };
  
  presets.push(newPreset);
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  
  return newPreset;
};

export const updatePreset = (id: string, mapping: ColumnMapping, headers?: string[]): ColumnMappingPreset | null => {
  const presets = getPresets();
  const index = presets.findIndex(p => p.id === id);
  
  if (index === -1) return null;
  
  presets[index] = {
    ...presets[index],
    mapping,
    ...(headers && {
      headerPattern: createHeaderPattern(headers),
      columnCount: headers.length
    }),
    updatedAt: new Date().toISOString()
  };
  
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  return presets[index];
};

export const deletePreset = (id: string): boolean => {
  const presets = getPresets();
  const filtered = presets.filter(p => p.id !== id);
  
  if (filtered.length === presets.length) return false;
  
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(filtered));
  return true;
};

export const renamePreset = (id: string, newName: string): ColumnMappingPreset | null => {
  const presets = getPresets();
  const index = presets.findIndex(p => p.id === id);
  
  if (index === -1) return null;
  
  presets[index] = {
    ...presets[index],
    name: newName.trim(),
    updatedAt: new Date().toISOString()
  };
  
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  return presets[index];
};

// Find matching presets based on CSV headers
export const findMatchingPresets = (headers: string[], minScore: number = 60): PresetMatch[] => {
  const presets = getPresets();
  if (presets.length === 0 || headers.length === 0) return [];
  
  const normalizedHeaders = createHeaderPattern(headers);
  const matches: PresetMatch[] = [];
  
  for (const preset of presets) {
    if (!preset.headerPattern || preset.headerPattern.length === 0) continue;
    
    // Count matching headers
    let matchedCount = 0;
    const presetHeaders = new Set(preset.headerPattern);
    
    for (const header of normalizedHeaders) {
      if (presetHeaders.has(header)) {
        matchedCount++;
      }
    }
    
    // Also check if column count is similar (within 20%)
    const columnCountDiff = Math.abs(preset.columnCount - headers.length);
    const columnCountSimilarity = 1 - (columnCountDiff / Math.max(preset.columnCount, headers.length));
    
    // Calculate score based on header matches and column count similarity
    const headerMatchScore = (matchedCount / Math.max(preset.headerPattern.length, normalizedHeaders.length)) * 100;
    const score = (headerMatchScore * 0.8) + (columnCountSimilarity * 20);
    
    if (score >= minScore) {
      matches.push({
        preset,
        score: Math.round(score),
        matchedHeaders: matchedCount,
        totalHeaders: preset.headerPattern.length
      });
    }
  }
  
  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score);
};

// Get the best matching preset if score is high enough
export const getBestMatch = (headers: string[], minScore: number = 75): PresetMatch | null => {
  const matches = findMatchingPresets(headers, minScore);
  return matches.length > 0 ? matches[0] : null;
};
