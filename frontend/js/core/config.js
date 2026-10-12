/**
 * Application Configuration
 */

export const CONFIG = {
  API_BASE_URL: '/api',
  APP_NAME: 'CS Attendance System',
  DEPARTMENT: 'Department of Computer Science',
  LEVELS: [
    { value: '100', label: '100 Level (Year 1)', color: '#3b82f6' },
    { value: '200', label: '200 Level (Year 2)', color: '#10b981' },
    { value: '300', label: '300 Level (Year 3)', color: '#f59e0b' },
    { value: '400', label: '400 Level (Year 4)', color: '#8b5cf6' }
  ],
  ROLES: {
    HOD: 'hod',
    LECTURER: 'lecturer',
    SECRETARY: 'secretary'
  },
  ITEMS_PER_PAGE: 10
};
