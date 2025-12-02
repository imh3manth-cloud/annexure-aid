import jsPDF from 'jspdf';
import { MemoRecord } from './db';
import { getConfig } from './config';

// Format date as DD/MM/YYYY
const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
};

// Format amount with Indian numbering
const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

// Draw a single memo on the page
const drawMemo = (
  doc: jsPDF,
  memo: MemoRecord,
  yOffset: number
) => {
  const config = getConfig();
  const OFFICE_NAME = config.officeName;
  const SUBDIVISION = config.subdivision;
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const halfHeight = pageHeight / 2;
  const margin = 10;
  const contentMargin = 2; // Reduced internal margin
  const columnWidth = (pageWidth - 2 * margin) / 2;
  const middleX = margin + columnWidth;
  const headerHeight = 10; // Reduced header height
  const footerHeight = 10; // Reduced footer height
  
  // Calculate available height for memo content
  const availableHeight = halfHeight - margin - 5; // 5mm buffer at bottom
  
  // Calculate body height (excluding header and footer)
  const bodyHeight = availableHeight - headerHeight - footerHeight;
  
  // Draw main border for this memo section
  doc.setLineWidth(0.5);
  doc.rect(margin, yOffset, pageWidth - 2 * margin, availableHeight);
  
  // Draw split header boxes (left and right for tearing)
  doc.rect(margin, yOffset, columnWidth, headerHeight);
  doc.rect(middleX, yOffset, columnWidth, headerHeight);
  
  // Header - split into left and right boxes
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ANNEXURE-4', margin + columnWidth / 2, yOffset + 5, { align: 'center' });
  doc.setFontSize(10);
  doc.text('[See para 105]', margin + columnWidth / 2, yOffset + 9, { align: 'center' });
  
  // Right header (duplicate)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ANNEXURE-4', middleX + columnWidth / 2, yOffset + 5, { align: 'center' });
  doc.setFontSize(10);
  doc.text('[See para 105]', middleX + columnWidth / 2, yOffset + 9, { align: 'center' });
  
  // Draw body separator line (below header)
  const bodyStartY = yOffset + headerHeight;
  doc.line(margin, bodyStartY, pageWidth - margin, bodyStartY);
  
  // Draw vertical line separating left and right columns (body section only)
  const bodyEndY = yOffset + headerHeight + bodyHeight;
  doc.line(middleX, bodyStartY, middleX, bodyEndY);
  
  // Left column - Memo of Verification (body section)
  let leftY = bodyStartY + 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Memo of Verification', margin + contentMargin, leftY);
  
  leftY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `No: ${memo.serial} dated at ${memo.BO_Name} the ${formatDate(memo.txn_date)}`,
    margin + contentMargin,
    leftY,
    { maxWidth: columnWidth - (contentMargin * 2) }
  );
  
  leftY += 5;
  // Withdrawal info
  const withdrawalText = `A withdrawal of Rs ${formatAmount(memo.amount)} (${memo.txn_id}) has been effected in Account No ${memo.account} at ${memo.BO_Name} on ${formatDate(memo.txn_date)}.`;
  const withdrawalLines = doc.splitTextToSize(withdrawalText, columnWidth - (contentMargin * 2));
  doc.text(withdrawalLines, margin + contentMargin, leftY);
  leftY += withdrawalLines.length * 3.5;
  
  // Name and address section
  leftY += 3;
  doc.text('The name and address of depositor are as below:', margin + contentMargin, leftY);
  leftY += 4;
  
  // Name and address
  doc.setFont('helvetica', 'bold');
  const nameLines = doc.splitTextToSize(memo.name, columnWidth - (contentMargin * 2));
  doc.text(nameLines, margin + contentMargin, leftY);
  leftY += nameLines.length * 3.5;
  
  doc.setFont('helvetica', 'normal');
  const addressLines = doc.splitTextToSize(memo.address, columnWidth - (contentMargin * 2));
  doc.text(addressLines, margin + contentMargin, leftY);
  leftY += addressLines.length * 3.5;
  
  leftY += 3;
  doc.setFontSize(7);
  doc.text('Kindly verify the genuineness and intimate result within 10/30 days.', margin + contentMargin, leftY);
  
  // Signature at bottom of body
  leftY = bodyEndY - 10;
  doc.setFontSize(8);
  doc.text(`Sub Post Master`, margin + contentMargin, leftY);
  leftY += 3;
  doc.text(`${OFFICE_NAME}`, margin + contentMargin, leftY);
  
  // Right column - Reply (body section)
  let rightY = bodyStartY + 4;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Reply', middleX + contentMargin, rightY);
  
  rightY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `No: ${memo.serial} dated at ${OFFICE_NAME} the ${formatDate(memo.txn_date)}`,
    middleX + contentMargin,
    rightY,
    { maxWidth: columnWidth - (contentMargin * 2) }
  );
  
  rightY += 6;
  doc.text('The result of verification has been found', middleX + contentMargin, rightY);
  rightY += 4;
  doc.text('satisfactory / not satisfactory.', middleX + contentMargin, rightY);
  rightY += 6;
  doc.text('Investigation has been taken up.', middleX + contentMargin, rightY);
  
  // Signature at bottom of body
  rightY = bodyEndY - 10;
  doc.text('Reply under certificate of posting', middleX + contentMargin, rightY);
  rightY += 3;
  doc.text(`Sub Post Master`, middleX + contentMargin, rightY);
  rightY += 3;
  doc.text(`${OFFICE_NAME}`, middleX + contentMargin, rightY);
  
  // Draw footer separator line
  doc.line(margin, bodyEndY, pageWidth - margin, bodyEndY);
  
  // Footer note box spanning full width below the memo
  const noteY = yOffset + availableHeight + 2;
  doc.setLineWidth(0.5);
  doc.rect(margin, noteY, pageWidth - 2 * margin, 8);
  
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  const noteText = 'Note: ';
  doc.text(noteText, margin + 2, noteY + 3);
  
  doc.setFont('helvetica', 'normal');
  const noteContent = 'The verification memo should be returned to the HO within 10 days in case where the place of residence of the depositor lies in the jurisdictions of P.R.I and within 30 days in all other cases.';
  const noteLines = doc.splitTextToSize(noteContent, pageWidth - 2 * margin - 10);
  doc.text(noteLines, margin + 2 + doc.getTextWidth(noteText), noteY + 3);
};

