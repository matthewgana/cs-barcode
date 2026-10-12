# Computer Science Department Online Barcode Attendance System

### Full-Stack Academic Attendance MVP (100L – 400L)
**Tech Stack**: Node.js &bull; Express.js &bull; PostgreSQL &bull; bwip-js &bull; Vanilla HTML5 &bull; CSS3 Design System &bull; Vanilla ES Modules

---

## 📌 Project Overview

A secure, full-stack, production-grade attendance management system designed specifically for a University **Computer Science Department**. The application automates student attendance tracking across four academic cohorts:
- **100 Level (Year 1)**
- **200 Level (Year 2)**
- **300 Level (Year 3)**
- **400 Level (Year 4 - Final Year)**

Students are issued unique **Code 128 barcodes** embedded into their student ID cards. Attendance is captured in real time via **Handheld USB Barcode Scanners (Keyboard Wedge)** or **Device Webcams** using in-browser barcode decoding.

---

## 🚀 Key Features

### 1. Dual Barcode Scanning Modes
- **Hardware USB Scanner Mode**: High-speed, focus-free buffer listener capturing rapid keystrokes (< 50ms intervals) terminated with an enter carriage return. Zero clicking required during lectures.
- **Live Camera Scanner Mode**: Built-in webcam barcode scanning with aiming reticle, active laser animation, and continuous frame decoding.
- **Instant Audio & Visual Feedback**: Distinct audio cues (high beep for valid scan, double tone for duplicate attempt, error buzz for invalid scan) paired with color-coded feedback banners (green for Present, amber for Late, red for Error/Unenrolled).
- **Duplicate Scan Prevention**: Database row locking (`FOR UPDATE`) within transaction blocks preventing race conditions and double check-ins.

### 2. Multi-Role RBAC (Role-Based Access Control)
- **Head of Department (HOD)**:
  - Complete departmental overview and real-time attendance analytics
  - Course curriculum management across all 4 levels
  - Lecturer course allocation and coordinator designations
  - Staff account administration (HOD, Lecturers, Secretary)
  - Full audit trail and manual attendance correction overrides
- **Lecturers**:
  - Start, monitor, close, and finalize lecture attendance sessions
  - Live scanning dashboard for scheduled courses
  - Grace period configuration with automatic lateness marking
  - Finalize sessions (automatically flags enrolled students who missed class as Absent)
- **Departmental Secretary**:
  - Student registration and cohort enrollment management
  - Code 128 barcode generation, regeneration, and ID badge printing
  - Academic session and semester calendar administration
  - Departmental attendance reports and CSV export

### 3. State-of-the-Art Vanilla UI Design System
- Built without bulky JavaScript frameworks (no React, Vue, Angular, or Tailwind)
- Native CSS custom properties token system (Sky-Blue `#0ea5e9`, Off-White `#f8fafc`, Orange Accent `#f97316`)
- Seamless Light / Dark theme toggling persisted in `localStorage`
- Accessible focus indicators, keyboard navigation, and responsive typography

---

## 🗄️ Database Architecture (PostgreSQL)

The database schema (`src/db/schema.sql`) implements relational integrity with foreign keys, constraints, and performance indexes:
- `users`: Staff accounts with bcrypt password hashes and roles (`hod`, `lecturer`, `secretary`)
- `students`: Matriculation numbers, cohorts (`100`, `200`, `300`, `400`), email, and unique `barcode_value`
- `academic_sessions`: Academic years (e.g., `2025/2026`) with current flag
- `semesters`: First / Second semesters
- `courses`: Computer science curriculum courses and credit units
- `lecturer_assignments`: Course teaching assignments and coordinators
- `student_course_enrollments`: Student course registrations
- `attendance_sessions`: Lecture sessions with date, time window, status, and grace periods
- `attendance_records`: Scan timestamps, check-in method (`usb`, `camera`, `manual_correction`), and status (`present`, `late`, `absent`, `excused`)
- `attendance_corrections`: Audited history of manual attendance status adjustments
- `audit_logs`: Immutable security log of all system actions
- `session`: Persistent PostgreSQL session store via `connect-pg-simple`

---

## 🔑 Demo Credentials

All test accounts share the password: `Password123!`

| Role | Username | Full Name | Access Scope |
| :--- | :--- | :--- | :--- |
| **HOD** | `hod` | Prof. Babatunde Lawal | Full Department Administrative Control |
| **Lecturer** | `lecturer1` | Dr. Adebayo Ogunlesi | CSC 201 & CSC 301 Sessions & Scanning |
| **Lecturer** | `lecturer2` | Dr. Chioma Okonkwo | CSC 101 & CSC 203 Sessions & Scanning |
| **Lecturer** | `lecturer3` | Mr. Faruq Abubakar | CSC 303 & CSC 401 Sessions & Scanning |
| **Secretary** | `secretary` | Mrs. Funmilayo Adeleke | Student Registration, Enrollments, Reports |

---

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js** (v18+ or v22 LTS recommended)
- **PostgreSQL** (v14+ running locally or remotely)

### 1. Configure Environment Variables
Create or verify `.env` in the project root:
```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=cs_attendance_db
DB_USER=postgres
DB_PASSWORD=
SESSION_SECRET=cs_dept_super_secret_session_key_2026_secure
CORS_ORIGIN=http://localhost:3000
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Database Migrations & Seed Data
```bash
npm run migrate
npm run seed
```

### 4. Start the Application
```bash
# Production / Standard run:
npm start

# Development with hot-reload:
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 5. Run Automated Test Suite
```bash
npm test
```

---

## 📡 Key REST API Endpoints

### Authentication
- `POST /api/auth/login` — Sign in and initialize session
- `POST /api/auth/logout` — Terminate session
- `GET /api/auth/me` — Current authenticated user profile

### Students & Barcodes
- `GET /api/students` — Filter by level, matric number, or name
- `POST /api/students` — Register student and generate barcode
- `GET /api/students/:id/barcode?format=svg|png` — Vector/raster barcode render
- `POST /api/students/:id/regenerate-barcode` — Rotate barcode value

### Attendance Sessions & Scanning
- `GET /api/sessions` — List lecture attendance sessions
- `POST /api/sessions` — Create attendance session
- `POST /api/sessions/:id/open` — Open session for active barcode scanning
- `POST /api/sessions/:id/close` — Close session
- `POST /api/sessions/:id/finalize` — Finalize session (automatically records absent students)
- `POST /api/attendance/scan` — Submit barcode scan (USB or Camera) with duplicate protection

### Analytics, Reports & Audit
- `GET /api/dashboard/stats` — Live role-aware department statistics
- `GET /api/reports` — Filtered attendance records
- `GET /api/reports/export` — Download official CSV attendance report
- `GET /api/audit/logs` — Immutable audit trail of department operations
- `GET /api/audit/corrections` — History of manual attendance overrides
