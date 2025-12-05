interface AppConfig {
  officeName: string;
  subdivision: string;
  division: string;
  boMappings: Record<string, string>;
}

const DEFAULT_CONFIG: AppConfig = {
  officeName: 'OLD SOSALE S.O',
  subdivision: 'T NARASIPURA SUB DIVISION',
  division: 'MYSORE DIVISION',
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
  
  // Try full BO code pattern: BO21309111001 through BO21309111007
  const match11 = particulars.match(/BO(\d{11})/i);
  if (match11) {
    const fullCode = `BO${match11[1]}`;
    const lastDigit = match11[1].slice(-1);
    return { 
      code: fullCode, // Return full BO code like BO21309111001
      name: config.boMappings[lastDigit] || 'Unknown' 
    };
  }
  
  // Fallback: try single digit after BO
  const match1 = particulars.match(/BO[^\d]*([1-7])/i);
  if (match1) {
    const code = match1[1];
    return { 
      code: `BO2130911100${code}`, // Generate full BO code
      name: config.boMappings[code] || 'Unknown' 
    };
  }
  
  return { code: 'BO_UNKNOWN', name: 'Unknown' };
};
