# High-Value Withdrawal Memo Tool

## India Post - T. Narasipura Sub Division
### Official Verification System for High-Value Withdrawals

---

## Overview

This is a comprehensive web application for managing the verification of high-value withdrawals from postal savings accounts. The system generates ANNEXURE-4 verification memos, tracks their workflow status, manages reminders, and provides detailed reporting capabilities.

## Features

### 1. **Dashboard**
- Real-time KPI tiles showing total memos, new, pending, verified, and reported counts
- System status monitoring
- Quick overview of verification workflow

### 2. **Upload & Processing**
- Upload HFTI transaction Excel files
- Upload multiple Last Balance CSV files (SBBAS, SBCHQ, SBGEN, SSA)
- Configurable threshold amount (default: ₹10,000)
- Automatic BO (Branch Office) detection from transaction particulars
- Serial number assignment with optional BO grouping
- Duplicate detection to prevent reprocessing

### 3. **Memo Register**
- Complete listing of all verification memos
- Filter by status (All, New, Pending, Verified, Reported)
- Bulk selection for PDF generation
- Individual memo details
- Status tracking with color-coded badges

### 4. **PDF Generation**
- ANNEXURE-4 format (exactly matches the official template)
- Two memos per A4 page
- Consolidated PDF for multiple memos
- Individual memo PDF download
- Automatic status update to "Pending" after generation

### 5. **Verify Replies**
- Process verification responses efficiently
- Edit name and address if needed
- Two-action workflow: Verified (Satisfactory) or Reported (Not Satisfactory)
- Sticky verification date for batch processing
- Auto-advance to next pending memo
- BO-grouped memo list for better organization

### 6. **Reminders**
- Select pending memos for reminder
- Set custom reminder dates
- Automatic reminder count increment
- Appends reminder details to remarks (e.g., "Reminder 1 on 2025-11-12")
- Generate consolidated reminder PDF with tracking details

### 7. **Reports & Export**
- Summary statistics
- Ageing analysis (≤1 month, 1-3 months, >3 months)
- Export to Excel (all memos, pending, verified, reported)
- Full backup/restore capability (JSON format)

## Data Flow

```
1. Upload Files
   ├── HFTI Excel (transactions)
   └── Last Balance CSVs (customer details)
        ↓
2. Merge & Filter
   ├── Match by account number
   ├── Apply threshold filter
   ├── Detect BO codes
   └── Check for duplicates
        ↓
3. Assign Serials
   ├── Optional: Group by BO
   ├── Sequential numbering
   └── Create "New" status memos
        ↓
4. Generate PDF
   ├── Select "New" memos
   ├── Generate ANNEXURE-4 format
   └── Mark as "Pending"
        ↓
5. Send Reminders (if needed)
   ├── Select "Pending" memos
   ├── Generate reminder PDF
   └── Update reminder count
        ↓
6. Process Verification
   ├── Review pending memos
   ├── Mark as "Verified" or "Reported"
   └── Add verification date
        ↓
7. Export & Report
   ├── Excel exports
   ├── Ageing analysis
   └── Full backup
```

## BO Code Mapping

The system automatically detects Branch Office codes from transaction particulars:

- **01** → Chiduravalli BO
- **02** → Doddebagilu BO
- **03** → Horalahalli BO
- **04** → Kolathur BO
- **05** → Somanathapura BO
- **06** → Ukkalagere BO
- **07** → Vyasarajapura BO

Detection patterns:
- `BO21309111001` → Extracts last 2 digits → `01`
- `BO01` → Direct 2-digit pattern → `01`

## File Formats

### HFTI Transaction File (Excel)
Required columns (case-insensitive):
- Transaction Date / txn_date
- A/c. ID / account_no / account_number
- Transaction ID / txn_id
- Amt. / amount
- Particulars / narration (contains BO code)

### Last Balance Files (CSV)
Required columns (case-insensitive):
- Account Number / ac_no / a/c_id
- Cust1 Name / customer_name / name
- Address / full_address
- BO Name / branch

## Workflow States

1. **New**: Memo created, ready for PDF generation
2. **Pending**: PDF generated and sent, awaiting verification response
3. **Verified**: Verification response received and found satisfactory
4. **Reported**: Verification response not satisfactory, investigation initiated

## Technical Stack

- **Frontend**: React 18 + TypeScript + Vite
- **UI Components**: shadcn/ui + Tailwind CSS
- **Database**: Dexie.js (IndexedDB wrapper)
- **File Parsing**: xlsx (Excel), papaparse (CSV)
- **PDF Generation**: jsPDF
- **State Management**: React Query + Context

## Local Storage

All data is stored locally in your browser using IndexedDB:
- Memo records
- Application settings (lastSerial, threshold, groupByBO)
- No server required - fully offline capable

## Persistence Features

- **Auto-save**: All changes are immediately persisted
- **Backup**: Export full database as JSON
- **Restore**: Import previous backup to restore state
- **Serial continuity**: Last serial number is tracked to prevent conflicts

## Usage Instructions

### Initial Setup

1. Open the application
2. Navigate to **Upload** tab
3. Select your HFTI Excel file
4. Select one or more Last Balance CSV files
5. Set threshold amount (default: ₹10,000)
6. Choose whether to group serials by BO
7. Click **Preview Detection** to see results
8. Click **Commit & Assign Serials** to create memos

### Generate Memos

1. Go to **Memo Register**
2. Filter to show "New" memos
3. Select memos to generate (use checkbox)
4. Click **Generate PDF**
5. PDF downloads automatically
6. Memos status changes to "Pending"

### Send Reminders

1. Go to **Reminders** tab
2. Select pending memos that need reminders
3. Set the reminder date
4. Click **Generate Reminder PDF**
5. PDF with tracking details is downloaded
6. Reminder count increments and date is recorded

### Process Verifications

1. Go to **Verify Replies** tab
2. Review the pending memo details
3. Edit name/address if needed
4. Set verification date
5. Click **Verified** (satisfactory) or **Reported** (not satisfactory)
6. System auto-advances to next memo

### Export Reports

1. Go to **Reports** tab
2. View summary statistics and ageing analysis
3. Export specific datasets (All, Pending, Verified, Reported)
4. Create full backup for safekeeping

## Support & Maintenance

For technical support or feature requests, contact the IT department at T. Narasipura Sub Division.

## Important Notes

- **Data Privacy**: All data remains in your browser. No external transmission.
- **Browser Compatibility**: Works best in Chrome, Edge, Firefox (latest versions)
- **Backup Regularly**: Use the backup feature to save your data periodically
- **Serial Numbers**: Once assigned, serial numbers cannot be changed
- **Duplicates**: The system automatically prevents duplicate memo creation based on transaction ID, account, amount, and date

## Version Information

- **Version**: 1.0.0
- **Last Updated**: November 2025
- **Office**: T. Narasipura Sub Division, India Post
