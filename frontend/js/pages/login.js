/**
 * Professional Authentication Page Controller
 * Supports secure Sign In and Account Registration across all roles:
 * Student, Lecturer, Secretary, and Head of Department (HOD)
 */

import { Auth } from '../core/auth.js';
import { Notification } from '../core/notifications.js';
import { Util } from '../core/utilities.js';

export const LoginPage = {
  currentTab: 'signin', // 'signin' | 'signup'
  selectedRole: 'student', // 'student' | 'lecturer' | 'secretary' | 'hod'

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
            <p class="auth-subtitle">Online Barcode Attendance Management System &bull; 100L – 400L</p>
          </div>

          <!-- Professional Tab Switcher -->
          <div class="auth-tabs" role="tablist">
            <button
              type="button"
              class="auth-tab-btn ${this.currentTab === 'signin' ? 'is-active' : ''}"
              id="tab-btn-signin"
              role="tab"
              aria-selected="${this.currentTab === 'signin'}"
            >
              Sign In
            </button>
            <button
              type="button"
              class="auth-tab-btn ${this.currentTab === 'signup' ? 'is-active' : ''}"
              id="tab-btn-signup"
              role="tab"
              aria-selected="${this.currentTab === 'signup'}"
            >
              Create Account
            </button>
          </div>

          <!-- SIGN IN FORM -->
          <div id="auth-signin-view" style="${this.currentTab === 'signin' ? '' : 'display: none;'}">
            <form id="login-form" class="auth-form" novalidate>
              <div class="form-group">
                <label for="username" class="form-label">Username, Email, or Matric No.</label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  class="form-control"
                  placeholder="Enter your username, email, or matric number"
                  required
                  autocomplete="username"
                  autofocus
                />
              </div>

              <div class="form-group">
                <label for="password" class="form-label">Password</label>
                <div class="password-input-wrapper">
                  <input
                    type="password"
                    id="password"
                    name="password"
                    class="form-control"
                    placeholder="Enter your password"
                    required
                    autocomplete="current-password"
                  />
                  <button
                    type="button"
                    class="password-toggle-btn"
                    data-toggle-password="password"
                    aria-label="Show password"
                    title="Show password"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                  </button>
                </div>
              </div>

              <button type="submit" id="btn-login-submit" class="btn btn-primary btn-block btn-lg" style="margin-top: var(--space-2);">
                <span>Sign In to Portal</span> &#8594;
              </button>
            </form>

            <div class="auth-switch-prompt">
              Don't have an account yet? 
              <button type="button" class="auth-link-action" id="link-goto-signup">Create an Account</button>
            </div>
          </div>

          <!-- SIGN UP / REGISTRATION FORM -->
          <div id="auth-signup-view" style="${this.currentTab === 'signup' ? '' : 'display: none;'}">
            <form id="register-form" class="auth-form" novalidate>
              <!-- Role Selection -->
              <div>
                <span class="auth-role-selector-label">Select Your Role</span>
                <div class="auth-role-grid" role="radiogroup">
                  <div
                    class="auth-role-card ${this.selectedRole === 'student' ? 'is-selected' : ''}"
                    data-role="student"
                    role="radio"
                    aria-checked="${this.selectedRole === 'student'}"
                    tabindex="0"
                  >
                    <span class="auth-role-card-icon">🎓</span>
                    <span class="auth-role-card-name">Student</span>
                  </div>
                  <div
                    class="auth-role-card ${this.selectedRole === 'lecturer' ? 'is-selected' : ''}"
                    data-role="lecturer"
                    role="radio"
                    aria-checked="${this.selectedRole === 'lecturer'}"
                    tabindex="0"
                  >
                    <span class="auth-role-card-icon">👨‍🏫</span>
                    <span class="auth-role-card-name">Lecturer</span>
                  </div>
                  <div
                    class="auth-role-card ${this.selectedRole === 'secretary' ? 'is-selected' : ''}"
                    data-role="secretary"
                    role="radio"
                    aria-checked="${this.selectedRole === 'secretary'}"
                    tabindex="0"
                  >
                    <span class="auth-role-card-icon">📋</span>
                    <span class="auth-role-card-name">Secretary</span>
                  </div>
                  <div
                    class="auth-role-card ${this.selectedRole === 'hod' ? 'is-selected' : ''}"
                    data-role="hod"
                    role="radio"
                    aria-checked="${this.selectedRole === 'hod'}"
                    tabindex="0"
                  >
                    <span class="auth-role-card-icon">🏛️</span>
                    <span class="auth-role-card-name">HOD</span>
                  </div>
                </div>
              </div>

              <!-- Full Name -->
              <div class="form-group">
                <label for="reg-fullname" class="form-label">Full Name</label>
                <input
                  type="text"
                  id="reg-fullname"
                  name="fullName"
                  class="form-control"
                  placeholder="e.g. Matthew Gana"
                  required
                />
              </div>

              <!-- Student Specific Fields -->
              <div id="reg-student-fields" style="${this.selectedRole === 'student' ? '' : 'display: none;'}">
                <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: var(--space-3); margin-bottom: var(--space-4);">
                  <div class="form-group" style="margin-bottom: 0;">
                    <label for="reg-matric" class="form-label">Matriculation No.</label>
                    <input
                      type="text"
                      id="reg-matric"
                      name="matricNumber"
                      class="form-control"
                      placeholder="e.g. U/22/CS/042"
                      required
                    />
                  </div>
                  <div class="form-group" style="margin-bottom: 0;">
                    <label for="reg-level" class="form-label">Academic Level</label>
                    <select id="reg-level" name="academicLevel" class="form-control">
                      <option value="100">100 Level</option>
                      <option value="200">200 Level</option>
                      <option value="300" selected>300 Level</option>
                      <option value="400">400 Level</option>
                    </select>
                  </div>
                </div>

                <div class="auth-info-banner" style="margin-bottom: var(--space-4);">
                  <span>ℹ️</span>
                  <span>A personalized Code 128 barcode badge will be auto-generated for lecture attendance verification.</span>
                </div>
              </div>

              <!-- Staff Specific Fields -->
              <div id="reg-staff-fields" style="${this.selectedRole !== 'student' ? '' : 'display: none;'}">
                <div class="form-group">
                  <label for="reg-username" class="form-label">Staff Username</label>
                  <input
                    type="text"
                    id="reg-username"
                    name="username"
                    class="form-control"
                    placeholder="e.g. m_gana or staff id"
                  />
                </div>
              </div>

              <!-- Email -->
              <div class="form-group">
                <label for="reg-email" class="form-label">Email Address</label>
                <input
                  type="email"
                  id="reg-email"
                  name="email"
                  class="form-control"
                  placeholder="e.g. name@university.edu"
                  required
                />
              </div>

              <!-- Password -->
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
                <div class="form-group">
                  <label for="reg-password" class="form-label">Password</label>
                  <div class="password-input-wrapper">
                    <input
                      type="password"
                      id="reg-password"
                      name="password"
                      class="form-control"
                      placeholder="Min. 6 chars"
                      required
                    />
                    <button
                      type="button"
                      class="password-toggle-btn"
                      data-toggle-password="reg-password"
                      aria-label="Show password"
                      title="Show password"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </div>
                </div>
                <div class="form-group">
                  <label for="reg-confirm-password" class="form-label">Confirm Password</label>
                  <div class="password-input-wrapper">
                    <input
                      type="password"
                      id="reg-confirm-password"
                      name="confirmPassword"
                      class="form-control"
                      placeholder="Re-type password"
                      required
                    />
                    <button
                      type="button"
                      class="password-toggle-btn"
                      data-toggle-password="reg-confirm-password"
                      aria-label="Show password"
                      title="Show password"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit" id="btn-register-submit" class="btn btn-primary btn-block btn-lg" style="margin-top: var(--space-2);">
                <span>Create Account & Enter Portal</span> &#8594;
              </button>
            </form>

            <div class="auth-switch-prompt">
              Already have an account? 
              <button type="button" class="auth-link-action" id="link-goto-signin">Sign In Here</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  setTab(tab) {
    this.currentTab = tab;
    const signinView = document.getElementById('auth-signin-view');
    const signupView = document.getElementById('auth-signup-view');
    const tabBtnSignin = document.getElementById('tab-btn-signin');
    const tabBtnSignup = document.getElementById('tab-btn-signup');

    if (tab === 'signin') {
      signinView.style.display = '';
      signupView.style.display = 'none';
      tabBtnSignin.classList.add('is-active');
      tabBtnSignup.classList.remove('is-active');
      tabBtnSignin.setAttribute('aria-selected', 'true');
      tabBtnSignup.setAttribute('aria-selected', 'false');
      document.getElementById('username')?.focus();
    } else {
      signinView.style.display = 'none';
      signupView.style.display = '';
      tabBtnSignin.classList.remove('is-active');
      tabBtnSignup.classList.add('is-active');
      tabBtnSignin.setAttribute('aria-selected', 'false');
      tabBtnSignup.setAttribute('aria-selected', 'true');
      document.getElementById('reg-fullname')?.focus();
    }
  },

  setRole(role) {
    this.selectedRole = role;
    document.querySelectorAll('.auth-role-card').forEach(card => {
      const isMatch = card.dataset.role === role;
      card.classList.toggle('is-selected', isMatch);
      card.setAttribute('aria-checked', isMatch ? 'true' : 'false');
    });

    const studentFields = document.getElementById('reg-student-fields');
    const staffFields = document.getElementById('reg-staff-fields');

    if (role === 'student') {
      if (studentFields) studentFields.style.display = '';
      if (staffFields) staffFields.style.display = 'none';
    } else {
      if (studentFields) studentFields.style.display = 'none';
      if (staffFields) staffFields.style.display = '';
    }
  },

  bindEvents() {
    // Tab switching
    document.getElementById('tab-btn-signin')?.addEventListener('click', () => this.setTab('signin'));
    document.getElementById('tab-btn-signup')?.addEventListener('click', () => this.setTab('signup'));
    document.getElementById('link-goto-signup')?.addEventListener('click', () => this.setTab('signup'));
    document.getElementById('link-goto-signin')?.addEventListener('click', () => this.setTab('signin'));

    // Password visibility toggles
    Util.initPasswordToggles();

    // Role card selection
    document.querySelectorAll('.auth-role-card').forEach(card => {
      card.addEventListener('click', () => {
        this.setRole(card.dataset.role);
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.setRole(card.dataset.role);
        }
      });
    });

    // Sign In form handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-login-submit');
        const username = document.getElementById('username')?.value.trim();
        const password = document.getElementById('password')?.value;

        if (!username || !password) {
          Notification.warning('Please enter both your username/email/matric number and password.');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Signing in...</span>`;

        try {
          await Auth.login(username, password);
          Notification.success(`Welcome back!`);
          window.location.hash = '#/dashboard';
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Sign In to Portal</span> &#8594;`;
        }
      });
    }

    // Sign Up form handler
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = document.getElementById('btn-register-submit');

        const fullName = document.getElementById('reg-fullname')?.value.trim();
        const email = document.getElementById('reg-email')?.value.trim();
        const password = document.getElementById('reg-password')?.value;
        const confirmPassword = document.getElementById('reg-confirm-password')?.value;
        const role = this.selectedRole;

        if (!fullName || !email || !password) {
          Notification.warning('Please fill in all required fields.');
          return;
        }

        if (password.length < 6) {
          Notification.warning('Password must be at least 6 characters.');
          return;
        }

        if (password !== confirmPassword) {
          Notification.warning('Passwords do not match. Please re-enter.');
          return;
        }

        const payload = {
          role,
          full_name: fullName,
          email,
          password
        };

        if (role === 'student') {
          const matricNumber = document.getElementById('reg-matric')?.value.trim();
          const academicLevel = document.getElementById('reg-level')?.value;

          if (!matricNumber) {
            Notification.warning('Please provide your Matriculation Number.');
            return;
          }

          payload.matric_number = matricNumber;
          payload.academic_level = academicLevel;
        } else {
          const username = document.getElementById('reg-username')?.value.trim();
          if (username) {
            payload.username = username;
          }
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>Creating account...</span>`;

        try {
          await Auth.register(payload);
          Notification.success(`Account created successfully! Welcome to the portal.`);
          window.location.hash = '#/dashboard';
        } catch (err) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>Create Account & Enter Portal</span> &#8594;`;
        }
      });
    }
  }
};
