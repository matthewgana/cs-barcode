/**
 * App Header Component
 */

import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';

export const Header = {
  render(title = 'Dashboard') {
    const user = Auth.getUser();
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';

    return `
      <header class="app-header">
        <div class="header-left">
          <button class="header-toggle-sidebar btn btn-ghost btn-sm" id="btn-toggle-sidebar" aria-label="Toggle Navigation">
            ☰
          </button>
          <div class="header-breadcrumbs">
            <span class="breadcrumb-item">CS Department</span>
            <span class="breadcrumb-separator">/</span>
            <span class="breadcrumb-item current">${Util.escapeHtml(title)}</span>
          </div>
        </div>

        <div class="header-right">
          <button class="theme-toggle" id="btn-theme-toggle" aria-label="Toggle Theme" title="Toggle dark/light mode">
            ${currentTheme === 'dark' ? '☀️' : '🌙'}
          </button>

          <div class="header-profile">
            <a href="#/profile" class="header-user-link" style="display: flex; align-items: center; gap: 10px; text-decoration: none; color: inherit; padding: 4px 8px; border-radius: var(--radius-md); transition: background 0.2s;" title="Manage Profile & Photo">
              <div class="header-user-avatar" style="width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #0ea5e9, #6366f1); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.85rem; overflow: hidden; border: 2px solid var(--color-primary); flex-shrink: 0; box-shadow: 0 2px 8px rgba(14, 165, 233, 0.25);">
                ${user?.photoUrl ? `<img src="${user.photoUrl}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;" />` : ((user?.fullName || user?.username || 'U')[0].toUpperCase())}
              </div>
              <div class="header-user-badge">
                <span class="header-user-name">${user ? Util.escapeHtml(user.fullName || user.username) : ''}</span>
                <span class="badge badge-sm badge-info">${user ? Util.escapeHtml(user.role.toUpperCase()) : ''}</span>
              </div>
            </a>
            <button class="btn btn-outline btn-sm" id="btn-logout" title="Sign out of system">
              Logout
            </button>
          </div>
        </div>
      </header>
    `;
  },

  bindEvents() {
    const themeBtn = document.getElementById('btn-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        themeBtn.textContent = next === 'dark' ? '☀️' : '🌙';
      });
    }

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await Auth.logout();
      });
    }

    const toggleSidebarBtn = document.getElementById('btn-toggle-sidebar');
    if (toggleSidebarBtn) {
      toggleSidebarBtn.addEventListener('click', () => {
        const sidebar = document.getElementById('app-sidebar');
        if (sidebar) {
          sidebar.classList.toggle('is-collapsed');
        }
      });
    }
  }
};
