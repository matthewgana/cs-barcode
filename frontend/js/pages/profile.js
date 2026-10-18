/**
 * Profile & Passport Management Page Controller
 * Allows Students, Lecturers, Secretary, and HOD to update their contact info,
 * upload or snap their official passport photo, and change passwords.
 */

import { Api } from '../core/api.js';
import { Auth } from '../core/auth.js';
import { Util } from '../core/utilities.js';
import { Notification } from '../core/notifications.js';
import { Modal } from '../core/modal.js';
import { IdCardPrinter } from '../components/id-card-printer.js';

export const ProfilePage = {
  profileData: null,
  pendingPhotoDataUrl: undefined, // undefined = unchanged, null = removed, string = new data url
  cameraStream: null,

  async render() {
    try {
      const res = await Api.get('/auth/profile');
      this.profileData = res.data || {};
      this.pendingPhotoDataUrl = undefined;
    } catch (err) {
      return `
        <div class="page-wrapper">
          <div class="empty-state">
            <div class="empty-state-icon">⚠️</div>
            <h3 class="empty-state-title">Failed to load profile</h3>
            <p class="empty-state-desc">${Util.escapeHtml(err.message)}</p>
            <button class="btn btn-outline" onclick="location.reload()">Retry</button>
          </div>
        </div>
      `;
    }

    const p = this.profileData;
    const isStudent = p.isStudent;
    const student = p.student || {};
    const currentPhoto = p.photoUrl;
    const initials = (p.fullName || 'User').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
    const roleBadge = Util.escapeHtml((p.role || '').toUpperCase());

    return `
      <div class="page-wrapper">
        <div class="page-header">
          <div class="page-header-title">
            <h1>Account Profile &amp; Security</h1>
            <p>Manage your official identity details, passport photograph, and credentials.</p>
          </div>
          <div class="page-actions">
            <a href="#/dashboard" class="btn btn-outline">
              <span>&larr;</span> Back to Dashboard
            </a>
            ${isStudent ? `
              <button type="button" class="btn btn-primary" id="btn-print-preview-profile">
                <span>🖨️</span> Print ID Card
              </button>
            ` : ''}
          </div>
        </div>

        <div class="grid grid-3" style="gap: var(--space-6); align-items: start;">
          
          <!-- Column 1: Passport Photo & Identity Card Preview (1 col) -->
          <div style="display: flex; flex-direction: column; gap: var(--space-5);">
            
            <!-- Passport Photo Card -->
            <div class="card" style="padding: var(--space-6); text-align: center;">
              <h3 class="card-title" style="margin-bottom: var(--space-4); text-align: left;">
                ${isStudent ? 'Student Passport Photo' : 'Official Profile Photo'}
              </h3>
              
              <!-- Photo Stage -->
              <div style="margin: 0 auto var(--space-4); position: relative; width: 140px; height: 168px;">
                <div id="passport-preview-box" style="
                  width: 140px;
                  height: 168px;
                  border-radius: var(--radius-lg);
                  background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 60%, #93c5fd 100%);
                  border: 3px solid var(--color-primary);
                  box-shadow: 0 10px 25px rgba(14, 165, 233, 0.25);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  overflow: hidden;
                  font-size: 3rem;
                  font-weight: 900;
                  color: #0369a1;
                  position: relative;
                ">
                  ${currentPhoto ? `
                    <img id="passport-img-preview" src="${currentPhoto}" alt="Passport Photo" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
                  ` : `
                    <span id="passport-initials-preview">${initials}</span>
                  `}
                </div>

                <div style="position: absolute; bottom: -8px; right: -8px; background: #10b981; color: #ffffff; border-radius: 50%; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; font-size: 14px; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.15);" title="Active Verification">
                  ✓
                </div>
              </div>

              <!-- Upload Buttons & Controls -->
              <div style="display: flex; flex-direction: column; gap: 8px;">
                <input type="file" id="input-passport-file" accept="image/jpeg,image/png,image/webp" style="display: none;" />
                
                <button type="button" class="btn btn-primary btn-sm" id="btn-trigger-upload">
                  <span>📁</span> Upload Photo File
                </button>
                
                <button type="button" class="btn btn-outline btn-sm" id="btn-open-camera">
                  <span>📷</span> Take Photo with Camera
                </button>

                <button type="button" class="btn btn-ghost btn-sm" id="btn-remove-photo" style="color: var(--color-danger); ${currentPhoto ? '' : 'display: none;'}">
                  <span>🗑️</span> Remove Photo
                </button>
              </div>

              <!-- Upload Drag & Drop Zone -->
              <div id="passport-dropzone" style="
                margin-top: var(--space-4);
                border: 2px dashed var(--color-border);
                border-radius: var(--radius-md);
                padding: var(--space-3);
                font-size: var(--font-size-xs);
                color: var(--color-text-secondary);
                cursor: pointer;
                transition: all 0.2s ease;
                background: var(--color-surface-hover);
              ">
                Drag &amp; drop an image here<br>
                <span style="font-size: 0.7rem; color: var(--color-text-muted);">(JPEG, PNG, WebP &bull; Max 5MB)</span>
              </div>

              <div style="margin-top: var(--space-4); text-align: left; background: rgba(14, 165, 233, 0.08); padding: var(--space-3); border-radius: var(--radius-md); border-left: 3px solid var(--color-primary);">
                <p style="margin: 0; font-size: 0.72rem; color: var(--color-text-secondary); line-height: 1.4;">
                  <strong>Passport Guidelines:</strong> Use a clear, front-facing headshot. This photo is printed on your official University ID Card and Lecture Entry Badge.
                </p>
              </div>
            </div>

            <!-- Role Badge Information -->
            <div class="card" style="padding: var(--space-5);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="text-muted" style="font-size: var(--font-size-xs); font-weight: 700; text-transform: uppercase;">Portal Account Role</span>
                <span class="badge badge-info">${roleBadge}</span>
              </div>
              <div style="margin-top: var(--space-2); font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                Username: <strong>${Util.escapeHtml(p.username)}</strong> &bull; Member since: <strong>${Util.formatDate(p.createdAt)}</strong>
              </div>
            </div>

          </div>

          <!-- Column 2 & 3: Profile Form & Password Security (2 cols) -->
          <div style="grid-column: span 2; display: flex; flex-direction: column; gap: var(--space-5);">
            
            <!-- Personal & Academic Information Card -->
            <div class="card" style="padding: var(--space-6);">
              <div class="card-header" style="margin-bottom: var(--space-4); padding: 0; border: none;">
                <div>
                  <h3 class="card-title" style="margin: 0 0 4px;">Personal &amp; Department Information</h3>
                  <p class="text-muted" style="margin: 0; font-size: var(--font-size-xs);">
                    ${isStudent ? 'Official academic registration records and contact details' : 'Faculty staff directory details and office contacts'}
                  </p>
                </div>
              </div>

              <form id="profile-form">
                
                ${isStudent ? `
                  <!-- Student Specific Fields -->
                  <div class="grid grid-2" style="gap: var(--space-4); margin-bottom: var(--space-4);">
                    <div class="form-group">
                      <label class="form-label" for="profile-full-name">
                        Full Name <span class="badge badge-neutral" style="font-size: 0.65rem;">Official Record</span>
                      </label>
                      <input type="text" id="profile-full-name" class="form-control" value="${Util.escapeHtml(p.fullName)}" readonly style="background: var(--color-surface-hover); cursor: not-allowed;" />
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="profile-matric">
                        Matriculation Number <span class="badge badge-neutral" style="font-size: 0.65rem;">🔒 Locked</span>
                      </label>
                      <input type="text" id="profile-matric" class="form-control" value="${Util.escapeHtml(student.matricNumber || '—')}" readonly style="background: var(--color-surface-hover); cursor: not-allowed; font-family: var(--font-family-mono); font-weight: 700; color: #0369a1;" />
                    </div>
                  </div>

                  <div class="grid grid-2" style="gap: var(--space-4); margin-bottom: var(--space-4);">
                    <div class="form-group">
                      <label class="form-label" for="profile-level">
                        Academic Cohort <span class="badge badge-neutral" style="font-size: 0.65rem;">🔒 Verified</span>
                      </label>
                      <input type="text" id="profile-level" class="form-control" value="${student.academicLevel ? `${student.academicLevel} Level` : '100 Level'}" readonly style="background: var(--color-surface-hover); cursor: not-allowed; font-weight: 700;" />
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="profile-barcode">
                        Attendance Barcode <span class="badge badge-neutral" style="font-size: 0.65rem;">🔒 Code 128</span>
                      </label>
                      <input type="text" id="profile-barcode" class="form-control" value="${Util.escapeHtml(student.barcodeValue || '—')}" readonly style="background: var(--color-surface-hover); cursor: not-allowed; font-family: var(--font-family-mono); font-weight: 700;" />
                    </div>
                  </div>
                ` : `
                  <!-- Staff Specific Fields -->
                  <div class="grid grid-3" style="gap: var(--space-4); margin-bottom: var(--space-4);">
                    <div class="form-group">
                      <label class="form-label" for="profile-title">Title</label>
                      <select id="profile-title" class="form-control">
                        <option value="" ${!p.title ? 'selected' : ''}>None</option>
                        <option value="Dr." ${p.title === 'Dr.' ? 'selected' : ''}>Dr.</option>
                        <option value="Prof." ${p.title === 'Prof.' ? 'selected' : ''}>Prof.</option>
                        <option value="Engr." ${p.title === 'Engr.' ? 'selected' : ''}>Engr.</option>
                        <option value="Mr." ${p.title === 'Mr.' ? 'selected' : ''}>Mr.</option>
                        <option value="Mrs." ${p.title === 'Mrs.' ? 'selected' : ''}>Mrs.</option>
                        <option value="Ms." ${p.title === 'Ms.' ? 'selected' : ''}>Ms.</option>
                      </select>
                    </div>

                    <div class="form-group" style="grid-column: span 2;">
                      <label class="form-label" for="profile-full-name">Full Name *</label>
                      <input type="text" id="profile-full-name" class="form-control" value="${Util.escapeHtml(p.fullName)}" required />
                    </div>
                  </div>

                  <div class="form-group" style="margin-bottom: var(--space-4);">
                    <label class="form-label" for="profile-office">Office Location / Lab</label>
                    <input type="text" id="profile-office" class="form-control" placeholder="e.g. CS Building, 2nd Floor, Room 204" value="${Util.escapeHtml(p.officeLocation || '')}" />
                  </div>
                `}

                <!-- Shared Contact Fields -->
                <div class="grid grid-2" style="gap: var(--space-4); margin-bottom: var(--space-4);">
                  <div class="form-group">
                    <label class="form-label" for="profile-phone">
                      Phone Number <span class="required">*</span>
                    </label>
                    <input type="tel" id="profile-phone" class="form-control" placeholder="e.g. 08012345678" value="${Util.escapeHtml(p.phone || '')}" />
                    <span style="font-size: 0.7rem; color: var(--color-text-muted);">Used for SMS alerts and department notices</span>
                  </div>

                  <div class="form-group">
                    <label class="form-label" for="profile-email">
                      Official Email Address <span class="badge badge-neutral" style="font-size: 0.65rem;">🔒 Primary</span>
                    </label>
                    <input type="email" id="profile-email" class="form-control" value="${Util.escapeHtml(p.email)}" readonly style="background: var(--color-surface-hover); cursor: not-allowed;" />
                  </div>
                </div>

                <!-- Password Change Section -->
                <div style="margin-top: var(--space-6); padding-top: var(--space-5); border-top: 1px solid var(--color-border);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-3);">
                    <div>
                      <h4 style="margin: 0 0 2px; font-size: var(--font-size-sm); color: var(--color-text-primary);">
                        Security &amp; Password Update
                      </h4>
                      <p style="margin: 0; font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                        Leave password fields blank if you do not wish to change your password.
                      </p>
                    </div>
                  </div>

                  <div class="grid grid-3" style="gap: var(--space-4);">
                    <div class="form-group">
                      <label class="form-label" for="profile-current-pass">Current Password</label>
                      <div class="password-input-wrapper">
                        <input type="password" id="profile-current-pass" class="form-control" placeholder="Current password" autocomplete="current-password" />
                        <button type="button" class="password-toggle-btn" aria-label="Toggle password visibility">👁️</button>
                      </div>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="profile-new-pass">New Password</label>
                      <div class="password-input-wrapper">
                        <input type="password" id="profile-new-pass" class="form-control" placeholder="At least 6 characters" autocomplete="new-password" />
                        <button type="button" class="password-toggle-btn" aria-label="Toggle password visibility">👁️</button>
                      </div>
                    </div>

                    <div class="form-group">
                      <label class="form-label" for="profile-confirm-pass">Confirm Password</label>
                      <div class="password-input-wrapper">
                        <input type="password" id="profile-confirm-pass" class="form-control" placeholder="Repeat new password" autocomplete="new-password" />
                        <button type="button" class="password-toggle-btn" aria-label="Toggle password visibility">👁️</button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Save Action Buttons -->
                <div style="margin-top: var(--space-6); display: flex; justify-content: flex-end; gap: var(--space-3); border-top: 1px solid var(--color-border); padding-top: var(--space-5);">
                  <a href="#/dashboard" class="btn btn-outline">Cancel</a>
                  <button type="submit" class="btn btn-primary" id="btn-save-profile">
                    <span>💾</span> Save Profile &amp; Photo
                  </button>
                </div>

              </form>
            </div>

          </div>
        </div>
      </div>
    `;
  },

  bindEvents() {
    Util.initPasswordToggles();

    const fileInput = document.getElementById('input-passport-file');
    const triggerUploadBtn = document.getElementById('btn-trigger-upload');
    const dropzone = document.getElementById('passport-dropzone');
    const removeBtn = document.getElementById('btn-remove-photo');
    const openCameraBtn = document.getElementById('btn-open-camera');
    const form = document.getElementById('profile-form');
    const printPreviewBtn = document.getElementById('btn-print-preview-profile');

    // Print button from profile header
    if (printPreviewBtn && this.profileData?.student) {
      printPreviewBtn.addEventListener('click', () => {
        const s = {
          ...this.profileData.student,
          fullName: this.profileData.fullName,
          photoUrl: this.pendingPhotoDataUrl !== undefined ? this.pendingPhotoDataUrl : this.profileData.photoUrl,
        };
        IdCardPrinter.printStudentIdCard(s);
      });
    }

    // Trigger file dialog
    triggerUploadBtn?.addEventListener('click', () => fileInput?.click());
    dropzone?.addEventListener('click', () => fileInput?.click());

    // File input change
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) this.processImageFile(file);
    });

    // Drag and drop handlers
    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.style.borderColor = 'var(--color-primary)';
          dropzone.style.background = 'rgba(14, 165, 233, 0.1)';
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.style.borderColor = 'var(--color-border)';
          dropzone.style.background = 'var(--color-surface-hover)';
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file) this.processImageFile(file);
      });
    }

    // Remove photo
    removeBtn?.addEventListener('click', () => {
      this.pendingPhotoDataUrl = null;
      const previewBox = document.getElementById('passport-preview-box');
      if (previewBox) {
        const initials = (this.profileData.fullName || 'User').split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
        previewBox.innerHTML = `<span id="passport-initials-preview">${initials}</span>`;
      }
      removeBtn.style.display = 'none';
      Notification.info('Photo removed. Click "Save Profile" to apply changes.');
    });

    // Camera capture modal
    openCameraBtn?.addEventListener('click', () => {
      this.openCameraModal();
    });

    // Form submit
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveProfile();
    });
  },

  /**
   * Reads, crops, and compresses an image file to optimal passport aspect ratio (400x480)
   */
  processImageFile(file) {
    if (!file.type.startsWith('image/')) {
      Notification.error('Please select a valid image file (JPEG, PNG, WebP).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      Notification.error('Image is too large. Maximum file size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create canvas with 400 x 480 passport dimensions
        const canvas = document.createElement('canvas');
        canvas.width = 400;
        canvas.height = 480;
        const ctx = canvas.getContext('2d');

        // Center crop to 400:480 (aspect ratio 5:6)
        const targetAspect = 400 / 480;
        const imgAspect = img.width / img.height;

        let sx, sy, sw, sh;
        if (imgAspect > targetAspect) {
          // Source is wider than target
          sh = img.height;
          sw = img.height * targetAspect;
          sx = (img.width - sw) / 2;
          sy = 0;
        } else {
          // Source is taller than target
          sw = img.width;
          sh = img.width / targetAspect;
          sx = 0;
          sy = (img.height - sh) / 2;
        }

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, 400, 480);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        this.pendingPhotoDataUrl = dataUrl;

        // Update preview in DOM
        const previewBox = document.getElementById('passport-preview-box');
        if (previewBox) {
          previewBox.innerHTML = `<img id="passport-img-preview" src="${dataUrl}" alt="Passport Photo" style="width: 100%; height: 100%; object-fit: cover; display: block;" />`;
        }

        const removeBtn = document.getElementById('btn-remove-photo');
        if (removeBtn) removeBtn.style.display = 'inline-flex';

        Notification.success('Passport photo processed! Click "Save Profile" to update your ID Card.');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  },

  /**
   * Opens live webcam modal to snap a passport photo
   */
  async openCameraModal() {
    const modalContent = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 14px;">
        <div style="position: relative; width: 320px; height: 384px; border-radius: 12px; overflow: hidden; background: #000; box-shadow: 0 8px 24px rgba(0,0,0,0.3);">
          <video id="webcam-video" autoplay playsinline style="width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1);"></video>
          
          <!-- Face outline guide -->
          <div style="position: absolute; top: 12%; left: 15%; right: 15%; bottom: 15%; border: 2px dashed rgba(255,255,255,0.7); border-radius: 50% 50% 45% 45%; pointer-events: none; box-shadow: 0 0 0 9999px rgba(0,0,0,0.35);"></div>
          
          <div style="position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; color: #fff; font-size: 11px; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
            Position head within the oval
          </div>
        </div>

        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn btn-primary" id="btn-snap-photo">
            <span>📸</span> Capture Passport
          </button>
          <button type="button" class="btn btn-outline" id="btn-cancel-camera">
            Cancel
          </button>
        </div>
      </div>
    `;

    Modal.show({
      title: 'Take Passport Photo',
      content: modalContent,
      size: 'md',
      onClose: () => {
        this.stopCamera();
      }
    });

    const videoEl = document.getElementById('webcam-video');
    const snapBtn = document.getElementById('btn-snap-photo');
    const cancelBtn = document.getElementById('btn-cancel-camera');

    cancelBtn?.addEventListener('click', () => {
      this.stopCamera();
      Modal.close();
    });

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false
      });
      if (videoEl) {
        videoEl.srcObject = this.cameraStream;
      }
    } catch (err) {
      console.error('Camera access error:', err);
      Modal.close();
      Notification.error('Could not access camera. Please check camera permissions or upload an image file instead.');
      return;
    }

    snapBtn?.addEventListener('click', () => {
      if (!videoEl) return;
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 480;
      const ctx = canvas.getContext('2d');

      // Mirror horizontally
      ctx.translate(400, 0);
      ctx.scale(-1, 1);

      // Crop center to 400x480
      const vWidth = videoEl.videoWidth || 640;
      const vHeight = videoEl.videoHeight || 480;
      const targetAspect = 400 / 480;
      let sw = vHeight * targetAspect;
      let sh = vHeight;
      let sx = (vWidth - sw) / 2;
      let sy = 0;

      ctx.drawImage(videoEl, sx, sy, sw, sh, 0, 0, 400, 480);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

      this.pendingPhotoDataUrl = dataUrl;

      // Update preview in DOM
      const previewBox = document.getElementById('passport-preview-box');
      if (previewBox) {
        previewBox.innerHTML = `<img id="passport-img-preview" src="${dataUrl}" alt="Passport Photo" style="width: 100%; height: 100%; object-fit: cover; display: block;" />`;
      }

      const removeBtn = document.getElementById('btn-remove-photo');
      if (removeBtn) removeBtn.style.display = 'inline-flex';

      this.stopCamera();
      Modal.close();
      Notification.success('Snapshot captured! Click "Save Profile" to finalize.');
    });
  },

  stopCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(track => track.stop());
      this.cameraStream = null;
    }
  },

  onDestroy() {
    this.stopCamera();
  },

  /**
   * Sends updated profile fields and photo to the server
   */
  async saveProfile() {
    const saveBtn = document.getElementById('btn-save-profile');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = `<span class="splash-spinner" style="width: 16px; height: 16px; display: inline-block;"></span> Saving...`;
    }

    try {
      const phoneInput = document.getElementById('profile-phone');
      const fullNameInput = document.getElementById('profile-full-name');
      const titleSelect = document.getElementById('profile-title');
      const officeInput = document.getElementById('profile-office');
      const currentPassInput = document.getElementById('profile-current-pass');
      const newPassInput = document.getElementById('profile-new-pass');
      const confirmPassInput = document.getElementById('profile-confirm-pass');

      const currentPass = currentPassInput?.value || '';
      const newPass = newPassInput?.value || '';
      const confirmPass = confirmPassInput?.value || '';

      if (newPass) {
        if (newPass.length < 6) {
          Notification.error('New password must be at least 6 characters long.');
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<span>💾</span> Save Profile &amp; Photo`;
          }
          return;
        }

        if (newPass !== confirmPass) {
          Notification.error('New password and confirmation do not match.');
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<span>💾</span> Save Profile &amp; Photo`;
          }
          return;
        }

        if (!currentPass) {
          Notification.error('Please enter your current password to authorize changing it.');
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<span>💾</span> Save Profile &amp; Photo`;
          }
          return;
        }
      }

      const payload = {
        phone: phoneInput?.value || '',
      };

      if (this.pendingPhotoDataUrl !== undefined) {
        payload.photo_url = this.pendingPhotoDataUrl;
      }

      if (this.profileData.role !== 'student') {
        if (fullNameInput) payload.full_name = fullNameInput.value.trim();
        if (titleSelect) payload.title = titleSelect.value;
        if (officeInput) payload.office_location = officeInput.value.trim();
      }

      if (newPass) {
        payload.current_password = currentPass;
        payload.new_password = newPass;
      }

      const res = await Api.patch('/auth/profile', payload);

      if (res.user) {
        Auth.setUser(res.user);
      }

      Notification.success('Profile and passport photo updated successfully!');

      // Clear password inputs
      if (currentPassInput) currentPassInput.value = '';
      if (newPassInput) newPassInput.value = '';
      if (confirmPassInput) confirmPassInput.value = '';

      this.pendingPhotoDataUrl = undefined;
    } catch (err) {
      Notification.error(err.message || 'Failed to update profile.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<span>💾</span> Save Profile &amp; Photo`;
      }
    }
  }
};
