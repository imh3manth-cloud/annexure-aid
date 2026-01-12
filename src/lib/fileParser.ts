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
            if (rowText.includes('prepared') || rowText.includes('date') || rowText.includes('as on') || rowText.includes('timestamp')) {
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
                  console.log('Extracted date:', preparedDate, 'from cell:', cell);
                  break;
                }
              }
            }
          }
          
          // Find the header row and detect column indices dynamically
          let headerRowIndex = -1;
          let columnMap: { [key: string]: number } = {};
          
          for (let i = 0; i < Math.min(20, rows.length); i++) {
            const row = rows[i];
            const rowStr = row.map((c: any) => String(c || '').toLowerCase()).join('|');
            
            // Check if this row contains typical header columns
            if (rowStr.includes('account') && (rowStr.includes('name') || rowStr.includes('cust'))) {
              headerRowIndex = i;
              
              // Map each column by its header
              row.forEach((cell: any, idx: number) => {
                const header = normalizeHeader(String(cell || ''));
                const headerLower = String(cell || '').toLowerCase().trim();
                
                // Account number detection
                if (headerLower.includes('account') && (headerLower.includes('number') || headerLower.includes('no'))) {
                  columnMap['account'] = idx;
                }
                // Scheme type detection  
                else if (headerLower.includes('scheme') || headerLower.includes('product')) {
                  columnMap['scheme_type'] = idx;
                }
                // Status detection
                else if (headerLower.includes('status') || headerLower.includes('a/c status') || headerLower.includes('account status')) {
                  columnMap['status'] = idx;
                }
                // Name detection (first name field found)
                else if ((headerLower.includes('cust') && headerLower.includes('name')) || 
                         headerLower === 'name' || headerLower === 'customer name') {
                  if (!columnMap['name']) columnMap['name'] = idx;
                  else if (!columnMap['name2']) columnMap['name2'] = idx;
                }
                // Cust1/Cust2 name
                else if (headerLower.includes('cust1') || headerLower.includes('cust 1')) {
                  columnMap['name'] = idx;
                }
                else if (headerLower.includes('cust2') || headerLower.includes('cust 2')) {
                  columnMap['name2'] = idx;
                }
                // Address detection
                else if (headerLower.includes('address') || headerLower.includes('addr')) {
                  columnMap['address'] = idx;
                }
                // Balance detection
                else if (headerLower.includes('balance') || headerLower.includes('bal') || 
                         headerLower.includes('outstanding') || headerLower.includes('amount')) {
                  if (!columnMap['balance']) columnMap['balance'] = idx;
                }
                // BO Name detection
                else if (headerLower.includes('bo') || headerLower.includes('branch') || 
                         headerLower.includes('office name') || headerLower.includes('so name')) {
                  columnMap['bo_name'] = idx;
                }
              });
              
              console.log('Header row found at index:', headerRowIndex);
              console.log('Headers:', row);
              console.log('Column mapping:', columnMap);
              break;
            }
          }
          
          if (headerRowIndex === -1) {
            console.error('Could not find header row in CSV. First 5 rows:', rows.slice(0, 5));
            reject(new Error('Could not find header row with "Account" and "Name" columns in CSV'));
            return;
          }
          
          // Parse data rows after header
          for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i];
            
            // Skip rows that don't have enough columns
            if (!row || row.length < 5) continue;
            
            // Extract account number
            const accountIdx = columnMap['account'] ?? 1;
            const accountRaw = String(row[accountIdx] || '').trim();
            let account = accountRaw.replace(/\D/g, '');
            account = account.replace(/^0+/, '') || '0';
            
            // Skip if no valid account number
            if (!account || account === '' || account === '0' || isNaN(Number(account))) continue;
            
            // Extract name (may have cust1 and cust2)
            let name = '';
            if (columnMap['name'] !== undefined) {
              name = String(row[columnMap['name']] || '').trim();
            }
            if (columnMap['name2'] !== undefined) {
              const name2 = String(row[columnMap['name2']] || '').trim();
              if (name2 && name2 !== ',' && name2 !== ' ') {
                name = name ? `${name} ${name2}`.trim() : name2;
              }
            }
            
            // Skip rows without names (likely empty or footer rows)
            if (!name) continue;
            
            // Extract address
            let address = '';
            if (columnMap['address'] !== undefined) {
              address = String(row[columnMap['address']] || '').trim();
            }
            
            // Extract balance - try mapped column first, then look for numeric values
            let balance = 0;
            if (columnMap['balance'] !== undefined) {
              const balanceRaw = String(row[columnMap['balance']] || '0').trim();
              balance = parseFloat(balanceRaw.replace(/[^0-9.-]/g, '')) || 0;
            }
            
            // If balance is 0, try scanning for a numeric column that looks like a balance
            if (balance === 0) {
              for (let colIdx = 0; colIdx < row.length; colIdx++) {
                const cellValue = String(row[colIdx] || '').trim();
                // Look for values that look like currency amounts (numbers with optional decimals)
                if (/^\d{1,3}(,?\d{3})*(\.\d{1,2})?$/.test(cellValue.replace(/[₹Rs\s]/g, ''))) {
                  const parsed = parseFloat(cellValue.replace(/[^0-9.-]/g, ''));
                  if (!isNaN(parsed) && parsed > 100) { // Assume balances are > 100
                    balance = parsed;
                    break;
                  }
                }
              }
            }
            
            // Extract scheme type
            let schemeType = '';
            if (columnMap['scheme_type'] !== undefined) {
              schemeType = String(row[columnMap['scheme_type']] || '').trim();
            }
            
            // Extract status (may be combined with scheme or separate)
            let status = '';
            if (columnMap['status'] !== undefined) {
              status = String(row[columnMap['status']] || '').trim();
            }
            // Append status to scheme_type if both exist
            if (status && schemeType) {
              schemeType = `${schemeType} (${status})`;
            } else if (status) {
              schemeType = status;
            }
            
            // Extract BO Name (fallback to last column)
            let boName = '';
            if (columnMap['bo_name'] !== undefined) {
              boName = String(row[columnMap['bo_name']] || '').trim();
            } else {
              // Fallback: use last non-empty column
              boName = String(row[row.length - 1] || '').trim();
            }
            
            console.log('Parsed record:', { account, name, address, balance, schemeType, boName });
            
            records.push({
              account,
              name,
              address,
              balance,
              balance_date: preparedDate,
              bo_name: boName,
              scheme_type: schemeType
            });
          }
          
          console.log(`Parsed ${records.length} balance records from ${file.name}`);
          resolve({ records, preparedDate });
        } catch (error) {
          console.error('Error parsing CSV:', error);
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
