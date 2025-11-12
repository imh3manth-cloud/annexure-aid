import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface HFTITransaction {
  txn_date: string;
  account: string;
  txn_id: string;
  amount: number;
  particulars: string;
}

export interface LastBalanceRecord {
  account: string;
  name: string;
  address: string;
  bo_name?: string;
}

// Normalize header names
const normalizeHeader = (header: string): string => {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
};

// Parse HFTI Excel file
export const parseHFTIFile = (file: File): Promise<HFTITransaction[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        const transactions: HFTITransaction[] = jsonData.map((row: any) => {
          // Find date column
          const txnDate = row['Transaction Date'] || row['transaction_date'] || row['txn_date'] || row['date'] || '';
          
          // Find account column
          const account = String(row['A/c. ID'] || row['a/c_id'] || row['ac_id'] || row['account_id'] || row['account_no'] || '').trim();
          
          // Find transaction ID
          const txnId = row['Transaction ID'] || row['txn_id'] || row['tran_id'] || row['reference'] || '';
          
          // Find amount
          let amountStr = row['Amt.'] || row['amount'] || row['withdrawal_amt'] || row['debit_amount'] || '0';
          if (typeof amountStr === 'string') {
            amountStr = amountStr.replace(/[^\d.]/g, '');
          }
          const amount = parseFloat(amountStr) || 0;
          
          // Find particulars
          const particulars = row['Particulars'] || row['particulars'] || row['narration'] || '';
          
          // Parse date to ISO format
          let isoDate = '';
          if (txnDate) {
            try {
              const dateObj = XLSX.SSF.parse_date_code(txnDate);
              if (dateObj) {
                isoDate = `${dateObj.y}-${String(dateObj.m).padStart(2, '0')}-${String(dateObj.d).padStart(2, '0')}`;
              } else if (typeof txnDate === 'string') {
                // Try parsing string date
                const parts = txnDate.split('/');
                if (parts.length === 3) {
                  const [m, d, y] = parts;
                  const fullYear = y.length === 2 ? `20${y}` : y;
                  isoDate = `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                }
              }
            } catch {
              isoDate = String(txnDate);
            }
          }
          
          return {
            txn_date: isoDate,
            account,
            txn_id: String(txnId),
            amount,
            particulars: String(particulars)
          };
        });
        
        resolve(transactions.filter(t => t.account && t.amount > 0));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// Parse Last Balance CSV files
export const parseLastBalanceCSV = (file: File): Promise<LastBalanceRecord[]> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const records: LastBalanceRecord[] = [];
          
          for (const row of results.data as any[]) {
            // Find account number
            const account = String(
              row['Account Number'] ||
              row['account_number'] ||
              row['ac_no'] ||
              row['a/c_id'] ||
              ''
            ).trim();
            
            // Find name (prefer Cust1 Name)
            let name = row['Cust1 Name'] || row['cust1_name'] || row['depositor_name'] || 
                       row['customer_name'] || row['name'] || '';
            
            // Check for Cust2 Name and concatenate if exists
            const name2 = row['Cust2 Name'] || row['cust2_name'] || '';
            if (name2 && name2.trim() && name2.trim() !== ',') {
              name = `${name} ${name2}`.trim();
            }
            
            // Find address
            const address = row['Address'] || row['address'] || row['full_address'] || '';
            
            // Find BO Name
            const boName = row['BO Name'] || row['bo_name'] || row['branch'] || '';
            
            if (account && name) {
              records.push({
                account,
                name: String(name).trim(),
                address: String(address).trim(),
                bo_name: String(boName).trim()
              });
            }
          }
          
          resolve(records);
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error)
    });
  });
};

// Detect BO code from particulars
export const detectBOCode = (particulars: string): { code: string; name: string } => {
  const boMap: Record<string, string> = {
    '01': 'Chiduravalli BO',
    '02': 'Doddebagilu BO',
    '03': 'Horalahalli BO',
    '04': 'Kolathur BO',
    '05': 'Somanathapura BO',
    '06': 'Ukkalagere BO',
    '07': 'Vyasarajapura BO'
  };
  
  // Try 2-digit pattern first
  const match2 = particulars.match(/BO(\d{2})/i);
  if (match2) {
    const code = match2[1];
    return { code, name: boMap[code] || 'Unknown' };
  }
  
  // Try 11-digit pattern and extract last 2 digits
  const match11 = particulars.match(/BO(\d{11})/i);
  if (match11) {
    const fullCode = match11[1];
    const code = fullCode.slice(-2);
    return { code, name: boMap[code] || 'Unknown' };
  }
  
  return { code: 'Unknown', name: 'Unknown' };
};
