import * as XLSX from 'xlsx';
import Papa from 'papaparse';

export interface HFTITransaction {
  txn_date: string;
  account: string;
  txn_id: string;
  amount: number;
  particulars: string;
  debit_credit: 'D' | 'C';
}

export interface LastBalanceRecord {
  account: string;
  name: string;
  address: string;
  balance: number;
  balance_date: string;
  bo_name: string;
  scheme_type: string;
}

export interface ColumnMapping {
  account: number | null;
  name: number | null;
  name2: number | null;
  address: number | null;
  balance: number | null;
  scheme_type: number | null;
  status: number | null;
  bo_name: number | null;
}

export interface RawCSVData {
  headers: string[];
  rows: string[][];
  preparedDate: string;
  autoMapping: ColumnMapping;
  headerRowIndex: number;
  detectedScheme: string;
}

// Normalize header names
const normalizeHeader = (header: string): string => {
  return header
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .trim();
};

// Parse HFTI Excel file - returns ALL transactions with debit/credit flag
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
          
          // Find account column - normalize by removing non-numeric chars and leading zeros
          const accountRaw = row['A/c. ID'] || row['a/c_id'] || row['ac_id'] || row['account_id'] || row['account_no'] || '';
          let account = String(accountRaw).trim();
          // Remove all non-numeric characters
          account = account.replace(/\D/g, '');
          // Remove leading zeros but keep the number as string
          account = account.replace(/^0+/, '') || '0';
          
          console.log('HFTI - Raw:', accountRaw, '-> Normalized:', account);
          
          // Find transaction ID
          const txnId = row['Transaction ID'] || row['txn_id'] || row['tran_id'] || row['reference'] || '';
          
          // Find amount - check if it ends with 'D' (debit) or 'C' (credit)
          let amountStr = row['Amt.'] || row['amount'] || row['withdrawal_amt'] || row['debit_amount'] || '0';
          let debitCredit: 'D' | 'C' = 'D';
          if (typeof amountStr === 'string') {
            const trimmed = amountStr.trim().toUpperCase();
            if (trimmed.endsWith('D')) {
              debitCredit = 'D';
            } else if (trimmed.endsWith('C')) {
              debitCredit = 'C';
            }
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
            particulars: String(particulars),
            debit_credit: debitCredit
          };
        });
        
        resolve(transactions.filter(t => t && t.account && t.amount > 0));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// Extract raw CSV data for manual mapping
export const extractRawCSVData = (file: File): Promise<RawCSVData> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results) => {
        try {
         const rows = results.data as string[][];
          
          // Known scheme patterns to detect from file content
          const SCHEME_KEYWORDS = ['SSA', 'SBCHQ', 'SBGEN', 'SBBAS', 'RD', 'TD', 'MIS', 'SCSS', 'PPF', 'NSC', 'KVP'];
          
          // Extract prepared date and detect scheme from metadata rows
          let preparedDate = new Date().toISOString().split('T')[0];
          let detectedScheme = '';
          
          for (let i = 0; i < Math.min(15, rows.length); i++) {
            const row = rows[i];
            const rowText = row.join(' ');
            const rowTextLower = rowText.toLowerCase();
            
            // Detect scheme from metadata rows (before header row)
            if (!detectedScheme) {
              const rowTextUpper = rowText.toUpperCase();
              for (const scheme of SCHEME_KEYWORDS) {
                // Match scheme as whole word or part of a product code
                if (new RegExp(`\\b${scheme}\\b`, 'i').test(rowTextUpper) ||
                    rowTextUpper.includes(`/${scheme}`) || 
                    rowTextUpper.includes(`${scheme}/`) ||
                    rowTextUpper.includes(`-${scheme}`) ||
                    rowTextUpper.includes(`${scheme}-`)) {
                  detectedScheme = scheme;
                  break;
                }
              }
            }
            
            if (rowTextLower.includes('prepared') || rowTextLower.includes('date') || rowTextLower.includes('as on') || rowTextLower.includes('timestamp')) {
              for (let j = 0; j < row.length; j++) {
                const cell = String(row[j] || '').trim();
                const dateMatch = cell.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
                if (dateMatch) {
                  const [, d1, d2, year] = dateMatch;
                  const fullYear = year.length === 2 ? `20${year}` : year;
                  const day = parseInt(d1) > 12 ? d1 : d2;
                  const month = parseInt(d1) > 12 ? d2 : d1;
                  preparedDate = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  break;
                }
              }
            }
          }
          
          // Find header row and auto-detect mappings
          let headerRowIndex = -1;
          let autoMapping: ColumnMapping = {
            account: null,
            name: null,
            name2: null,
            address: null,
            balance: null,
            scheme_type: null,
            status: null,
            bo_name: null
          };
          
          for (let i = 0; i < Math.min(20, rows.length); i++) {
            const row = rows[i];
            const rowStr = row.map((c: any) => String(c || '').toLowerCase()).join('|');
            
            if (rowStr.includes('account') && (rowStr.includes('name') || rowStr.includes('cust'))) {
              headerRowIndex = i;
              
              row.forEach((cell: any, idx: number) => {
                const headerLower = String(cell || '').toLowerCase().trim();
                
                if (headerLower.includes('account') && (headerLower.includes('number') || headerLower.includes('no') || headerLower.includes('id'))) {
                  autoMapping.account = idx;
                } else if (headerLower.includes('scheme') || headerLower.includes('product')) {
                  autoMapping.scheme_type = idx;
                } else if (headerLower.includes('status') || headerLower.includes('a/c status') || headerLower.includes('account status')) {
                  autoMapping.status = idx;
                } else if ((headerLower.includes('cust') && headerLower.includes('name')) || 
                           headerLower === 'name' || headerLower === 'customer name') {
                  if (autoMapping.name === null) autoMapping.name = idx;
                  else if (autoMapping.name2 === null) autoMapping.name2 = idx;
                } else if (headerLower.includes('cust1') || headerLower.includes('cust 1')) {
                  autoMapping.name = idx;
                } else if (headerLower.includes('cust2') || headerLower.includes('cust 2')) {
                  autoMapping.name2 = idx;
                } else if (headerLower.includes('address') || headerLower.includes('addr')) {
                  autoMapping.address = idx;
                } else if (headerLower.includes('balance') || headerLower.includes('bal') || 
                           headerLower.includes('outstanding') || headerLower.includes('amount')) {
                  if (autoMapping.balance === null) autoMapping.balance = idx;
                } else if (headerLower.includes('bo') || headerLower.includes('branch') || 
                           headerLower.includes('office name') || headerLower.includes('so name')) {
                  autoMapping.bo_name = idx;
                }
              });
              break;
            }
          }
          
          if (headerRowIndex === -1) {
            // Fallback: use first row with multiple columns as header
            for (let i = 0; i < Math.min(10, rows.length); i++) {
              if (rows[i].length >= 5) {
                headerRowIndex = i;
                break;
              }
            }
          }
          
          const headers = headerRowIndex >= 0 ? rows[headerRowIndex].map(h => String(h || '').trim()) : [];
          const dataRows = headerRowIndex >= 0 ? rows.slice(headerRowIndex + 1) : rows;
          
          resolve({
            headers,
            rows: dataRows,
            preparedDate,
            autoMapping,
            headerRowIndex,
            detectedScheme
          });
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error)
    });
  });
};

