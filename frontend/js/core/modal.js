/**
 * Dynamic Modal Dialog Manager
 */

export const Modal = {
  activeModal: null,

  show({ title, content, footer = '', size = 'md', onClose = null }) {
    this.close();

    const container = document.getElementById('modal-container');
    if (!container) return;

    const sizeClass = size !== 'md' ? `modal-dialog-${size}` : '';

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal-dialog ${sizeClass}" role="dialog" aria-modal="true" aria-labelledby="modal-title-text">
        <div class="modal-header">
          <h2 id="modal-title-text" class="modal-title">${title}</h2>
          <button class="modal-close" aria-label="Close dialog">&times;</button>
        </div>
        <div class="modal-body">
          ${typeof content === 'string' ? content : ''}
        </div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    `;

    if (typeof content !== 'string' && content instanceof HTMLElement) {
      backdrop.querySelector('.modal-body').appendChild(content);
    }

    const closeBtn = backdrop.querySelector('.modal-close');
    const doClose = () => {
      this.close();
      if (onClose) onClose();
    };

    closeBtn.addEventListener('click', doClose);
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) doClose();
    });

    const keyHandler = (e) => {
      if (e.key === 'Escape') {
        doClose();
        document.removeEventListener('keydown', keyHandler);
      }
    };
    document.addEventListener('keydown', keyHandler);

    container.appendChild(backdrop);
    // Trigger transition
    requestAnimationFrame(() => {
      backdrop.classList.add('is-open');
    });

    this.activeModal = backdrop;
    return backdrop;
  },

  close() {
    if (this.activeModal) {
      this.activeModal.classList.remove('is-open');
      const modalToRemove = this.activeModal;
      setTimeout(() => {
        if (modalToRemove.parentElement) {
          modalToRemove.parentElement.removeChild(modalToRemove);
        }
      }, 200);
      this.activeModal = null;
    }
  }
};
