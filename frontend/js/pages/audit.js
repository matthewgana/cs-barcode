/**
 * Audit Trail & Attendance Corrections Log Controller (HOD Only)
 */

import { Api } from '../core/api.js';
import { Util } from '../core/utilities.js';

export const AuditPage = {
  activeTab: 'logs', // 'logs' | 'corrections'

  render() {
    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Department Security &amp; Audit Trail</h1>
            <p>Immutable event logging for attendance actions, session lifecycle, and manual status corrections.</p>
          </div>
        </div>

        <div class="card">
          <div class="card-header" style="border-bottom: 1px solid var(--color-border); padding: 0 var(--space-6);">
            <div style="display: flex; gap: var(--space-4);">
              <button class="btn btn-ghost is-active" id="tab-audit-logs" style="border-radius: 0; border-bottom: 2px solid var(--color-primary); padding: var(--space-4) var(--space-2);">
                🛡️ System Audit Logs
              </button>
              <button class="btn btn-ghost" id="tab-audit-corrections" style="border-radius: 0; padding: var(--space-4) var(--space-2);">
                ✏️ Manual Attendance Corrections
              </button>
            </div>
          </div>

          <div class="table-container">
            <!-- Audit Logs Table -->
            <table class="data-table" id="table-audit-logs">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>User</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody id="audit-logs-body">
                <tr><td colspan="5" class="text-center p-8 text-muted">Loading audit logs...</td></tr>
              </tbody>
            </table>

            <!-- Corrections Table -->
            <table class="data-table" id="table-audit-corrections" style="display: none;">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Student Name</th>
                  <th>Reg Number</th>
                  <th>Course</th>
                  <th>Old Status</th>
                  <th>New Status</th>
                  <th>Corrected By</th>
                  <th>Reason / Justification</th>
                </tr>
              </thead>
              <tbody id="audit-corrections-body">
                <tr><td colspan="8" class="text-center p-8 text-muted">Loading corrections...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async bindEvents() {
    const tabLogs = document.getElementById('tab-audit-logs');
    const tabCorrections = document.getElementById('tab-audit-corrections');
    const tableLogs = document.getElementById('table-audit-logs');
    const tableCorrections = document.getElementById('table-audit-corrections');

    tabLogs?.addEventListener('click', () => {
      this.activeTab = 'logs';
      tabLogs.style.borderBottom = '2px solid var(--color-primary)';
      tabCorrections.style.borderBottom = 'none';
      tableLogs.style.display = 'table';
      tableCorrections.style.display = 'none';
      this.loadLogs();
    });

    tabCorrections?.addEventListener('click', () => {
      this.activeTab = 'corrections';
      tabCorrections.style.borderBottom = '2px solid var(--color-primary)';
      tabLogs.style.borderBottom = 'none';
      tableLogs.style.display = 'none';
      tableCorrections.style.display = 'table';
      this.loadCorrections();
    });

    await this.loadLogs();
  },

  async loadLogs() {
    const tbody = document.getElementById('audit-logs-body');
    if (!tbody) return;

    try {
      const res = await Api.get('/audit/logs');
      const logs = res.data || [];

      if (logs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8">No audit logs recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = logs.map(l => `
        <tr>
          <td style="font-family: var(--font-family-mono); font-size: var(--font-size-xs);">${Util.formatDateTime(l.created_at)}</td>
          <td><span class="badge badge-neutral font-mono">${Util.escapeHtml(l.action)}</span></td>
          <td>${Util.escapeHtml(l.entity_type)}</td>
          <td style="font-weight: var(--font-weight-medium);">${Util.escapeHtml(l.username || 'System')}</td>
          <td style="font-family: var(--font-family-mono); font-size: var(--font-size-xs); max-width: 320px; word-break: break-all;">
            ${Util.escapeHtml(typeof l.details === 'object' ? JSON.stringify(l.details) : l.details || '—')}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-danger">${Util.escapeHtml(err.message)}</td></tr>`;
    }
  },

  async loadCorrections() {
    const tbody = document.getElementById('audit-corrections-body');
    if (!tbody) return;

    try {
      const res = await Api.get('/audit/corrections');
      const corrections = res.data || [];

      if (corrections.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center p-8">No manual attendance corrections recorded.</td></tr>`;
        return;
      }

      tbody.innerHTML = corrections.map(c => `
        <tr>
          <td style="font-family: var(--font-family-mono); font-size: var(--font-size-xs);">${Util.formatDateTime(c.created_at)}</td>
          <td style="font-weight: var(--font-weight-medium);">${Util.escapeHtml(c.first_name + ' ' + c.last_name)}</td>
          <td style="font-family: var(--font-family-mono);">${Util.escapeHtml(c.reg_number)}</td>
          <td><strong>${Util.escapeHtml(c.course_code)}</strong></td>
          <td>${Util.getStatusBadge(c.previous_status)}</td>
          <td>${Util.getStatusBadge(c.new_status)}</td>
          <td>${Util.escapeHtml(c.corrected_by_name || 'Staff')}</td>
          <td style="font-style: italic;">${Util.escapeHtml(c.reason)}</td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center p-6 text-danger">${Util.escapeHtml(err.message)}</td></tr>`;
    }
  }
};