// Generate consolidated PDF for multiple memos with summary report
export const generateConsolidatedPDF = (memos: MemoRecord[]): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  let pageCount = 0;
  // Fit 2 memos per page (reverted from 3 to avoid overlapping)
  const memosPerPage = 2;
  const memoHeight = 297 / memosPerPage; // Divide page height by 2
  
  for (let i = 0; i < memos.length; i += memosPerPage) {
    if (pageCount > 0) {
      doc.addPage();
    }
    
    // Draw up to 2 memos per page
    for (let j = 0; j < memosPerPage && i + j < memos.length; j++) {
      drawMemo(doc, memos[i + j], 5 + j * memoHeight);
    }
    
    pageCount++;
  }
  
  // Add consolidated summary report at the end
  doc.addPage();
  
  // Header with India Post branding
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('DEPARTMENT OF POSTS', 105, 20, { align: 'center' });
  doc.setFontSize(14);
  doc.text('INDIA POST', 105, 27, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Consolidated Memo Report', 105, 40, { align: 'center' });
  
  const config = getConfig();
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(`Office: ${config.officeName}`, 105, 48, { align: 'center' });
  doc.text(`Subdivision: ${config.subdivision}`, 105, 55, { align: 'center' });
  
  // Summary section with proper alignment
  doc.setFontSize(10);
  const leftCol = 15;
  const rightCol = 100;
  doc.text('Report Date:', leftCol, 68);
  doc.text(formatDate(new Date().toISOString()), rightCol, 68);
  doc.text('Total Memos:', leftCol, 75);
  doc.text(String(memos.length), rightCol, 75);
  
  const totalAmount = memos.reduce((sum, memo) => sum + memo.amount, 0);
  doc.text('Total Amount:', leftCol, 82);
  doc.text(`Rs ${formatAmount(totalAmount)}`, rightCol, 82);
  
  // Branch Office Summary - First on page with proper spacing
  let yPos = 95;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Branch Office Summary', 15, yPos);
  yPos += 10;
  
  const boGroups = memos.reduce((acc, memo) => {
    const key = memo.BO_Name;
    if (!acc[key]) {
      acc[key] = { count: 0, amount: 0 };
    }
    acc[key].count++;
    acc[key].amount += memo.amount;
    return acc;
  }, {} as Record<string, { count: number; amount: number }>);
  
  // Draw BO summary table with borders (removed BO Code column)
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const summaryX = [15, 105, 150];
  
  // Header
  doc.setFillColor(230, 230, 230);
  doc.rect(summaryX[0], yPos - 5, 180, 7, 'F');
  doc.text('Branch Office Name', summaryX[0] + 2, yPos);
  doc.text('Memos', summaryX[1] + 2, yPos);
  doc.text('Amount (Rs)', summaryX[2] + 2, yPos);
  doc.rect(summaryX[0], yPos - 5, 180, 7);
  yPos += 7;
  
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  Object.entries(boGroups).sort().forEach(([boName, data], idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(summaryX[0], yPos - 5, 180, 7, 'F');
    }
    
    doc.text(boName, summaryX[0] + 2, yPos);
    doc.text(String(data.count), summaryX[1] + 20, yPos, { align: 'center' });
    doc.text(formatAmount(data.amount), summaryX[2] + 43, yPos, { align: 'right' });
    
    doc.setLineWidth(0.3);
    doc.rect(summaryX[0], yPos - 5, 180, 7);
    yPos += 7;
  });
  
  // Sort memos by serial number in ascending order
  const sortedMemos = [...memos].sort((a, b) => a.serial - b.serial);
  
  // Memo details table
  yPos += 15;
  if (yPos > 250) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Memo Details', 15, yPos);
  yPos += 10;
  
  const tableColX = [15, 30, 70, 115, 145];
  const rowHeight = 7;
  
  // Draw table header
  doc.setFillColor(230, 230, 230);
  doc.rect(tableColX[0], yPos - 5, 180, rowHeight, 'F');
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text('Sl.No', tableColX[0] + 7, yPos, { align: 'center' });
  doc.text('Account Number', tableColX[1] + 2, yPos);
  doc.text('Amount (Rs)', tableColX[2] + 40, yPos, { align: 'right' });
  doc.text('Date', tableColX[3] + 2, yPos);
  doc.text('Branch Office', tableColX[4] + 2, yPos);
  
  doc.setLineWidth(0.5);
  doc.rect(tableColX[0], yPos - 5, 180, rowHeight);
  yPos += rowHeight;
  
  // Draw table rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  
  sortedMemos.forEach((memo, idx) => {
    if (yPos > 270) {
      doc.addPage();
      yPos = 20;
      
      // Redraw header
      doc.setFillColor(230, 230, 230);
      doc.rect(tableColX[0], yPos - 5, 180, rowHeight, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Sl.No', tableColX[0] + 7, yPos, { align: 'center' });
      doc.text('Account Number', tableColX[1] + 2, yPos);
      doc.text('Amount (Rs)', tableColX[2] + 40, yPos, { align: 'right' });
      doc.text('Date', tableColX[3] + 2, yPos);
      doc.text('Branch Office', tableColX[4] + 2, yPos);
      doc.rect(tableColX[0], yPos - 5, 180, rowHeight);
      yPos += rowHeight;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
    }
    
    // Alternate row shading
    if (idx % 2 === 0) {
      doc.setFillColor(245, 245, 245);
      doc.rect(tableColX[0], yPos - 5, 180, rowHeight, 'F');
    }
    
    // Center-aligned serial number
    doc.text(String(memo.serial), tableColX[0] + 7, yPos, { align: 'center' });
    doc.text(memo.account.substring(0, 16), tableColX[1] + 2, yPos);
    doc.text(formatAmount(memo.amount), tableColX[2] + 40, yPos, { align: 'right' });
    doc.text(formatDate(memo.txn_date), tableColX[3] + 2, yPos);
    
    // Truncate BO name if too long
    const boName = memo.BO_Name.length > 22 ? memo.BO_Name.substring(0, 19) + '...' : memo.BO_Name;
    doc.text(boName, tableColX[4] + 2, yPos);
    
    // Draw row border
    doc.setLineWidth(0.3);
    doc.rect(tableColX[0], yPos - 5, 180, rowHeight);
    
    yPos += rowHeight;
  });
  
  return doc;
};

