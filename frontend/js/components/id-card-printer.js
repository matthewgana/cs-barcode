/**
 * Elite Academic Credential & ID Card Print Engine
 * Provides dual-sided CR80 badge rendering, cutting guides, vector barcodes,
 * and isolated high-fidelity printing.
 */

import { Util } from '../core/utilities.js';

export const IdCardPrinter = {
  /**
   * Normalizes student data from various API shapes
   */
  normalizeStudent(raw = {}) {
    const fullName = raw.fullName || raw.full_name || `${raw.first_name || ''} ${raw.last_name || ''}`.trim() || 'Student Name';
    const matricNumber = raw.matricNumber || raw.matric_number || raw.reg_number || 'MATRIC-PENDING';
    const rawLevel = String(raw.academicLevel || raw.academic_level || raw.level || '100').replace(/\D/g, '') || '100';
    const academicLevel = rawLevel.endsWith('00') ? rawLevel : `${rawLevel}00`;
    const barcodeValue = raw.barcodeValue || raw.barcode_value || `CS${rawLevel}-0000`;
    const id = raw.id || raw.student_id || null;
    const admissionYear = raw.admissionYear || raw.admission_year || new Date().getFullYear();
    const validThru = parseInt(admissionYear, 10) + 4;
    const initials = fullName
      .split(' ')
      .filter(Boolean)
      .map(w => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'CS';

    return {
      id,
      fullName,
      matricNumber,
      academicLevel,
      barcodeValue,
      admissionYear,
      validThru,
      initials,
      photoUrl: raw.photoUrl || raw.photo_url || null,
      email: raw.email || 'student@university.edu.ng',
      programme: 'B.Sc. Computer Science',
      faculty: 'Faculty of Computing & Informatics',
      university: 'Federal University of Technology',
      department: 'Dept. of Computer Science'
    };
  },

  /**
   * Generates the complete, self-contained HTML for the print sheet
   */
  getPrintSheetHtml(rawStudent) {
    const s = this.normalizeStudent(rawStudent);
    const barcodeUrl = s.id ? `/api/students/${s.id}/barcode?format=svg&type=code128` : '';
    const qrcodeUrl = s.id ? `/api/students/${s.id}/barcode?format=svg&type=qrcode` : '';
    const issueDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const refCode = `FUT-CS-${s.matricNumber.replace(/[^A-Za-z0-9]/g, '')}-${Date.now().toString().slice(-4)}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Student ID Badge - ${Util.escapeHtml(s.fullName)} (${Util.escapeHtml(s.matricNumber)})</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    /* ==========================================================================
       Print Sheet Reset & Typography
       ========================================================================== */
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #0f172a;
      color: #0f172a;
      display: flex;
      flex-direction: column;
      align-items: center;
      min-height: 100vh;
      padding: 0 0 40px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Screen-Only Control Toolbar */
    .screen-toolbar {
      width: 100%;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      position: sticky;
      top: 0;
      z-index: 100;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
    }

    .toolbar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #f8fafc;
    }

    .toolbar-logo {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #0ea5e9, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.25rem;
      box-shadow: 0 4px 12px rgba(14, 165, 233, 0.4);
    }

    .toolbar-title {
      font-size: 0.95rem;
      font-weight: 700;
      letter-spacing: -0.01em;
      color: #f8fafc;
    }

    .toolbar-subtitle {
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .toolbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: inherit;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 9px 18px;
      border-radius: 8px;
      border: 1px solid transparent;
      cursor: pointer;
      transition: all 0.2s ease;
      text-decoration: none;
    }

    .btn-primary {
      background: linear-gradient(135deg, #0ea5e9, #0284c7);
      color: #ffffff;
      box-shadow: 0 4px 16px rgba(14, 165, 233, 0.4);
    }

    .btn-primary:hover {
      background: linear-gradient(135deg, #38bdf8, #0ea5e9);
      transform: translateY(-1px);
      box-shadow: 0 6px 20px rgba(14, 165, 233, 0.5);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #e2e8f0;
      border-color: rgba(255, 255, 255, 0.15);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      color: #ffffff;
    }

    .toolbar-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.75rem;
      color: #38bdf8;
      background: rgba(14, 165, 233, 0.1);
      padding: 6px 12px;
      border-radius: 6px;
      border: 1px solid rgba(14, 165, 233, 0.25);
    }

    /* ==========================================================================
       A4 Printable Page Sheet Container
       ========================================================================== */
    .sheet-wrapper {
      margin-top: 30px;
      background: #ffffff;
      width: 210mm;
      min-height: 297mm;
      max-height: 297mm;
      padding: 12mm 15mm;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.45);
      border-radius: 6px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }

    /* Institutional Letterhead Banner */
    .letterhead {
      border-bottom: 2px solid #0f172a;
      padding-bottom: 8px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }

    .letterhead-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .university-crest {
      width: 50px;
      height: 50px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #0284c7, #0c1a2e);
      border: 2px solid #0f172a;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      color: #f8fafc;
      flex-shrink: 0;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    .letterhead-text h1 {
      font-size: 12pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #0c1a2e;
      line-height: 1.15;
    }

    .letterhead-text h2 {
      font-size: 8.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #0369a1;
      margin-top: 2px;
    }

    .letterhead-text p {
      font-size: 7.5pt;
      font-weight: 600;
      color: #475569;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 1px;
    }

    .letterhead-right {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      font-size: 7pt;
      color: #64748b;
      line-height: 1.4;
    }

    .letterhead-right strong {
      color: #0f172a;
      font-size: 7.5pt;
    }

    /* Purpose notice */
    .credential-purpose {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-left: 4px solid #0ea5e9;
      padding: 6px 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-radius: 4px;
    }

    .credential-purpose-title {
      font-size: 8pt;
      font-weight: 800;
      color: #0c1a2e;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .credential-purpose-desc {
      font-size: 7pt;
      color: #64748b;
    }

    .credential-purpose-badge {
      font-size: 6.5pt;
      font-weight: 800;
      padding: 3px 8px;
      border-radius: 12px;
      background: #dcfce7;
      color: #15803d;
      border: 1px solid #bbf7d0;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }

    /* ==========================================================================
       ID Cards Cutting & Lamination Container
       ========================================================================== */
    .id-cards-cut-container {
      border: 1.5px dashed #94a3b8;
      border-radius: 12px;
      padding: 16px 20px;
      background: #fbfcfe;
      position: relative;
      margin-bottom: 16px;
    }

    /* Cut badge indicator */
    .cut-indicator-top {
      position: absolute;
      top: -10px;
      left: 20px;
      background: #ffffff;
      padding: 0 10px;
      font-size: 6.5pt;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    /* Side-by-side card layout */
    .id-cards-grid {
      display: flex;
      justify-content: center;
      align-items: stretch;
      gap: 24px;
      position: relative;
    }

    /* Vertical fold guide between front and back */
    .fold-divider {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 24px;
      position: relative;
    }

    .fold-line {
      width: 1px;
      height: 100%;
      border-left: 1.5px dotted #94a3b8;
    }

    .fold-label {
      position: absolute;
      background: #ffffff;
      padding: 6px 2px;
      writing-mode: vertical-rl;
      text-orientation: mixed;
      font-size: 6pt;
      font-weight: 800;
      letter-spacing: 0.15em;
      color: #64748b;
      text-transform: uppercase;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }

    /* Card Wrapper with Crop Marks */
    .card-print-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    }

    .card-side-tag {
      font-size: 7pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #0369a1;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* ==========================================================================
       STANDARD CR80 ID CARD (54mm x 85.6mm vertical or 85.6mm x 54mm)
       Dimensions: 86mm height x 54mm width (standard portrait badge)
       Scaled proportionally to high-DPI: 325px x 515px
       ========================================================================== */
    .cr80-card {
      width: 78mm;
      height: 122mm;
      background: #ffffff;
      border-radius: 4.5mm;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.08);
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Holographic Security Strip */
    .card-holo-strip {
      height: 4mm;
      width: 100%;
      background: linear-gradient(90deg,
        #0284c7 0%,
        #38bdf8 15%,
        #6366f1 35%,
        #a855f7 50%,
        #ec4899 65%,
        #f97316 80%,
        #eab308 92%,
        #0284c7 100%);
    }

    /* ── FRONT CARD STYLING ── */
    .front-header {
      background: linear-gradient(135deg, #09182a 0%, #0d2547 50%, #153763 100%);
      padding: 3mm 4mm 2.5mm;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 3mm;
    }

    .front-header-crest {
      width: 8mm;
      height: 8mm;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #38bdf8, #0284c7);
      border: 1.5px solid rgba(255,255,255,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 4.5mm;
      flex-shrink: 0;
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.3);
    }

    .front-header-text {
      flex: 1;
    }

    .front-univ-name {
      font-size: 5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #93c5fd;
      line-height: 1.1;
    }

    .front-dept-name {
      font-size: 7.5pt;
      font-weight: 900;
      text-transform: uppercase;
      color: #ffffff;
      letter-spacing: -0.01em;
      line-height: 1.15;
      margin-top: 1px;
    }

    .front-card-type {
      font-size: 5pt;
      font-weight: 700;
      color: #38bdf8;
      text-transform: uppercase;
      letter-spacing: 0.14em;
    }

    /* Student Profile Segment */
    .front-profile {
      padding: 3mm 4mm 2mm;
      display: flex;
      gap: 3.5mm;
      align-items: flex-start;
    }

    .front-avatar-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.5mm;
    }

    .front-avatar {
      width: 22mm;
      height: 24mm;
      border-radius: 3mm;
      background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 60%, #93c5fd 100%);
      color: #0369a1;
      border: 2px solid #0284c7;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11pt;
      font-weight: 900;
      letter-spacing: -1px;
      box-shadow: 0 3px 8px rgba(3, 105, 161, 0.2);
      flex-shrink: 0;
      overflow: hidden;
    }

    .front-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
      border-radius: inherit;
    }

    .front-badge-chip {
      font-size: 4.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      background: #dcfce7;
      color: #15803d;
      padding: 1.2px 4px;
      border-radius: 2mm;
      border: 0.8px solid #86efac;
      white-space: nowrap;
    }

    .front-info-col {
      flex: 1;
      min-width: 0;
    }

    .front-student-name {
      font-size: 9pt;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.02em;
      line-height: 1.2;
      margin-bottom: 1.5mm;
      word-break: break-word;
    }

    .front-matric-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 7pt;
      font-weight: 800;
      background: #0c1a2e;
      color: #38bdf8;
      padding: 1.5px 5px;
      border-radius: 2mm;
      display: inline-block;
      margin-bottom: 2mm;
      letter-spacing: 0.05em;
    }

    .front-meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5mm 2mm;
    }

    .front-meta-item {
      display: flex;
      flex-direction: column;
    }

    .front-meta-label {
      font-size: 4.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #64748b;
    }

    .front-meta-value {
      font-size: 6.5pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
    }

    /* Barcode Section on Front */
    .front-barcode-section {
      padding: 2mm 4mm 3mm;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .front-barcode-title {
      font-size: 4.5pt;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.14em;
      color: #64748b;
      align-self: flex-start;
      margin-bottom: 1mm;
    }

    .front-barcode-box {
      width: 100%;
      height: 16mm;
      background: #ffffff;
      border-radius: 2mm;
      border: 1px solid #cbd5e1;
      padding: 1mm 2mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    .front-barcode-img {
      max-width: 100%;
      height: 11mm;
      object-fit: contain;
      display: block;
    }

    .front-barcode-num {
      font-family: 'JetBrains Mono', monospace;
      font-size: 6pt;
      font-weight: 800;
      letter-spacing: 0.2em;
      color: #1e293b;
      margin-top: 0.5mm;
    }

    /* Front Card Footer */
    .front-card-footer {
      background: linear-gradient(135deg, #09182a, #153763);
      padding: 2mm 4mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: #94a3b8;
    }

    .front-footer-auth {
      font-size: 4.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #cbd5e1;
    }

    .front-footer-hash {
      font-family: 'JetBrains Mono', monospace;
      font-size: 4.5pt;
      color: #38bdf8;
    }

    /* ── BACK CARD STYLING ── */
    .back-magstripe {
      height: 11mm;
      background: linear-gradient(180deg, #111827 0%, #1f2937 50%, #111827 100%);
      border-bottom: 1px solid #374151;
      position: relative;
    }

    .back-magstripe::after {
      content: '';
      position: absolute;
      top: 3.5mm;
      left: 0;
      right: 0;
      height: 3.5mm;
      background: repeating-linear-gradient(90deg, #1f2937, #1f2937 1mm, #374151 1mm, #374151 2mm);
      opacity: 0.4;
    }

    .back-content {
      padding: 3mm 4mm 2mm;
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .back-terms h3 {
      font-size: 5pt;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: #0f172a;
      margin-bottom: 1mm;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 0.5mm;
    }

    .back-terms ol {
      padding-left: 3.5mm;
      font-size: 4.5pt;
      line-height: 1.4;
      color: #334155;
    }

    .back-terms li {
      margin-bottom: 0.8mm;
    }

    .back-terms li strong {
      color: #0369a1;
    }

    /* Verification QR & Signature Row */
    .back-security-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 3mm;
      margin-top: 1.5mm;
      padding: 1.5mm 2.5mm;
      background: #f8fafc;
      border-radius: 2mm;
      border: 1px solid #e2e8f0;
    }

    .back-qr-box {
      width: 14mm;
      height: 14mm;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 1.5mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      padding: 0.8mm;
    }

    .back-qr-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    .back-signatures {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 1.5mm;
    }

    .back-sig-block {
      border-bottom: 1px solid #cbd5e1;
      padding-bottom: 0.5mm;
    }

    .back-sig-handwriting {
      font-family: 'Brush Script MT', 'Segoe Script', cursive;
      font-size: 9pt;
      color: #0369a1;
      line-height: 0.9;
      margin-bottom: -1px;
    }

    .back-sig-title {
      font-size: 4pt;
      font-weight: 800;
      text-transform: uppercase;
      color: #64748b;
      letter-spacing: 0.05em;
    }

    .back-card-footer {
      background: #0f172a;
      color: #94a3b8;
      padding: 2mm 4mm;
      font-size: 4.5pt;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .back-footer-url {
      color: #38bdf8;
      font-weight: 700;
    }

    /* ==========================================================================
       Print Instructions & Disclaimer at Sheet Bottom
       ========================================================================== */
    .sheet-instructions {
      border-top: 1px solid #cbd5e1;
      padding-top: 10px;
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 14px;
      font-size: 7pt;
      color: #475569;
    }

    .instructions-list h4 {
      font-size: 7.5pt;
      font-weight: 800;
      text-transform: uppercase;
      color: #0f172a;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }

    .instructions-list ol {
      padding-left: 14px;
      line-height: 1.45;
    }

    .instructions-list li {
      margin-bottom: 3px;
    }

    .instructions-sec {
      background: #f1f5f9;
      padding: 8px 10px;
      border-radius: 6px;
      border: 1px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    .instructions-sec strong {
      color: #0f172a;
      font-size: 7.5pt;
    }

    .instructions-sec p {
      font-size: 6.5pt;
      color: #64748b;
      line-height: 1.35;
      margin-top: 3px;
    }

    .sheet-footer-line {
      margin-top: 10px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 6.5pt;
      color: #94a3b8;
      font-family: 'JetBrains Mono', monospace;
    }

    /* ==========================================================================
       PRINT MEDIA QUERY (Clean single-page output)
       ========================================================================== */
    @media print {
      @page {
        size: A4 portrait;
        margin: 8mm 12mm 8mm 12mm;
      }

      html, body {
        background: #ffffff !important;
        color: #000000 !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        height: auto !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      .screen-toolbar {
        display: none !important;
      }

      .sheet-wrapper {
        margin: 0 auto !important;
        padding: 0 !important;
        width: 100% !important;
        min-height: auto !important;
        max-height: none !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        page-break-after: avoid !important;
        break-after: avoid !important;
      }

      .id-cards-cut-container {
        border-color: #64748b !important;
      }

      .cr80-card {
        box-shadow: none !important;
        border: 1px solid #475569 !important;
      }
    }
  </style>
</head>
<body>

  <!-- Screen Floating Toolbar (Hidden during print) -->
  <div class="screen-toolbar">
    <div class="toolbar-brand">
      <div class="toolbar-logo">🎓</div>
      <div>
        <div class="toolbar-title">Official Student ID Badge Preview</div>
        <div class="toolbar-subtitle">CR80 Dual-Sided Credential • 300+ DPI Vector Ready</div>
      </div>
    </div>

    <div class="toolbar-hint">
      <span>💡</span>
      <span><strong>Print Setting:</strong> Enable <strong>"Background graphics"</strong> for authentic color &amp; barcode clarity</span>
    </div>

    <div class="toolbar-actions">
      <button type="button" class="btn btn-secondary" onclick="window.close()">
        <span>✕</span> Close
      </button>
      <button type="button" class="btn btn-primary" onclick="window.print()">
        <span>🖨️</span> Print Badge Now
      </button>
    </div>
  </div>

  <!-- A4 Printable Sheet Document -->
  <div class="sheet-wrapper">
    
    <!-- Header / Letterhead -->
    <div>
      <div class="letterhead">
        <div class="letterhead-left">
          <div class="university-crest">🏛️</div>
          <div class="letterhead-text">
            <h1>${Util.escapeHtml(s.university)}</h1>
            <h2>${Util.escapeHtml(s.faculty)}</h2>
            <p>${Util.escapeHtml(s.department)} • Student Affairs Division</p>
          </div>
        </div>
        <div class="letterhead-right">
          <div>DOCUMENT REF: <strong>${refCode}</strong></div>
          <div>ISSUED DATE: <strong>${issueDate}</strong></div>
          <div>STATUS: <strong style="color: #15803d;">OFFICIALLY VERIFIED</strong></div>
        </div>
      </div>

      <!-- Credential Notice -->
      <div class="credential-purpose">
        <div>
          <div class="credential-purpose-title">Student Identification &amp; Lecture Attendance Card</div>
          <div class="credential-purpose-desc">Standard dual-sided CR80 badge — fold along center mark, laminate, or insert into badge holder.</div>
        </div>
        <div class="credential-purpose-badge">Active Academic Session</div>
      </div>
    </div>

    <!-- Dual Cards Cutting Zone -->
    <div class="id-cards-cut-container">
      <div class="cut-indicator-top">
        <span>✂</span> CUT ALONG OUTER DASHED BOUNDARY FOR BADGE HOLDER (CR80 SPECIFICATION)
      </div>

      <div class="id-cards-grid">
        
        <!-- FRONT OF CARD -->
        <div class="card-print-box">
          <div class="card-side-tag"><span>▼</span> Front Face</div>
          
          <div class="cr80-card">
            <!-- Holographic security shimmer strip -->
            <div class="card-holo-strip"></div>

            <!-- Deep Navy Header -->
            <div class="front-header">
              <div class="front-header-crest">🎓</div>
              <div class="front-header-text">
                <div class="front-univ-name">Federal University of Technology</div>
                <div class="front-dept-name">Computer Science</div>
                <div class="front-card-type">Student Identity Badge</div>
              </div>
            </div>

            <!-- Profile & Student Info -->
            <div class="front-profile">
              <div class="front-avatar-col">
                <div class="front-avatar">
                  ${s.photoUrl ? `
                    <img src="${s.photoUrl}" alt="${Util.escapeHtml(s.fullName)}" class="front-avatar-img" onerror="this.style.display='none'; this.parentElement.innerText='${s.initials}'" />
                  ` : s.initials}
                </div>
                <div class="front-badge-chip">● ACTIVE</div>
              </div>

              <div class="front-info-col">
                <div class="front-student-name">${Util.escapeHtml(s.fullName)}</div>
                <div class="front-matric-badge">${Util.escapeHtml(s.matricNumber)}</div>

                <div class="front-meta-grid">
                  <div class="front-meta-item">
                    <span class="front-meta-label">Level</span>
                    <span class="front-meta-value">${s.academicLevel} Level</span>
                  </div>
                  <div class="front-meta-item">
                    <span class="front-meta-label">Programme</span>
                    <span class="front-meta-value">B.Sc. CS</span>
                  </div>
                  <div class="front-meta-item">
                    <span class="front-meta-label">Admission</span>
                    <span class="front-meta-value">${s.admissionYear}</span>
                  </div>
                  <div class="front-meta-item">
                    <span class="front-meta-label">Valid Thru</span>
                    <span class="front-meta-value">${s.validThru}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Primary Attendance Barcode -->
            <div class="front-barcode-section">
              <div class="front-barcode-title">Lecture Attendance Barcode (Code 128)</div>
              <div class="front-barcode-box">
                ${barcodeUrl ? `
                  <img
                    src="${barcodeUrl}"
                    alt="Barcode for ${Util.escapeHtml(s.matricNumber)}"
                    class="front-barcode-img"
                    onerror="this.style.display='none'"
                  />
                ` : `<div style="font-family:monospace;letter-spacing:3px;font-size:12pt;font-weight:bold;">|||| | ||| | || |||| |</div>`}
                <div class="front-barcode-num">${Util.escapeHtml(s.barcodeValue)}</div>
              </div>
            </div>

            <!-- Bottom Security Footer -->
            <div class="front-card-footer">
              <span class="front-footer-auth">Official Academic Credential</span>
              <span class="front-footer-hash">AUTH: CS-DEPT-VERIFIED</span>
            </div>
          </div>
        </div>

        <!-- Center Fold Guide -->
        <div class="fold-divider">
          <div class="fold-line"></div>
          <div class="fold-label">▲ FOLD CENTER LINE ▲</div>
        </div>

        <!-- BACK OF CARD -->
        <div class="card-print-box">
          <div class="card-side-tag"><span>▼</span> Back Face</div>

          <div class="cr80-card">
            <!-- Simulated Magnetic Stripe -->
            <div class="back-magstripe"></div>

            <!-- Terms & Regulation -->
            <div class="back-content">
              <div class="back-terms">
                <h3>Terms &amp; Attendance Regulations</h3>
                <ol>
                  <li>This card is the property of the <strong>Department of Computer Science</strong> and must be surrendered upon graduation or withdrawal.</li>
                  <li><strong>75% lecture attendance is mandatory</strong> in all enrolled courses for examination qualification.</li>
                  <li>Scan barcode at the handheld/USB terminal at every scheduled lecture.</li>
                  <li>Transferring, counterfeiting, or proxy scanning constitutes gross academic misconduct.</li>
                  <li>If found, return to HOD Office, Department of Computer Science.</li>
                </ol>
              </div>

              <!-- Security QR & Signatures -->
              <div class="back-security-row">
                <div class="back-qr-box">
                  ${qrcodeUrl ? `
                    <img
                      src="${qrcodeUrl}"
                      alt="QR Verification"
                      class="back-qr-img"
                      onerror="this.style.display='none'"
                    />
                  ` : `<div style="font-size:6pt;font-weight:bold;">QR</div>`}
                </div>

                <div class="back-signatures">
                  <div class="back-sig-block">
                    <div class="back-sig-handwriting">Prof. A. O. Balogun</div>
                    <div class="back-sig-title">Head of Department (HOD)</div>
                  </div>
                  <div class="back-sig-block">
                    <div class="back-sig-handwriting">Dr. M. I. Adeleke</div>
                    <div class="back-sig-title">Registrar / Exams Officer</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Back Card Footer -->
            <div class="back-card-footer">
              <span>Department Helpdesk: cs@university.edu.ng</span>
              <span class="back-footer-url">cs-portal.edu.ng</span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- Instructions and Cutting Guide for Students -->
    <div>
      <div class="sheet-instructions">
        <div class="instructions-list">
          <h4>Card Assembly &amp; Usage Instructions:</h4>
          <ol>
            <li><strong>Print Quality:</strong> In your browser print dialog, click <em>More Settings</em> and check <strong>"Background graphics"</strong> to ensure badges and colors print properly. Set margins to <em>Default</em> or <em>None</em>.</li>
            <li><strong>Cutting:</strong> Cut cleanly along the outer dashed rectangle boundary using scissors or a paper trimmer.</li>
            <li><strong>Assembly:</strong> Fold precisely down the center dotted fold line to combine Front and Back faces into a standard double-sided CR80 card.</li>
            <li><strong>Lamination:</strong> Place inside a standard 86mm × 54mm lanyard cardholder or laminate with heat pouch for durability.</li>
            <li><strong>Attendance Verification:</strong> Present the barcode to the terminal barcode scanner at lecture hall entrances.</li>
          </ol>
        </div>

        <div class="instructions-sec">
          <div>
            <strong>Digital Verification</strong>
            <p>Scanning the reverse QR code with any smartphone instantly verifies matriculation validity against the active database.</p>
          </div>
          <div style="font-size:6pt;color:#0369a1;font-weight:700;margin-top:6px;">
            SECURE BARCODE PROTOCOL &bull; COMP. SCI. ATTENDANCE
          </div>
        </div>
      </div>

      <div class="sheet-footer-line">
        <span>FEDERAL UNIVERSITY OF TECHNOLOGY &bull; ACADEMIC RECORD DIVISION</span>
        <span>PAGE 1 OF 1 &bull; SINGLE PRINT SHEET</span>
      </div>
    </div>

  </div>

  <script>
    // Automatically trigger print dialog once resources load
    window.addEventListener('load', () => {
      // Small timeout to guarantee SVG and fonts are painted
      setTimeout(() => {
        window.focus();
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;
  },

  /**
   * Opens the dedicated print window or fallback iframe
   */
  printStudentIdCard(rawStudent) {
    const htmlContent = this.getPrintSheetHtml(rawStudent);

    // Try opening dedicated high-res popup window
    const printWindow = window.open('', '_blank', 'width=1000,height=1000,menubar=no,toolbar=no,location=no,status=no');

    if (printWindow && !printWindow.closed) {
      try {
        printWindow.document.open();
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        return;
      } catch (err) {
        console.warn('Direct popup document write failed, falling back to hidden iframe:', err);
      }
    }

    // Fallback: If popup blocker blocked window.open, use an isolated hidden iframe
    let iframe = document.getElementById('id-card-print-frame');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'id-card-print-frame';
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '210mm';
      iframe.style.height = '297mm';
      iframe.style.border = 'none';
      document.body.appendChild(iframe);
    }

    const doc = iframe.contentWindow || iframe.contentDocument;
    const iframeDoc = doc.document || doc;
    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        console.error('Iframe print failed:', e);
      }
    }, 600);
  }
};
