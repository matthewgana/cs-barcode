/**
 * Students & Barcodes Management Page Controller
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';
import { Modal } from '../core/modal.js';
import { Notification } from '../core/notifications.js';

export const StudentsPage = {
  students: [],
  filters: {
    level: '',
    search: '',
    page: 1,
    limit: 15
  },

  render() {
    const canManage = Auth.hasRole('hod', 'secretary');

    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Students &amp; Barcodes</h1>
            <p>Manage Computer Science students across 100, 200, 300, and 400 Levels with unique Code 128 barcodes.</p>
          </div>
          <div class="page-actions">
            ${canManage ? `
              <button class="btn btn-primary" id="btn-create-student">
                <span>➕</span> Register Student
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Filter bar -->
        <div class="card mb-6">
          <div class="filter-bar">
            <div class="search-input-wrapper">
              <span class="search-icon">🔍</span>
              <input
                type="text"
                id="search-students"
                class="form-control search-input"
                placeholder="Search by student name or registration number..."
              />
            </div>

            <div class="form-group mb-0" style="min-width: 180px;">
              <select id="filter-level" class="form-control">
                <option value="">All Academic Levels</option>
                <option value="100">100 Level (Year 1)</option>
                <option value="200">200 Level (Year 2)</option>
                <option value="300">300 Level (Year 3)</option>
                <option value="400">400 Level (Year 4)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Students Table -->
        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Registration No.</th>
                  <th>Full Name</th>
                  <th>Level</th>
                  <th>Email</th>
                  <th>Barcode ID</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody id="students-table-body">
                <tr>
                  <td colspan="6" class="text-center p-8 text-muted">
                    <div class="splash-spinner" style="margin: 0 auto 0.5rem;"></div>
                    Loading students...
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div id="students-pagination" class="pagination-wrapper" style="display: none;"></div>
        </div>
      </div>
    `;
  },

  async bindEvents() {
    const searchInput = document.getElementById('search-students');
    const levelSelect = document.getElementById('filter-level');
    const createBtn = document.getElementById('btn-create-student');

    if (searchInput) {
      searchInput.addEventListener('input', Util.debounce((e) => {
        this.filters.search = e.target.value.trim();
        this.filters.page = 1;
        this.loadStudents();
      }, 300));
    }

    if (levelSelect) {
      levelSelect.addEventListener('change', (e) => {
        this.filters.level = e.target.value;
        this.filters.page = 1;
        this.loadStudents();
      });
    }

    if (createBtn) {
      createBtn.addEventListener('click', () => this.showCreateModal());
    }

    await this.loadStudents();
  },

  async loadStudents() {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;

    try {
      const res = await Api.get('/students', {
        level: this.filters.level || undefined,
        search: this.filters.search || undefined,
        page: this.filters.page,
        limit: this.filters.limit
      });

      this.students = res.data || [];
      const pagination = res.pagination || { total: this.students.length, page: 1, limit: 15 };

      this.renderTable(this.students);
      this.renderPagination(pagination);
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center p-6 text-danger">Failed to load students: ${Util.escapeHtml(err.message)}</td>
        </tr>
      `;
    }
  },

  renderTable(students) {
    const tbody = document.getElementById('students-table-body');
    if (!tbody) return;

    if (!students || students.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center p-8">
            <div class="empty-state">
              <div class="empty-state-icon">🎓</div>
              <div class="empty-state-title">No Students Found</div>
              <div class="empty-state-desc">Try adjusting your search criteria or register a new student.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const canManage = Auth.hasRole('hod', 'secretary');

    tbody.innerHTML = students.map(s => {
      const reg = s.matric_number || s.reg_number || '—';
      const name = s.full_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || 'Student';
      const level = s.academic_level || s.level || '100';

      return `
        <tr>
          <td style="font-family: var(--font-family-mono); font-weight: var(--font-weight-bold); color: var(--color-text-primary);">
            ${Util.escapeHtml(reg)}
          </td>
          <td style="font-weight: var(--font-weight-medium);">
            ${Util.escapeHtml(name)}
          </td>
          <td>${Util.getLevelBadge(level)}</td>
          <td style="color: var(--color-text-secondary);">${Util.escapeHtml(s.email || '—')}</td>
          <td>
            <code style="font-family: var(--font-family-mono); font-size: 0.8rem; background: var(--color-surface-hover); padding: 2px 6px; border-radius: 4px;">
              ${Util.escapeHtml(s.barcode_value)}
            </code>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button class="btn btn-sm btn-outline btn-view-id" data-id="${s.id}" title="View Student ID Card with Barcode">
                🪪 ID Card
              </button>
              ${canManage ? `
                <button class="btn btn-sm btn-ghost btn-edit-student" data-id="${s.id}" title="Edit Student">
                  ✏️
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row events
    tbody.querySelectorAll('.btn-view-id').forEach(btn => {
      btn.addEventListener('click', () => {
        const student = this.students.find(s => s.id === btn.dataset.id);
        if (student) this.showStudentIdCard(student);
      });
    });

    tbody.querySelectorAll('.btn-edit-student').forEach(btn => {
      btn.addEventListener('click', () => {
        const student = this.students.find(s => s.id === btn.dataset.id);
        if (student) this.showEditModal(student);
      });
    });
  },

  renderPagination(pagination) {
    const wrapper = document.getElementById('students-pagination');
    if (!wrapper) return;

    const total = pagination.total || 0;
    const page = pagination.page || 1;
    const limit = pagination.limit || 15;
    const totalPages = Math.ceil(total / limit) || 1;

    if (totalPages <= 1) {
      wrapper.style.display = 'none';
      return;
    }

    wrapper.style.display = 'flex';
    wrapper.innerHTML = `
      <div class="pagination-info">
        Showing <strong>${(page - 1) * limit + 1}</strong> to <strong>${Math.min(page * limit, total)}</strong> of <strong>${total}</strong> students
      </div>
      <div class="pagination-controls">
        <button class="pagination-btn" id="pag-prev" ${page <= 1 ? 'disabled' : ''}>&larr; Prev</button>
        <span class="pagination-ellipsis">Page ${page} of ${totalPages}</span>
        <button class="pagination-btn" id="pag-next" ${page >= totalPages ? 'disabled' : ''}>Next &rarr;</button>
      </div>
    `;

    document.getElementById('pag-prev')?.addEventListener('click', () => {
      if (this.filters.page > 1) {
        this.filters.page--;
        this.loadStudents();
      }
    });

    document.getElementById('pag-next')?.addEventListener('click', () => {
      if (this.filters.page < totalPages) {
        this.filters.page++;
        this.loadStudents();
      }
    });
  },

  showStudentIdCard(student) {
    const reg = student.matric_number || student.reg_number || '—';
    const name = student.full_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || 'Student';
    const level = student.academic_level || student.level || '100';
    const initial = (name[0] || 'S').toUpperCase();

    const content = `
      <div class="student-id-card">
        <div class="id-card-header">
          <div class="id-card-institution">University Computer Science</div>
          <div class="id-card-dept">DEPARTMENT OF COMPUTER SCIENCE</div>
        </div>

        <div class="id-card-avatar">
          ${initial}
        </div>

        <div class="id-card-name">${Util.escapeHtml(name)}</div>
        <div class="id-card-reg">${Util.escapeHtml(reg)}</div>

        <div class="id-card-meta">
          <span>${Util.getLevelBadge(level)}</span>
          <span>Status: Active</span>
        </div>

        <div class="id-card-barcode-container">
          <img
            src="/api/students/${student.id}/barcode?format=svg"
            alt="Barcode for ${Util.escapeHtml(reg)}"
            class="id-card-barcode-img"
          />
          <div class="id-card-barcode-val">${Util.escapeHtml(student.barcode_value)}</div>
        </div>
      </div>
    `;

    const footer = `
      <button class="btn btn-outline" onclick="window.print()">🖨️ Print ID Card</button>
      <button class="btn btn-primary" id="btn-modal-close-id">Done</button>
    `;

    Modal.show({
      title: 'Student ID & Attendance Barcode',
      content,
      footer,
      size: 'md'
    });

    document.getElementById('btn-modal-close-id')?.addEventListener('click', () => Modal.close());
  },

  showCreateModal() {
    const content = `
      <form id="create-student-form" class="space-y-4">
        <div class="form-group">
          <label class="form-label" for="new-reg-num">Registration Number *</label>
          <input type="text" id="new-reg-num" class="form-control" placeholder="e.g. CS/2026/015" required />
        </div>
        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="new-first-name">First Name *</label>
            <input type="text" id="new-first-name" class="form-control" placeholder="e.g. Chukwuma" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="new-last-name">Last Name *</label>
            <input type="text" id="new-last-name" class="form-control" placeholder="e.g. Obi" required />
          </div>
        </div>
        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="new-level">Academic Level *</label>
            <select id="new-level" class="form-control" required>
              <option value="100">100 Level (Year 1)</option>
              <option value="200">200 Level (Year 2)</option>
              <option value="300">300 Level (Year 3)</option>
              <option value="400">400 Level (Year 4)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="new-email">Email Address</label>
            <input type="email" id="new-email" class="form-control" placeholder="student@cs.edu.ng" />
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" id="btn-cancel-create">Cancel</button>
      <button class="btn btn-primary" id="btn-save-student">Save Student & Generate Barcode</button>
    `;

    Modal.show({
      title: 'Register New Student',
      content,
      footer,
      size: 'md'
    });

    document.getElementById('btn-cancel-create')?.addEventListener('click', () => Modal.close());
    document.getElementById('btn-save-student')?.addEventListener('click', async () => {
      const reg = document.getElementById('new-reg-num').value.trim();
      const first = document.getElementById('new-first-name').value.trim();
      const last = document.getElementById('new-last-name').value.trim();
      const level = document.getElementById('new-level').value;
      const email = document.getElementById('new-email').value.trim();

      if (!reg || !first || !last || !level) {
        Notification.warning('Please fill in all required fields.');
        return;
      }

      try {
        await Api.post('/students', {
          reg_number: reg,
          first_name: first,
          last_name: last,
          level,
          email: email || undefined
        });

        Notification.success('Student registered and barcode generated successfully!');
        Modal.close();
        this.loadStudents();
      } catch {
        // Handled by API error notification
      }
    });
  },

  showEditModal(student) {
    const content = `
      <form id="edit-student-form" class="space-y-4">
        <div class="form-group">
          <label class="form-label">Registration Number</label>
          <input type="text" class="form-control" value="${Util.escapeHtml(student.reg_number)}" disabled />
        </div>
        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="edit-first-name">First Name *</label>
            <input type="text" id="edit-first-name" class="form-control" value="${Util.escapeHtml(student.first_name)}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-last-name">Last Name *</label>
            <input type="text" id="edit-last-name" class="form-control" value="${Util.escapeHtml(student.last_name)}" required />
          </div>
        </div>
        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="edit-level">Academic Level *</label>
            <select id="edit-level" class="form-control" required>
              <option value="100" ${student.level == '100' ? 'selected' : ''}>100 Level</option>
              <option value="200" ${student.level == '200' ? 'selected' : ''}>200 Level</option>
              <option value="300" ${student.level == '300' ? 'selected' : ''}>300 Level</option>
              <option value="400" ${student.level == '400' ? 'selected' : ''}>400 Level</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-email">Email Address</label>
            <input type="email" id="edit-email" class="form-control" value="${Util.escapeHtml(student.email || '')}" />
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" id="btn-cancel-edit">Cancel</button>
      <button class="btn btn-primary" id="btn-update-student">Save Changes</button>
    `;

    Modal.show({
      title: `Edit Student: ${student.reg_number}`,
      content,
      footer,
      size: 'md'
    });

    document.getElementById('btn-cancel-edit')?.addEventListener('click', () => Modal.close());
    document.getElementById('btn-update-student')?.addEventListener('click', async () => {
      const first = document.getElementById('edit-first-name').value.trim();
      const last = document.getElementById('edit-last-name').value.trim();
      const level = document.getElementById('edit-level').value;
      const email = document.getElementById('edit-email').value.trim();

      if (!first || !last || !level) {
        Notification.warning('Please fill in all required fields.');
        return;
      }

      try {
        await Api.put(`/students/${student.id}`, {
          first_name: first,
          last_name: last,
          level,
          email: email || undefined
        });

        Notification.success('Student updated successfully!');
        Modal.close();
        this.loadStudents();
      } catch {
        // Handled by API
      }
    });
  }
};
