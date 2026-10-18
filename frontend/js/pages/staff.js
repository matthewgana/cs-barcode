/**
 * Staff Accounts Management Controller (HOD Only)
 */

import { Api } from '../core/api.js';
import { Util } from '../core/utilities.js';
import { Modal } from '../core/modal.js';
import { Notification } from '../core/notifications.js';

export const StaffPage = {
  users: [],

  render() {
    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Staff &amp; Department Accounts</h1>
            <p>Manage access credentials and roles for Lecturers, HOD, and Departmental Secretaries.</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="btn-add-staff">
              <span>➕</span> Create Staff Account
            </button>
          </div>
        </div>

        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Departmental Role</th>
                  <th>Status</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody id="staff-table-body">
                <tr>
                  <td colspan="6" class="text-center p-8 text-muted">Loading staff accounts...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async bindEvents() {
    document.getElementById('btn-add-staff')?.addEventListener('click', () => {
      this.showAddModal();
    });

    await this.loadUsers();
  },

  async loadUsers() {
    const tbody = document.getElementById('staff-table-body');
    if (!tbody) return;

    try {
      const res = await Api.get('/users');
      this.users = res.data || [];

      tbody.innerHTML = this.users.map(u => `
        <tr>
          <td style="font-family: var(--font-family-mono); font-weight: var(--font-weight-bold);">${Util.escapeHtml(u.username)}</td>
          <td style="font-weight: var(--font-weight-medium);">${Util.escapeHtml(u.first_name + ' ' + u.last_name)}</td>
          <td>${Util.escapeHtml(u.email || '—')}</td>
          <td><span class="badge badge-info">${u.role.toUpperCase()}</span></td>
          <td>${u.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Disabled</span>'}</td>
          <td style="text-align: right;">
            <button class="btn btn-sm btn-ghost btn-edit-user" data-id="${u.id}">
              ✏️ Edit
            </button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-edit-user').forEach(btn => {
        btn.addEventListener('click', () => {
          const user = this.users.find(u => u.id === btn.dataset.id);
          if (user) this.showEditModal(user);
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-center p-6 text-danger">${Util.escapeHtml(err.message)}</td></tr>`;
    }
  },

  showAddModal() {
    const content = `
      <form id="create-user-form" class="space-y-4">
        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="staff-first">First Name *</label>
            <input type="text" id="staff-first" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="staff-last">Last Name *</label>
            <input type="text" id="staff-last" class="form-control" required />
          </div>
        </div>

        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="staff-user">Username *</label>
            <input type="text" id="staff-user" class="form-control" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="staff-role">Role *</label>
            <select id="staff-role" class="form-control" required>
              <option value="lecturer">Lecturer</option>
              <option value="secretary">Departmental Secretary</option>
              <option value="hod">Head of Department (HOD)</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="staff-email">Email</label>
          <input type="email" id="staff-email" class="form-control" />
        </div>

        <div class="form-group">
          <label class="form-label" for="staff-pass">Initial Password <span class="required">*</span></label>
          <div class="password-input-wrapper">
            <input type="password" id="staff-pass" class="form-control" value="Password123!" required />
            <button
              type="button"
              class="password-toggle-btn"
              data-toggle-password="staff-pass"
              aria-label="Show password"
              title="Show password"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" id="btn-cancel-staff">Cancel</button>
      <button class="btn btn-primary" id="btn-save-staff">Create User</button>
    `;

    Modal.show({
      title: 'Create Staff Account',
      content,
      footer,
      size: 'md'
    });

    // Wire up password visibility toggle inside the modal
    Util.initPasswordToggles();

    document.getElementById('btn-cancel-staff')?.addEventListener('click', () => Modal.close());
    document.getElementById('btn-save-staff')?.addEventListener('click', async () => {
      const first = document.getElementById('staff-first').value.trim();
      const last = document.getElementById('staff-last').value.trim();
      const user = document.getElementById('staff-user').value.trim();
      const role = document.getElementById('staff-role').value;
      const email = document.getElementById('staff-email').value.trim();
      const pass = document.getElementById('staff-pass').value;

      if (!first || !last || !user || !pass) {
        Notification.warning('Please fill in required fields.');
        return;
      }

      try {
        await Api.post('/users', {
          first_name: first,
          last_name: last,
          username: user,
          role,
          email: email || undefined,
          password: pass
        });

        Notification.success('Staff account created!');
        Modal.close();
        this.loadUsers();
      } catch {}
    });
  },

  showEditModal(user) {
    const content = `
      <form id="edit-user-form" class="space-y-4">
        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="edit-staff-first">First Name *</label>
            <input type="text" id="edit-staff-first" class="form-control" value="${Util.escapeHtml(user.first_name)}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-staff-last">Last Name *</label>
            <input type="text" id="edit-staff-last" class="form-control" value="${Util.escapeHtml(user.last_name)}" required />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-staff-email">Email</label>
          <input type="email" id="edit-staff-email" class="form-control" value="${Util.escapeHtml(user.email || '')}" />
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="edit-staff-active" ${user.is_active ? 'checked' : ''} />
            <span>Account Active & Enabled</span>
          </label>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" id="btn-cancel-edit-staff">Cancel</button>
      <button class="btn btn-primary" id="btn-update-staff">Save Changes</button>
    `;

    Modal.show({
      title: `Edit Staff: @${user.username}`,
      content,
      footer,
      size: 'md'
    });

    document.getElementById('btn-cancel-edit-staff')?.addEventListener('click', () => Modal.close());
    document.getElementById('btn-update-staff')?.addEventListener('click', async () => {
      const first = document.getElementById('edit-staff-first').value.trim();
      const last = document.getElementById('edit-staff-last').value.trim();
      const email = document.getElementById('edit-staff-email').value.trim();
      const isActive = document.getElementById('edit-staff-active').checked;

      try {
        await Api.put(`/users/${user.id}`, {
          first_name: first,
          last_name: last,
          email: email || undefined,
          is_active: isActive
        });

        Notification.success('User updated successfully!');
        Modal.close();
        this.loadUsers();
      } catch {}
    });
  }
};
