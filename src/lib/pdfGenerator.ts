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
  const contentMargin = 3; // Internal margin within border
  const columnWidth = (pageWidth - 2 * margin) / 2;
  const middleX = margin + columnWidth;
  const headerHeight = 12; // Height for header box
  const footerHeight = 12; // Height for footer box
  
  // Draw main border for this memo half
  doc.setLineWidth(0.5);
  doc.rect(margin, yOffset, pageWidth - 2 * margin, halfHeight - margin);
  
  // Draw merged header box
  doc.rect(margin, yOffset, pageWidth - 2 * margin, headerHeight);
  
  // Header - centered (inside merged box)
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ANNEXURE-4', pageWidth / 2, yOffset + 5, { align: 'center' });
  doc.setFontSize(10);
  doc.text('[See para 105]', pageWidth / 2, yOffset + 10, { align: 'center' });
  
  // Draw vertical line separating left and right columns (starting after header)
  doc.line(middleX, yOffset + headerHeight, middleX, yOffset + halfHeight - margin - footerHeight);
  
  // Left column - Memo of Verification (starting after header box)
  let leftY = yOffset + headerHeight + 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Memo of Verification', margin + contentMargin, leftY);
  
  leftY += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(
    `No: ${memo.serial} dated at ${OFFICE_NAME} the ${formatDate(memo.txn_date)}`,
    margin + contentMargin,
    leftY,
    { maxWidth: columnWidth - (contentMargin * 2) }
  );
  
  leftY += 10;
  const bodyText = `A withdrawal of Rs ${formatAmount(memo.amount)} (${memo.txn_id}) has been effected in Account No ${memo.account} with ${OFFICE_NAME} on ${formatDate(memo.txn_date)}.`;
  const bodyLines = doc.splitTextToSize(bodyText, columnWidth - (contentMargin * 2));
  doc.text(bodyLines, margin + contentMargin, leftY);
  leftY += bodyLines.length * 5;
  
  leftY += 5;
  doc.text('The name and address of depositor are as below:', margin + contentMargin, leftY);
  leftY += 5;
  
  // Name and address
  doc.setFont('helvetica', 'bold');
  const nameLines = doc.splitTextToSize(memo.name, columnWidth - (contentMargin * 2));
  doc.text(nameLines, margin + contentMargin, leftY);
  leftY += nameLines.length * 4.5;
  
  doc.setFont('helvetica', 'normal');
  const addressLines = doc.splitTextToSize(memo.address, columnWidth - (contentMargin * 2));
  doc.text(addressLines, margin + contentMargin, leftY);
  leftY += addressLines.length * 4.5;
  
  leftY += 8;
  const instructionText = 'Kindly verify the genuineness of the withdrawal by contacting the depositor and intimate result within 10/30 days.';
  const instructionLines = doc.splitTextToSize(instructionText, columnWidth - (contentMargin * 2));
  doc.text(instructionLines, margin + contentMargin, leftY);
  leftY += instructionLines.length * 4.5;
  
  // Bottom left - To address (positioned above footer box)
  const bottomY = yOffset + halfHeight - margin - footerHeight - 25;
  doc.text('To,', margin + contentMargin, bottomY);
  doc.text('THE INSPECTOR OF POSTS    Sub Postmaster', margin + contentMargin, bottomY + 5);
  doc.text(`T NARASIPURA SUB DIVISION  ${OFFICE_NAME}`, margin + contentMargin, bottomY + 10);
  
  // Right column - Reply (starting after header box)
  let rightY = yOffset + headerHeight + 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Reply', middleX + contentMargin, rightY);
  
  rightY += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(
    `No: ${memo.serial} dated at ${OFFICE_NAME} the ${formatDate(memo.txn_date)}`,
    middleX + contentMargin,
    rightY,
    { maxWidth: columnWidth - (contentMargin * 2) }
  );
  
  rightY += 10;
  const replyText = 'The result of verification of the withdrawal particularised in the margin has been found satisfactory/ not satisfactory.\n\nInvestigation has been taken up.';
  const replyLines = doc.splitTextToSize(replyText, columnWidth - (contentMargin * 2));
  doc.text(replyLines, middleX + contentMargin, rightY);
  rightY += replyLines.length * 5;
  
  // Signature block - right aligned in right column (positioned above footer box)
  const sigY = yOffset + halfHeight - margin - footerHeight - 25;
  doc.text('THE INSPECTOR OF POSTS', middleX + columnWidth - 55, sigY);
  doc.text('T NARASIPURA SUB DIVISION', middleX + columnWidth - 58, sigY + 5);
  doc.text('To,', middleX + contentMargin, sigY + 12);
  doc.text('Sub Postmaster', middleX + contentMargin, sigY + 17);
  doc.text(OFFICE_NAME, middleX + contentMargin, sigY + 22);
  
  // Draw merged footer box
  const footerY = yOffset + halfHeight - margin - footerHeight;
  doc.rect(margin, footerY, pageWidth - 2 * margin, footerHeight);
  
  // Footer note - centered in merged box
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  const noteText = 'Note: The verification memo should be returned to the HO within 10 days in case where the place of residence of the depositor lies in the jurisdictions of P.R.I and within 30 days in all other cases.';
  const noteLines = doc.splitTextToSize(noteText, pageWidth - 2 * margin - (contentMargin * 2));
  doc.text(noteLines, margin + contentMargin, footerY + 4);
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
