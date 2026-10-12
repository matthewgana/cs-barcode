/**
 * Reports & Analytics Controller
 */

import { Api } from '../core/api.js';
import { Util } from '../core/utilities.js';
import { Notification } from '../core/notifications.js';

export const ReportsPage = {
  courses: [],
  filters: {
    course_id: '',
    level: '',
    status: '',
    start_date: '',
    end_date: ''
  },

  render() {
    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Attendance Reports &amp; Analytics</h1>
            <p>Filter attendance history across all levels and export official departmental CSV reports.</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary" id="btn-export-csv">
              <span>📥</span> Export CSV Report
            </button>
          </div>
        </div>

        <!-- Filter Card -->
        <div class="card mb-6">
          <div class="card-body">
            <div class="grid grid-3" style="gap: var(--space-4);">
              <div class="form-group mb-0">
                <label class="form-label" for="report-filter-course">Course</label>
                <select id="report-filter-course" class="form-control">
                  <option value="">All Courses</option>
                </select>
              </div>

              <div class="form-group mb-0">
                <label class="form-label" for="report-filter-level">Academic Level</label>
                <select id="report-filter-level" class="form-control">
                  <option value="">All Levels</option>
                  <option value="100">100 Level</option>
                  <option value="200">200 Level</option>
                  <option value="300">300 Level</option>
                  <option value="400">400 Level</option>
                </select>
              </div>

              <div class="form-group mb-0">
                <label class="form-label" for="report-filter-status">Attendance Status</label>
                <select id="report-filter-status" class="form-control">
                  <option value="">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </select>
              </div>
            </div>

            <div class="grid grid-2 mt-4" style="gap: var(--space-4);">
              <div class="form-group mb-0">
                <label class="form-label" for="report-filter-start">From Date</label>
                <input type="date" id="report-filter-start" class="form-control" />
              </div>
              <div class="form-group mb-0">
                <label class="form-label" for="report-filter-end">To Date</label>
                <input type="date" id="report-filter-end" class="form-control" />
              </div>
            </div>
          </div>
        </div>

        <!-- Report Table -->
        <div class="card">
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Course</th>
                  <th>Reg. Number</th>
                  <th>Student Name</th>
                  <th>Level</th>
                  <th>Status</th>
                  <th>Scan Time</th>
                </tr>
              </thead>
              <tbody id="reports-table-body">
                <tr>
                  <td colspan="7" class="text-center p-8 text-muted">
                    <div class="splash-spinner" style="margin: 0 auto 0.5rem;"></div>
                    Generating attendance report...
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
    await this.loadCourses();

    const courseSelect = document.getElementById('report-filter-course');
    const levelSelect = document.getElementById('report-filter-level');
    const statusSelect = document.getElementById('report-filter-status');
    const startInput = document.getElementById('report-filter-start');
    const endInput = document.getElementById('report-filter-end');
    const exportBtn = document.getElementById('btn-export-csv');

    const onFilterChange = () => {
      this.filters.course_id = courseSelect.value;
      this.filters.level = levelSelect.value;
      this.filters.status = statusSelect.value;
      this.filters.start_date = startInput.value;
      this.filters.end_date = endInput.value;
      this.loadReport();
    };

    courseSelect?.addEventListener('change', onFilterChange);
    levelSelect?.addEventListener('change', onFilterChange);
    statusSelect?.addEventListener('change', onFilterChange);
    startInput?.addEventListener('change', onFilterChange);
    endInput?.addEventListener('change', onFilterChange);

    exportBtn?.addEventListener('click', () => this.exportCsv());

    await this.loadReport();
  },

  async loadCourses() {
    try {
      const res = await Api.get('/courses');
      this.courses = res.data || [];
      const select = document.getElementById('report-filter-course');
      if (select) {
        select.innerHTML = '<option value="">All Courses</option>' +
          this.courses.map(c => `
            <option value="${c.id}">${Util.escapeHtml(c.course_code)} — ${Util.escapeHtml(c.course_title)}</option>
          `).join('');
      }
    } catch {}
  },

  async loadReport() {
    const tbody = document.getElementById('reports-table-body');
    if (!tbody) return;

    try {
      const res = await Api.get('/reports', this.filters);
      const records = res.data || [];

      if (records.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center p-8">
              <div class="empty-state">
                <div class="empty-state-icon">📈</div>
                <div class="empty-state-title">No Records Found</div>
                <div class="empty-state-desc">Try widening your date range or filters.</div>
              </div>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = records.map(r => `
        <tr>
          <td>${Util.formatDate(r.session_date)}</td>
          <td style="font-weight: var(--font-weight-bold);">${Util.escapeHtml(r.course_code)}</td>
          <td style="font-family: var(--font-family-mono);">${Util.escapeHtml(r.reg_number)}</td>
          <td style="font-weight: var(--font-weight-medium);">${Util.escapeHtml(r.first_name + ' ' + r.last_name)}</td>
          <td>${Util.getLevelBadge(r.level)}</td>
          <td>${Util.getStatusBadge(r.status)}</td>
          <td style="font-family: var(--font-family-mono); font-size: var(--font-size-xs);">
            ${r.scanned_at ? Util.formatTime(r.scanned_at) : '—'}
          </td>
        </tr>
      `).join('');
    } catch (err) {
      tbody.innerHTML = `
        <tr><td colspan="7" class="text-center p-6 text-danger">Failed to generate report: ${Util.escapeHtml(err.message)}</td></tr>
      `;
    }
  },

  async exportCsv() {
    try {
      Notification.info('Generating CSV download...');
      const blob = await Api.get('/reports/export', this.filters);
      const filename = `cs_attendance_report_${new Date().toISOString().slice(0, 10)}.csv`;
      Util.downloadBlob(blob, filename);
      Notification.success('Attendance CSV report downloaded successfully!');
    } catch (err) {
      Notification.error('Failed to export CSV: ' + err.message);
    }
  }
};
