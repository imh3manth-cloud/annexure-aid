import jsPDF from 'jspdf';
import { MemoRecord } from './db';
import { getConfig, type OfficeAddress } from './config';
import { getPdfConfig, PdfFormatConfig } from './pdfConfig';

// Write a full address block in PDF and return new Y position
const writeAddress = (doc: jsPDF, addr: OfficeAddress, x: number, y: number, indent: number = 5): number => {
  doc.text(addr.name + ',', x + indent, y);
  y += 5;
  doc.text(addr.line1 + ',', x + indent, y);
  y += 5;
  if (addr.line2) {
    doc.text(addr.line2 + ',', x + indent, y);
    y += 5;
  }
  doc.text(`${addr.city} - ${addr.pincode}`, x + indent, y);
  return y;
};

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
  const pdfConfig = getPdfConfig();
  const OFFICE_NAME = config.officeName;
  const SUBDIVISION = config.subdivision;
  const pageWidth = 210; // A4 width in mm
  const pageHeight = 297; // A4 height in mm
  const halfHeight = pageHeight / 2;
  const margin = pdfConfig.pageMargin;
  const contentMargin = pdfConfig.contentMargin;
  const columnWidth = (pageWidth - 2 * margin) / 2;
  const middleX = margin + columnWidth;
  const headerHeight = pdfConfig.headerHeight;
  const footerHeight = pdfConfig.footerHeight;
  const lineSpacing = pdfConfig.lineSpacing;
  
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
  doc.setFontSize(pdfConfig.headerFontSize);
  doc.setFont('helvetica', 'bold');
  const headerYCenter = yOffset + (headerHeight * 0.45);
  doc.text(pdfConfig.textContent.headerTitle, margin + columnWidth / 2, headerYCenter, { align: 'center' });
  doc.setFontSize(pdfConfig.subHeaderFontSize);
  doc.text(pdfConfig.textContent.headerSubtitle, margin + columnWidth / 2, headerYCenter + (pdfConfig.headerFontSize * 0.35), { align: 'center' });
  
  // Right header (duplicate)
  doc.setFontSize(pdfConfig.headerFontSize);
  doc.setFont('helvetica', 'bold');
  doc.text(pdfConfig.textContent.headerTitle, middleX + columnWidth / 2, headerYCenter, { align: 'center' });
  doc.setFontSize(pdfConfig.subHeaderFontSize);
  doc.text(pdfConfig.textContent.headerSubtitle, middleX + columnWidth / 2, headerYCenter + (pdfConfig.headerFontSize * 0.35), { align: 'center' });
  
  // Draw body separator line (below header)
  const bodyStartY = yOffset + headerHeight;
  doc.line(margin, bodyStartY, pageWidth - margin, bodyStartY);
  
  // Draw vertical line separating left and right columns (body section only)
  const bodyEndY = yOffset + headerHeight + bodyHeight;
  doc.line(middleX, bodyStartY, middleX, bodyEndY);
  
  // Left column - Memo of Verification (body section)
  let leftY = bodyStartY + lineSpacing + 1;
  doc.setFontSize(pdfConfig.bodyFontSize + 1);
  doc.setFont('helvetica', 'bold');
  doc.text(pdfConfig.textContent.leftColumnTitle, margin + columnWidth / 2, leftY, { align: 'center' });
  
  leftY += lineSpacing + 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(pdfConfig.bodyFontSize);
  doc.text(
    `No: ${memo.serial} dated at ${OFFICE_NAME} SO the ${formatDate(memo.txn_date)}`,
    margin + columnWidth / 2,
    leftY,
    { align: 'center' }
  );
  
  // Draw line under sub-header
  leftY += 2;
  doc.line(margin, leftY, middleX, leftY);
  
  leftY += lineSpacing + 1;
  // Withdrawal info
  doc.setFontSize(pdfConfig.bodyFontSize);
  const withdrawalText = `A withdrawal of Rs ${formatAmount(memo.amount)} (${memo.txn_id}) has been effected in Account No ${memo.account} at ${memo.BO_Name} BO in account with ${OFFICE_NAME} S.O on ${formatDate(memo.txn_date)}.`;
  const withdrawalLines = doc.splitTextToSize(withdrawalText, columnWidth - (contentMargin * 2) - 2);
  doc.text(withdrawalLines, margin + contentMargin + 1, leftY);
  leftY += withdrawalLines.length * lineSpacing;
  
  // Name and address section
  leftY += lineSpacing * 0.5;
  doc.text(pdfConfig.textContent.addressSectionLabel, margin + contentMargin + 1, leftY);
  leftY += lineSpacing;
  
  // Draw box for name and address
  const boxStartY = leftY - 1;
  const boxWidth = columnWidth - (contentMargin * 2) - 2;
  
  // Name with underline label
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(pdfConfig.labelFontSize);
  doc.text('Name', margin + contentMargin + 2, leftY);
  doc.setFont('helvetica', 'normal');
  doc.text(':', margin + contentMargin + 14, leftY);
  const nameText = memo.name.toUpperCase();
  const nameLines = doc.splitTextToSize(nameText, boxWidth - 20);
  doc.text(nameLines, margin + contentMargin + 17, leftY);
  leftY += Math.max(nameLines.length * lineSpacing, lineSpacing);
  
  // Address with underline label
  doc.setFont('helvetica', 'bold');
  doc.text('Address', margin + contentMargin + 2, leftY);
  doc.setFont('helvetica', 'normal');
  doc.text(':', margin + contentMargin + 14, leftY);
  const addressText = memo.address.toUpperCase();
  const addressLines = doc.splitTextToSize(addressText, boxWidth - 20);
  doc.text(addressLines, margin + contentMargin + 17, leftY);
  leftY += Math.max(addressLines.length * lineSpacing, lineSpacing);
  
  // Draw the box around name and address
  const boxEndY = leftY + pdfConfig.boxPadding - 2;
  doc.setLineWidth(0.3);
  doc.rect(margin + contentMargin + 1, boxStartY - 2, boxWidth, boxEndY - boxStartY + 2);
  
  leftY += lineSpacing;
  doc.setFontSize(pdfConfig.bodyFontSize);
  const verifyText = pdfConfig.textContent.verificationInstruction;
  const verifyLines = doc.splitTextToSize(verifyText, columnWidth - (contentMargin * 2) - 2);
  doc.text(verifyLines, margin + contentMargin + 1, leftY);
  
  // Bottom section with To and Signature
  leftY = bodyEndY - (pdfConfig.signatureSpacing * 5);
  doc.setFontSize(pdfConfig.signatureFontSize);
  doc.text(pdfConfig.textContent.toLabel, margin + contentMargin + 1, leftY);
  leftY += pdfConfig.signatureSpacing;
  doc.text(pdfConfig.textContent.inspectorLabel, margin + contentMargin + 1, leftY);
  leftY += pdfConfig.signatureSpacing;
  doc.text(`${SUBDIVISION}`, margin + contentMargin + 1, leftY);
  
  // Sub Post Master on right side
  doc.setFont('helvetica', 'bold');
  doc.text(pdfConfig.textContent.subPostmasterLabel, margin + columnWidth - contentMargin - 2, leftY - pdfConfig.signatureSpacing, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(`${OFFICE_NAME} SO`, margin + columnWidth - contentMargin - 2, leftY, { align: 'right' });
  
  // Right column - Reply (body section)
  let rightY = bodyStartY + lineSpacing + 1;
  doc.setFontSize(pdfConfig.bodyFontSize + 1);
  doc.setFont('helvetica', 'bold');
  doc.text(pdfConfig.textContent.rightColumnTitle, middleX + columnWidth / 2, rightY, { align: 'center' });
  
  rightY += lineSpacing + 1;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(pdfConfig.bodyFontSize);
  doc.text(
    `No: ${memo.serial} dated at ${OFFICE_NAME} SO the ${formatDate(memo.txn_date)}`,
    middleX + columnWidth / 2,
    rightY,
    { align: 'center' }
  );
  
  // Draw line under sub-header
  rightY += 2;
  doc.line(middleX, rightY, pageWidth - margin, rightY);
  
  rightY += lineSpacing + 2;
  doc.setFontSize(pdfConfig.bodyFontSize);
  const replyText1 = pdfConfig.textContent.replyText;
  const replyLines1 = doc.splitTextToSize(replyText1, columnWidth - (contentMargin * 2) - 2);
  doc.text(replyLines1, middleX + contentMargin + 1, rightY);
  rightY += replyLines1.length * lineSpacing;
  
  rightY += lineSpacing + 1;
  doc.text(pdfConfig.textContent.investigationText, middleX + contentMargin + 1, rightY);
  
  // Inspector of Posts centered
  rightY += lineSpacing * 3;
  doc.text(pdfConfig.textContent.inspectorLabel, middleX + columnWidth / 2, rightY, { align: 'center' });
  rightY += pdfConfig.signatureSpacing;
  doc.text(`${SUBDIVISION}`, middleX + columnWidth / 2, rightY, { align: 'center' });
  
  // Bottom section with To
  rightY = bodyEndY - (pdfConfig.signatureSpacing * 3.5);
  doc.setFontSize(pdfConfig.signatureFontSize);
  doc.text(pdfConfig.textContent.toLabel, middleX + contentMargin + 1, rightY);
  rightY += pdfConfig.signatureSpacing;
  doc.text('Sub Postmaster', middleX + contentMargin + 1, rightY);
  rightY += pdfConfig.signatureSpacing;
  doc.text(`${OFFICE_NAME} SO`, middleX + contentMargin + 1, rightY);
  
  // Draw footer separator line
  doc.line(margin, bodyEndY, pageWidth - margin, bodyEndY);
  
  // Footer note box spanning full width below the memo
  const noteY = yOffset + availableHeight + 2;
  doc.setLineWidth(0.5);
  doc.rect(margin, noteY, pageWidth - 2 * margin, 8);
  
  doc.setFontSize(pdfConfig.noteFontSize);
  doc.setFont('helvetica', 'bold');
  const noteText = 'Note: ';
  doc.text(noteText, margin + 2, noteY + 3);
  
  doc.setFont('helvetica', 'normal');
  const noteContent = pdfConfig.textContent.noteText;
  const noteLines = doc.splitTextToSize(noteContent, pageWidth - 2 * margin - 10);
  doc.text(noteLines, margin + 2 + doc.getTextWidth(noteText), noteY + 3);
};