// Apply column mapping to raw data to create records
export const applyColumnMapping = (
  rawData: RawCSVData,
  mapping: ColumnMapping
): LastBalanceRecord[] => {
  const records: LastBalanceRecord[] = [];
  
  for (const row of rawData.rows) {
    if (!row || row.length < 3) continue;
    
    // Extract account
    let account = '';
    if (mapping.account !== null && row[mapping.account]) {
      const accountRaw = String(row[mapping.account]).trim();
      account = accountRaw.replace(/\D/g, '');
      account = account.replace(/^0+/, '') || '0';
    }
    
    if (!account || account === '0' || isNaN(Number(account))) continue;
    
    // Extract name
    let name = '';
    if (mapping.name !== null && row[mapping.name]) {
      name = String(row[mapping.name]).trim();
    }
    if (mapping.name2 !== null && row[mapping.name2]) {
      const name2 = String(row[mapping.name2]).trim();
      if (name2 && name2 !== ',' && name2 !== ' ') {
        name = name ? `${name} ${name2}`.trim() : name2;
      }
    }
    
    if (!name) continue;
    
    // Extract address
    let address = '';
    if (mapping.address !== null && row[mapping.address]) {
      address = String(row[mapping.address]).trim();
    }
    
    // Extract balance
    let balance = 0;
    if (mapping.balance !== null && row[mapping.balance]) {
      const balanceRaw = String(row[mapping.balance]).trim();
      balance = parseFloat(balanceRaw.replace(/[^0-9.-]/g, '')) || 0;
    }
    
    // Fallback: scan for balance-like values if not mapped
    if (balance === 0 && mapping.balance === null) {
      for (let colIdx = 0; colIdx < row.length; colIdx++) {
        const cellValue = String(row[colIdx] || '').trim();
        if (/^\d{1,3}(,?\d{3})*(\.\d{1,2})?$/.test(cellValue.replace(/[₹Rs\s]/g, ''))) {
          const parsed = parseFloat(cellValue.replace(/[^0-9.-]/g, ''));
          if (!isNaN(parsed) && parsed > 100) {
            balance = parsed;
            break;
          }
        }
      }
    }
    
    // Extract scheme type
    let schemeType = '';
    if (mapping.scheme_type !== null && row[mapping.scheme_type]) {
      schemeType = String(row[mapping.scheme_type]).trim();
    }
    
    // Extract and combine status
    let status = '';
    if (mapping.status !== null && row[mapping.status]) {
      status = String(row[mapping.status]).trim();
    }
    if (status && schemeType) {
      schemeType = `${schemeType} (${status})`;
    } else if (status) {
      schemeType = status;
    }
    
    // Extract BO Name
    let boName = '';
    if (mapping.bo_name !== null && row[mapping.bo_name]) {
      boName = String(row[mapping.bo_name]).trim();
    }
    
    records.push({
      account,
      name,
      address,
      balance,
      balance_date: rawData.preparedDate,
      bo_name: boName,
      scheme_type: schemeType
    });
  }
  
  return records;
};

// Parse Last Balance CSV files (legacy - uses auto-detection)
export const parseLastBalanceCSV = (file: File): Promise<{ records: LastBalanceRecord[]; preparedDate: string }> => {
  return new Promise(async (resolve, reject) => {
    try {
      const rawData = await extractRawCSVData(file);
      const records = applyColumnMapping(rawData, rawData.autoMapping);
      resolve({ records, preparedDate: rawData.preparedDate });
    } catch (error) {
      reject(error);
    }
  });
};

// Detect BO code from particulars - now uses config
import { detectBOFromConfig } from './config';

export const detectBOCode = detectBOFromConfig;
