/**
 * Attendance Records & Corrections Controller
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';
import { Modal } from '../core/modal.js';
import { Notification } from '../core/notifications.js';

export const AttendancePage = {
  records: [],
  sessions: [],
  selectedSessionId: '',

  render() {
    const isStudent = Auth.hasRole('student');

    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>${isStudent ? 'My Attendance History' : 'Attendance Records &amp; Logs'}</h1>
            <p>${isStudent
              ? 'Your verified check-in timestamps, lecture presence status, and scanning history.'
              : 'Verify attendance scans, detect lateness, and apply audited status corrections.'}</p>
          </div>
          <div class="page-actions">
            <div class="form-group mb-0" style="min-width: 320px;">
              <select id="attendance-session-select" class="form-control">
                <option value="">Select an attendance session...</option>
              </select>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Reg. Number</th>
                  <th>Student Name</th>
                  <th>Level</th>
                  <th>Scan Time</th>
                  <th>Status</th>
                  <th>Method</th>
                  ${!isStudent ? '<th style="text-align: right;">Audited Action</th>' : ''}
                </tr>
              </thead>
              <tbody id="attendance-table-body">
                <tr>
                  <td colspan="7" class="text-center p-8 text-muted">
                    Please select a session above to view records.
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
    await this.loadSessions();
  },

  async loadSessions() {
    try {
      const res = await Api.get('/sessions');
      this.sessions = res.data || [];

      const select = document.getElementById('attendance-session-select');
      if (!select) return;

      select.innerHTML = '<option value="">Select an attendance session...</option>' +
        this.sessions.map(s => `
          <option value="${s.id}">
            ${Util.escapeHtml(s.course_code)} — ${Util.formatDate(s.session_date)} (${s.status.toUpperCase()})
          </option>
        `).join('');

      const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const querySessionId = urlParams.get('session_id');

      if (querySessionId && this.sessions.some(s => s.id === querySessionId)) {
        select.value = querySessionId;
        this.selectedSessionId = querySessionId;
        this.loadRecords(querySessionId);
      } else if (this.sessions.length > 0) {
        select.value = this.sessions[0].id;
        this.selectedSessionId = this.sessions[0].id;
        this.loadRecords(this.sessions[0].id);
      }

      select.addEventListener('change', (e) => {
        this.selectedSessionId = e.target.value;
        if (this.selectedSessionId) {
          this.loadRecords(this.selectedSessionId);
        } else {
          document.getElementById('attendance-table-body').innerHTML = `
            <tr><td colspan="7" class="text-center p-8 text-muted">Please select a session above.</td></tr>
          `;
        }
      });
    } catch (err) {
      Notification.error('Failed to load sessions: ' + err.message);
    }
  },

  async loadRecords(sessionId) {
    const tbody = document.getElementById('attendance-table-body');
    if (!tbody) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center p-8 text-muted">
          <div class="splash-spinner" style="margin: 0 auto 0.5rem;"></div>
          Loading records...
        </td>
      </tr>
    `;

    try {
      const res = await Api.get(`/attendance/session/${sessionId}`);
      this.records = res.data || [];
      this.renderTable(this.records);
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center p-6 text-danger">Failed to load attendance records: ${Util.escapeHtml(err.message)}</td>
        </tr>
      `;
    }
  },

  renderTable(records) {
    const tbody = document.getElementById('attendance-table-body');
    if (!tbody) return;

    if (!records || records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center p-8">
            <div class="empty-state">
              <div class="empty-state-icon">📋</div>
              <div class="empty-state-title">No Records Found</div>
              <div class="empty-state-desc">No attendance records have been registered for this session yet.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const isStudent = Auth.hasRole('student');
    const canCorrect = Auth.hasRole('hod', 'lecturer');

    tbody.innerHTML = records.map(r => `
      <tr>
        <td style="font-family: var(--font-family-mono); font-weight: var(--font-weight-bold);">
          ${Util.escapeHtml(r.matric_number || r.reg_number)}
        </td>
        <td style="font-weight: var(--font-weight-medium);">
          ${Util.escapeHtml(r.full_name || r.student_name || `${r.first_name || ''} ${r.last_name || ''}`.trim())}
        </td>
        <td>${Util.getLevelBadge(r.academic_level || r.level)}</td>
        <td style="font-family: var(--font-family-mono); font-size: var(--font-size-xs);">
          ${(r.check_in_time || r.scanned_at) ? Util.formatDateTime(r.check_in_time || r.scanned_at) : 'Not Scanned'}
        </td>
        <td>${Util.getStatusBadge(r.status)}</td>
        <td><span class="badge badge-neutral">${Util.escapeHtml(r.scan_method || '—')}</span></td>
        ${!isStudent ? `
          <td style="text-align: right;">
            ${canCorrect ? `
              <button class="btn btn-sm btn-outline btn-correct" data-id="${r.id}" title="Audited correction for this student record">
                ✏️ Correct
              </button>
            ` : '—'}
          </td>
        ` : ''}
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-correct').forEach(btn => {
      btn.addEventListener('click', () => {
        const record = this.records.find(r => r.id === btn.dataset.id);
        if (record) this.showCorrectionModal(record);
      });
    });
  },

  showCorrectionModal(record) {
    const content = `
      <form id="correction-form" class="space-y-4">
        <div>
          <strong>Student:</strong> ${Util.escapeHtml(record.full_name || record.student_name || `${record.first_name || ''} ${record.last_name || ''}`.trim())} (${record.matric_number || record.reg_number})
        </div>
        <div>
          <strong>Current Status:</strong> ${Util.getStatusBadge(record.status)}
        </div>

        <div class="form-group">
          <label class="form-label" for="new-record-status">New Status *</label>
          <select id="new-record-status" class="form-control" required>
            <option value="present" ${record.status === 'present' ? 'selected' : ''}>Present</option>
            <option value="late" ${record.status === 'late' ? 'selected' : ''}>Late</option>
            <option value="absent" ${record.status === 'absent' ? 'selected' : ''}>Absent</option>
            <option value="excused" ${record.status === 'excused' ? 'selected' : ''}>Excused</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label" for="correction-reason">Correction Reason / Audit Justification *</label>
          <textarea
            id="correction-reason"
            class="form-control"
            rows="3"
            placeholder="e.g. Approved medical leave letter submitted, or scanner hardware misread ID."
            required
          ></textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" id="btn-cancel-correction">Cancel</button>
      <button class="btn btn-primary" id="btn-save-correction">Submit Audited Correction</button>
    `;

    Modal.show({
      title: 'Manual Attendance Correction',
      content,
      footer,
      size: 'md'
    });

    document.getElementById('btn-cancel-correction')?.addEventListener('click', () => Modal.close());
    document.getElementById('btn-save-correction')?.addEventListener('click', async () => {
      const newStatus = document.getElementById('new-record-status').value;
      const reason = document.getElementById('correction-reason').value.trim();

      if (!newStatus || !reason) {
        Notification.warning('Please specify the new status and provide an audited justification reason.');
        return;
      }

      try {
        await Api.post('/attendance/correct', {
          attendance_record_id: record.id,
          new_status: newStatus,
          reason
        });

        Notification.success('Attendance record corrected and logged to audit trail.');
        Modal.close();
        this.loadRecords(this.selectedSessionId);
      } catch {}
    });
  }
};
