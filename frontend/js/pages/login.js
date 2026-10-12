/**
 * Redesigned Login Page Controller
 */

import { Auth } from '../core/auth.js';
import { Notification } from '../core/notifications.js';

export const LoginPage = {
  render() {
    return `
      <div class="auth-page">
        <!-- Floating ambient orbs -->
        <div class="auth-orb auth-orb-1" aria-hidden="true"></div>
        <div class="auth-orb auth-orb-2" aria-hidden="true"></div>
        <div class="auth-orb auth-orb-3" aria-hidden="true"></div>

        <div class="auth-card">
          <div class="auth-header">
            <div class="auth-logo" aria-hidden="true">🎓</div>
            <span class="auth-dept-tag">Department of Computer Science</span>
            <h1 class="auth-title">Attendance Portal</h1>
            <p class="auth-subtitle">Online Barcode Attendance System &bull; 100L – 400L</p>
          </div>

          <form id="login-form" class="auth-form" novalidate>
            <div class="form-group">
              <label for="username" class="form-label">Username</label>
              <input
                type="text"
                id="username"
                name="username"
                class="form-control"
                placeholder="e.g. hod, lecturer1, secretary"
                required
                autocomplete="username"
                autofocus
              />
            </div>

            <div class="form-group">
              <label for="password" class="form-label">Password</label>
              <input
                type="password"
                id="password"
                name="password"
                class="form-control"
                placeholder="Enter your account password"
                required
                autocomplete="current-password"
              />
            </div>

            <button type="submit" id="btn-login-submit" class="btn btn-primary btn-block btn-lg" style="margin-top: var(--space-2);">
              <span>Sign In to Dashboard</span> &#8594;
            </button>
          </form>

          <div class="auth-credentials-hint">
            <div class="auth-credentials-hint-header">
              <div class="auth-credentials-hint-title">
                <span>&#9889; Quick Test Logins</span>
              </div>
              <span style="font-size: 0.7rem; color: #475569;">Click to autofill</span>
            </div>

            <div class="auth-test-accounts-grid">
              <div class="auth-test-account-chip" data-user="hod" title="Autofill HOD account">
                <strong>HOD</strong>
                <span>hod</span>
              </div>
              <div class="auth-test-account-chip" data-user="lecturer1" title="Autofill Lecturer account">
                <strong>Lecturer</strong>
                <span>lecturer1</span>
              </div>
              <div class="auth-test-account-chip" data-user="secretary" title="Autofill Secretary account">
                <strong>Secretary</strong>
                <span>secretary</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  bindEvents() {
    const form = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    // Quick autofill buttons
    document.querySelectorAll('.auth-test-account-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const user = chip.dataset.user;
        if (usernameInput && passwordInput) {
          usernameInput.value = user;
          passwordInput.value = 'Password123!';
          Notification.info(`Filled credentials for ${user.toUpperCase()}`);
          usernameInput.focus();
        }
      });
    });

    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btn-login-submit');

      const username = usernameInput?.value.trim();
      const password = passwordInput?.value;

      if (!username || !password) {
        Notification.warning('Please enter both username and password.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Signing in...</span>`;

      try {
        await Auth.login(username, password);
        Notification.success(`Signed in successfully!`);
        window.location.hash = '#/dashboard';
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In to Dashboard</span> &#8594;`;
      }
    });
  }
};
