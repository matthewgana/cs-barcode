/**
 * Sidebar Navigation Component
 */

import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';

export const Sidebar = {
  render(currentRoute = '') {
    const user = Auth.getUser();
    if (!user) return '';

    const role = user.role;
    const isHod = role === 'hod';
    const isLecturer = role === 'lecturer';
    const isSecretary = role === 'secretary';
    const isStudent = role === 'student';

    const navItems = [
      {
        section: isStudent ? 'STUDENT PORTAL' : 'MAIN',
        items: [
          { route: 'dashboard', label: isStudent ? 'Digital ID & Overview' : 'Dashboard', icon: isStudent ? '🪪' : '📊', show: true }
        ]
      },
      {
        section: isStudent ? 'MY RECORDS' : 'ATTENDANCE',
        items: [
          { route: 'scanner', label: 'Live Scanner', icon: '📷', show: isHod || isLecturer },
          { route: 'sessions', label: 'Attendance Sessions', icon: '⏱️', show: !isStudent },
          { route: 'attendance', label: isStudent ? 'My Attendance' : 'Attendance Records', icon: '📋', show: true },
          { route: 'reports', label: 'Reports & Analytics', icon: '📈', show: !isStudent }
        ]
      },
      {
        section: 'ACADEMIC',
        items: [
          { route: 'courses', label: 'Courses', icon: '📚', show: true },
          { route: 'academic-sessions', label: 'Sessions & Terms', icon: '📅', show: isHod || isSecretary },
          { route: 'semesters', label: 'Semesters', icon: '📆', show: isHod || isSecretary }
        ]
      },
      {
        section: 'DEPARTMENT',
        items: [
          { route: 'students', label: 'Students & Barcodes', icon: '🎓', show: isHod || isSecretary },
          { route: 'enrollments', label: 'Course Enrollments', icon: '📝', show: isHod || isSecretary },
          { route: 'lecturer-assignments', label: 'Lecturer Allocation', icon: '👨‍🏫', show: isHod },
          { route: 'staff', label: 'Staff Accounts', icon: '👥', show: isHod },
          { route: 'audit', label: 'Audit Trail', icon: '🛡️', show: isHod }
        ]
      },
      {
        section: 'ACCOUNT',
        items: [
          { route: 'profile', label: isStudent ? 'Profile & Passport' : 'My Profile & Settings', icon: '👤', show: true }
        ]
      }
    ];

    let navHtml = '';

    navItems.forEach(sec => {
      const visibleItems = sec.items.filter(item => item.show);
      if (visibleItems.length === 0) return;

      navHtml += `
        <div class="sidebar-section-title">${sec.section}</div>
        <ul class="sidebar-nav">
          ${visibleItems.map(item => `
            <li class="sidebar-nav-item">
              <a href="#/${item.route}" class="sidebar-nav-link ${currentRoute === item.route ? 'is-active' : ''}" data-route="${item.route}">
                <span class="sidebar-nav-icon">${item.icon}</span>
                <span class="sidebar-nav-label">${Util.escapeHtml(item.label)}</span>
              </a>
            </li>
          `).join('')}
        </ul>
      `;
    });

    return `
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <div class="sidebar-logo">🎓</div>
            <div class="sidebar-brand-text">
              <div class="sidebar-brand-name">CS Attendance</div>
              <div class="sidebar-brand-dept">Dept. of Computer Science</div>
            </div>
          </div>
        </div>

        <div class="sidebar-content">
          ${navHtml}
        </div>

        <div class="sidebar-footer">
          <a href="#/profile" class="sidebar-user" style="text-decoration: none; color: inherit; display: flex; align-items: center; width: 100%;" title="Edit Profile & Passport">
            <div class="sidebar-user-avatar" style="overflow: hidden; flex-shrink: 0;">
              ${user.photoUrl ? `<img src="${user.photoUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;" />` : (user.fullName || user.username || 'U')[0].toUpperCase()}
            </div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${Util.escapeHtml(user.fullName || user.username)}</div>
              <div class="sidebar-user-role">${Util.escapeHtml(user.role.toUpperCase())} &bull; Edit &rarr;</div>
            </div>
          </a>
        </div>
      </aside>
    `;
  }
};
