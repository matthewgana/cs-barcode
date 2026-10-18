/**
 * Live Barcode Attendance Scanner Controller
 * Supports:
 *  1) USB Keyboard Wedge Barcode Scanner (fast keystroke buffer + Enter)
 *  2) Built-in Device Camera Barcode Scanning (html5-qrcode library)
 */

import { Api } from '../core/api.js';
import { Util } from '../core/utilities.js';
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
    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Live Barcode Attendance Scanner</h1>
            <p>Scan student Code 128 barcodes via USB handheld reader or live device camera.</p>
          </div>
          <div class="page-actions">
            <div class="form-group mb-0" style="min-width: 320px;">
              <select id="scanner-session-select" class="form-control">
                <option value="">Select an active attendance session...</option>
              </select>
            </div>
          </div>
        </div>

        <div id="scanner-no-session" class="empty-state card p-8" style="display: none;">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">No Active Attendance Session Selected</h3>
          <p class="empty-state-desc">Please open or select an active session above to start scanning barcodes.</p>
          <a href="#/sessions" class="btn btn-primary" style="margin-top: var(--space-3);">Go to Sessions Manager</a>
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
              <div class="stat-card-label">Students Checked In</div>
              <div class="stat-card-value text-success" id="stat-scanned-count">0</div>
              <div class="stat-card-meta">Present: <span id="stat-present-count">0</span> | Late: <span id="stat-late-count">0</span></div>
            </div>
            <div class="stat-card">
              <div class="stat-card-label">Scan Method</div>
              <div class="stat-card-value text-accent" id="stat-scan-mode-label" style="font-size: var(--font-size-xl);">USB Wedge</div>
              <div class="stat-card-meta">Ready for instant input</div>
            </div>
          </div>

          <!-- Main Scanner Grid -->
          <div class="scanner-container">
            <!-- Left: Scan Feed / Input Viewport -->
            <div class="card scanner-feed-card">
              <div class="card-header">
                <div class="scanner-mode-switch">
                  <button type="button" class="scanner-mode-btn is-active" id="btn-mode-usb">
                    <span>🔌</span> USB Hardware Scanner
                  </button>
                  <button type="button" class="scanner-mode-btn" id="btn-mode-cam">
                    <span>📷</span> Device Camera
                  </button>
                </div>
              </div>

              <div class="card-body">
                <!-- USB Mode View -->
                <div id="usb-scanner-view" class="scanner-viewport-usb is-listening" tabindex="0">
                  <div class="scanner-usb-pulse">⚡</div>
                  <h3 style="font-weight: var(--font-weight-bold); margin-bottom: 4px;">Hardware Scanner Active</h3>
                  <p class="text-muted" style="font-size: var(--font-size-sm); max-width: 380px;">
                    Aim handheld USB barcode reader at student ID card. Barcode data is captured automatically without clicking.
                  </p>
                  <!-- Hidden text input to capture scanner input if focused -->
                  <input
                    type="text"
                    id="usb-direct-input"
                    class="form-control"
                    style="margin-top: 1rem; max-width: 320px; text-align: center; font-family: var(--font-family-mono);"
                    placeholder="or type / paste barcode value..."
                    autocomplete="off"
                  />
                </div>

                <!-- Camera Mode View -->
                <div id="camera-scanner-view" class="scanner-viewport-cam" style="display: none;">
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

            <!-- Right: Real-Time Attendance Feed -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Live Scanned Students</h3>
                <span class="badge badge-primary" id="feed-count-badge">0 Checked In</span>
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

    await this.loadActiveSessions();
    this.setupUsbListener();
    this.setupManualInput();
    this.setupModeSwitch();
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

    const level = session.academic_level || session.level || '100';
    document.getElementById('scanner-course-code').textContent = session.course_code;
    document.getElementById('scanner-session-meta').textContent = `${session.course_title} • ${level} Level`;

    // Load existing records for this session
    await this.loadSessionRecords(sessionId);

    // Focus input for USB scanner
    document.getElementById('usb-direct-input')?.focus();
  },

  async loadSessionRecords(sessionId) {
    try {
      const res = await Api.get(`/attendance/session/${sessionId}`);
      const records = res.data || [];
      this.scannedList = records;
      this.updateStats();
      this.renderFeed();
    } catch {
      // Empty if no scans yet
    }
  },

  setupUsbListener() {
    // Hardware USB barcode scanners fire keys extremely quickly (typically < 30ms between keys)
    // terminated by Enter.
    window.onBarcodeKeydown = (e) => {
      // Don't capture if user is typing in regular forms elsewhere, but capture if in scanner page
      if (window.location.hash.indexOf('scanner') === -1) return;
      if (!this.activeSession) return;

      const currentTime = Date.now();
      const directInput = document.getElementById('usb-direct-input');

      // If user pressed Enter, process buffer
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

      // If keys are coming quickly (< 50ms interval), it's a hardware scanner
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
          this.processBarcode(val, 'USB');
          input.value = '';
        }
      }
    });
  },

  setupModeSwitch() {
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
      modeLabel.textContent = 'USB Wedge';
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

    try {
      this.cameraScanner = new Html5Qrcode('camera-reader');
      const config = {
        fps: 10,
        qrbox: { width: 280, height: 160 },
        aspectRatio: 1.777778
      };

      await this.cameraScanner.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          // On successful scan
          this.processBarcode(decodedText, 'camera');
        },
        (error) => {
          // Frame decode error (normal while searching)
        }
      );
    } catch (err) {
      Notification.error('Failed to start camera: ' + (err.message || 'Permission denied'));
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
      Notification.warning('Please select an attendance session first.');
      return;
    }

    if (this.isScanning) return; // Debounce rapid scans
    this.isScanning = true;

    try {
      const res = await Api.post('/attendance/scan', {
        attendance_session_id: this.activeSession.id,
        barcode_value: barcodeValue,
        scan_method: method
      }, { silent: true });

      const record = res.data || res.attendance || {};
      const student = res.student || {
        full_name: record.student_name || `${record.first_name || ''} ${record.last_name || ''}`.trim(),
        first_name: record.first_name || '',
        last_name: record.last_name || '',
        matric_number: record.matric_number || record.reg_number,
        academic_level: record.academic_level || record.level
      };

      const studentName = student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
      const matricNum = student.matric_number || student.reg_number || 'Matric';
      const studentLvl = student.academic_level || student.level || '100';
      const scanTime = record.scanned_at || record.check_in_time || new Date().toISOString();
      const status = record.status || res.attendance?.status || 'present';

      // Play success audio
      Util.playBeep('success');

      // Show banner
      this.showFeedback({
        type: 'success',
        title: `CHECKED IN: ${studentName}`,
        desc: `${matricNum} (${studentLvl}L) • Status: ${status.toUpperCase()} • Time: ${Util.formatTime(scanTime)}`
      });

      // Prepend to feed
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
      // Check if duplicate scan
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

  onDestroy() {
    this.stopCameraScanner();
    if (window._scannerKeyHandler) {
      window.removeEventListener('keydown', window._scannerKeyHandler);
    }
  }
};