// Generate sample memo PDF for preview
export const generateSampleMemoPDF = (): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const sampleMemo: MemoRecord = {
    id: 1,
    serial: 101,
    memoKey: 'SAMPLE-001',
    account: '0100123456789',
    txn_id: 'TXN2024001234',
    amount: 25000,
    txn_date: new Date().toISOString(),
    name: 'SAMPLE DEPOSITOR NAME',
    address: '123 Sample Street, Sample Village, Sample District, Karnataka 570001',
    balance: 50000,
    balance_date: new Date().toISOString(),
    BO_Code: 'BO21309111001',
    BO_Name: 'Sample Branch Office',
    status: 'New',
    printed: false,
    memo_sent_date: null,
    reminder_count: 0,
    last_reminder_date: null,
    verified_date: null,
    reported_date: null,
    remarks: '',
    created_at: new Date().toISOString()
  };
  
  // Draw first memo at top
  drawMemo(doc, sampleMemo, 5);
  
  // Draw second memo at bottom
  const secondMemo = { ...sampleMemo, serial: 102 };
  drawMemo(doc, secondMemo, 5 + 297 / 2);
  
  return doc;
};

// Generate consolidated PDF for multiple memos with summary report
export const generateConsolidatedPDF = (memos: MemoRecord[]): jsPDF => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const config = getConfig();
  
  // Cover letter page first
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Department of Posts, India', 105, 20, { align: 'center' });
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  let coverY = 40;
  doc.text('To,', 20, coverY);
  coverY += 7;
  doc.text('The Inspector of Posts,', 20, coverY);
  coverY += 7;
  doc.text(`${config.subdivision}`, 20, coverY);
  
  coverY += 20;
  doc.setFont('helvetica', 'bold');
  doc.text('Sub: Verification of High Value Wdl Memos - Reg:', 20, coverY);
  
  doc.setFont('helvetica', 'normal');
  coverY += 15;
  doc.text('Sir/Madam,', 25, coverY);
  coverY += 10;
  const bodyText = 'The following High Value Wdl Memos are sent herewith for verification and early returns please.';
  doc.text(bodyText, 25, coverY, { maxWidth: 160 });
  
  let pageCount = 1;
  // Fit 2 memos per page (reverted from 3 to avoid overlapping)
  const memosPerPage = 2;
  const memoHeight = 297 / memosPerPage; // Divide page height by 2
  
  for (let i = 0; i < memos.length; i += memosPerPage) {
    doc.addPage();
    
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
  
  // Add IP addressing and Sub Postmaster signature at the end
  yPos += 20;
  if (yPos > 240) {
    doc.addPage();
    yPos = 40;
  }
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Left side - To Inspector of Posts
  doc.text('To', 20, yPos);
  yPos += 5;
  doc.text('Inspector of Posts,', 20, yPos);
  yPos += 5;
  doc.text(`${config.subdivision}`, 20, yPos);
  
  // Right side - Sub Postmaster (same line as last IP line)
  doc.text('Sub Postmaster', 175, yPos - 10, { align: 'right' });
  doc.text(`${config.officeName} S.O`, 175, yPos - 5, { align: 'right' });
  
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

// Generate reminder PDF addressed to Inspector of Posts
export const generateReminderPDF = (memos: MemoRecord[]): jsPDF => {
  const config = getConfig();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let y = 15;

  // === LETTER HEADER ===
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Department of Posts, India', pageWidth / 2, y, { align: 'center' });
  
  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('From,', margin, y);
  y += 5;
  doc.text(`The Sub Postmaster,`, margin + 5, y);
  y += 5;
  doc.text(`${config.officeName}`, margin + 5, y);
  y += 5;
  doc.text(`${config.subdivision}`, margin + 5, y);

  y += 8;
  doc.text('To,', margin, y);
  y += 5;
  doc.text('The Inspector of Posts,', margin + 5, y);
  y += 5;
  doc.text(`${config.subdivision}`, margin + 5, y);
  
  // Date on right
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  doc.text(`Date: ${dateStr}`, pageWidth - margin, y, { align: 'right' });
  
  // Subject
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Sub: Reminder for pending High Value Withdrawal Verification Memos - Reg.', margin, y);
  
  // Reference line with reminder number
  const reminderNum = memos.length > 0 ? memos[0].reminder_count : 1;
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Ref: Reminder No. ${reminderNum}`, margin, y);
  
  // Letter body
  y += 10;
  doc.setFontSize(10);
  doc.text('Sir/Madam,', margin + 5, y);
  y += 7;
  const bodyText = `With reference to the above subject, it is to bring to your kind notice that the following High Value Withdrawal Verification Memos (ANNEXURE-4) issued from this office are still pending for verification reply. Despite earlier correspondence, no replies have been received so far. The details of pending memos are furnished below for your kind perusal and necessary action. Kindly expedite the verification and return the replies at the earliest.`;
  const bodyLines = doc.splitTextToSize(bodyText, contentWidth - 10);
  doc.text(bodyLines, margin + 5, y);
  y += bodyLines.length * 5 + 5;
  
  // === SECTION 1: BO-WISE CONSOLIDATED SUMMARY ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('I. Consolidated Summary - Branch Office wise pending memos:', margin, y);
  y += 7;
  
  // Group memos by BO
  const boGroups: Record<string, MemoRecord[]> = {};
  memos.forEach(memo => {
    const bo = memo.BO_Name || 'Unknown';
    if (!boGroups[bo]) boGroups[bo] = [];
    boGroups[bo].push(memo);
  });
  
  const boNames = Object.keys(boGroups).sort();
  
  // Summary table header
  const summaryColWidths = [15, 80, 35, 40];
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  
  // Draw header row with border
  const headerH = 7;
  doc.rect(margin, y - 4, contentWidth, headerH);
  let sx = margin + 2;
  doc.text('Sl.', sx, y);
  sx += summaryColWidths[0];
  doc.text('Branch Office', sx, y);
  sx += summaryColWidths[1];
  doc.text('No. of Memos', sx, y);
  sx += summaryColWidths[2];
  doc.text('Total Amount (₹)', sx, y);
  y += headerH - 1;
  
  // Summary rows
  doc.setFont('helvetica', 'normal');
  let grandTotal = 0;
  let grandCount = 0;
  
  boNames.forEach((bo, idx) => {
    const group = boGroups[bo];
    const totalAmount = group.reduce((sum, m) => sum + m.amount, 0);
    grandTotal += totalAmount;
    grandCount += group.length;
    
    const rowH = 6;
    doc.rect(margin, y - 3.5, contentWidth, rowH);
    sx = margin + 2;
    doc.text(String(idx + 1), sx, y);
    sx += summaryColWidths[0];
    doc.text(bo, sx, y);
    sx += summaryColWidths[1];
    doc.text(String(group.length), sx, y);
    sx += summaryColWidths[2];
    doc.text(formatAmount(totalAmount), sx, y);
    y += rowH;
  });
  
  // Grand total row
  const gtRowH = 7;
  doc.setFont('helvetica', 'bold');
  doc.rect(margin, y - 3.5, contentWidth, gtRowH);
  sx = margin + 2;
  doc.text('', sx, y);
  sx += summaryColWidths[0];
  doc.text('GRAND TOTAL', sx, y);
  sx += summaryColWidths[1];
  doc.text(String(grandCount), sx, y);
  sx += summaryColWidths[2];
  doc.text(formatAmount(grandTotal), sx, y);
  y += gtRowH + 8;
  
  // === SECTION 2: BO-WISE DETAILED TABLE ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  
  // Check page space
  if (y > 250) {
    doc.addPage();
    y = 15;
  }
  doc.text('II. Branch Office wise Details of Pending Memos:', margin, y);
  y += 7;
  
  const detailColWidths = [18, 28, 25, 55, 30];
  const detailHeaders = ['Memo No.', 'Account No.', 'Memo Date', 'Depositor Name', 'Amount (₹)'];
  
  boNames.forEach((bo) => {
    const group = boGroups[bo];
    const boTotal = group.reduce((sum, m) => sum + m.amount, 0);
    
    // Check if we need a new page (header + at least 2 rows)
    if (y > 255) {
      doc.addPage();
      y = 15;
    }
    
    // BO sub-header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${bo} (${group.length} memos, ₹${formatAmount(boTotal)})`, margin, y);
    y += 5;
    
    // Detail table header
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    const thH = 6;
    doc.rect(margin, y - 3.5, contentWidth, thH);
    let dx = margin + 1;
    detailHeaders.forEach((h, i) => {
      doc.text(h, dx, y);
      dx += detailColWidths[i];
    });
    y += thH;
    
    // Detail rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    
    group.sort((a, b) => a.serial - b.serial).forEach((memo) => {
      if (y > 280) {
        doc.addPage();
        y = 15;
      }
      
      const rowH = 5.5;
      doc.rect(margin, y - 3.5, contentWidth, rowH);
      dx = margin + 1;
      doc.text(String(memo.serial), dx, y);
      dx += detailColWidths[0];
      doc.text(memo.account, dx, y);
      dx += detailColWidths[1];
      doc.text(memo.memo_sent_date ? formatDate(memo.memo_sent_date) : formatDate(memo.txn_date), dx, y);
      dx += detailColWidths[2];
      const nameText = doc.splitTextToSize(memo.name || '', detailColWidths[3] - 3);
      doc.text(nameText[0] || '', dx, y);
      dx += detailColWidths[3];
      doc.text(formatAmount(memo.amount), dx, y);
      y += rowH;
    });
    
    y += 5;
  });
  
  // === SIGNATURE BLOCK ===
  y += 10;
  if (y > 260) {
    doc.addPage();
    y = 40;
  }
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Thanking you,', margin + 5, y);
  y += 5;
  doc.text('Yours faithfully,', margin + 5, y);
  
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('Sub Postmaster', pageWidth - margin, y, { align: 'right' });
  y += 5;
  doc.text(`${config.officeName}`, pageWidth - margin, y, { align: 'right' });
  
  return doc;
};

