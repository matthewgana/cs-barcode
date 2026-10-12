/**
 * Dashboard Page Controller
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';

export const DashboardPage = {
  async render() {
    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Department Overview</h1>
            <p>Real-time attendance metrics, active lecture sessions, and student levels.</p>
          </div>
          <div class="page-actions" id="dashboard-actions">
            <!-- Rendered based on role -->
          </div>
        </div>

        <div id="dashboard-loading" class="text-center p-8">
          <div class="splash-spinner" style="margin: 0 auto 1rem;"></div>
          <p class="text-muted">Loading department metrics...</p>
        </div>

        <div id="dashboard-content" style="display: none;">
          <!-- Key Metrics -->
          <div class="stats-grid" id="stats-grid"></div>

          <!-- Active Sessions & Recent Activity -->
          <div class="grid grid-2" style="gap: var(--space-6); margin-bottom: var(--space-6);">
            <!-- Active Sessions Card -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Live & Active Sessions</h3>
                <span class="badge badge-success" id="active-sessions-count">0 Active</span>
              </div>
              <div class="card-body" id="active-sessions-list" style="padding: 0;">
                <!-- Populated dynamically -->
              </div>
            </div>

            <!-- Student Level Breakdown -->
            <div class="card">
              <div class="card-header">
                <h3 class="card-title">Students by Academic Level</h3>
              </div>
              <div class="card-body" id="level-breakdown">
                <!-- Level pills -->
              </div>
            </div>
          </div>

          <!-- Recent Attendance Scans -->
          <div class="card">
            <div class="card-header">
              <h3 class="card-title">Recent Attendance Activity</h3>
              <a href="#/attendance" class="btn btn-ghost btn-sm">View All Logs &rarr;</a>
            </div>
            <div class="table-container">
              <table class="data-table" id="recent-attendance-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Student Name</th>
                    <th>Reg Number</th>
                    <th>Level</th>
                    <th>Course</th>
                    <th>Status</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody id="recent-attendance-body">
                  <!-- Populated dynamically -->
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async bindEvents() {
    const user = Auth.getUser();
    const actionsContainer = document.getElementById('dashboard-actions');

    if (actionsContainer && user) {
      if (user.role === 'hod' || user.role === 'lecturer') {
        actionsContainer.innerHTML = `
          <a href="#/sessions" class="btn btn-primary">
            <span>➕</span> New Attendance Session
          </a>
          <a href="#/scanner" class="btn btn-accent">
            <span>📷</span> Open Scanner
          </a>
        `;
      } else if (user.role === 'secretary') {
        actionsContainer.innerHTML = `
          <a href="#/students" class="btn btn-primary">
            <span>➕</span> Register Student
          </a>
        `;
      }
    }

    try {
      const [statsRes, sessionsRes] = await Promise.all([
        Api.get('/dashboard/stats'),
        Api.get('/sessions').catch(() => ({ data: [] }))
      ]);

      const data = statsRes.data || {};
      const allSessions = sessionsRes.data || [];
      const activeSessions = allSessions.filter(s => s.status === 'open' || s.status === 'scheduled');

      document.getElementById('dashboard-loading').style.display = 'none';
      document.getElementById('dashboard-content').style.display = 'block';

      this.renderStats(data);
      this.renderActiveSessions(activeSessions);
      this.renderLevelBreakdown(data.studentsByLevel || {});
      this.renderRecentAttendance(data.recentScans || data.recentRecords || []);
    } catch (err) {
      document.getElementById('dashboard-loading').innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3 class="empty-state-title">Failed to load dashboard</h3>
          <p class="empty-state-desc">${Util.escapeHtml(err.message)}</p>
          <button class="btn btn-outline" onclick="location.reload()">Retry</button>
        </div>
      `;
    }
  },

  renderStats(data) {
    const grid = document.getElementById('stats-grid');
    if (!grid) return;

    const totalStudents = data.studentsByLevel?.total ?? data.totalStudents ?? 0;
    const totalCourses = data.totalCourses ?? 0;
    const activeSessions = data.activeOpenSessions ?? data.activeSessionsCount ?? 0;
    const totalAttendance = data.statusCounts?.total ?? data.totalAttendanceRecords ?? 0;
    const rate = data.attendanceRate ?? 0;

    const cards = [
      {
        icon: '🎓',
        label: 'Total Enrolled Students',
        value: totalStudents,
        meta: '100L — 400L cohorts',
        trend: null,
      },
      {
        icon: '📚',
        label: 'Courses Managed',
        value: totalCourses,
        meta: 'Computer Science curriculum',
        trend: null,
      },
      {
        icon: '⚡',
        label: 'Active Sessions',
        value: activeSessions,
        meta: 'Ready for scanning now',
        trend: activeSessions > 0 ? 'up' : null,
      },
      {
        icon: '📊',
        label: 'Attendance Rate',
        value: `${rate}%`,
        meta: `${totalAttendance} records logged`,
        trend: rate >= 75 ? 'up' : 'down',
      },
    ];

    grid.innerHTML = cards.map(c => `
      <div class="stat-card">
        <div class="stat-card-accent-line"></div>
        <div class="stat-card-top">
          <div>
            <div class="stat-card-label">${c.label}</div>
            <div class="stat-card-value">${c.value}</div>
          </div>
          <div class="stat-card-icon">${c.icon}</div>
        </div>
        <div class="stat-card-meta">
          ${c.trend === 'up' ? '<span class="stat-trend-up">↑</span>' : ''}
          ${c.trend === 'down' ? '<span class="stat-trend-down">↓</span>' : ''}
          ${c.meta}
        </div>
      </div>
    `).join('');
  },

  renderActiveSessions(sessions) {
    const list = document.getElementById('active-sessions-list');
    const badge = document.getElementById('active-sessions-count');
    if (!list) return;

    if (badge) {
      badge.textContent = `${sessions.length} Active`;
    }

    if (!sessions || sessions.length === 0) {
      list.innerHTML = `
        <div class="empty-state" style="padding: var(--space-6);">
          <div class="empty-state-icon">⏱️</div>
          <div class="empty-state-title">No Active Sessions</div>
          <div class="empty-state-desc">There are no open attendance sessions right now.</div>
          ${Auth.hasRole('hod', 'lecturer') ? `
            <a href="#/sessions" class="btn btn-sm btn-primary" style="margin-top: var(--space-2);">Start a Session</a>
          ` : ''}
        </div>
      `;
      return;
    }

    list.innerHTML = `
      <div class="divide-y">
        ${sessions.map(s => `
          <div style="padding: var(--space-4); display: flex; align-items: center; justify-content: space-between; gap: var(--space-4); border-bottom: 1px solid var(--color-border);">
            <div>
              <div style="font-weight: var(--font-weight-bold); color: var(--color-text-primary);">
                ${Util.escapeHtml(s.course_code)} — ${Util.escapeHtml(s.course_title)}
              </div>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary); margin-top: 2px;">
                ${Util.getLevelBadge(s.academic_level || s.level)} &bull; ${Util.getStatusBadge(s.status)}
              </div>
            </div>
            <div style="display: flex; gap: var(--space-2);">
              <a href="#/scanner?session_id=${s.id}" class="btn btn-sm btn-accent" title="Open Barcode Scanner">
                📷 Scan
              </a>
              <a href="#/sessions" class="btn btn-sm btn-outline">
                Details
              </a>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderLevelBreakdown(levels) {
    const container = document.getElementById('level-breakdown');
    if (!container) return;

    const levelCounts = { '100': 0, '200': 0, '300': 0, '400': 0 };
    if (Array.isArray(levels)) {
      levels.forEach(item => {
        levelCounts[String(item.level)] = parseInt(item.count, 10) || 0;
      });
    } else if (typeof levels === 'object') {
      ['100', '200', '300', '400'].forEach(lvl => {
        levelCounts[lvl] = parseInt(levels[lvl], 10) || 0;
      });
    }

    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: var(--space-4);">
        ${['100', '200', '300', '400'].map(lvl => {
          const count = levelCounts[lvl];
          return `
            <div>
              <div style="display: flex; justify-content: space-between; font-size: var(--font-size-sm); margin-bottom: 4px;">
                <span style="font-weight: var(--font-weight-semibold);">${lvl} Level</span>
                <span class="text-muted">${count} Students</span>
              </div>
              <div style="height: 8px; background: var(--color-surface-hover); border-radius: var(--radius-full); overflow: hidden;">
                <div style="height: 100%; width: ${Math.min(100, count * 20)}%; background-color: var(--color-primary); border-radius: var(--radius-full);"></div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  renderRecentAttendance(records) {
    const tbody = document.getElementById('recent-attendance-body');
    if (!tbody) return;

    if (!records || records.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center p-6 text-muted">No attendance scans recorded yet.</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = records.map(r => {
      const time = r.check_in_time || r.scanned_at || r.created_at;
      const name = r.full_name || r.student_name || `${r.first_name || ''} ${r.last_name || ''}`.trim();
      const reg = r.matric_number || r.reg_number || '—';
      const level = r.academic_level || r.level || '—';

      return `
        <tr>
          <td style="font-family: var(--font-family-mono); font-size: var(--font-size-xs);">
            ${Util.formatTime(time)}
          </td>
          <td style="font-weight: var(--font-weight-medium);">
            ${Util.escapeHtml(name)}
          </td>
          <td style="font-family: var(--font-family-mono); font-size: var(--font-size-xs);">
            ${Util.escapeHtml(reg)}
          </td>
          <td>${Util.getLevelBadge(level)}</td>
          <td><strong>${Util.escapeHtml(r.course_code || '—')}</strong></td>
          <td>${Util.getStatusBadge(r.status)}</td>
          <td><span class="badge badge-neutral">${Util.escapeHtml(r.scan_method || 'USB')}</span></td>
        </tr>
      `;
    }).join('');
  }
};
