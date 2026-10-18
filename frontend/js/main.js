/**
 * Master SPA Application Bootstrap & Client-Side Router
 */

import { Auth } from './core/auth.js';
import { Sidebar } from './components/sidebar.js';
import { Header } from './components/header.js';
import { Modal } from './core/modal.js';
import { Notification } from './core/notifications.js';

// Pages
import { LoginPage } from './pages/login.js';
import { DashboardPage } from './pages/dashboard.js';
import { StudentsPage } from './pages/students.js';
import { CoursesPage } from './pages/courses.js';
import { SessionsPage } from './pages/sessions.js';
import { ScannerPage } from './pages/scanner.js';
import { AttendancePage } from './pages/attendance.js';
import { ReportsPage } from './pages/reports.js';
import { EnrollmentsPage } from './pages/enrollments.js';
import { AcademicSessionsPage } from './pages/academic-sessions.js';
import { SemestersPage } from './pages/semesters.js';
import { LecturerAssignmentsPage } from './pages/lecturer-assignments.js';
import { StaffPage } from './pages/staff.js';
import { AuditPage } from './pages/audit.js';
import { ProfilePage } from './pages/profile.js';

const routes = {
  login: { controller: LoginPage, title: 'Login', auth: false },
  dashboard: { controller: DashboardPage, title: 'Department Dashboard', auth: true },
  profile: { controller: ProfilePage, title: 'My Profile & Security', auth: true },
  students: { controller: StudentsPage, title: 'Students & Barcodes', auth: true, roles: ['hod', 'secretary'] },
  courses: { controller: CoursesPage, title: 'Courses', auth: true },
  sessions: { controller: SessionsPage, title: 'Attendance Sessions', auth: true },
  scanner: { controller: ScannerPage, title: 'Live Barcode Scanner', auth: true, roles: ['hod', 'lecturer'] },
  attendance: { controller: AttendancePage, title: 'Attendance Records', auth: true },
  reports: { controller: ReportsPage, title: 'Attendance Reports', auth: true },
  enrollments: { controller: EnrollmentsPage, title: 'Course Enrollments', auth: true, roles: ['hod', 'secretary'] },
  'academic-sessions': { controller: AcademicSessionsPage, title: 'Academic Sessions', auth: true, roles: ['hod', 'secretary'] },
  semesters: { controller: SemestersPage, title: 'Semesters', auth: true, roles: ['hod', 'secretary'] },
  'lecturer-assignments': { controller: LecturerAssignmentsPage, title: 'Lecturer Allocation', auth: true, roles: ['hod'] },
  staff: { controller: StaffPage, title: 'Staff Accounts', auth: true, roles: ['hod'] },
  audit: { controller: AuditPage, title: 'Audit Trail', auth: true, roles: ['hod'] }
};

let currentPageController = null;

class AppRouter {
  static init() {
    this.initTheme();
    this.bindGlobalEvents();
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  static initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  static bindGlobalEvents() {
    window.addEventListener('auth:expired', () => {
      Notification.warning('Your session has expired. Please sign in again.');
      window.location.hash = '#/login';
    });

    window.addEventListener('auth:logout', () => {
      window.location.hash = '#/login';
    });

    window.addEventListener('auth:login', () => {
      window.location.hash = '#/dashboard';
    });
  }

  static parseHash() {
    const hash = window.location.hash.slice(2); // strip '#/'
    if (!hash) return { route: '', params: new URLSearchParams() };

    const [routePart, queryPart] = hash.split('?');
    return {
      route: routePart.toLowerCase(),
      params: new URLSearchParams(queryPart || '')
    };
  }

  static async handleRoute() {
    // Destroy previous page hooks (e.g. camera stop, keyboard unbind)
    if (currentPageController && typeof currentPageController.onDestroy === 'function') {
      currentPageController.onDestroy();
    }
    Modal.close();

    const { route } = this.parseHash();
    const appEl = document.getElementById('app');

    // Authenticate check
    const user = await Auth.checkAuth();

    // Default route
    let targetRoute = route || (user ? 'dashboard' : 'login');

    // If unauthenticated and trying to access protected route
    if (!user && targetRoute !== 'login') {
      window.location.hash = '#/login';
      return;
    }

    // If authenticated and visiting login
    if (user && targetRoute === 'login') {
      window.location.hash = '#/dashboard';
      return;
    }

    const routeConfig = routes[targetRoute] || routes.dashboard;

    // RBAC check
    if (routeConfig.roles && !routeConfig.roles.includes(user?.role)) {
      Notification.error('You do not have permission to access that section.');
      window.location.hash = '#/dashboard';
      return;
    }

    currentPageController = routeConfig.controller;

    // Render App Shell or Fullscreen for Login
    if (targetRoute === 'login') {
      appEl.innerHTML = routeConfig.controller.render();
      if (typeof routeConfig.controller.bindEvents === 'function') {
        routeConfig.controller.bindEvents();
      }
    } else {
      // Build Shell Layout
      appEl.innerHTML = `
        <div class="app-layout">
          ${Sidebar.render(targetRoute)}
          <div class="app-main">
            ${Header.render(routeConfig.title)}
            <main class="page-content" id="page-content" role="main">
              ${await routeConfig.controller.render()}
            </main>
          </div>
        </div>
      `;

      Header.bindEvents();
      if (typeof routeConfig.controller.bindEvents === 'function') {
        await routeConfig.controller.bindEvents();
      }
    }

    // Scroll to top
    window.scrollTo(0, 0);
  }
}

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  AppRouter.init();
});