// Generate report to Superintendent for overdue cases
export const generateOverdueReportPDF = (memos: MemoRecord[]): jsPDF => {
  const config = getConfig();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  const today = new Date();
  const dateStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;
  let y = 15;

  // === LETTER HEADER ===
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Department of Posts, India', pageWidth / 2, y, { align: 'center' });
  
  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('From,', margin, y);
  y += 5;
  doc.text(`The Sub Postmaster,`, margin + 5, y);
  y += 5;
  doc.text(`${config.officeName}`, margin + 5, y);
  y += 5;
  doc.text(`${config.subdivision}`, margin + 5, y);

  y += 8;
  doc.text('To,', margin, y);
  y += 5;
  doc.text('The Superintendent of Post Offices,', margin + 5, y);
  y += 5;
  doc.text(`${config.division}`, margin + 5, y);
  
  // Date on right
  doc.text(`Date: ${dateStr}`, pageWidth - margin, y, { align: 'right' });
  
  // Subject
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Sub: Report on Overdue High Value Withdrawal Verification Memos - Reg.', margin, y);
  
  // Letter body
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Sir/Madam,', margin + 5, y);
  y += 7;
  const bodyText = `With reference to the above subject, it is respectfully submitted that the following High Value Withdrawal Verification Memos (ANNEXURE-4) issued from this office are overdue. Despite issuing reminders to the Inspector of Posts, no replies have been received within 15 days from the date of issue of reminder as per rules. The details of overdue memos are furnished below for your kind perusal and necessary action please.`;
  const bodyLines = doc.splitTextToSize(bodyText, contentWidth - 10);
  doc.text(bodyLines, margin + 5, y);
  y += bodyLines.length * 5 + 5;

  // === SECTION 1: BO-WISE CONSOLIDATED SUMMARY ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('I. Consolidated Summary - Branch Office wise overdue memos:', margin, y);
  y += 7;
  
  // Group memos by BO
  const boGroups: Record<string, MemoRecord[]> = {};
  memos.forEach(memo => {
    const bo = memo.BO_Name || 'Unknown';
    if (!boGroups[bo]) boGroups[bo] = [];
    boGroups[bo].push(memo);
  });
  
  const boNames = Object.keys(boGroups).sort();
  
  // Summary table header
  const summaryColWidths = [15, 80, 35, 40];
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  
  const headerH = 7;
  doc.rect(margin, y - 4, contentWidth, headerH);
  let sx = margin + 2;
  doc.text('Sl.', sx, y);
  sx += summaryColWidths[0];
  doc.text('Branch Office', sx, y);
  sx += summaryColWidths[1];
  doc.text('No. of Memos', sx, y);
  sx += summaryColWidths[2];
  doc.text('Total Amount (₹)', sx, y);
  y += headerH - 1;
  
  // Summary rows
  doc.setFont('helvetica', 'normal');
  let grandTotal = 0;
  let grandCount = 0;
  
  boNames.forEach((bo, idx) => {
    const group = boGroups[bo];
    const totalAmount = group.reduce((sum, m) => sum + m.amount, 0);
    grandTotal += totalAmount;
    grandCount += group.length;
    
    const rowH = 6;
    doc.rect(margin, y - 3.5, contentWidth, rowH);
    sx = margin + 2;
    doc.text(String(idx + 1), sx, y);
    sx += summaryColWidths[0];
    doc.text(bo, sx, y);
    sx += summaryColWidths[1];
    doc.text(String(group.length), sx, y);
    sx += summaryColWidths[2];
    doc.text(formatAmount(totalAmount), sx, y);
    y += rowH;
  });
  
  // Grand total row
  const gtRowH = 7;
  doc.setFont('helvetica', 'bold');
  doc.rect(margin, y - 3.5, contentWidth, gtRowH);
  sx = margin + 2;
  sx += summaryColWidths[0];
  doc.text('GRAND TOTAL', sx, y);
  sx += summaryColWidths[1];
  doc.text(String(grandCount), sx, y);
  sx += summaryColWidths[2];
  doc.text(formatAmount(grandTotal), sx, y);
  y += gtRowH + 8;

  // === SECTION 2: BO-WISE DETAILED TABLE ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  
  if (y > 250) {
    doc.addPage();
    y = 15;
  }
  doc.text('II. Branch Office wise Details of Overdue Memos:', margin, y);
  y += 7;
  
  const detailColWidths = [18, 28, 25, 55, 30];
  const detailHeaders = ['Memo No.', 'Account No.', 'Memo Date', 'Depositor Name', 'Amount (₹)'];
  
  boNames.forEach((bo) => {
    const group = boGroups[bo];
    const boTotal = group.reduce((sum, m) => sum + m.amount, 0);
    
    if (y > 255) {
      doc.addPage();
      y = 15;
    }
    
    // BO sub-header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(`${bo} (${group.length} memos, ₹${formatAmount(boTotal)})`, margin, y);
    y += 5;
    
    // Detail table header
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    const thH = 6;
    doc.rect(margin, y - 3.5, contentWidth, thH);
    let dx = margin + 1;
    detailHeaders.forEach((h, i) => {
      doc.text(h, dx, y);
      dx += detailColWidths[i];
    });
    y += thH;
    
    // Detail rows
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    
    group.sort((a, b) => a.serial - b.serial).forEach((memo) => {
      if (y > 280) {
        doc.addPage();
        y = 15;
      }
      
      const rowH = 5.5;
      doc.rect(margin, y - 3.5, contentWidth, rowH);
      dx = margin + 1;
      doc.text(String(memo.serial), dx, y);
      dx += detailColWidths[0];
      doc.text(memo.account, dx, y);
      dx += detailColWidths[1];
      doc.text(memo.memo_sent_date ? formatDate(memo.memo_sent_date) : formatDate(memo.txn_date), dx, y);
      dx += detailColWidths[2];
      const nameText = doc.splitTextToSize(memo.name || '', detailColWidths[3] - 3);
      doc.text(nameText[0] || '', dx, y);
      dx += detailColWidths[3];
      doc.text(formatAmount(memo.amount), dx, y);
      y += rowH;
    });
    
    y += 5;
  });

  // === SIGNATURE BLOCK ===
  y += 10;
  if (y > 260) {
    doc.addPage();
    y = 40;
  }
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Thanking you,', margin + 5, y);
  y += 5;
  doc.text('Yours faithfully,', margin + 5, y);
  
  y += 15;
  doc.setFont('helvetica', 'bold');
  doc.text('Sub Postmaster', pageWidth - margin, y, { align: 'right' });
  y += 5;
  doc.text(`${config.officeName}`, pageWidth - margin, y, { align: 'right' });
  
  return doc;
};