// Generate single memo PDF
export const generateSingleMemoPDF = (memo: MemoRecord): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  drawMemo(doc, memo, 10);
  
  return doc;
};

// Generate reminder PDF
export const generateReminderPDF = (memos: MemoRecord[]): jsPDF => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Reminder Report - High Value Withdrawals', 148, 15, { align: 'center' });
  
  // Table headers
  const startY = 25;
  const rowHeight = 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  
  const headers = ['Memo No', 'Account No', 'Office', 'Amount', 'Memo Sent Date', 'Reminder Date', 'Remarks'];
  const colWidths = [20, 30, 45, 25, 30, 30, 87];
  let x = 10;
  
  headers.forEach((header, i) => {
    doc.text(header, x, startY);
    x += colWidths[i];
  });
  
  // Draw line under headers
  doc.line(10, startY + 2, 287, startY + 2);
  
  // Table rows
  doc.setFont('helvetica', 'normal');
  let y = startY + rowHeight;
  
  memos.forEach((memo) => {
    if (y > 190) {
      doc.addPage();
      y = 15;
    }
    
    x = 10;
    doc.text(String(memo.serial), x, y);
    x += colWidths[0];
    
    doc.text(memo.account, x, y);
    x += colWidths[1];
    
    doc.text(memo.BO_Name, x, y, { maxWidth: colWidths[2] - 2 });
    x += colWidths[2];
    
    doc.text(formatAmount(memo.amount), x, y);
    x += colWidths[3];
    
    doc.text(memo.memo_sent_date ? formatDate(memo.memo_sent_date) : '', x, y);
    x += colWidths[4];
    
    doc.text(memo.last_reminder_date ? formatDate(memo.last_reminder_date) : '', x, y);
    x += colWidths[5];
    
    const remarks = doc.splitTextToSize(memo.remarks, colWidths[6] - 2);
    doc.text(remarks, x, y);
    
    y += Math.max(rowHeight, remarks.length * 4);
  });
  
  return doc;
};
