interface AppConfig {
  officeName: string;
  subdivision: string;
  boMappings: Record<string, string>;
}

const DEFAULT_CONFIG: AppConfig = {
  officeName: 'OLD SOSALE S.O',
  subdivision: 'T NARASIPURA SUB DIVISION',
  boMappings: {
    '1': 'Chiduravalli BO',
    '2': 'Doddebagilu BO',
    '3': 'Horalahalli BO',
    '4': 'Kolathur BO',
    '5': 'Somanathapura BO',
    '6': 'Ukkalagere BO',
    '7': 'Vyasarajapura BO'
  }
};

export const getConfig = (): AppConfig => {
  const saved = localStorage.getItem('appConfig');
  if (saved) {
    return JSON.parse(saved);
  }
  return DEFAULT_CONFIG;
};

export const detectBOFromConfig = (particulars: string): { code: string; name: string } => {
  const config = getConfig();
  
  // Try 11-digit pattern: BO21309111001 through BO21309111007
  const match11 = particulars.match(/BO(\d{11})/i);
  if (match11) {
    const fullCode = match11[1];
    const lastDigit = fullCode.slice(-1);
    return { 
      code: lastDigit, 
      name: config.boMappings[lastDigit] || 'Unknown' 
    };
  }
  
  // Fallback: try single digit after BO
  const match1 = particulars.match(/BO[^\d]*([1-7])/i);
  if (match1) {
    const code = match1[1];
    return { 
      code, 
      name: config.boMappings[code] || 'Unknown' 
    };
  }
  
  return { code: 'Unknown', name: 'Unknown' };
};
