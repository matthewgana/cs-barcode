/**
 * General Utilities & Helpers
 */

export const Util = {
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  },

  formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  },

  formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  },

  formatTime(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  },

  debounce(func, wait = 300) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  getLevelBadge(level) {
    if (!level) return '<span class="badge badge-neutral">All Levels</span>';
    const lvl = String(level).replace(/\D/g, '') || '100';
    return `<span class="badge badge-level-${lvl}">${lvl} Level</span>`;
  },

  getStatusBadge(status) {
    switch (status?.toLowerCase()) {
      case 'present':
        return '<span class="badge badge-success"><span class="badge-dot"></span> Present</span>';
      case 'late':
        return '<span class="badge badge-warning"><span class="badge-dot"></span> Late</span>';
      case 'absent':
        return '<span class="badge badge-danger"><span class="badge-dot"></span> Absent</span>';
      case 'excused':
        return '<span class="badge badge-info"><span class="badge-dot"></span> Excused</span>';
      case 'open':
      case 'active':
        return '<span class="badge badge-success"><span class="badge-dot"></span> Active</span>';
      case 'closed':
        return '<span class="badge badge-warning"><span class="badge-dot"></span> Closed</span>';
      case 'finalized':
        return '<span class="badge badge-neutral"><span class="badge-dot"></span> Finalized</span>';
      default:
        return `<span class="badge badge-neutral">${Util.escapeHtml(status || 'Unknown')}</span>`;
    }
  },

  // Audio feedback for barcode scanning
  playBeep(type = 'success') {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(1800, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'duplicate') {
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        // Error beep (low buzz)
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch {
      // AudioContext may be blocked before user gesture
    }
  },

  downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
};
