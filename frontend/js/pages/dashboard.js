/**
 * Master Dashboard Page Controller
 * Automatically switches between:
 * 1. Staff/Faculty Department Overview (HOD, Lecturer, Secretary)
 * 2. Dedicated Student Attendance & Digital ID Badge Portal (Student)
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';
import { IdCardPrinter } from '../components/id-card-printer.js';

export const DashboardPage = {
  async render() {
    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title" id="dashboard-header-title">
            <h1>Department Overview</h1>
            <p>Real-time attendance metrics, active lecture sessions, and student cohorts.</p>
          </div>
          <div class="page-actions" id="dashboard-actions">
            <!-- Rendered dynamically based on role -->
          </div>
        </div>

        <div id="dashboard-loading" class="text-center p-8">
          <div class="splash-spinner" style="margin: 0 auto 1rem;"></div>
          <p class="text-muted">Loading dashboard metrics...</p>
        </div>

        <div id="dashboard-content" style="display: none;">
          <!-- Dynamically populated -->
        </div>
      </div>
    `;
  },

  async bindEvents() {
    const user = Auth.getUser();

    try {
      const statsRes = await Api.get('/dashboard/stats');
      const data = statsRes.data || {};

      document.getElementById('dashboard-loading').style.display = 'none';
      const contentEl = document.getElementById('dashboard-content');
      contentEl.style.display = 'block';

      if (data.isStudent) {
        const studentSessionsRes = await Api.get('/sessions').catch(() => ({ data: [] }));
        const openSession = (studentSessionsRes.data || []).find(s => s.status === 'open');
        this.renderStudentDashboard(data, openSession);
      } else {
        const sessionsRes = await Api.get('/sessions').catch(() => ({ data: [] }));
        const allSessions = sessionsRes.data || [];
        const activeSessions = allSessions.filter(s => s.status === 'open' || s.status === 'scheduled');

        this.renderStaffDashboard(data, activeSessions, user);
      }
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

  /* ==========================================================================
     STUDENT PORTAL DASHBOARD
     ========================================================================== */
  renderStudentDashboard(data, openSession = null) {
    const student = IdCardPrinter.normalizeStudent(data.student || {});
    const stats = data.stats || { rate: 100, attended: 0, present: 0, late: 0, absent: 0, totalSessions: 0 };
    const courses = data.courses || [];
    const recentScans = data.recentScans || [];

    // Header updates
    const titleEl = document.getElementById('dashboard-header-title');
    if (titleEl) {
      titleEl.innerHTML = `
        <h1>Student Identity & Attendance Portal</h1>
        <p>Welcome back, <strong>${Util.escapeHtml(student.fullName)}</strong> &bull; Cohort: <strong>${student.academicLevel} Level</strong> &bull; Reg No: <strong>${student.matricNumber}</strong></p>
      `;
    }

    const actionsEl = document.getElementById('dashboard-actions');
    if (actionsEl) {
      actionsEl.innerHTML = `
        <a href="#/scanner" class="btn btn-primary" id="btn-scan-attendance-direct">
          <span>📷</span> Mark Attendance
        </a>
        <button type="button" class="btn btn-outline" id="btn-print-id-card">
          <span>🖨️</span> Print ID Card
        </button>
      `;

      document.getElementById('btn-print-id-card')?.addEventListener('click', () => {
        IdCardPrinter.printStudentIdCard(student);
      });
    }

    const isExamEligible = stats.rate >= 75;
    const barcodeUrl = student.id ? `/api/students/${student.id}/barcode?format=svg&type=code128` : '';
    const qrcodeUrl = student.id ? `/api/students/${student.id}/barcode?format=svg&type=qrcode` : '';

    const contentEl = document.getElementById('dashboard-content');
    contentEl.innerHTML = `
      ${openSession ? `
        <div class="card mb-6 p-5" style="border-left: 4px solid var(--color-success); background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(14, 165, 233, 0.05)); display: flex; justify-content: space-between; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 2rem;">🔴</span>
            <div>
              <div style="font-weight: var(--font-weight-bold); font-size: var(--font-size-base); color: var(--color-text);">
                LIVE LECTURE IN PROGRESS: ${Util.escapeHtml(openSession.course_code)}
              </div>
              <div style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                ${Util.escapeHtml(openSession.session_title)} &bull; ${openSession.academic_level || openSession.level || '100'}L &bull; Session is currently OPEN
              </div>
            </div>
          </div>
          <a href="#/scanner?session_id=${openSession.id}" class="btn btn-primary btn-sm" style="white-space: nowrap;">
            📷 Take / Mark Attendance Now &rarr;
          </a>
        </div>
      ` : ''}

      <!-- Top Section: Digital ID Card + Performance Summary -->
      <div class="grid grid-2" style="gap: var(--space-6); margin-bottom: var(--space-6); align-items: start;">
        
        <!-- Left: Elite Student Barcode ID Card -->
        <div class="card card-id-wrapper" style="padding: var(--space-6); background: var(--color-surface);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-5);">
            <div>
              <h3 class="card-title" style="margin: 0 0 2px;">Digital Identity Badge</h3>
              <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-text-secondary);">Official academic credential &bull; CR80 verified</p>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button type="button" class="btn btn-sm btn-ghost" id="btn-flip-card" title="Flip to reverse side">
                <span>🔄</span> Flip Card
              </button>
              <span class="badge badge-success" style="padding: 0.35rem 0.75rem;">● Active</span>
            </div>
          </div>

          <!-- 3D Flippable Card Stage -->
          <div class="id-card-stage" id="id-card-stage">
            
            <!-- FRONT FACE -->
            <div class="student-id-card id-card-face id-card-front" id="student-badge-card">
              <!-- Holographic security top strip -->
              <div class="card-holo-strip"></div>

              <!-- Dark navy header banner -->
              <div class="id-card-banner">
                <div class="id-card-banner-seal">🎓</div>
                <div class="id-card-banner-text">
                  <div class="id-card-banner-university">${Util.escapeHtml(student.university)}</div>
                  <div class="id-card-banner-dept">${Util.escapeHtml(student.department)}</div>
                  <div class="id-card-banner-type">Student Identity Card</div>
                </div>
              </div>

              <!-- Body: avatar + info columns -->
              <div class="id-card-body">
                <div class="id-card-photo-col">
                  <div class="id-card-avatar">
                    ${student.photoUrl ? `
                      <img src="${student.photoUrl}" alt="${Util.escapeHtml(student.fullName)}" class="id-card-avatar-img" onerror="this.style.display='none'; this.parentElement.innerText='${student.initials}'" />
                    ` : student.initials}
                  </div>
                  <div class="id-card-status-chip">● Active</div>
                </div>
                <div class="id-card-info-col">
                  <div class="id-card-name">${Util.escapeHtml(student.fullName)}</div>
                  <div class="id-card-reg">${Util.escapeHtml(student.matricNumber)}</div>
                  <div class="id-card-fields">
                    <div class="id-card-field">
                      <span class="id-card-field-label">Level</span>
                      <span class="id-card-field-value">${student.academicLevel} Level</span>
                    </div>
                    <div class="id-card-field">
                      <span class="id-card-field-label">Programme</span>
                      <span class="id-card-field-value">${Util.escapeHtml(student.programme)}</span>
                    </div>
                    <div class="id-card-field">
                      <span class="id-card-field-label">Admission</span>
                      <span class="id-card-field-value">${student.admissionYear}</span>
                    </div>
                    <div class="id-card-field">
                      <span class="id-card-field-label">Valid Thru</span>
                      <span class="id-card-field-value">${student.validThru}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Divider -->
              <div class="id-card-divider"></div>

              <!-- Barcode zone -->
              <div class="id-card-barcode-zone">
                <div class="id-card-barcode-label">Lecture Attendance Barcode (Code 128)</div>
                <div class="id-card-barcode-container">
                  ${barcodeUrl ? `
                    <img
                      src="${barcodeUrl}"
                      alt="Barcode"
                      class="id-card-barcode-img"
                      onerror="this.style.display='none'"
                    />
                  ` : `<div style="padding:8px;font-family:monospace;font-size:1.1rem;letter-spacing:4px;color:#475569">||| | |||| | || ||| |</div>`}
                  <div class="id-card-barcode-val">${Util.escapeHtml(student.barcodeValue)}</div>
                </div>
              </div>

              <!-- Dark footer -->
              <div class="id-card-footer">
                <span class="id-card-footer-text">Official Academic Credential</span>
                <span class="id-card-footer-text" style="color: #38bdf8; font-family: monospace;">AUTH: VERIFIED</span>
              </div>
            </div>

            <!-- BACK FACE -->
            <div class="student-id-card id-card-face id-card-back" id="student-badge-back" style="display: none;">
              <!-- Simulated Magnetic Stripe -->
              <div class="id-card-back-magstripe"></div>

              <!-- Regulations & Terms -->
              <div class="id-card-back-body">
                <div class="id-card-back-heading">Terms & Attendance Regulations</div>
                <ul class="id-card-back-list">
                  <li>Property of Department of Computer Science. Surrender upon request.</li>
                  <li><strong>Minimum 75% lecture attendance mandatory</strong> for exam clearance.</li>
                  <li>Scan at entrance terminal for all lectures and laboratory sessions.</li>
                  <li>Unauthorized duplication or proxy scanning is strictly prohibited.</li>
                  <li>If found, please return to the HOD Office, CS Building.</li>
                </ul>

                <!-- Security Verification Block -->
                <div class="id-card-back-sec-row">
                  <div class="id-card-back-qr">
                    ${qrcodeUrl ? `
                      <img src="${qrcodeUrl}" alt="QR Code" style="width: 100%; height: 100%; object-fit: contain;" />
                    ` : `<span style="font-size: 8px;">QR CODE</span>`}
                  </div>
                  <div class="id-card-back-sigs">
                    <div class="id-card-back-sig-line">
                      <span class="id-card-sig-cursive">Prof. A. O. Balogun</span>
                      <span class="id-card-sig-title">Head of Department (HOD)</span>
                    </div>
                    <div class="id-card-back-sig-line">
                      <span class="id-card-sig-cursive">Dr. M. I. Adeleke</span>
                      <span class="id-card-sig-title">Exams Officer</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Dark footer -->
              <div class="id-card-footer">
                <span class="id-card-footer-text">cs@university.edu.ng</span>
                <span class="id-card-footer-text" style="color: #38bdf8;">cs-portal.edu.ng</span>
              </div>
            </div>

          </div>

          <!-- Bottom Card Action Controls -->
          <div style="display: flex; justify-content: center; flex-wrap: wrap; gap: 8px; margin-top: var(--space-4);">
            <button type="button" class="btn btn-outline btn-sm" id="btn-stage-flip">
              <span>🔄</span> Flip to <span id="flip-face-label">Reverse Side</span>
            </button>
            <a href="#/profile" class="btn btn-outline btn-sm">
              <span>📷</span> ${student.photoUrl ? 'Update Photo' : 'Upload Passport'}
            </a>
            <button type="button" class="btn btn-primary btn-sm" id="btn-print-direct">
              <span>🖨️</span> Print CR80 Badge Sheet
            </button>
          </div>

          <p class="text-muted text-center" style="font-size: var(--font-size-xs); margin-top: var(--space-3); margin-bottom: 0;">
            Print in full-color on cardstock &bull; Fold down center &bull; Laminate for standard CR80 lanyard holder.
          </p>
        </div>


        <!-- Right: Real-time Attendance Performance Stats -->
        <div style="display: flex; flex-direction: column; gap: var(--space-5);">
          <!-- Overall Rate Card -->
          <div class="card" style="padding: var(--space-6);">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-3);">
              <div>
                <span class="text-muted" style="font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold;">
                  Overall Attendance Rate
                </span>
                <div style="font-size: 2.75rem; font-weight: 800; color: ${isExamEligible ? 'var(--color-primary)' : 'var(--color-warning)'}; line-height: 1.1; margin-top: 4px;">
                  ${stats.rate}%
                </div>
              </div>
              <span class="badge ${isExamEligible ? 'badge-success' : 'badge-warning'}" style="font-size: 0.8rem; padding: 0.4rem 0.8rem;">
                ${isExamEligible ? '✓ Exam Eligible (>= 75%)' : '⚠️ Below 75% Threshold'}
              </span>
            </div>

            <!-- Progress Bar -->
            <div style="height: 10px; background: var(--color-surface-hover); border-radius: var(--radius-full); overflow: hidden; margin-bottom: var(--space-4);">
              <div style="height: 100%; width: ${Math.min(100, stats.rate)}%; background: ${isExamEligible ? 'linear-gradient(90deg, #0ea5e9, #10b981)' : '#f59e0b'}; border-radius: var(--radius-full); transition: width 0.6s ease;"></div>
            </div>

            <!-- 4-Stat Grid -->
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-3); text-align: center; border-top: 1px solid var(--color-border); padding-top: var(--space-4);">
              <div>
                <div style="font-size: 1.35rem; font-weight: 700; color: var(--color-text-primary);">${stats.totalSessions}</div>
                <div style="font-size: 0.72rem; color: var(--color-text-secondary); text-transform: uppercase;">Held</div>
              </div>
              <div>
                <div style="font-size: 1.35rem; font-weight: 700; color: #10b981;">${stats.present}</div>
                <div style="font-size: 0.72rem; color: var(--color-text-secondary); text-transform: uppercase;">Present</div>
              </div>
              <div>
                <div style="font-size: 1.35rem; font-weight: 700; color: #f59e0b;">${stats.late}</div>
                <div style="font-size: 0.72rem; color: var(--color-text-secondary); text-transform: uppercase;">Late</div>
              </div>
              <div>
                <div style="font-size: 1.35rem; font-weight: 700; color: #ef4444;">${stats.absent}</div>
                <div style="font-size: 0.72rem; color: var(--color-text-secondary); text-transform: uppercase;">Missed</div>
              </div>
            </div>
          </div>

          <!-- Academic Policy Info -->
          <div class="card" style="padding: var(--space-5); background: rgba(14, 165, 233, 0.05); border-color: rgba(14, 165, 233, 0.2);">
            <div style="display: flex; gap: var(--space-3); align-items: flex-start;">
              <span style="font-size: 1.4rem;">🏛️</span>
              <div>
                <h4 style="margin: 0 0 4px; font-size: var(--font-size-sm); color: var(--color-text-primary);">Department Attendance Regulation</h4>
                <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-text-secondary); line-height: 1.5;">
                  University Computer Science Department regulations require at least <strong>75% lecture attendance</strong> in every enrolled course to qualify for end-of-semester examination clearance.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Section: Course Breakdown & Attendance Logs -->
      <div class="grid grid-2" style="gap: var(--space-6); margin-bottom: var(--space-6);">
        <!-- Enrolled Courses -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">My Courses & Attendance</h3>
            <span class="badge badge-neutral">${courses.length} Courses</span>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Title</th>
                  <th>Units</th>
                  <th>Attended</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                ${courses.length === 0 ? `
                  <tr><td colspan="5" class="text-center p-6 text-muted">No courses found for ${student.academicLevel || '100'} Level.</td></tr>
                ` : courses.map(c => `
                  <tr>
                    <td><strong>${Util.escapeHtml(c.course_code)}</strong></td>
                    <td style="font-size: var(--font-size-xs);">${Util.escapeHtml(c.course_title)}</td>
                    <td>${c.credit_units || 3}</td>
                    <td>${c.attended_count || 0} / ${c.total_sessions || 0}</td>
                    <td>
                      <span class="badge ${(c.course_rate || 0) >= 75 ? 'badge-success' : 'badge-warning'}">
                        ${c.course_rate || 0}%
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent Attendance Activity Logs -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">My Attendance History</h3>
            <a href="#/attendance" class="btn btn-ghost btn-sm">Full History &rarr;</a>
          </div>
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Course</th>
                  <th>Session</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${recentScans.length === 0 ? `
                  <tr><td colspan="4" class="text-center p-6 text-muted">No attendance scans recorded for your account yet.</td></tr>
                ` : recentScans.map(r => `
                  <tr>
                    <td style="font-family: var(--font-family-mono); font-size: var(--font-size-xs);">
                      ${Util.formatDate(r.check_in_time)} ${Util.formatTime(r.check_in_time)}
                    </td>
                    <td><strong>${Util.escapeHtml(r.course_code || '—')}</strong></td>
                    <td style="font-size: var(--font-size-xs);">${Util.escapeHtml(r.session_title || 'Lecture')}</td>
                    <td>${Util.getStatusBadge(r.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    // Wire up interactive card flip buttons
    const frontCard = document.getElementById('student-badge-card');
    const backCard = document.getElementById('student-badge-back');
    const flipLabel = document.getElementById('flip-face-label');
    let showingBack = false;

    const toggleFlip = () => {
      showingBack = !showingBack;
      if (showingBack) {
        if (frontCard) frontCard.style.display = 'none';
        if (backCard) backCard.style.display = 'flex';
        if (flipLabel) flipLabel.textContent = 'Front Face';
      } else {
        if (frontCard) frontCard.style.display = 'flex';
        if (backCard) backCard.style.display = 'none';
        if (flipLabel) flipLabel.textContent = 'Reverse Side';
      }
    };

    document.getElementById('btn-flip-card')?.addEventListener('click', toggleFlip);
    document.getElementById('btn-stage-flip')?.addEventListener('click', toggleFlip);
    document.getElementById('btn-print-direct')?.addEventListener('click', () => {
      IdCardPrinter.printStudentIdCard(student);
    });
  },

  openPrintWindow(student) {
    IdCardPrinter.printStudentIdCard(student);
  },

  /* ==========================================================================
     STAFF / FACULTY DEPARTMENT DASHBOARD (HOD, Lecturer, Secretary)
     ========================================================================== */
  renderStaffDashboard(data, activeSessions, user) {
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

    const contentEl = document.getElementById('dashboard-content');
    contentEl.innerHTML = `
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
          <div class="card-body" id="active-sessions-list" style="padding: 0;"></div>
        </div>

        <!-- Student Level Breakdown -->
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Students by Academic Level</h3>
          </div>
          <div class="card-body" id="level-breakdown"></div>
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
            <tbody id="recent-attendance-body"></tbody>
          </table>
        </div>
      </div>
    `;

    this.renderStats(data);
    this.renderActiveSessions(activeSessions);
    this.renderLevelBreakdown(data.studentsByLevel || {});
    this.renderRecentAttendance(data.recentScans || data.recentRecords || []);
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
