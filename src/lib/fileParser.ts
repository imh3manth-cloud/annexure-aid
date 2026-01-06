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
  balance: number;
  balance_date: string;
  bo_name: string;
  scheme_type: string;
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
          
          // Find amount - only process if it ends with 'D' (debit)
          let amountStr = row['Amt.'] || row['amount'] || row['withdrawal_amt'] || row['debit_amount'] || '0';
          let isDebit = false;
          if (typeof amountStr === 'string') {
            isDebit = amountStr.trim().toUpperCase().endsWith('D');
            amountStr = amountStr.replace(/[^\d.]/g, '');
          }
          const amount = parseFloat(amountStr) || 0;
          
          // Skip if not a debit transaction
          if (!isDebit) {
            return null;
          }
          
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
        
        resolve(transactions.filter(t => t && t.account && t.amount > 0));
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
};

// Parse Last Balance CSV files
export const parseLastBalanceCSV = (file: File): Promise<{ records: LastBalanceRecord[]; preparedDate: string }> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false, // Parse without headers to handle complex structure
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const records: LastBalanceRecord[] = [];
          const rows = results.data as any[][];
          
          // Try to extract prepared date from the file
          let preparedDate = new Date().toISOString().split('T')[0];
          
          // Search in first 15 rows for "Prepared Date" or similar
          for (let i = 0; i < Math.min(15, rows.length); i++) {
            const row = rows[i];
            const rowText = row.join(' ').toLowerCase();
            
            // Look for prepared date patterns
            if (rowText.includes('prepared') || rowText.includes('date')) {
              for (let j = 0; j < row.length; j++) {
                const cell = String(row[j] || '').trim();
                // Try to match date patterns like DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
                const dateMatch = cell.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
                if (dateMatch) {
                  const [, d1, d2, year] = dateMatch;
                  const fullYear = year.length === 2 ? `20${year}` : year;
                  // Determine if d1/d2 is day/month or month/day
                  const day = parseInt(d1) > 12 ? d1 : d2;
                  const month = parseInt(d1) > 12 ? d2 : d1;
                  preparedDate = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  console.log('Extracted prepared date:', preparedDate, 'from cell:', cell);
                  break;
                }
              }
            }
            
            // Also check for timestamp in headers
            if (rowText.includes('timestamp') || rowText.includes('as on')) {
              for (let j = 0; j < row.length; j++) {
                const cell = String(row[j] || '').trim();
                const dateMatch = cell.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
                if (dateMatch) {
                  const [, d1, d2, year] = dateMatch;
                  const fullYear = year.length === 2 ? `20${year}` : year;
                  const day = parseInt(d1) > 12 ? d1 : d2;
                  const month = parseInt(d1) > 12 ? d2 : d1;
                  preparedDate = `${fullYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  console.log('Extracted timestamp date:', preparedDate, 'from cell:', cell);
                  break;
                }
              }
            }
          }
          
          // Find the header row (contains "Account Number")
          let headerRowIndex = -1;
          for (let i = 0; i < Math.min(20, rows.length); i++) {
            const row = rows[i];
            if (row.some((cell: any) => String(cell).includes('Account Number'))) {
              headerRowIndex = i;
              break;
            }
          }
          
          if (headerRowIndex === -1) {
            reject(new Error('Could not find header row in CSV'));
            return;
          }
          
          // Parse data rows after header
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            
            // Skip rows that don't have enough columns or look like headers
            if (!row || row.length < 10) continue;
            
            // Account Number is typically at index 1
            const accountRaw = String(row[1] || '').trim();
            let account = accountRaw.replace(/\D/g, '');
            account = account.replace(/^0+/, '') || '0';
            
            // Skip if no account number or if it looks like a header/footer
            if (!account || account === '' || account === '0' || isNaN(Number(account))) continue;
            
            console.log('Last Balance - Raw:', accountRaw, '-> Normalized:', account);
            
            // Cust1 Name is typically at index 3
            let name = String(row[3] || '').trim();
            
            // Cust2 Name is typically at index 7
            const name2 = String(row[7] || '').trim();
            if (name2 && name2 !== ',' && name2 !== ' ') {
              name = `${name} ${name2}`.trim();
            }
            
            // Address is typically around index 12 (may contain commas)
            let address = String(row[12] || '').trim();
            
            // Balance - try multiple columns (10, 11, or look for numeric value)
            let balance = 0;
            for (const colIdx of [10, 11, 9]) {
              const balanceRaw = String(row[colIdx] || '0').trim();
              const parsed = parseFloat(balanceRaw.replace(/[^0-9.-]/g, ''));
              if (!isNaN(parsed) && parsed > 0) {
                balance = parsed;
                break;
              }
            }
            
            // BO Name is typically the last column
            const boName = String(row[row.length - 1] || '').trim();
            
            // Scheme Type is typically at index 2
            const schemeType = String(row[2] || '').trim();
            
            if (account && name) {
              records.push({
                account,
                name,
                address,
                balance,
                balance_date: preparedDate,
                bo_name: boName || '',
                scheme_type: schemeType || ''
              });
            }
          }
          
          resolve({ records, preparedDate });
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error)
    });
  });
};

// Detect BO code from particulars - now uses config
import { detectBOFromConfig } from './config';

export const detectBOCode = detectBOFromConfig;
