/**
 * Live Barcode Attendance Scanner Controller
 * Supports:
 *  1) Staff/Faculty Mode: USB Keyboard Wedge reader or device webcam scanning student ID cards
 *  2) Student Self-Attendance Mode: Camera scanning lecturer's session QR code or instant session check-in
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';
import { Modal } from '../core/modal.js';
import { Notification } from '../core/notifications.js';

export const ScannerPage = {
  activeSession: null,
  activeSessions: [],
  scanMode: 'usb', // 'usb' | 'camera'
  cameraScanner: null,
  isScanning: false,
  scannedList: [],
  stats: {
    total: 0,
    present: 0,
    late: 0
  },

  // USB Scanner buffer state
  usbBuffer: '',
  lastKeyTime: 0,
  usbTimeout: null,

  render() {
    const isStudent = Auth.hasRole('student');

    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>${isStudent ? 'Attendance Scanner &amp; Check-In' : 'Live Barcode Attendance Scanner'}</h1>
            <p>${isStudent
              ? 'Mark attendance for active lecture sessions by scanning the lecturer\'s QR code or entering the session code.'
              : 'Scan student Code 128 barcodes via USB handheld reader or live device camera.'}</p>
          </div>
          <div class="page-actions" style="display: flex; gap: var(--space-2); align-items: center;">
            ${!isStudent ? `
              <button type="button" class="btn btn-outline" id="btn-show-qr-scanner" style="display: none;">
                <span>📱</span> Display Session QR
              </button>
            ` : ''}
            <div class="form-group mb-0" style="min-width: 300px;">
              <select id="scanner-session-select" class="form-control">
                <option value="">Select an active attendance session...</option>
              </select>
            </div>
          </div>
        </div>

        <div id="scanner-no-session" class="empty-state card p-8" style="display: none;">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">No Active Attendance Session Selected</h3>
          <p class="empty-state-desc">${isStudent
            ? 'There are currently no active open attendance sessions for your enrolled courses.'
            : 'Please open or select an active session above to start scanning barcodes.'}</p>
          <a href="${isStudent ? '#/dashboard' : '#/sessions'}" class="btn btn-primary" style="margin-top: var(--space-3);">
            ${isStudent ? 'Return to Dashboard' : 'Go to Sessions Manager'}
          </a>
        </div>

        <div id="scanner-workspace" style="display: none;">
          <!-- Top Stats Bar -->
          <div class="grid grid-3 mb-6" style="gap: var(--space-4);">
            <div class="stat-card">
              <div class="stat-card-label">Active Course</div>
              <div class="stat-card-value" id="scanner-course-code" style="font-size: var(--font-size-xl);">—</div>
              <div class="stat-card-meta" id="scanner-session-meta">—</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-label">${isStudent ? 'My Attendance Status' : 'Students Checked In'}</div>
              <div class="stat-card-value text-success" id="stat-scanned-count">${isStudent ? 'Pending' : '0'}</div>
              <div class="stat-card-meta" id="stat-scanned-meta">${isStudent ? 'Awaiting scan/check-in' : 'Present: 0 | Late: 0'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-card-label">Check-In Method</div>
              <div class="stat-card-value text-accent" id="stat-scan-mode-label" style="font-size: var(--font-size-xl);">
                ${isStudent ? 'Device Camera' : 'USB Wedge'}
              </div>
              <div class="stat-card-meta">Ready for instant input</div>
            </div>
          </div>

          <!-- Main Scanner Grid -->
          <div class="scanner-container">
            <!-- Left: Scan Feed / Input Viewport -->
            <div class="card scanner-feed-card">
              <div class="card-header">
                <div class="scanner-mode-switch">
                  ${!isStudent ? `
                    <button type="button" class="scanner-mode-btn is-active" id="btn-mode-usb">
                      <span>🔌</span> USB Hardware Scanner
                    </button>
                    <button type="button" class="scanner-mode-btn" id="btn-mode-cam">
                      <span>📷</span> Device Camera
                    </button>
                  ` : `
                    <button type="button" class="scanner-mode-btn is-active" id="btn-mode-cam">
                      <span>📷</span> Scan Projector QR Code
                    </button>
                    <button type="button" class="scanner-mode-btn" id="btn-mode-usb">
                      <span>⌨️</span> Manual Session Code
                    </button>
                  `}
                </div>
              </div>

              <div class="card-body">
                <!-- USB / Manual Entry View -->
                <div id="usb-scanner-view" class="scanner-viewport-usb is-listening" tabindex="0" style="${isStudent ? 'display: none;' : ''}">
                  <div class="scanner-usb-pulse">⚡</div>
                  <h3 style="font-weight: var(--font-weight-bold); margin-bottom: 4px;">
                    ${isStudent ? 'Manual Session Code Entry' : 'Hardware Scanner Active'}
                  </h3>
                  <p class="text-muted" style="font-size: var(--font-size-sm); max-width: 380px;">
                    ${isStudent
                      ? 'Type or paste the Session Code displayed by your lecturer to record attendance.'
                      : 'Aim handheld USB barcode reader at student ID card. Barcode data is captured automatically without clicking.'}
                  </p>
                  <input
                    type="text"
                    id="usb-direct-input"
                    class="form-control"
                    style="margin-top: 1rem; max-width: 320px; text-align: center; font-family: var(--font-family-mono);"
                    placeholder="${isStudent ? 'Enter Session Code or ATT:SESSION:...' : 'or type / paste barcode value...'}"
                    autocomplete="off"
                  />
                  ${isStudent ? `
                    <button type="button" class="btn btn-primary btn-sm" id="btn-submit-manual-code" style="margin-top: 0.75rem;">
                      Submit Attendance
                    </button>
                  ` : ''}
                </div>

                <!-- Camera Mode View -->
                <div id="camera-scanner-view" class="scanner-viewport-cam" style="${isStudent ? 'display: flex;' : 'display: none;'}">
                  <div id="camera-reader" style="width: 100%; height: 100%;"></div>
                  <div class="scanner-laser"></div>
                  <div class="scanner-reticle"></div>
                </div>

                <!-- Live Result Alert Banner -->
                <div id="scan-feedback-banner" class="scan-last-feedback" style="display: none;">
                  <span id="feedback-icon" style="font-size: 1.5rem;">✓</span>
                  <div>
                    <div id="feedback-title" style="font-weight: var(--font-weight-bold); font-size: var(--font-size-sm);"></div>
                    <div id="feedback-desc" style="font-size: var(--font-size-xs);"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Right: Real-Time Attendance Feed / Student Status -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">${isStudent ? 'My Attendance Record' : 'Live Scanned Students'}</h3>
                <span class="badge badge-primary" id="feed-count-badge">${isStudent ? 'Status' : '0 Checked In'}</span>
              </div>
              <div class="card-body" style="padding: var(--space-4);">
                <div class="scan-feed-list" id="scan-feed-list">
                  <div class="empty-state p-6">
                    <div class="empty-state-icon">📡</div>
                    <div class="empty-state-title">Awaiting Scans</div>
                    <div class="empty-state-desc">Scanned student records will appear here in real time.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async bindEvents() {
    this.usbBuffer = '';
    this.scannedList = [];
    this.stats = { total: 0, present: 0, late: 0 };

    const isStudent = Auth.hasRole('student');
    this.scanMode = isStudent ? 'camera' : 'usb';

    await this.loadActiveSessions();
    this.setupUsbListener();
    this.setupManualInput();
    this.setupModeSwitch();

    // Setup projector QR button for lecturer/HOD
    document.getElementById('btn-show-qr-scanner')?.addEventListener('click', () => {
      if (this.activeSession) this.showSessionQrModal(this.activeSession);
    });

    if (isStudent) {
      document.getElementById('btn-submit-manual-code')?.addEventListener('click', () => {
        const val = document.getElementById('usb-direct-input')?.value.trim();
        if (val) {
          this.processBarcode(val, 'mobile_qr');
        } else if (this.activeSession) {
          this.processBarcode(this.activeSession.id, 'mobile_qr');
        }
      });
      // Start camera automatically for student to scan projector QR
      setTimeout(() => this.startCameraScanner(), 300);
    }
  },

  async loadActiveSessions() {
    try {
      const res = await Api.get('/sessions');
      const allSessions = res.data || [];
      // Prefer open sessions, or scheduled
      this.activeSessions = allSessions.filter(s => s.status === 'open' || s.status === 'scheduled');

      const select = document.getElementById('scanner-session-select');
      if (!select) return;

      select.innerHTML = '<option value="">Select an active attendance session...</option>' +
        this.activeSessions.map(s => `
          <option value="${s.id}">
            ${Util.escapeHtml(s.course_code)} — ${Util.escapeHtml(s.course_title)} (${s.academic_level || s.level || '100'}L) [${s.status.toUpperCase()}]
          </option>
        `).join('');

      // Check query param
      const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const querySessionId = urlParams.get('session_id');

      if (querySessionId && this.activeSessions.some(s => s.id === querySessionId)) {
        select.value = querySessionId;
        this.selectSession(querySessionId);
      } else if (this.activeSessions.length > 0) {
        select.value = this.activeSessions[0].id;
        this.selectSession(this.activeSessions[0].id);
      } else {
        document.getElementById('scanner-no-session').style.display = 'block';
        document.getElementById('scanner-workspace').style.display = 'none';
      }

      select.addEventListener('change', (e) => {
        this.selectSession(e.target.value);
      });
    } catch (err) {
      Notification.error('Failed to load active sessions: ' + err.message);
    }
  },

  async selectSession(sessionId) {
    if (!sessionId) {
      document.getElementById('scanner-no-session').style.display = 'block';
      document.getElementById('scanner-workspace').style.display = 'none';
      this.activeSession = null;
      return;
    }

    const session = this.activeSessions.find(s => s.id === sessionId);
    this.activeSession = session;

    document.getElementById('scanner-no-session').style.display = 'none';
    document.getElementById('scanner-workspace').style.display = 'block';

    const btnQr = document.getElementById('btn-show-qr-scanner');
    if (btnQr) {
      btnQr.style.display = session.status === 'open' ? 'inline-flex' : 'none';
    }

    const level = session.academic_level || session.level || '100';
    document.getElementById('scanner-course-code').textContent = session.course_code;
    document.getElementById('scanner-session-meta').textContent = `${session.course_title} • ${level} Level`;

    // Load existing records for this session
    await this.loadSessionRecords(sessionId);

    // Focus input for USB scanner if not student
    if (!Auth.hasRole('student')) {
      document.getElementById('usb-direct-input')?.focus();
    }
  },

  async loadSessionRecords(sessionId) {
    const isStudent = Auth.hasRole('student');
    try {
      if (isStudent) {
        // Students: use GET /sessions/:id which returns only their own my_attendance record
        const res = await Api.get(`/sessions/${sessionId}`);
        const raw = res.data?.my_attendance;
        // Normalize field names: attendance_status → status, attendance_record_id → id
        const myAttendance = raw ? {
          ...raw,
          id: raw.id || raw.attendance_record_id,
          status: raw.status || raw.attendance_status,
        } : null;
        this.scannedList = myAttendance ? [myAttendance] : [];
      } else {
        // Staff: fetch full attendance roster for the session
        const res = await Api.get(`/attendance/session/${sessionId}`);
        this.scannedList = res.data || [];
      }
      this.updateStats();
      this.renderFeed();
    } catch {
      this.scannedList = [];
      this.renderFeed();
    }
  },

  setupUsbListener() {
    window.onBarcodeKeydown = (e) => {
      if (window.location.hash.indexOf('scanner') === -1) return;
      if (!this.activeSession) return;

      const currentTime = Date.now();
      const directInput = document.getElementById('usb-direct-input');

      if (e.key === 'Enter') {
        let codeToProcess = this.usbBuffer.trim();
        if (!codeToProcess && directInput && directInput.value.trim()) {
          codeToProcess = directInput.value.trim();
        }

        if (codeToProcess.length >= 3) {
          e.preventDefault();
          this.processBarcode(codeToProcess, 'USB');
          this.usbBuffer = '';
          if (directInput) directInput.value = '';
        }
        return;
      }

      if (currentTime - this.lastKeyTime > 200) {
        this.usbBuffer = '';
      }
      this.lastKeyTime = currentTime;

      if (e.key.length === 1) {
        this.usbBuffer += e.key;
      }
    };

    window.removeEventListener('keydown', window._scannerKeyHandler);
    window._scannerKeyHandler = window.onBarcodeKeydown;
    window.addEventListener('keydown', window._scannerKeyHandler);
  },

  setupManualInput() {
    const input = document.getElementById('usb-direct-input');
    if (!input) return;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const val = input.value.trim();
        if (val) {
          this.processBarcode(val, Auth.hasRole('student') ? 'mobile_qr' : 'USB');
          input.value = '';
        }
      }
    });
  },

  setupModeSwitch() {
    const isStudent = Auth.hasRole('student');
    const btnUsb = document.getElementById('btn-mode-usb');
    const btnCam = document.getElementById('btn-mode-cam');
    const usbView = document.getElementById('usb-scanner-view');
    const camView = document.getElementById('camera-scanner-view');
    const modeLabel = document.getElementById('stat-scan-mode-label');

    btnUsb?.addEventListener('click', () => {
      this.scanMode = 'usb';
      btnUsb.classList.add('is-active');
      btnCam.classList.remove('is-active');
      usbView.style.display = 'flex';
      camView.style.display = 'none';
      modeLabel.textContent = isStudent ? 'Session Code' : 'USB Wedge';
      this.stopCameraScanner();
      document.getElementById('usb-direct-input')?.focus();
    });

    btnCam?.addEventListener('click', () => {
      this.scanMode = 'camera';
      btnCam.classList.add('is-active');
      btnUsb.classList.remove('is-active');
      usbView.style.display = 'none';
      camView.style.display = 'flex';
      modeLabel.textContent = 'Device Camera';
      this.startCameraScanner();
    });
  },

  async startCameraScanner() {
    if (typeof Html5Qrcode === 'undefined') {
      Notification.warning('Camera barcode library is initializing, please check camera permissions.');
      return;
    }

    if (this.cameraScanner) return; // already active

    try {
      this.cameraScanner = new Html5Qrcode('camera-reader');
      const config = {
        fps: 10,
        qrbox: { width: 280, height: 200 },
        aspectRatio: 1.777778
      };

      await this.cameraScanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          this.processBarcode(decodedText, 'camera');
        },
        () => {}
      );
    } catch (err) {
      Notification.error('Camera notice: ' + (err.message || 'Permission required or camera busy'));
    }
  },

  stopCameraScanner() {
    if (this.cameraScanner) {
      try {
        this.cameraScanner.stop().then(() => {
          this.cameraScanner.clear();
          this.cameraScanner = null;
        }).catch(() => {});
      } catch {}
    }
  },

  async processBarcode(barcodeValue, method = 'USB') {
    if (!this.activeSession) {
      Notification.warning('Please select an active attendance session first.');
      return;
    }

    if (this.isScanning) return; // Debounce
    this.isScanning = true;

    const isStudent = Auth.hasRole('student');
    const user = Auth.getUser();

    // If student and barcode matches session ID or ATT:SESSION, pass session ID
    let finalBarcode = barcodeValue;
    if (isStudent && (!barcodeValue || barcodeValue === this.activeSession.id || barcodeValue.startsWith('ATT:SESSION:'))) {
      finalBarcode = user?.barcodeValue || user?.matricNumber;
    }

    try {
      const res = await Api.post('/attendance/scan', {
        attendance_session_id: this.activeSession.id,
        barcode_value: finalBarcode,
        scan_method: isStudent ? 'camera' : method
      }, { silent: true });

      const record = res.data || res.attendance || {};
      const student = res.student || {
        full_name: record.student_name || `${record.first_name || ''} ${record.last_name || ''}`.trim(),
        first_name: record.first_name || '',
        last_name: record.last_name || '',
        matric_number: record.matric_number || record.reg_number,
        academic_level: record.academic_level || record.level
      };

      const studentName = student.full_name || 'Student';
      const matricNum = student.matric_number || student.reg_number || 'Matric';
      const studentLvl = student.academic_level || student.level || '100';
      const scanTime = record.scanned_at || record.check_in_time || new Date().toISOString();
      const status = record.status || res.attendance?.status || 'present';

      // Play success audio
      Util.playBeep('success');

      // Show banner
      this.showFeedback({
        type: 'success',
        title: isStudent ? `ATTENDANCE MARKED: ${status.toUpperCase()}` : `CHECKED IN: ${studentName}`,
        desc: `${studentName} (${matricNum}, ${studentLvl}L) • Status: ${status.toUpperCase()} • Time: ${Util.formatTime(scanTime)}`
      });

      // Update local feed
      this.scannedList = this.scannedList.filter(s => s.id !== record.id && s.student_id !== student.id);
      this.scannedList.unshift({
        ...record,
        full_name: studentName,
        student_name: studentName,
        matric_number: matricNum,
        reg_number: matricNum,
        level: studentLvl,
        academic_level: studentLvl,
        scanned_at: scanTime,
        check_in_time: scanTime,
        status: status,
        scan_method: method
      });

      this.updateStats();
      this.renderFeed();
    } catch (err) {
      if (err.message && err.message.toLowerCase().includes('already')) {
        Util.playBeep('duplicate');
        this.showFeedback({
          type: 'duplicate',
          title: 'ALREADY SCANNED',
          desc: err.message
        });
      } else {
        Util.playBeep('error');
        this.showFeedback({
          type: 'error',
          title: 'SCAN REJECTED',
          desc: err.message || 'Invalid barcode or student not enrolled in this course.'
        });
      }
    } finally {
      setTimeout(() => {
        this.isScanning = false;
      }, 700);
    }
  },

  showFeedback({ type, title, desc }) {
    const banner = document.getElementById('scan-feedback-banner');
    const icon = document.getElementById('feedback-icon');
    const titleEl = document.getElementById('feedback-title');
    const descEl = document.getElementById('feedback-desc');

    if (!banner) return;

    banner.className = `scan-last-feedback feedback-${type}`;
    icon.textContent = type === 'success' ? '✓' : (type === 'duplicate' ? '⚠' : '✕');
    titleEl.textContent = title;
    descEl.textContent = desc;

    banner.style.display = 'flex';
  },

  updateStats() {
    const isStudent = Auth.hasRole('student');
    if (isStudent) {
      const myRecord = this.scannedList[0];
      const countEl = document.getElementById('stat-scanned-count');
      const metaEl = document.getElementById('stat-scanned-meta');
      const badgeEl = document.getElementById('feed-count-badge');

      if (myRecord) {
        if (countEl) countEl.textContent = myRecord.status.toUpperCase();
        if (metaEl) metaEl.textContent = `Checked in at ${Util.formatTime(myRecord.check_in_time || myRecord.scanned_at)}`;
        if (badgeEl) badgeEl.textContent = 'Verified';
      } else {
        if (countEl) countEl.textContent = 'Not Recorded';
        if (metaEl) metaEl.textContent = 'Scan code to mark presence';
        if (badgeEl) badgeEl.textContent = 'Pending';
      }
      return;
    }

    const present = this.scannedList.filter(s => s.status === 'present').length;
    const late = this.scannedList.filter(s => s.status === 'late').length;
    const total = this.scannedList.length;

    document.getElementById('stat-scanned-count').textContent = total;
    document.getElementById('stat-present-count').textContent = present;
    document.getElementById('stat-late-count').textContent = late;
    document.getElementById('feed-count-badge').textContent = `${total} Checked In`;
  },

  renderFeed() {
    const feed = document.getElementById('scan-feed-list');
    if (!feed) return;

    const isStudent = Auth.hasRole('student');

    if (isStudent) {
      const myRecord = this.scannedList[0];
      if (myRecord) {
        feed.innerHTML = `
          <div class="card p-6" style="background: var(--color-surface-hover); border: 1px solid var(--color-border); text-align: center;">
            <div style="font-size: 2.5rem; margin-bottom: var(--space-2);">✅</div>
            <h3 style="font-weight: var(--font-weight-bold); margin-bottom: var(--space-1);">Attendance Confirmed</h3>
            <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-4);">
              You are officially registered for this lecture session.
            </p>
            <div style="display: inline-flex; align-items: center; gap: 8px; margin-bottom: var(--space-3);">
              ${Util.getStatusBadge(myRecord.status)}
              <span class="badge badge-neutral">${Util.escapeHtml(myRecord.scan_method || 'Mobile')}</span>
            </div>
            <div style="font-family: var(--font-family-mono); font-size: var(--font-size-xs); color: var(--color-text-secondary);">
              Recorded at: ${Util.formatDateTime(myRecord.check_in_time || myRecord.scanned_at)}
            </div>
          </div>
        `;
      } else {
        feed.innerHTML = `
          <div class="empty-state p-6" style="text-align: center;">
            <div class="empty-state-icon">⏳</div>
            <div class="empty-state-title">Not Checked In</div>
            <div class="empty-state-desc" style="margin-bottom: var(--space-4);">
              Scan the session QR code on the lecture screen or click below to mark your attendance.
            </div>
            ${this.activeSession?.status === 'open' ? `
              <button type="button" class="btn btn-primary" id="btn-instant-checkin">
                ⚡ Mark My Attendance Now
              </button>
            ` : '<span class="badge badge-warning">Session is not open for check-ins</span>'}
          </div>
        `;

        document.getElementById('btn-instant-checkin')?.addEventListener('click', () => {
          this.processBarcode(this.activeSession.id, 'mobile_qr');
        });
      }
      return;
    }

    if (this.scannedList.length === 0) {
      feed.innerHTML = `
        <div class="empty-state p-6">
          <div class="empty-state-icon">📡</div>
          <div class="empty-state-title">Awaiting Scans</div>
          <div class="empty-state-desc">Scanned student records will appear here in real time.</div>
        </div>
      `;
      return;
    }

    feed.innerHTML = this.scannedList.map(item => `
      <div class="scan-feed-item">
        <div>
          <div class="scan-feed-student">${Util.escapeHtml(item.student_name || item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim())}</div>
          <div class="scan-feed-meta">
            <code>${Util.escapeHtml(item.matric_number || item.reg_number)}</code> &bull; ${item.academic_level || item.level} Level &bull; ${Util.formatTime(item.check_in_time || item.scanned_at)}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          ${Util.getStatusBadge(item.status)}
          <span class="badge badge-neutral badge-sm">${Util.escapeHtml(item.scan_method || 'USB')}</span>
        </div>
      </div>
    `).join('');
  },

  showSessionQrModal(session) {
    const qrUrl = `/api/sessions/${session.id}/qrcode?format=svg`;
    const level = session.academic_level || session.level || '100';

    const content = `
      <div style="text-align: center; padding: var(--space-4);">
        <div style="display: inline-block; background: var(--color-surface-hover); padding: 4px 12px; border-radius: 999px; font-size: var(--font-size-xs); font-weight: var(--font-weight-bold); color: var(--color-primary); margin-bottom: var(--space-2);">
          ${Util.escapeHtml(session.course_code)} &bull; ${level} Level
        </div>
        <h2 style="font-size: var(--font-size-xl); margin: 0 0 4px;">${Util.escapeHtml(session.course_title)}</h2>
        <p class="text-muted" style="font-size: var(--font-size-sm); margin-bottom: var(--space-5);">
          Session Code: <code style="font-size: var(--font-size-base); font-weight: var(--font-weight-bold);">${session.id}</code>
        </p>

        <div style="display: flex; justify-content: center; align-items: center; margin: 0 auto var(--space-5); width: 280px; height: 280px; background: #ffffff; border-radius: var(--radius-lg); padding: var(--space-4); box-shadow: var(--shadow-lg); border: 2px solid var(--color-border);">
          <img src="${qrUrl}" alt="Live Attendance QR Code" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>

        <div class="alert alert-info" style="text-align: left; font-size: var(--font-size-xs);">
          💡 <strong>Projector Instructions:</strong> Project this QR code on the lecture screen. Students can scan it using their device camera or click <strong>⚡ Mark My Attendance Now</strong> in their portal.
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" id="btn-close-scanner-qr">Done</button>
    `;

    Modal.show({
      title: `Projector Display: ${session.course_code} Attendance Code`,
      content,
      footer,
      size: 'md'
    });

    document.getElementById('btn-close-scanner-qr')?.addEventListener('click', () => Modal.close());
  },

  onDestroy() {
    this.stopCameraScanner();
    if (window._scannerKeyHandler) {
      window.removeEventListener('keydown', window._scannerKeyHandler);
    }
  }
};
