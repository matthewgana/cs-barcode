/**
 * Lecturer Course Assignments Controller (HOD Only)
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';
import { Modal } from '../core/modal.js';
import { Notification } from '../core/notifications.js';

export const LecturerAssignmentsPage = {
  assignments: [],

  render() {
    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Lecturer Course Allocation</h1>
            <p>HOD management of course teaching assignments across academic sessions.</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="btn-assign-lecturer">
              <span>➕</span> Assign Lecturer to Course
            </button>
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
                  <th>Lecturer Name</th>
                  <th>Staff Role</th>
                  <th>Academic Session</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody id="assignments-table-body">
                <tr>
                  <td colspan="7" class="text-center p-8 text-muted">Loading course allocations...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async bindEvents() {
    document.getElementById('btn-assign-lecturer')?.addEventListener('click', () => {
      this.showAssignModal();
    });

    await this.loadAssignments();
  },

  async loadAssignments() {
    const tbody = document.getElementById('assignments-table-body');
    if (!tbody) return;

    try {
      const res = await Api.get('/lecturer-assignments');
      this.assignments = res.data || [];

      if (this.assignments.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-8">No lecturer allocations recorded.</td></tr>`;
        return;
      }

      tbody.innerHTML = this.assignments.map(a => `
        <tr>
          <td style="font-weight: var(--font-weight-bold); color: var(--color-primary);">${Util.escapeHtml(a.course_code)}</td>
          <td>${Util.escapeHtml(a.course_title)}</td>
          <td>${Util.getLevelBadge(a.academic_level || a.level)}</td>
          <td style="font-weight: var(--font-weight-medium);">${Util.escapeHtml(a.lecturer_name)}</td>
          <td>${a.is_coordinator ? '<span class="badge badge-accent">Course Coordinator</span>' : '<span class="badge badge-neutral">Instructor</span>'}</td>
          <td>${Util.escapeHtml(a.session_label || a.academic_session_name || '—')}</td>
          <td style="text-align: right;">
            <button class="btn btn-sm btn-danger btn-revoke" data-id="${a.id}" title="Revoke assignment">
              Revoke
            </button>
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-revoke').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Are you sure you want to revoke this lecturer assignment?')) return;
          try {
            await Api.delete(`/lecturer-assignments/${btn.dataset.id}`);
            Notification.success('Assignment revoked.');
            this.loadAssignments();
          } catch {}
        });
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-danger">${Util.escapeHtml(err.message)}</td></tr>`;
    }
  },

  async showAssignModal() {
    try {
      const [coursesRes, usersRes, sessionsRes] = await Promise.all([
        Api.get('/courses'),
        Api.get('/users'),
        Api.get('/academic/sessions')
      ]);

      const courses = coursesRes.data || [];
      const lecturers = (usersRes.data || []).filter(u => u.role === 'lecturer' || u.role === 'hod');
      const sessions = sessionsRes.data || [];
      const activeSession = sessions.find(s => s.status === 'active' || s.is_current) || sessions[0];

      const content = `
        <form id="assign-form" class="space-y-4">
          <div class="form-group">
            <label class="form-label" for="assign-course">Course *</label>
            <select id="assign-course" class="form-control" required>
              <option value="">Select Course...</option>
              ${courses.map(c => `<option value="${c.id}">${Util.escapeHtml(c.course_code)} — ${Util.escapeHtml(c.course_title)} (${c.academic_level || c.level || '100'}L)</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="assign-lecturer">Lecturer *</label>
            <select id="assign-lecturer" class="form-control" required>
              <option value="">Select Lecturer...</option>
              ${lecturers.map(l => `<option value="${l.id}">${Util.escapeHtml(l.full_name || `${l.first_name || ''} ${l.last_name || ''}`.trim() || l.username)} (@${l.username})</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="assign-session">Academic Session *</label>
            <select id="assign-session" class="form-control" required>
              ${sessions.map(s => `<option value="${s.id}" ${s.id === activeSession?.id ? 'selected' : ''}>${Util.escapeHtml(s.session_label || s.name)}</option>`).join('')}
            </select>
          </div>

          <div class="form-group">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="assign-is-coord" checked />
              <span>Designate as Primary Course Coordinator</span>
            </label>
          </div>
        </form>
      `;

      const footer = `
        <button class="btn btn-outline" id="btn-cancel-assign">Cancel</button>
        <button class="btn btn-primary" id="btn-save-assign">Assign Lecturer</button>
      `;

      Modal.show({
        title: 'Allocate Lecturer to Course',
        content,
        footer,
        size: 'md'
      });

      document.getElementById('btn-cancel-assign')?.addEventListener('click', () => Modal.close());
      document.getElementById('btn-save-assign')?.addEventListener('click', async () => {
        const courseId = document.getElementById('assign-course').value;
        const lecturerId = document.getElementById('assign-lecturer').value;
        const sessionId = document.getElementById('assign-session').value;
        const isCoord = document.getElementById('assign-is-coord').checked;

        if (!courseId || !lecturerId || !sessionId) {
          Notification.warning('Please select course, lecturer, and session.');
          return;
        }

        try {
          await Api.post('/lecturer-assignments', {
            course_id: courseId,
            lecturer_id: lecturerId,
            academic_session_id: sessionId,
            is_coordinator: isCoord
          });

          Notification.success('Lecturer assigned successfully!');
          Modal.close();
          this.loadAssignments();
        } catch {}
      });
    } catch {}
  }
};
