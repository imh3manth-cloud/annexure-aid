import { ColumnMapping } from './fileParser';

export interface ColumnMappingPreset {
  id: string;
  name: string;
  mapping: ColumnMapping;
  createdAt: string;
  updatedAt: string;
}

const PRESETS_STORAGE_KEY = 'csv_column_mapping_presets';

export const getPresets = (): ColumnMappingPreset[] => {
  try {
    const stored = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error('Failed to load column mapping presets:', error);
    return [];
  }
};

export const savePreset = (name: string, mapping: ColumnMapping): ColumnMappingPreset => {
  const presets = getPresets();
  const now = new Date().toISOString();
  
  const newPreset: ColumnMappingPreset = {
    id: `preset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: name.trim(),
    mapping,
    createdAt: now,
    updatedAt: now
  };
  
  presets.push(newPreset);
  localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  
  return newPreset;
};

export const updatePreset = (id: string, mapping: ColumnMapping): ColumnMappingPreset | null => {
  const presets = getPresets();
  const index = presets.findIndex(p => p.id === id);
  
  if (index === -1) return null;
  
  presets[index] = {
    ...presets[index],
    mapping,
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