// Get quarter info from a date
const getQuarterInfo = (date: Date) => {
  const month = date.getMonth();
  const year = date.getFullYear();
  
  // Quarters: Q1 (Apr-Jun), Q2 (Jul-Sep), Q3 (Oct-Dec), Q4 (Jan-Mar)
  // Report due: Jan 5 (Q3), Apr 5 (Q4), Jul 5 (Q1), Oct 5 (Q2)
  if (month >= 0 && month <= 2) {
    return { quarter: 'Q4', period: `January - March ${year}`, startMonth: 0, endMonth: 2, year };
  } else if (month >= 3 && month <= 5) {
    return { quarter: 'Q1', period: `April - June ${year}`, startMonth: 3, endMonth: 5, year };
  } else if (month >= 6 && month <= 8) {
    return { quarter: 'Q2', period: `July - September ${year}`, startMonth: 6, endMonth: 8, year };
  } else {
    return { quarter: 'Q3', period: `October - December ${year}`, startMonth: 9, endMonth: 11, year };
  }
};

// Generate quarterly report to Divisional Superintendent
export const generateQuarterlyReportPDF = (
  memos: MemoRecord[],
  quarterStart: Date,
  quarterEnd: Date
): jsPDF => {
  const config = getConfig();
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const quarterInfo = getQuarterInfo(quarterStart);
  
  // Filter memos for the quarter
  const quarterMemos = memos.filter(m => {
    if (!m.memo_sent_date) return false;
    const memoDate = new Date(m.memo_sent_date);
    return memoDate >= quarterStart && memoDate <= quarterEnd;
  });
  
  const verified = quarterMemos.filter(m => m.status === 'Verified');
  const reported = quarterMemos.filter(m => m.status === 'Reported');
  const pending = quarterMemos.filter(m => m.status === 'Pending');
  
  // Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Department of Posts, India', 105, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  let y = 30;
  doc.text('To,', 20, y);
  y += 6;
  doc.text('The Superintendent of Post Offices,', 20, y);
  y += 6;
  doc.text(`${config.division}`, 20, y);
  
  // Subject
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.text('Sub: Quarterly Report on Verification of High Value Withdrawals', 20, y);
  y += 6;
  doc.text(`       (${quarterInfo.period}) - Reg:`, 20, y);
  
  y += 10;
  doc.setFont('helvetica', 'normal');
  doc.text('Sir/Madam,', 25, y);
  
  y += 8;
  const bodyText = `It is certified that action for verification of withdrawals of Rs.10,000/- and above in savings accounts at Branch Offices through verification memos has been duly completed in time for the quarter ${quarterInfo.period}.`;
  const bodyLines = doc.splitTextToSize(bodyText, 160);
  doc.text(bodyLines, 25, y);
  y += bodyLines.length * 6;
  
  // Summary table
  y += 10;
  doc.setFont('helvetica', 'bold');
  doc.text('Summary of Verification Memos:', 20, y);
  
  y += 8;
  doc.setFont('helvetica', 'normal');
  
  // Draw summary box
  doc.rect(20, y, 170, 50);
  
  const summaryData = [
    ['Total Memos Issued during Quarter', String(quarterMemos.length)],
    ['Memos Verified', String(verified.length)],
    ['Cases Reported for Action', String(reported.length)],
    ['Memos Pending Verification', String(pending.length)],
    ['Verification Completion Rate', quarterMemos.length > 0 
      ? `${((verified.length / quarterMemos.length) * 100).toFixed(1)}%` 
      : 'N/A']
  ];
  
  let tableY = y + 8;
  summaryData.forEach(([label, value]) => {
    doc.text(label, 25, tableY);
    doc.text(':', 130, tableY);
    doc.text(value, 140, tableY);
    tableY += 9;
  });
  
  y = tableY + 10;
  
  // Branch-wise breakdown
  if (quarterMemos.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Branch Office Wise Summary:', 20, y);
    y += 8;
    
    // Group by BO
    const boStats: Record<string, { total: number; verified: number; pending: number; reported: number }> = {};
    quarterMemos.forEach(m => {
      const bo = m.BO_Name || 'Unknown';
      if (!boStats[bo]) boStats[bo] = { total: 0, verified: 0, pending: 0, reported: 0 };
      boStats[bo].total++;
      if (m.status === 'Verified') boStats[bo].verified++;
      else if (m.status === 'Reported') boStats[bo].reported++;
      else boStats[bo].pending++;
    });
    
    // Table headers
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Branch Office', 25, y);
    doc.text('Total', 90, y);
    doc.text('Verified', 110, y);
    doc.text('Reported', 135, y);
    doc.text('Pending', 160, y);
    
    doc.line(20, y + 2, 190, y + 2);
    y += 7;
    
    doc.setFont('helvetica', 'normal');
    Object.entries(boStats).sort().forEach(([bo, stats]) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.text(bo, 25, y, { maxWidth: 60 });
      doc.text(String(stats.total), 95, y);
      doc.text(String(stats.verified), 115, y);
      doc.text(String(stats.reported), 140, y);
      doc.text(String(stats.pending), 165, y);
      y += 6;
    });
  }
  
  // Footer with signature
  y += 20;
  if (y > 250) {
    doc.addPage();
    y = 40;
  }
  
  doc.setFontSize(10);
  const reportDate = formatDate(new Date().toISOString().split('T')[0]);
  doc.text(`Date: ${reportDate}`, 20, y);
  
  doc.text('Sub Postmaster', 180, y, { align: 'right' });
  y += 6;
  doc.text(`${config.officeName} S.O`, 180, y, { align: 'right' });
  
  return doc;
};
