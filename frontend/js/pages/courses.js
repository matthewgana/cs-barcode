/**
 * Courses Management Controller
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';
import { Modal } from '../core/modal.js';
import { Notification } from '../core/notifications.js';

export const CoursesPage = {
  courses: [],

  render() {
    const user = Auth.getUser();
    const isStudent = Auth.hasRole('student');
    const canManage = Auth.hasRole('hod');

    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>${isStudent ? `My Courses (${user?.academicLevel || '100'} Level)` : 'Computer Science Courses'}</h1>
            <p>${isStudent
              ? `Approved departmental curriculum courses for your ${user?.academicLevel || '100'} Level cohort.`
              : 'Curriculum across 100, 200, 300, and 400 Levels with credit units and assigned lecturers.'}</p>
          </div>
          <div class="page-actions">
            ${canManage ? `
              <button class="btn btn-primary" id="btn-create-course">
                <span>➕</span> Add Course
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
                  <th>Title</th>
                  <th>Level</th>
                  <th>Credits</th>
                  <th>Status</th>
                  ${!isStudent ? '<th style="text-align: right;">Actions</th>' : ''}
                </tr>
              </thead>
              <tbody id="courses-table-body">
                <tr>
                  <td colspan="6" class="text-center p-8 text-muted">
                    <div class="splash-spinner" style="margin: 0 auto 0.5rem;"></div>
                    Loading courses...
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
    document.getElementById('btn-create-course')?.addEventListener('click', () => {
      this.showCreateModal();
    });

    await this.loadCourses();
  },

  async loadCourses() {
    const tbody = document.getElementById('courses-table-body');
    if (!tbody) return;

    try {
      const res = await Api.get('/courses');
      this.courses = res.data || [];
      this.renderTable(this.courses);
    } catch (err) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center p-6 text-danger">Failed to load courses: ${Util.escapeHtml(err.message)}</td>
        </tr>
      `;
    }
  },

  renderTable(courses) {
    const tbody = document.getElementById('courses-table-body');
    if (!tbody) return;

    if (!courses || courses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="text-center p-8">
            <div class="empty-state">
              <div class="empty-state-icon">📚</div>
              <div class="empty-state-title">No Courses Registered</div>
              <div class="empty-state-desc">Add curriculum courses to start scheduling attendance sessions.</div>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    const isStudent = Auth.hasRole('student');
    const canManage = Auth.hasRole('hod');

    tbody.innerHTML = courses.map(c => `
      <tr>
        <td style="font-weight: var(--font-weight-bold); color: var(--color-primary); font-family: var(--font-family-mono);">
          ${Util.escapeHtml(c.course_code)}
        </td>
        <td style="font-weight: var(--font-weight-medium);">${Util.escapeHtml(c.course_title)}</td>
        <td>${Util.getLevelBadge(c.academic_level || c.level)}</td>
        <td><span class="badge badge-neutral">${c.credit_units} Units</span></td>
        <td>${c.status === 'active' || c.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-neutral">Inactive</span>'}</td>
        ${!isStudent ? `
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <a href="#/enrollments?course_id=${c.id}" class="btn btn-sm btn-outline" title="View Students Enrolled">
                Enrollments
              </a>
              ${canManage ? `
                <button class="btn btn-sm btn-ghost btn-edit-course" data-id="${c.id}" title="Edit Course">
                  ✏️
                </button>
              ` : ''}
            </div>
          </td>
        ` : ''}
      </tr>
    `).join('');

    tbody.querySelectorAll('.btn-edit-course').forEach(btn => {
      btn.addEventListener('click', () => {
        const course = this.courses.find(c => c.id === btn.dataset.id);
        if (course) this.showEditModal(course);
      });
    });
  },

  showCreateModal() {
    const content = `
      <form id="create-course-form" class="space-y-4">
        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="course-code">Course Code *</label>
            <input type="text" id="course-code" class="form-control" placeholder="e.g. CSC 301" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="course-credits">Credit Units *</label>
            <input type="number" id="course-credits" class="form-control" value="3" min="1" max="6" required />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="course-title">Course Title *</label>
          <input type="text" id="course-title" class="form-control" placeholder="e.g. Operating Systems Architecture" required />
        </div>

        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="course-level">Academic Level *</label>
            <select id="course-level" class="form-control" required>
              <option value="100">100 Level</option>
              <option value="200">200 Level</option>
              <option value="300" selected>300 Level</option>
              <option value="400">400 Level</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="course-semester">Semester Type *</label>
            <select id="course-semester" class="form-control" required>
              <option value="first">First Semester</option>
              <option value="second">Second Semester</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="course-desc">Description</label>
          <textarea id="course-desc" class="form-control" rows="3" placeholder="Brief course syllabus or summary..."></textarea>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" id="btn-cancel-course">Cancel</button>
      <button class="btn btn-primary" id="btn-save-course">Create Course</button>
    `;

    Modal.show({
      title: 'Add New Course',
      content,
      footer,
      size: 'md'
    });

    document.getElementById('btn-cancel-course')?.addEventListener('click', () => Modal.close());
    document.getElementById('btn-save-course')?.addEventListener('click', async () => {
      const code = document.getElementById('course-code').value.trim();
      const title = document.getElementById('course-title').value.trim();
      const academic_level = document.getElementById('course-level').value;
      const semester_type = document.getElementById('course-semester').value;
      const credits = parseInt(document.getElementById('course-credits').value, 10);
      const desc = document.getElementById('course-desc').value.trim();

      if (!code || !title || !academic_level || !semester_type) {
        Notification.warning('Please enter course code, title, academic level, and semester type.');
        return;
      }

      try {
        await Api.post('/courses', {
          course_code: code,
          course_title: title,
          academic_level,
          semester_type,
          credit_units: credits,
          description: desc || undefined
        });

        Notification.success('Course created successfully!');
        Modal.close();
        this.loadCourses();
      } catch {}
    });
  },

  showEditModal(course) {
    const content = `
      <form id="edit-course-form" class="space-y-4">
        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="edit-course-code">Course Code *</label>
            <input type="text" id="edit-course-code" class="form-control" value="${Util.escapeHtml(course.course_code)}" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-course-credits">Credit Units *</label>
            <input type="number" id="edit-course-credits" class="form-control" value="${course.credit_units}" min="1" max="6" required />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-course-title">Course Title *</label>
          <input type="text" id="edit-course-title" class="form-control" value="${Util.escapeHtml(course.course_title)}" required />
        </div>

        <div class="grid grid-2" style="gap: var(--space-4);">
          <div class="form-group">
            <label class="form-label" for="edit-course-level">Academic Level *</label>
            <select id="edit-course-level" class="form-control" required>
              <option value="100" ${course.academic_level == '100' ? 'selected' : ''}>100 Level</option>
              <option value="200" ${course.academic_level == '200' ? 'selected' : ''}>200 Level</option>
              <option value="300" ${course.academic_level == '300' ? 'selected' : ''}>300 Level</option>
              <option value="400" ${course.academic_level == '400' ? 'selected' : ''}>400 Level</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-course-semester">Semester Type *</label>
            <select id="edit-course-semester" class="form-control" required>
              <option value="first" ${course.semester_type == 'first' ? 'selected' : ''}>First Semester</option>
              <option value="second" ${course.semester_type == 'second' ? 'selected' : ''}>Second Semester</option>
            </select>
          </div>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" id="btn-cancel-edit-course">Cancel</button>
      <button class="btn btn-primary" id="btn-update-course">Update Course</button>
    `;

    Modal.show({
      title: `Edit Course: ${course.course_code}`,
      content,
      footer,
      size: 'md'
    });

    document.getElementById('btn-cancel-edit-course')?.addEventListener('click', () => Modal.close());
    document.getElementById('btn-update-course')?.addEventListener('click', async () => {
      const code = document.getElementById('edit-course-code').value.trim();
      const title = document.getElementById('edit-course-title').value.trim();
      const academic_level = document.getElementById('edit-course-level').value;
      const semester_type = document.getElementById('edit-course-semester').value;
      const credits = parseInt(document.getElementById('edit-course-credits').value, 10);

      try {
        await Api.put(`/courses/${course.id}`, {
          course_code: code,
          course_title: title,
          academic_level,
          semester_type,
          credit_units: credits
        });

        Notification.success('Course updated successfully!');
        Modal.close();
        this.loadCourses();
      } catch {}
    });
  }
};
