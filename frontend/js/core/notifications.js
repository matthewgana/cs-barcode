/**
 * Notification / Toast Service
 */

const icons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ'
};

export const Notification = {
  show(message, type = 'info', title = null, duration = 4000) {
    const container = document.getElementById('notification-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = icons[type] || '•';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'toast-content';

    if (title) {
      const titleDiv = document.createElement('div');
      titleDiv.className = 'toast-title';
      titleDiv.textContent = title;
      contentDiv.appendChild(titleDiv);
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = 'toast-message';
    messageDiv.textContent = message;
    contentDiv.appendChild(messageDiv);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close notification');
    closeBtn.onclick = () => this.dismiss(toast);

    toast.appendChild(iconSpan);
    toast.appendChild(contentDiv);
    toast.appendChild(closeBtn);

    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(toast);
      }, duration);
    }

    return toast;
  },

  dismiss(toast) {
    if (!toast || toast.classList.contains('toast-removing')) return;
    toast.classList.add('toast-removing');
    setTimeout(() => {
      if (toast.parentElement) {
        toast.parentElement.removeChild(toast);
      }
    }, 200);
  },

  success(msg, title = 'Success') {
    return this.show(msg, 'success', title);
  },

  error(msg, title = 'Error') {
    return this.show(msg, 'error', title, 6000);
  },

  warning(msg, title = 'Warning') {
    return this.show(msg, 'warning', title, 5000);
  },

  info(msg, title = 'Info') {
    return this.show(msg, 'info', title);
  }
};
