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

// Check if a row looks like a header row (contains "account" and "name"/"cust")
const isHeaderRow = (row: string[]): boolean => {
  const rowStr = row.map(c => String(c || '').toLowerCase().trim()).join('|');
  return rowStr.includes('account') && (rowStr.includes('name') || rowStr.includes('cust'));
};

// Check if a row is a metadata/page-break row to skip
const isMetadataRow = (row: string[]): boolean => {
  const rowText = row.join(' ').toLowerCase();
  return (
    rowText.includes('india post') ||
    rowText.includes('last balance report') ||
    /page\s+\d+\s+(of|\/)\s*\d+/i.test(rowText) ||
    rowText.includes('prepared date') ||
    rowText.includes('sol id') ||
    rowText.includes('branch id') ||
    rowText.includes('scheme :') ||
    rowText.includes('total no of') ||
    // Row is mostly empty (metadata lines with sparse content)
    (row.filter(c => String(c || '').trim()).length <= 3 && !(/^\d+$/.test(String(row[0] || '').trim())))
  );
};

// Detect column mapping from a header row
const detectHeaderMapping = (row: string[]): Record<string, number> => {
  const mapping: Record<string, number> = {};
  for (let idx = 0; idx < row.length; idx++) {
    const h = String(row[idx] || '').toLowerCase().trim();
    if (!h) continue;
    if (h.includes('account') && (h.includes('number') || h.includes('no') || h.includes('id') || h === 'account number')) {
      mapping.account = idx;
    } else if ((h.includes('cust1') || h.includes('cust 1')) && h.includes('name')) {
      mapping.name = idx;
    } else if ((h.includes('cust') && h.includes('name')) || h === 'name' || h === 'customer name') {
      if (!('name' in mapping)) mapping.name = idx;
    } else if (h.includes('cif') && h.includes('id')) {
      if (!('cif' in mapping)) mapping.cif = idx;
    } else if (h.includes('address') || h.includes('addr')) {
      mapping.address = idx;
    } else if (h.includes('balance') && (h.includes('after') || h.includes('transaction') || h.includes('amt'))) {
      mapping.balance = idx;
    } else if (h.includes('balance') || h.includes('outstanding')) {
      if (!('balance' in mapping)) mapping.balance = idx;
    } else if (h.includes('date') && h.includes('last')) {
      mapping.lastTxnDate = idx;
    } else if (h.includes('status')) {
      mapping.status = idx;
    } else if (h.includes('bo') && h.includes('name')) {
      mapping.boName = idx;
    } else if (h.includes('account') && h.includes('type')) {
      // skip account type
    } else if (h.includes('scheme') || h.includes('product')) {
      mapping.schemeType = idx;
    }
  }
  return mapping;
};

// Extract raw CSV data for manual mapping - handles multi-page reports with shifting columns
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
          
          // Extract prepared date and detect scheme from first 15 metadata rows
          let preparedDate = new Date().toISOString().split('T')[0];
          let detectedScheme = '';
          
          for (let i = 0; i < Math.min(15, rows.length); i++) {
            const row = rows[i];
            const rowText = row.join(' ');
            const rowTextLower = rowText.toLowerCase();
            
            // Detect scheme from metadata rows
            if (!detectedScheme) {
              const rowTextUpper = rowText.toUpperCase();
              for (const scheme of SCHEME_KEYWORDS) {
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
          
          // Find ALL header rows and their positions
          const headerPositions: { index: number; mapping: Record<string, number> }[] = [];
          
          for (let i = 0; i < rows.length; i++) {
            if (isHeaderRow(rows[i])) {
              headerPositions.push({ index: i, mapping: detectHeaderMapping(rows[i]) });
            }
          }
          
          // Canonical output columns
          const canonicalHeaders = ['Account Number', 'Name', 'CIF ID', 'Address', 'Balance', 'Last Txn Date', 'Status', 'BO Name'];
          const normalizedRows: string[][] = [];
          
          // Process each data row using the mapping from its closest preceding header
          for (let i = 0; i < rows.length; i++) {
            // Skip header rows themselves
            if (headerPositions.some(h => h.index === i)) continue;
            
            // Skip metadata/page-break rows
            if (isMetadataRow(rows[i])) continue;
            
            // Find the mapping for this row (from closest preceding header)
            let currentMapping: Record<string, number> | null = null;
            for (let h = headerPositions.length - 1; h >= 0; h--) {
              if (i > headerPositions[h].index) {
                currentMapping = headerPositions[h].mapping;
                break;
              }
            }
            
            if (!currentMapping) continue; // Row before any header
            
            const row = rows[i];
            
            // Extract account number
            const account = currentMapping.account !== undefined ? String(row[currentMapping.account] || '').trim() : '';
            // Must have a valid account number (at least 5 digits)
            if (!account || !/\d{5,}/.test(account.replace(/\D/g, ''))) continue;
            
            const name = currentMapping.name !== undefined ? String(row[currentMapping.name] || '').trim() : '';
            const cif = currentMapping.cif !== undefined ? String(row[currentMapping.cif] || '').trim() : '';
            const address = currentMapping.address !== undefined ? String(row[currentMapping.address] || '').trim() : '';
            const balance = currentMapping.balance !== undefined ? String(row[currentMapping.balance] || '').trim() : '';
            const lastTxnDate = currentMapping.lastTxnDate !== undefined ? String(row[currentMapping.lastTxnDate] || '').trim() : '';
            const status = currentMapping.status !== undefined ? String(row[currentMapping.status] || '').trim() : '';
            const boName = currentMapping.boName !== undefined ? String(row[currentMapping.boName] || '').trim() : '';
            
            normalizedRows.push([account, name, cif, address, balance, lastTxnDate, status, boName]);
          }
          
          // Create canonical auto-mapping pointing to normalized columns
          const autoMapping: ColumnMapping = {
            account: 0,
            name: 1,
            name2: null,
            address: 3,
            balance: 4,
            scheme_type: null, // scheme comes from file metadata/filename
            status: 6,
            bo_name: 7
          };
          
          resolve({
            headers: canonicalHeaders,
            rows: normalizedRows,
            preparedDate,
            autoMapping,
            headerRowIndex: 0,
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
