/**
 * Semesters Management Controller
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';
import { Modal } from '../core/modal.js';
import { Notification } from '../core/notifications.js';

export const SemestersPage = {
  semesters: [],

  render() {
    const canManage = Auth.hasRole('hod');

    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Department Semesters</h1>
            <p>Manage First and Second Semesters across academic sessions.</p>
          </div>
          <div class="page-actions">
            ${canManage ? `
              <button class="btn btn-primary" id="btn-add-semester">
                <span>➕</span> Add Semester
              </button>
            ` : ''}
          </div>
        </div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Semester Name</th>
                  <th>Academic Session</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Status</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody id="semesters-table-body">
                <tr>
                  <td colspan="6" class="text-center p-8 text-muted">Loading semesters...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async bindEvents() {
    document.getElementById('btn-add-semester')?.addEventListener('click', () => {
      this.showAddModal();
    });

    await this.loadSemesters();
  },

  async loadSemesters() {
    const tbody = document.getElementById('semesters-table-body');
    if (!tbody) return;

    try {
      const res = await Api.get('/academic/semesters');
      this.semesters = res.data || [];

      if (this.semesters.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center p-8">No semesters found.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.semesters.map(s => `
        <tr>
          <td style="font-weight: var(--font-weight-bold);">${Util.escapeHtml(s.semester_name || s.name)}</td>
          <td>${Util.escapeHtml(s.session_label || s.academic_session_name || '—')}</td>
          <td>${Util.formatDate(s.start_date)}</td>
          <td>${Util.formatDate(s.end_date)}</td>
          <td>${(s.status === 'active' || s.is_current) ? '<span class="badge badge-success">Current Active</span>' : '<span class="badge badge-neutral">Inactive</span>'}</td>
          <td style="text-align: right;">
            ${(s.status !== 'active' && !s.is_current) && Auth.hasRole('hod') ? `
              <button class="btn btn-sm btn-outline btn-set-current-sem" data-id="${s.id}">
                Set as Active
              </button>
            ` : '—'}
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-set-current-sem').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            await Api.patch(`/academic/semesters/${btn.dataset.id}`, { status: 'active' });
            Notification.success('Active semester updated!');
            this.loadSemesters();
          } catch {}
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-danger">${Util.escapeHtml(err.message)}</td></tr>`;
    }
  },

  async showAddModal() {
    try {
      const sessionsRes = await Api.get('/academic/sessions');
      const sessions = sessionsRes.data || [];

      const content = `
        <form id="add-semester-form" class="space-y-4">
          <div class="form-group">
            <label class="form-label" for="sem-name">Semester Name *</label>
            <input type="text" id="sem-name" class="form-control" placeholder="e.g. First Semester" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="sem-session">Academic Session *</label>
            <select id="sem-session" class="form-control" required>
              ${sessions.map(s => `<option value="${s.id}">${Util.escapeHtml(s.session_label || s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="grid grid-2" style="gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label" for="sem-start">Start Date *</label>
              <input type="date" id="sem-start" class="form-control" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="sem-end">End Date *</label>
              <input type="date" id="sem-end" class="form-control" required />
            </div>
          </div>
        </form>
      `;

      const footer = `
        <button class="btn btn-outline" id="btn-cancel-sem">Cancel</button>
        <button class="btn btn-primary" id="btn-save-sem">Save Semester</button>
      `;

      Modal.show({
        title: 'Add Semester',
        content,
        footer,
        size: 'md'
      });

      document.getElementById('btn-cancel-sem')?.addEventListener('click', () => Modal.close());
      document.getElementById('btn-save-sem')?.addEventListener('click', async () => {
        const name = document.getElementById('sem-name').value.trim();
        const sessionId = document.getElementById('sem-session').value;
        const start = document.getElementById('sem-start').value;
        const end = document.getElementById('sem-end').value;

        if (!name || !sessionId || !start || !end) {
          Notification.warning('Please fill in all fields.');
          return;
        }

        try {
          await Api.post('/academic/semesters', {
            semester_name: name,
            name,
            academic_session_id: sessionId,
            start_date: start,
            end_date: end,
            status: 'active'
          });

          Notification.success('Semester created!');
          Modal.close();
          this.loadSemesters();
        } catch {}
      });
    } catch {}
  }
};
