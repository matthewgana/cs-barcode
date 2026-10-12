/**
 * Course Enrollments Controller
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';
import { Modal } from '../core/modal.js';
import { Notification } from '../core/notifications.js';

export const EnrollmentsPage = {
  courses: [],
  sessions: [],
  selectedCourseId: '',
  selectedSessionId: '',
  enrollments: [],

  render() {
    const canManage = Auth.hasRole('hod', 'secretary');

    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Course Enrollments</h1>
            <p>Manage student registrations per course, including bulk cohort enrollment by academic level.</p>
          </div>
          <div class="page-actions">
            ${canManage ? `
              <button class="btn btn-accent" id="btn-bulk-enroll">
                <span>⚡</span> Bulk Enroll by Level
              </button>
              <button class="btn btn-primary" id="btn-single-enroll">
                <span>➕</span> Enroll Student
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Filter Selectors -->
        <div class="card mb-6">
          <div class="card-body">
            <div class="grid grid-2" style="gap: var(--space-4);">
              <div class="form-group mb-0">
                <label class="form-label" for="enroll-course-select">Course *</label>
                <select id="enroll-course-select" class="form-control">
                  <option value="">Select Course...</option>
                </select>
              </div>
              <div class="form-group mb-0">
                <label class="form-label" for="enroll-session-select">Academic Session *</label>
                <select id="enroll-session-select" class="form-control">
                  <option value="">Select Academic Session...</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Enrolled Students Table -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Enrolled Students</h3>
            <span class="badge badge-primary" id="enrollment-count-badge">0 Enrolled</span>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Registration No.</th>
                  <th>Student Name</th>
                  <th>Level</th>
                  <th>Email</th>
                  <th>Enrolled On</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody id="enrollments-table-body">
                <tr>
                  <td colspan="6" class="text-center p-8 text-muted">Select a course to view enrollments.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  },

  async bindEvents() {
    await this.loadInitialData();

    document.getElementById('btn-single-enroll')?.addEventListener('click', () => {
      this.showSingleEnrollModal();
    });

    document.getElementById('btn-bulk-enroll')?.addEventListener('click', () => {
      this.showBulkEnrollModal();
    });
  },

  async loadInitialData() {
    try {
      const [coursesRes, sessionsRes] = await Promise.all([
        Api.get('/courses'),
        Api.get('/academic/sessions')
      ]);

      this.courses = coursesRes.data || [];
      this.sessions = sessionsRes.data || [];

      const courseSelect = document.getElementById('enroll-course-select');
      const sessionSelect = document.getElementById('enroll-session-select');

      courseSelect.innerHTML = '<option value="">Select Course...</option>' +
        this.courses.map(c => `
          <option value="${c.id}">${Util.escapeHtml(c.course_code)} — ${Util.escapeHtml(c.course_title)} (${c.level}L)</option>
        `).join('');

      const activeSession = this.sessions.find(s => s.is_current) || this.sessions[0];

      sessionSelect.innerHTML = '<option value="">Select Academic Session...</option>' +
        this.sessions.map(s => `
          <option value="${s.id}" ${s.id === activeSession?.id ? 'selected' : ''}>${Util.escapeHtml(s.name)}</option>
        `).join('');

      this.selectedSessionId = activeSession ? activeSession.id : '';

      // Check query param
      const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
      const queryCourseId = urlParams.get('course_id');

      if (queryCourseId && this.courses.some(c => c.id === queryCourseId)) {
        courseSelect.value = queryCourseId;
        this.selectedCourseId = queryCourseId;
        this.loadEnrollments();
      } else if (this.courses.length > 0) {
        courseSelect.value = this.courses[0].id;
        this.selectedCourseId = this.courses[0].id;
        this.loadEnrollments();
      }

      courseSelect.addEventListener('change', (e) => {
        this.selectedCourseId = e.target.value;
        this.loadEnrollments();
      });

      sessionSelect.addEventListener('change', (e) => {
        this.selectedSessionId = e.target.value;
        this.loadEnrollments();
      });
    } catch (err) {
      Notification.error('Failed to load courses or sessions: ' + err.message);
    }
  },

  async loadEnrollments() {
    const tbody = document.getElementById('enrollments-table-body');
    const badge = document.getElementById('enrollment-count-badge');
    if (!tbody || !this.selectedCourseId) return;

    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="text-center p-8 text-muted">
          <div class="splash-spinner" style="margin: 0 auto 0.5rem;"></div>
          Loading enrollments...
        </td>
      </tr>
    `;

    try {
      const res = await Api.get('/enrollments', {
        course_id: this.selectedCourseId,
        academic_session_id: this.selectedSessionId || undefined
      });

      this.enrollments = res.data || [];
      if (badge) badge.textContent = `${this.enrollments.length} Enrolled`;

      if (this.enrollments.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" class="text-center p-8">
              <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <div class="empty-state-title">No Students Enrolled</div>
                <div class="empty-state-desc">Use Single or Bulk Enroll to register students for this course.</div>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      const canManage = Auth.hasRole('hod', 'secretary');

      tbody.innerHTML = this.enrollments.map(e => `
        <tr>
          <td style="font-family: var(--font-family-mono); font-weight: var(--font-weight-bold);">
            ${Util.escapeHtml(e.reg_number)}
          </td>
          <td style="font-weight: var(--font-weight-medium);">${Util.escapeHtml(e.first_name + ' ' + e.last_name)}</td>
          <td>${Util.getLevelBadge(e.level)}</td>
          <td>${Util.escapeHtml(e.email || '—')}</td>
          <td style="font-size: var(--font-size-xs);">${Util.formatDate(e.created_at)}</td>
          <td style="text-align: right;">
            ${canManage ? `
              <button class="btn btn-sm btn-danger btn-drop" data-id="${e.id}" title="Drop student enrollment">
                Drop
              </button>
            ` : '—'}
          </td>
        </tr>
      `).join('');

      tbody.querySelectorAll('.btn-drop').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Are you sure you want to drop this student enrollment?')) return;
          try {
            await Api.delete(`/enrollments/${btn.dataset.id}`);
            Notification.success('Student dropped from course.');
            this.loadEnrollments();
          } catch {}
        });
      });
    } catch (err) {
      tbody.innerHTML = `
        <tr><td colspan="6" class="text-center p-6 text-danger">Failed to load enrollments: ${Util.escapeHtml(err.message)}</td></tr>
      `;
    }
  },

  async showSingleEnrollModal() {
    try {
      const studentsRes = await Api.get('/students', { limit: 100 });
      const students = studentsRes.data || [];

      const content = `
        <form id="single-enroll-form" class="space-y-4">
          <div class="form-group">
            <label class="form-label" for="enroll-student-select">Student *</label>
            <select id="enroll-student-select" class="form-control" required>
              <option value="">Select Student...</option>
              ${students.map(s => `
                <option value="${s.id}">${Util.escapeHtml(s.reg_number)} — ${Util.escapeHtml(s.first_name + ' ' + s.last_name)} (${s.level}L)</option>
              `).join('')}
            </select>
          </div>
        </form>
      `;

      const footer = `
        <button class="btn btn-outline" id="btn-cancel-single-enroll">Cancel</button>
        <button class="btn btn-primary" id="btn-save-single-enroll">Enroll Student</button>
      `;

      Modal.show({
        title: 'Enroll Student in Course',
        content,
        footer,
        size: 'md'
      });

      document.getElementById('btn-cancel-single-enroll')?.addEventListener('click', () => Modal.close());
      document.getElementById('btn-save-single-enroll')?.addEventListener('click', async () => {
        const studentId = document.getElementById('enroll-student-select').value;
        if (!studentId || !this.selectedCourseId || !this.selectedSessionId) {
          Notification.warning('Please select a student.');
          return;
        }

        try {
          await Api.post('/enrollments', {
            course_id: this.selectedCourseId,
            student_id: studentId,
            academic_session_id: this.selectedSessionId
          });

          Notification.success('Student enrolled successfully!');
          Modal.close();
          this.loadEnrollments();
        } catch {}
      });
    } catch {}
  },

  showBulkEnrollModal() {
    const course = this.courses.find(c => c.id === this.selectedCourseId);
    const defaultLevel = course ? course.level : '100';

    const content = `
      <form id="bulk-enroll-form" class="space-y-4">
        <p class="text-sm text-secondary">
          Automatically enroll all active students of a given level into this course in a single click.
        </p>

        <div class="form-group">
          <label class="form-label" for="bulk-level-select">Student Academic Level *</label>
          <select id="bulk-level-select" class="form-control" required>
            <option value="100" ${defaultLevel == '100' ? 'selected' : ''}>100 Level (Year 1)</option>
            <option value="200" ${defaultLevel == '200' ? 'selected' : ''}>200 Level (Year 2)</option>
            <option value="300" ${defaultLevel == '300' ? 'selected' : ''}>300 Level (Year 3)</option>
            <option value="400" ${defaultLevel == '400' ? 'selected' : ''}>400 Level (Year 4)</option>
          </select>
        </div>
      </form>
    `;

    const footer = `
      <button class="btn btn-outline" id="btn-cancel-bulk">Cancel</button>
      <button class="btn btn-accent" id="btn-execute-bulk">Execute Bulk Enrollment</button>
    `;

    Modal.show({
      title: `Bulk Enroll Cohort (${course?.course_code || 'Course'})`,
      content,
      footer,
      size: 'md'
    });

    document.getElementById('btn-cancel-bulk')?.addEventListener('click', () => Modal.close());
    document.getElementById('btn-execute-bulk')?.addEventListener('click', async () => {
      const level = document.getElementById('bulk-level-select').value;
      if (!this.selectedCourseId || !this.selectedSessionId) {
        Notification.warning('Please ensure a course and academic session are selected.');
        return;
      }

      try {
        const res = await Api.post('/enrollments/bulk-by-level', {
          course_id: this.selectedCourseId,
          academic_session_id: this.selectedSessionId,
          level
        });

        Notification.success(res.message || 'Bulk enrollment completed!');
        Modal.close();
        this.loadEnrollments();
      } catch {}
    });
  }
};
