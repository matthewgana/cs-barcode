/**
 * Academic Sessions Controller
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';
import { Modal } from '../core/modal.js';
import { Notification } from '../core/notifications.js';

export const AcademicSessionsPage = {
  sessions: [],

  render() {
    const canManage = Auth.hasRole('hod');

    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Academic Sessions</h1>
            <p>Define academic calendar years (e.g. 2025/2026) and designate the current active academic session.</p>
          </div>
          <div class="page-actions">
            ${canManage ? `
              <button class="btn btn-primary" id="btn-add-session">
                <span>➕</span> Add Academic Session
              </button>
            ` : ''}
          </div>
        </div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Session Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody id="academic-sessions-body">
                <tr>
                  <td colspan="5" class="text-center p-8 text-muted">Loading academic sessions...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async bindEvents() {
    document.getElementById('btn-add-session')?.addEventListener('click', () => {
      this.showAddModal();
    });

    await this.loadSessions();
  },

  async loadSessions() {
    const tbody = document.getElementById('academic-sessions-body');
    if (!tbody) return;

    try {
      const res = await Api.get('/academic/sessions');
      this.sessions = res.data || [];

      if (this.sessions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8">No academic sessions found.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.sessions.map(s => `
        <tr>
          <td style="font-weight: var(--font-weight-bold);">${Util.escapeHtml(s.name)}</td>
          <td>${Util.formatDate(s.start_date)}</td>
          <td>${Util.formatDate(s.end_date)}</td>
          <td>${s.is_current ? '<span class="badge badge-success">Current Active</span>' : '<span class="badge badge-neutral">Archived</span>'}</td>
          <td style="text-align: right;">
            ${!s.is_current && Auth.hasRole('hod') ? `
              <button class="btn btn-sm btn-outline btn-set-current" data-id="${s.id}">
                Set as Active
              </button>
            ` : '—'}
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-set-current').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await Api.put(`/academic/sessions/${btn.dataset.id}`, { is_current: true });
            Notification.success('Active academic session updated!');
            this.loadSessions();
          } catch {}
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-danger">${Util.escapeHtml(err.message)}</td></tr>`;
    }
  },

  showAddModal() {
    const content = `
      <form id="add-academic-form" class="space-y-4">
        <div class="form-group">
          <label class="form-label" for="session-name">Session Name *</label>
          <input type="text" id="session-name" class="form-control" placeholder="e.g. 2026/2027" required />
        </div>
        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="session-start">Start Date *</label>
            <input type="date" id="session-start" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="session-end">End Date *</label>
            <input type="date" id="session-end" class="form-control" required />
          </div>
        </div>
        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="session-is-current" />
            <span>Set as current active session</span>
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" id="btn-cancel-acad">Cancel</button>
      <button class="btn btn-primary" id="btn-save-acad">Save Session</button>
    `;

    Modal.show({
      title: 'Add Academic Session',
      content,
      footer,
      size: 'md'
    });

    document.getElementById('btn-cancel-acad')?.addEventListener('click', () => Modal.close());
    document.getElementById('btn-save-acad')?.addEventListener('click', async () => {
      const name = document.getElementById('session-name').value.trim();
      const start = document.getElementById('session-start').value;
      const end = document.getElementById('session-end').value;
      const isCurrent = document.getElementById('session-is-current').checked;

      if (!name || !start || !end) {
        Notification.warning('Please fill in all fields.');
        return;
      }

      try {
        await Api.post('/academic/sessions', {
          name,
          start_date: start,
          end_date: end,
          is_current: isCurrent
        });

        Notification.success('Academic session created!');
        Modal.close();
        this.loadSessions();
      } catch {}
    });
  }
};
