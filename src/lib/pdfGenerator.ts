import jsPDF from 'jspdf';
import { MemoRecord } from './db';

const OFFICE_NAME = 'OLD SOSALE S.O';

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
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const halfHeight = pageHeight / 2;
  const margin = 10;
  const columnWidth = (pageWidth - 2 * margin) / 2;
  const middleX = margin + columnWidth;
  
  // Draw border for this memo half
  doc.setLineWidth(0.5);
  doc.rect(margin, yOffset, pageWidth - 2 * margin, halfHeight - margin);
  doc.line(middleX, yOffset, middleX, yOffset + halfHeight - margin);
  
  // Header - centered
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ANNEXURE-4', pageWidth / 2, yOffset + 8, { align: 'center' });
  doc.setFontSize(10);
  doc.text('[See para 105]', pageWidth / 2, yOffset + 13, { align: 'center' });
  
  // Left column - Memo of Verification
  let leftY = yOffset + 22;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Memo of Verification', margin + 3, leftY);
  
  leftY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `No: ${memo.serial} dated at ${OFFICE_NAME} the ${formatDate(memo.txn_date)}`,
    margin + 3,
    leftY,
    { maxWidth: columnWidth - 6 }
  );
  
  leftY += 10;
  const bodyText = `A withdrawal of Rs ${formatAmount(memo.amount)} (${memo.txn_id}) has been effected in Account No ${memo.account} with ${OFFICE_NAME} on ${formatDate(memo.txn_date)}.`;
  const bodyLines = doc.splitTextToSize(bodyText, columnWidth - 6);
  doc.text(bodyLines, margin + 3, leftY);
  leftY += bodyLines.length * 5;
  
  leftY += 5;
  doc.text('The name and address of depositor are as below:', margin + 3, leftY);
  leftY += 5;
  
  // Name and address
  doc.setFont('helvetica', 'bold');
  const nameLines = doc.splitTextToSize(memo.name, columnWidth - 6);
  doc.text(nameLines, margin + 3, leftY);
  leftY += nameLines.length * 4.5;
  
  doc.setFont('helvetica', 'normal');
  const addressLines = doc.splitTextToSize(memo.address, columnWidth - 6);
  doc.text(addressLines, margin + 3, leftY);
  leftY += addressLines.length * 4.5;
  
  leftY += 8;
  const instructionText = 'Kindly verify the genuineness of the withdrawal by contacting the depositor and intimate result within 10/30 days.';
  const instructionLines = doc.splitTextToSize(instructionText, columnWidth - 6);
  doc.text(instructionLines, margin + 3, leftY);
  leftY += instructionLines.length * 4.5;
  
  // Bottom left - To address
  const bottomY = yOffset + halfHeight - margin - 28;
  doc.text('To,', margin + 3, bottomY);
  doc.text('THE INSPECTOR OF POSTS    Sub Postmaster', margin + 3, bottomY + 5);
  doc.text(`T NARASIPURA SUB DIVISION  ${OFFICE_NAME}`, margin + 3, bottomY + 10);
  
  // Right column - Reply
  let rightY = yOffset + 22;
  doc.setFont('helvetica', 'bold');
  doc.text('Reply', middleX + 3, rightY);
  
  rightY += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(
    `No: ${memo.serial} dated at ${OFFICE_NAME} the ${formatDate(memo.txn_date)}`,
    middleX + 3,
    rightY,
    { maxWidth: columnWidth - 6 }
  );
  
  rightY += 10;
  const replyText = 'The result of verification of the withdrawal particularised in the margin has been found satisfactory/ not satisfactory.\n\nInvestigation has been taken up.';
  const replyLines = doc.splitTextToSize(replyText, columnWidth - 6);
  doc.text(replyLines, middleX + 3, rightY);
  rightY += replyLines.length * 5;
  
  // Signature block - right aligned in right column
  const sigY = yOffset + halfHeight - margin - 28;
  doc.text('THE INSPECTOR OF POSTS', middleX + columnWidth - 55, sigY);
  doc.text('T NARASIPURA SUB DIVISION', middleX + columnWidth - 58, sigY + 5);
  doc.text('To,', middleX + 3, sigY + 12);
  doc.text('Sub Postmaster', middleX + 3, sigY + 17);
  doc.text(OFFICE_NAME, middleX + 3, sigY + 22);
  
  // Footer note
  doc.setFontSize(7);
  const noteText = 'Note: The verification memo should be returned to the HO within 10 days in case where the place of residence of the depositor lies in the jurisdictions of P.R.I and within 30 days in all other cases.';
  const noteLines = doc.splitTextToSize(noteText, pageWidth - 2 * margin - 4);
  doc.text(noteLines, margin + 2, yOffset + halfHeight - margin - 7);
};

// Generate consolidated PDF for multiple memos
export const generateConsolidatedPDF = (memos: MemoRecord[]): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  let pageCount = 0;
  for (let i = 0; i < memos.length; i += 2) {
    if (pageCount > 0) {
      doc.addPage();
    }
    
    // Draw first memo (top half)
    drawMemo(doc, memos[i], 10);
    
    // Draw second memo (bottom half) if exists
    if (i + 1 < memos.length) {
      drawMemo(doc, memos[i + 1], 158);
    }
    
    pageCount++;
  }
  
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
