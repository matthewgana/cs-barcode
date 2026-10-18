/**
 * Authentication & Session State Management
 */

import { Api } from './api.js';

let currentUser = null;

export const Auth = {
  getUser() {
    return currentUser;
  },

  setUser(user) {
    currentUser = user;
    window.dispatchEvent(new CustomEvent('auth:change', { detail: { user } }));
  },

  isAuthenticated() {
    return !!currentUser;
  },

  hasRole(...roles) {
    if (!currentUser) return false;
    return roles.includes(currentUser.role);
  },

  isHod() {
    return currentUser?.role === 'hod';
  },

  isLecturer() {
    return currentUser?.role === 'lecturer';
  },

  isSecretary() {
    return currentUser?.role === 'secretary';
  },

  isStudent() {
    return currentUser?.role === 'student';
  },

  async register(registrationData) {
    const res = await Api.post('/auth/register', registrationData);
    const user = res?.user || res?.data;
    if (user) {
      currentUser = {
        ...user,
        fullName: user.fullName || user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
      };
      window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser } }));
      return currentUser;
    }
    throw new Error('Registration failed');
  },

  async checkAuth() {
    try {
      const res = await Api.get('/auth/me', null, { silent: true });
      const user = res?.user || res?.data;
      if (user) {
        currentUser = {
          ...user,
          fullName: user.fullName || user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
        };
        return currentUser;
      }
      currentUser = null;
      return null;
    } catch {
      currentUser = null;
      return null;
    }
  },

  async login(username, password) {
    const res = await Api.post('/auth/login', { username, password });
    const user = res?.user || res?.data;
    if (user) {
      currentUser = {
        ...user,
        fullName: user.fullName || user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username
      };
      window.dispatchEvent(new CustomEvent('auth:login', { detail: { user: currentUser } }));
      return currentUser;
    }
    throw new Error('Login failed');
  },

  async logout() {
    try {
      await Api.post('/auth/logout', {});
    } catch {
      // Ignore network errors during logout
    } finally {
      currentUser = null;
      window.dispatchEvent(new CustomEvent('auth:logout'));
    }
  }
};
