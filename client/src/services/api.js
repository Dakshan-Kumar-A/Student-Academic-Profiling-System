import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercept requests to attach Authorization header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth endpoints
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  verifyTempPassword: (data) => api.post('/auth/verify-temp-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  setFirstPassword: (data) => api.post('/auth/set-first-password', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.put('/auth/profile', data),
};

// Admin endpoints
export const adminAPI = {
  getStats: () => api.get('/admin/stats'),
  getUsers: (params) => api.get('/admin/users', { params }),
  createUser: (data) => api.post('/admin/users', data),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  resendInvite: (id) => api.post(`/admin/users/${id}/resend-invite`),
  bulkUploadUsers: (formData) =>
    api.post('/admin/users/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getLogs: (params) => api.get('/admin/logs', { params }),
  clearLogs: (data) => api.delete('/admin/logs/clear', { data }),
  getTemplates: (params) => api.get('/admin/templates', { params }),
  createTemplate: (data) => api.post('/admin/templates', data),
  updateTemplate: (id, data) => api.put(`/admin/templates/${id}`, data),
  deleteTemplate: (id) => api.delete(`/admin/templates/${id}`),
  addSemesterSlot: (data) => api.post('/admin/templates/semester/add', data),
};

// Department Coordinator endpoints
export const coordinatorAPI = {
  getAnalytics: (params) => api.get('/coordinator/analytics', { params }),
  getStudents: (params) => api.get('/coordinator/students', { params }),
  getStudentById: (id) => api.get(`/coordinator/students/${id}`),
  createStudent: (data) => api.post('/coordinator/students', data),
  updateStudent: (id, data) => api.put(`/coordinator/students/${id}`, data),
  deleteStudent: (id) => api.delete(`/coordinator/students/${id}`),
  bulkUploadStudents: (formData) =>
    api.post('/coordinator/students/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getMentors: (params) => api.get('/coordinator/mentors', { params }),
  createMentor: (data) => api.post('/coordinator/mentors', data),
  updateMentor: (id, data) => api.put(`/coordinator/mentors/${id}`, data),
  deleteMentor: (id) => api.delete(`/coordinator/mentors/${id}`),
  assignMentor: (data) => api.post('/coordinator/assign-mentor', data),
  exportExcel: (params) =>
    api.get('/coordinator/export-excel', {
      params,
      responseType: 'blob',
    }),
  exportCustomExcel: (data) =>
    api.post('/coordinator/export-excel', data, {
      responseType: 'blob',
    }),
  getDrives: (params) => api.get('/coordinator/drives', { params }),
  createDrive: (data) => api.post('/coordinator/drives', data),
  updateDrive: (id, data) => api.put(`/coordinator/drives/${id}`, data),
  deleteDrive: (id) => api.delete(`/coordinator/drives/${id}`),
  addDriveRole: (driveId, data) => api.post(`/coordinator/drives/${driveId}/roles`, data),
  updateDriveRole: (driveId, roleId, data) => api.put(`/coordinator/drives/${driveId}/roles/${roleId}`, data),
  deleteDriveRole: (driveId, roleId) => api.delete(`/coordinator/drives/${driveId}/roles/${roleId}`),
  optInDrive: (driveId, data) => api.post(`/coordinator/drives/${driveId}/opt-in`, data),
  optOutDrive: (driveId, data) => api.post(`/coordinator/drives/${driveId}/opt-out`, data),
  getDriveExportExcelUrl: (driveId) => `/api/coordinator/drives/${driveId}/export-excel`,
  downloadDriveExcel: (driveId) => api.get(`/coordinator/drives/${driveId}/export-excel`, { responseType: 'blob' }),
  updateRemarks: (studentId, data) => api.put(`/coordinator/students/${studentId}/remarks`, data),
  getMessages: () => api.get('/coordinator/messages'),
  sendMessage: (data) => api.post('/coordinator/messages', data),
  replyMessage: (id, data) => api.post(`/coordinator/messages/${id}/reply`, data),
};

// Department Mentor endpoints
export const mentorAPI = {
  getAnalytics: (params) => api.get('/mentor/analytics', { params }),
  getStudents: (params) => api.get('/mentor/students', { params }),
  getStudentById: (id) => api.get(`/mentor/students/${id}`),
  exportCustomExcel: (data) =>
    api.post('/mentor/export-excel', data, {
      responseType: 'blob',
    }),
  updateRemarks: (studentId, data) => api.put(`/mentor/students/${studentId}/remarks`, data),
  getCommunicationRecipients: () => api.get('/mentor/communication/recipients'),
  getMessages: () => api.get('/mentor/messages'),
  sendMessage: (data) => api.post('/mentor/messages', data),
  replyMessage: (id, data) => api.post(`/mentor/messages/${id}/reply`, data),
  updateProfile: (data) => api.put('/mentor/profile', data),
};

// Ticket Support System endpoints
export const ticketAPI = {
  getTickets: (params) => api.get('/tickets', { params }),
  getTicketById: (id) => api.get(`/tickets/${id}`),
  createTicket: (data) => api.post('/tickets', data),
  replyTicket: (id, data) => api.post(`/tickets/${id}/reply`, data),
  updateStatus: (id, data) => api.put(`/tickets/${id}/status`, data),
};

// Placement Officer Portal endpoints
export const placementAPI = {
  getPolicy: (params) => api.get('/placement/policy', { params }),
  savePolicy: (data) => api.post('/placement/policy', data),
  getAnalytics: (params) => api.get('/placement/analytics', { params }),
  getStudents: (params) => api.get('/placement/students', { params }),
  getDrives: (params) => api.get('/placement/drives', { params }),
  createDrive: (data) => api.post('/placement/drives', data),
  updateDrive: (id, data) => api.put(`/placement/drives/${id}`, data),
  deleteDrive: (id) => api.delete(`/placement/drives/${id}`),
  getEvaluations: (driveId) => api.get(`/placement/drives/${driveId}/evaluations`),
  updateEvaluation: (driveId, data) => api.put(`/placement/drives/${driveId}/evaluations`, data),
  updateDriveRounds: (driveId, data) => api.put(`/placement/drives/${driveId}/rounds`, data),
  getUnwillingnessForm: () => api.get('/placement/unwillingness/form'),
  saveUnwillingnessForm: (data) => api.post('/placement/unwillingness/form', data),
  submitUnwillingness: (data) => api.post('/placement/unwillingness/submit', data),
  getUnwillingnessSubmissions: (params) => api.get('/placement/unwillingness/submissions', { params }),
  permitPlacementSwitch: (submissionId) => api.put(`/placement/unwillingness/${submissionId}/permit-placement`),
  updateRemarks: (studentId, data) => api.put(`/placement/students/${studentId}/remarks`, data),
  downloadDriveExcel: (driveId) => api.get(`/placement/drives/${driveId}/export-excel`, { responseType: 'blob' }),
  downloadMasterTrackingExcel: (params) => api.get('/placement/export-master-tracking', { params, responseType: 'blob' }),
  downloadUnwillingnessExcel: (params) => api.get('/placement/unwillingness/export-excel', { params, responseType: 'blob' }),
  getChannelMessages: (params) => api.get('/placement/communication/messages', { params }),
  postChannelMessage: (data) => api.post('/placement/communication/messages', data),
  replyChannelMessage: (id, data) => api.post(`/placement/communication/messages/${id}/reply`, data),
};

// 5 System Excels Engine endpoints
export const excelAPI = {
  downloadExcel1_QSGauge: (params) => api.get('/excels/1-qs-gauge', { params, responseType: 'blob' }),
  downloadExcel2_Custom: (data) => api.post('/excels/2-custom-export', data, { responseType: 'blob' }),
  downloadExcel3_Drives: (params) => api.get('/excels/3-drives-detail', { params, responseType: 'blob' }),
  downloadExcel4_Master: (params) => api.get('/excels/4-master-tracking', { params, responseType: 'blob' }),
  downloadExcel5_UnwillingnessPlaced: (params) => api.get('/excels/5-unwillingness-and-placed', { params, responseType: 'blob' }),
};

// Student Portal endpoints
export const studentAPI = {
  getProfile: () => api.get('/student/profile'),
  updateProfile: (data) => api.put('/student/profile', data),
  getDrives: () => api.get('/student/drives'),
  optInDrive: (id, data) => api.post(`/student/drives/${id}/opt-in`, data),
  optOutDrive: (id) => api.post(`/student/drives/${id}/opt-out`),
  getUnwillingnessForm: () => api.get('/student/unwillingness'),
  submitUnwillingnessForm: (data) => api.post('/student/unwillingness', data),
  getMessages: (params) => api.get('/student/communication/messages', { params }),
  postMessage: (data) => api.post('/student/communication/messages', data),
  replyMessage: (id, data) => api.post(`/student/communication/messages/${id}/reply`, data),
  uploadResume: (formData) =>
    api.post('/student/resume', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

// Notification endpoints
export const notificationAPI = {
  getNotifications: () => api.get('/notifications'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
};

export default api;
