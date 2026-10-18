/**
 * Attendance Sessions Controller
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';
import { Modal } from '../core/modal.js';
import { Notification } from '../core/notifications.js';

export const SessionsPage = {
  sessions: [],

  render() {
    const canManage = Auth.hasRole('hod', 'lecturer');

    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Attendance Sessions</h1>
            <p>Schedule, activate, monitor, and finalize lecture barcode attendance sessions.</p>
          </div>
          <div class="page-actions">
            ${canManage ? `
              <button class="btn btn-primary" id="btn-create-session">
                <span>➕</span> Create New Session
              </button>
            ` : ''}
          </div>
        </div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Title</th>
                  <th>Level</th>
                  <th>Date</th>
                  <th>Time Window</th>
                  <th>Status</th>
                  <th>Lecturer</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody id="sessions-table-body">
                <tr>
                  <td colspan="8" class="text-center p-8 text-muted">
                    <div class="splash-spinner" style="margin: 0 auto 0.5rem;"></div>
                    Loading attendance sessions...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async bindEvents() {
    document.getElementById('btn-create-session')?.addEventListener('click', () => {
      this.showCreateModal();
    });

    await this.loadSessions();
  },

  async loadSessions() {
    const tbody = document.getElementById('sessions-table-body');
    if (!tbody) return;

    try {
      const res = await Api.get('/sessions');
      this.sessions = res.data || [];
      this.renderTable(this.sessions);
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center p-6 text-danger">Failed to load sessions: ${Util.escapeHtml(err.message)}</td>
        </tr>
      `;
    }
  },

  renderTable(sessions) {
    const tbody = document.getElementById('sessions-table-body');
    if (!tbody) return;

    if (!sessions || sessions.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="text-center p-8">
            <div class="empty-state">
              <div class="empty-state-icon">⏱️</div>
              <div class="empty-state-title">No Attendance Sessions</div>
              <div class="empty-state-desc">Create a new lecture session to start collecting student barcode scans.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const canManage = Auth.hasRole('hod', 'lecturer');

    tbody.innerHTML = sessions.map(s => {
      const isOpen = s.status === 'open';
      const isScheduled = s.status === 'scheduled';
      const isClosed = s.status === 'closed';

      return `
        <tr>
          <td style="font-weight: var(--font-weight-bold); color: var(--color-primary);">
            ${Util.escapeHtml(s.course_code)}
          </td>
          <td>${Util.escapeHtml(s.course_title)}</td>
          <td>${Util.getLevelBadge(s.academic_level || s.level)}</td>
          <td>${Util.formatDate(s.session_date)}</td>
          <td style="font-size: var(--font-size-xs); font-family: var(--font-family-mono);">
            ${s.start_time?.substring(0, 5) || '—'} &ndash; ${s.end_time?.substring(0, 5) || '—'}
          </td>
          <td>${Util.getStatusBadge(s.status)}</td>
          <td style="font-size: var(--font-size-sm); color: var(--color-text-secondary);">
            ${Util.escapeHtml(s.lecturer_name || 'Assigned Staff')}
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              ${isOpen ? `
                <a href="#/scanner?session_id=${s.id}" class="btn btn-sm btn-accent" title="Scan Barcodes">
                  📷 Scan
                </a>
                <button class="btn btn-sm btn-outline btn-view-qr" data-id="${s.id}" title="Project Session Attendance QR Code">
                  📱 QR Code
                </button>
                ${canManage ? `
                  <button class="btn btn-sm btn-warning btn-close-session" data-id="${s.id}" title="Close Session">
                    Close
                  </button>
                ` : ''}
              ` : ''}

              ${isScheduled && canManage ? `
                <button class="btn btn-sm btn-success btn-open-session" data-id="${s.id}" title="Open Session for Scanning">
                  ▶ Open
                </button>
              ` : ''}

              ${isClosed && canManage ? `
                <button class="btn btn-sm btn-outline btn-finalize-session" data-id="${s.id}" title="Finalize (marks absent students)">
                  Finalize
                </button>
              ` : ''}

              <a href="#/attendance?session_id=${s.id}" class="btn btn-sm btn-ghost" title="View Records">
                Records
              </a>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach actions
    tbody.querySelectorAll('.btn-open-session').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await Api.post(`/sessions/${btn.dataset.id}/open`, {});
          Notification.success('Attendance session is now OPEN for scanning!');
          this.loadSessions();
        } catch {}
      });
    });

    tbody.querySelectorAll('.btn-close-session').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await Api.post(`/sessions/${btn.dataset.id}/close`, {});
          Notification.warning('Attendance session closed.');
          this.loadSessions();
        } catch {}
      });
    });

    tbody.querySelectorAll('.btn-view-qr').forEach(btn => {
      btn.addEventListener('click', () => {
        const session = this.sessions.find(s => s.id === btn.dataset.id);
        if (session) this.showSessionQrModal(session);
      });
    });

    tbody.querySelectorAll('.btn-finalize-session').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Finalizing will automatically mark all enrolled students who did not scan as ABSENT. Proceed?')) return;
        try {
          await Api.post(`/sessions/${btn.dataset.id}/finalize`, {});
          Notification.success('Session finalized and absent students recorded.');
          this.loadSessions();
        } catch {}
      });
    });
  },

  async showCreateModal() {
    try {
      const [coursesRes, academicRes, semestersRes] = await Promise.all([
        Api.get('/courses'),
        Api.get('/academic/sessions'),
        Api.get('/academic/semesters')
      ]);

      const courses = coursesRes.data || [];
      const sessions = academicRes.data || [];
      const semesters = semestersRes.data || [];

      const activeSession = sessions.find(s => s.status === 'active') || sessions[0];
      const activeSemester = semesters.find(s => s.status === 'active') || semesters[0];

      const today = new Date().toISOString().split('T')[0];

      const content = `
        <form id="create-session-form" class="space-y-4">
          <div class="form-group">
            <label class="form-label" for="session-course">Course *</label>
            <select id="session-course" class="form-control" required>
              <option value="">Select Course...</option>
              ${courses.map(c => `
                <option value="${c.id}">${Util.escapeHtml(c.course_code)} — ${Util.escapeHtml(c.course_title)} (${c.academic_level || c.level || 'N/A'} Level)</option>
              `).join('')}
            </select>
          </div>

          <div class="grid grid-2" style="gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label" for="session-acad">Academic Session *</label>
              <select id="session-acad" class="form-control" required>
                ${sessions.map(s => `
                  <option value="${s.id}" ${s.id === activeSession?.id ? 'selected' : ''}>${Util.escapeHtml(s.session_label)}</option>
                `).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="session-sem">Semester *</label>
              <select id="session-sem" class="form-control" required>
                ${semesters.map(s => `
                  <option value="${s.id}" ${s.id === activeSemester?.id ? 'selected' : ''}>${Util.escapeHtml(s.semester_name)}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="session-date">Session Date *</label>
            <input type="date" id="session-date" class="form-control" value="${today}" required />
          </div>

          <div class="grid grid-3" style="gap: var(--space-3);">
            <div class="form-group">
              <label class="form-label" for="session-start">Start Time *</label>
              <input type="time" id="session-start" class="form-control" value="09:00" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="session-end">End Time *</label>
              <input type="time" id="session-end" class="form-control" value="11:00" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="session-grace">Grace (Mins)</label>
              <input type="number" id="session-grace" class="form-control" value="15" min="0" max="120" />
            </div>
          </div>
        </form>
      `;

      const footer = `
        <button class="btn btn-outline" id="btn-cancel-session">Cancel</button>
        <button class="btn btn-primary" id="btn-save-session">Create Session</button>
      `;

      Modal.show({
        title: 'Create Attendance Session',
        content,
        footer,
        size: 'lg'
      });

      document.getElementById('btn-cancel-session')?.addEventListener('click', () => Modal.close());
      document.getElementById('btn-save-session')?.addEventListener('click', async () => {
        const courseSelect = document.getElementById('session-course');
        const courseId = courseSelect.value;
        const courseText = courseSelect.options[courseSelect.selectedIndex]?.text || 'Session';
        const sessionId = document.getElementById('session-acad').value;
        const semesterId = document.getElementById('session-sem').value;
        const date = document.getElementById('session-date').value;
        const start = document.getElementById('session-start').value;
        const end = document.getElementById('session-end').value;
        const grace = parseInt(document.getElementById('session-grace').value, 10) || 15;

        if (!courseId || !sessionId || !semesterId || !date || !start || !end) {
          Notification.warning('Please fill in all required fields.');
          return;
        }

        // Auto-generate session_title from course code + date (required by backend)
        const sessionTitle = `${courseText.split(' —')[0]} - ${date}`;

        try {
          await Api.post('/sessions', {
            course_id: courseId,
            academic_session_id: sessionId,
            semester_id: semesterId,
            session_title: sessionTitle,
            session_date: date,
            start_time: start,
            end_time: end,
            lateness_threshold_minutes: grace
          });

          Notification.success('Attendance session created successfully!');
          Modal.close();
          this.loadSessions();
        } catch {}
      });
    } catch (err) {
      Notification.error('Failed to prepare session form: ' + err.message);
    }
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
          💡 <strong>Projector Instructions:</strong> Project this QR code on the lecture screen. Students in class can sign in to their portal, select <strong>Scan / Mark Attendance</strong>, and scan this code to take attendance instantly.
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" id="btn-close-qr-modal">Done</button>
      <a href="#/scanner?session_id=${session.id}" class="btn btn-primary" id="btn-goto-scanner">Open Live Scanner &rarr;</a>
    `;

    Modal.show({
      title: `Projector Display: ${session.course_code} Attendance Code`,
      content,
      footer,
      size: 'md'
    });

    document.getElementById('btn-close-qr-modal')?.addEventListener('click', () => Modal.close());
    document.getElementById('btn-goto-scanner')?.addEventListener('click', () => Modal.close());
  }
};
