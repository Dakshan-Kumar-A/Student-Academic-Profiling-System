import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { adminAPI, ticketAPI } from '../services/api';
import Navbar from '../components/Navbar';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function AdminDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'staff' | 'logs' | 'deletions'
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Dashboard Filters
  const [dashboardDept, setDashboardDept] = useState('all');
  const [dashboardStartDate, setDashboardStartDate] = useState('');
  const [dashboardEndDate, setDashboardEndDate] = useState('');

  // Staff State
  const [staffList, setStaffList] = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffSearch, setStaffSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'department_coordinator',
    department: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Bulk Upload State
  const [excelFile, setExcelFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

  // System Logs State
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedLogDetail, setSelectedLogDetail] = useState(null);

  // Log Filters
  const [logStartDate, setLogStartDate] = useState('');
  const [logEndDate, setLogEndDate] = useState('');
  const [logIsError, setLogIsError] = useState('');
  const [logLevel, setLogLevel] = useState('all');
  const [logModule, setLogModule] = useState('all');
  const [logSearch, setLogSearch] = useState('');
  const [logPage, setLogPage] = useState(1);
  const [logPagination, setLogPagination] = useState({ totalPages: 1, totalCount: 0 });

  // Ticket System State
  const [ticketsList, setTicketsList] = useState([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketTypeFilter, setTicketTypeFilter] = useState('all');
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketCounts, setTicketCounts] = useState({ total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 });
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [ticketReplyText, setTicketReplyText] = useState('');
  const [sendingTicketReply, setSendingTicketReply] = useState(false);

  // Field & Template Management State
  const [templatesList, setTemplatesList] = useState([]);
  const [templatesGrouped, setTemplatesGrouped] = useState({});
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [newFieldData, setNewFieldData] = useState({
    fieldKey: '',
    fieldName: '',
    category: 'student_profile',
    fieldType: 'text',
    isRequired: false,
    description: '',
  });
  const [newSemNumber, setNewSemNumber] = useState(5);
  const [activatingSemester, setActivatingSemester] = useState(false);

  // Load Dashboard Stats with Filters
  const loadStats = async () => {
    setStatsLoading(true);
    try {
      const params = {
        department: dashboardDept,
        startDate: dashboardStartDate,
        endDate: dashboardEndDate,
      };
      const res = await adminAPI.getStats(params);
      if (res.data.success) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Load Staff List
  const loadStaff = async () => {
    setStaffLoading(true);
    try {
      const res = await adminAPI.getUsers({
        search: staffSearch,
        role: roleFilter,
        department: deptFilter,
      });
      if (res.data.success) {
        setStaffList(res.data.users);
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setStaffLoading(false);
    }
  };

  // Load Logs
  const loadLogs = async (page = 1) => {
    setLogsLoading(true);
    try {
      const params = {
        page,
        limit: 25,
        startDate: logStartDate,
        endDate: logEndDate,
        isError: logIsError,
        level: logLevel,
        module: logModule,
        search: logSearch,
      };
      const res = await adminAPI.getLogs(params);
      if (res.data.success) {
        setLogs(res.data.logs);
        setLogPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load logs:', err);
    } finally {
      setLogsLoading(false);
    }
  };

  // Load Tickets
  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      const res = await ticketAPI.getTickets({
        ticketType: ticketTypeFilter,
        status: ticketStatusFilter,
        search: ticketSearch,
      });
      if (res.data.success) {
        setTicketsList(res.data.tickets);
        setTicketCounts(res.data.counts);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setTicketsLoading(false);
    }
  };

  // Load Templates
  const loadTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const res = await adminAPI.getTemplates();
      if (res.data.success) {
        setTemplatesList(res.data.fields);
        setTemplatesGrouped(res.data.grouped);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setTemplatesLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
    loadStaff();
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') loadStats();
    if (activeTab === 'staff') loadStaff();
    if (activeTab === 'logs') loadLogs(logPage);
    if (activeTab === 'tickets') loadTickets();
    if (activeTab === 'templates') loadTemplates();
  }, [activeTab, logPage, logIsError, logLevel, logModule, ticketTypeFilter, ticketStatusFilter]);

  // Reply to ticket
  const handleReplyTicket = async (e) => {
    e.preventDefault();
    if (!ticketReplyText.trim() || !selectedTicket) return;
    setSendingTicketReply(true);
    try {
      const res = await ticketAPI.replyTicket(selectedTicket._id, { content: ticketReplyText.trim() });
      if (res.data.success) {
        setSelectedTicket(res.data.ticket);
        setTicketReplyText('');
        loadTickets();
        Swal.fire({
          icon: 'success',
          title: 'Reply Sent',
          text: 'Response delivered to user and cross-posted to Communication Hub.',
          timer: 1800,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to send reply', 'error');
    } finally {
      setSendingTicketReply(false);
    }
  };

  // Update ticket status
  const handleUpdateTicketStatus = async (ticketId, newStatus) => {
    try {
      const res = await ticketAPI.updateStatus(ticketId, { status: newStatus });
      if (res.data.success) {
        if (selectedTicket && selectedTicket._id === ticketId) {
          setSelectedTicket(res.data.ticket);
        }
        loadTickets();
        Swal.fire({
          icon: 'success',
          title: 'Status Updated',
          text: `Ticket status set to ${newStatus}.`,
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update status', 'error');
    }
  };

  // Create new template field
  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      const res = await adminAPI.createTemplate(newFieldData);
      if (res.data.success) {
        setShowAddFieldModal(false);
        setNewFieldData({
          fieldKey: '',
          fieldName: '',
          category: 'student_profile',
          fieldType: 'text',
          isRequired: false,
          description: '',
        });
        loadTemplates();
        Swal.fire('Success', res.data.message, 'success');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to create field', 'error');
    }
  };

  // Delete template field
  const handleDeleteTemplate = async (fieldId, fieldName) => {
    const result = await Swal.fire({
      title: 'Remove Template Field?',
      text: `Are you sure you want to remove '${fieldName}' from templates?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, Delete',
    });

    if (result.isConfirmed) {
      try {
        const res = await adminAPI.deleteTemplate(fieldId);
        if (res.data.success) {
          loadTemplates();
          Swal.fire('Deleted!', res.data.message, 'success');
        }
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Failed to delete field', 'error');
      }
    }
  };

  // Activate semester SGPA slot
  const handleActivateSemester = async (e) => {
    e.preventDefault();
    setActivatingSemester(true);
    try {
      const res = await adminAPI.addSemesterSlot({ semesterNumber: newSemNumber });
      if (res.data.success) {
        loadTemplates();
        Swal.fire({
          icon: 'success',
          title: `Semester ${newSemNumber} Slot Activated`,
          text: res.data.message,
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to activate semester slot', 'error');
    } finally {
      setActivatingSemester(false);
    }
  };

  // Create Staff
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await adminAPI.createUser(formData);
      if (res.data.success) {
        setShowAddModal(false);
        setFormData({ name: '', email: '', role: 'department_coordinator', department: '' });
        loadStaff();
        loadStats();

        let alertHtml = `<p>${res.data.message}</p>`;
        if (res.data.demoTempPassword) {
          alertHtml += `<div class="p-2 bg-light border rounded text-dark font-monospace mt-2">
            <strong>Single-Use Temp Password:</strong> ${res.data.demoTempPassword}
          </div>`;
        }

        Swal.fire({
          icon: 'success',
          title: 'Account Created & Email Sent',
          html: alertHtml,
          confirmButtonColor: '#1e3a8a',
        });
      }
    } catch (err) {
      Swal.fire('Creation Failed', err.response?.data?.message || 'Could not create user.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Update Staff
  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);
    try {
      const res = await adminAPI.updateUser(selectedUser._id, formData);
      if (res.data.success) {
        setShowEditModal(false);
        setSelectedUser(null);
        loadStaff();
        Swal.fire('Updated', 'User details updated successfully.', 'success');
      }
    } catch (err) {
      Swal.fire('Update Failed', err.response?.data?.message || 'Could not update user.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Staff
  const handleDeleteStaff = (u) => {
    Swal.fire({
      title: 'Delete Staff Account?',
      html: `Are you sure you want to delete <strong>${u.name}</strong> (${u.email})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, Delete',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await adminAPI.deleteUser(u._id);
          if (res.data.success) {
            Swal.fire('Deleted!', res.data.message, 'success');
            loadStaff();
            loadStats();
          }
        } catch (err) {
          Swal.fire('Failed', err.response?.data?.message || 'Delete operation failed', 'error');
        }
      }
    });
  };

  // Resend 24-hr Temp Password
  const handleResendInvite = (u) => {
    Swal.fire({
      title: 'Resend Invitation?',
      text: `Generate a new single-use 24-hour temporary password and dispatch it to ${u.email}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1e3a8a',
      confirmButtonText: 'Yes, Resend Email',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await adminAPI.resendInvite(u._id);
          if (res.data.success) {
            let msg = res.data.message;
            if (res.data.demoTempPassword) {
              msg += `\n[New Temp Password]: ${res.data.demoTempPassword}`;
            }
            Swal.fire('Invitation Resent', msg, 'success');
            loadStaff();
          }
        } catch (err) {
          Swal.fire('Error', err.response?.data?.message || 'Failed to resend invitation.', 'error');
        }
      }
    });
  };

  // Toggle Active/Inactive status
  const handleToggleStatus = async (u) => {
    const nextStatus = u.status === 'active' ? 'inactive' : 'active';
    try {
      await adminAPI.updateUser(u._id, { status: nextStatus });
      loadStaff();
      loadStats();
    } catch (err) {
      Swal.fire('Error', 'Failed to toggle status.', 'error');
    }
  };

  // Bulk Upload Handler
  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      Swal.fire('File Required', 'Please select an Excel (.xlsx/.xls) or CSV file.', 'warning');
      return;
    }
    const formDataUpload = new FormData();
    formDataUpload.append('file', excelFile);
    setBulkUploading(true);
    setBulkResults(null);
    try {
      const res = await adminAPI.bulkUploadUsers(formDataUpload);
      if (res.data.success) {
        setBulkResults(res.data.results);
        loadStaff();
        loadStats();
        Swal.fire('Bulk Import Completed', `Processed ${res.data.results.totalRows} rows. Created ${res.data.results.createdCount} accounts.`, 'success');
      }
    } catch (err) {
      Swal.fire('Bulk Import Failed', err.response?.data?.message || 'Failed to process spreadsheet.', 'error');
    } finally {
      setBulkUploading(false);
    }
  };

  // ------------------------------------------
  // CHART DATA DEFINITIONS
  // ------------------------------------------
  // 1. Department Breakdown Bar Chart
  const departmentChartData = {
    labels: stats?.departmentBreakdown?.map((d) => d._id) || [],
    datasets: [
      {
        label: 'Students Count',
        data: stats?.departmentBreakdown?.map((d) => d.studentsCount) || [],
        backgroundColor: '#3b82f6',
        borderRadius: 4,
      },
      {
        label: 'Staff Count (Coordinators & Mentors)',
        data: stats?.departmentBreakdown?.map((d) => d.staffCount) || [],
        backgroundColor: '#10b981',
        borderRadius: 4,
      },
    ],
  };

  // 2. Role Composition Doughnut Chart
  const roleChartData = {
    labels: stats?.roleDistribution ? Object.keys(stats.roleDistribution) : [],
    datasets: [
      {
        data: stats?.roleDistribution ? Object.values(stats.roleDistribution) : [],
        backgroundColor: ['#0284c7', '#059669', '#14b8a6', '#f59e0b', '#7c3aed'],
        borderWidth: 2,
      },
    ],
  };

  // 3. 7-Day Activity & Error Trend
  const trendChartData = {
    labels: stats?.activityTrend?.map((t) => t.label) || [],
    datasets: [
      {
        label: 'Total Activity Logs',
        data: stats?.activityTrend?.map((t) => t.totalEvents) || [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.3,
        fill: true,
      },
      {
        label: 'System Errors',
        data: stats?.activityTrend?.map((t) => t.errorEvents) || [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        tension: 0.3,
        fill: true,
      },
    ],
  };

  return (
    <div className="min-vh-100 bg-light">
      <Navbar user={user} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* ADMIN SUB-NAVBAR WITH FILTER CONTROLS */}
      <div className="bg-white border-bottom shadow-sm px-3 py-2 sticky-top">
        <div className="container-fluid d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="btn-group btn-group-sm">
            <button
              className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('overview')}
            >
              <i className="bi bi-graph-up-arrow me-1"></i> Visual Overview & Charts
            </button>
            <button
              className={`btn ${activeTab === 'staff' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('staff')}
            >
              <i className="bi bi-people-fill me-1"></i> Staff Directory ({staffList.length})
            </button>
            <button
              className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('logs')}
            >
              <i className="bi bi-journal-code me-1"></i> Activity Logs & Errors
            </button>
            <button
              className={`btn ${activeTab === 'tickets' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('tickets')}
            >
              <i className="bi bi-ticket-detailed-fill me-1"></i> Tickets & Support {ticketCounts.open > 0 && <span className="badge bg-danger ms-1">{ticketCounts.open}</span>}
            </button>
            <button
              className={`btn ${activeTab === 'templates' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('templates')}
            >
              <i className="bi bi-sliders me-1"></i> Field & Template Hub
            </button>
          </div>

          {activeTab === 'overview' && (
            <div className="d-flex align-items-center gap-2">
              <span className="small text-muted fw-semibold d-none d-md-inline">Filter Dashboard:</span>
              <select
                className="form-select form-select-sm"
                style={{ width: '160px' }}
                value={dashboardDept}
                onChange={(e) => setDashboardDept(e.target.value)}
              >
                <option value="all">All Departments</option>
                <option value="CSE">CSE</option>
                <option value="ECE">ECE</option>
                <option value="MECH">MECH</option>
                <option value="IT">IT</option>
                <option value="EEE">EEE</option>
                <option value="CIVIL">CIVIL</option>
              </select>
              <button className="btn btn-sm btn-primary" onClick={loadStats}>
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="container-fluid py-4 px-md-4">
        {/* ======================================================== */}
        {/* TAB 1: VISUAL OVERVIEW & CHARTS */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <div>
            {statsLoading || !stats ? (
              <div className="text-center py-5 text-muted">
                <span className="spinner-border text-primary me-2"></span> Loading dashboard visual metrics...
              </div>
            ) : (
              <div>
                {/* TOP METRIC CARDS ROW */}
                <div className="row g-3 mb-4">
                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-primary border-4 p-3 bg-white">
                      <span className="text-muted small text-uppercase fw-semibold">Total Accounts</span>
                      <h3 className="fw-bold mb-0 text-primary mt-1">{stats.totalUsers}</h3>
                      <small className="text-muted">Registered in System</small>
                    </div>
                  </div>
                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-success border-4 p-3 bg-white">
                      <span className="text-muted small text-uppercase fw-semibold">Active Users</span>
                      <h3 className="fw-bold mb-0 text-success mt-1">{stats.activeUsers}</h3>
                      <small className="text-muted">{stats.inactiveUsers} Inactive</small>
                    </div>
                  </div>
                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-info border-4 p-3 bg-white">
                      <span className="text-muted small text-uppercase fw-semibold">Placement Officers</span>
                      <h3 className="fw-bold mb-0 text-info mt-1">{stats.totalOfficers}</h3>
                      <small className="text-muted">Campus Cell</small>
                    </div>
                  </div>
                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-teal border-4 p-3 bg-white" style={{ borderLeftColor: '#059669' }}>
                      <span className="text-muted small text-uppercase fw-semibold">Dept Coordinators</span>
                      <h3 className="fw-bold mb-0 text-success mt-1">{stats.totalCoordinators}</h3>
                      <small className="text-muted">{stats.totalMentors} Mentors</small>
                    </div>
                  </div>
                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-warning border-4 p-3 bg-white">
                      <span className="text-muted small text-uppercase fw-semibold">Total Students</span>
                      <h3 className="fw-bold mb-0 text-dark mt-1">{stats.totalStudents}</h3>
                      <small className="text-muted">Enrolled Profiles</small>
                    </div>
                  </div>
                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-danger border-4 p-3 bg-white">
                      <span className="text-muted small text-uppercase fw-semibold">Errors (24h)</span>
                      <h3 className="fw-bold mb-0 text-danger mt-1">{stats.recentErrors}</h3>
                      <small className="text-muted">{stats.totalLogs} Total Logs</small>
                    </div>
                  </div>
                </div>

                {/* VISUAL CHARTS & GRAPHS SECTION */}
                <div className="row g-4 mb-4">
                  {/* Bar Chart: Department Distribution */}
                  <div className="col-12 col-lg-8">
                    <div className="card shadow-sm border-0 rounded-3 h-100">
                      <div className="card-header bg-white py-3 fw-bold text-dark border-bottom d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-bar-chart-fill text-primary me-2"></i> Department-Wise Student & Staff Breakdown</span>
                        <span className="badge bg-light text-muted border">Filtered: {dashboardDept}</span>
                      </div>
                      <div className="card-body p-4" style={{ height: '320px' }}>
                        <Bar
                          data={departmentChartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'top' } },
                            scales: { y: { beginAtZero: true } },
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Doughnut Chart: Institutional Role Distribution */}
                  <div className="col-12 col-lg-4">
                    <div className="card shadow-sm border-0 rounded-3 h-100">
                      <div className="card-header bg-white py-3 fw-bold text-dark border-bottom">
                        <i className="bi bi-pie-chart-fill text-success me-2"></i> Role Composition
                      </div>
                      <div className="card-body p-4 d-flex align-items-center justify-content-center" style={{ height: '320px' }}>
                        <Doughnut
                          data={roleChartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'bottom' } },
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Line Chart: 7-Day Activity & Error Trend */}
                  <div className="col-12">
                    <div className="card shadow-sm border-0 rounded-3">
                      <div className="card-header bg-white py-3 fw-bold text-dark border-bottom">
                        <i className="bi bi-activity text-danger me-2"></i> 7-Day System Activity vs. Error Trend
                      </div>
                      <div className="card-body p-4" style={{ height: '280px' }}>
                        <Line
                          data={trendChartData}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'top' } },
                            scales: { y: { beginAtZero: true } },
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: STAFF DIRECTORY */}
        {/* ======================================================== */}
        {activeTab === 'staff' && (
          <div className="card shadow-sm border-0 rounded-3">
            <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h5 className="fw-bold mb-0 text-slate-800">
                  <i className="bi bi-people-fill text-primary me-2"></i> Placement Officers & Department Coordinators
                </h5>
                <span className="text-muted small">
                  Manage authorized staff, dispatch 24-hr temporary passwords, and onboard via Excel.
                </span>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-outline-success btn-sm"
                  onClick={() => setShowBulkModal(true)}
                >
                  <i className="bi bi-file-earmark-excel me-1"></i> Bulk Excel Upload
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setFormData({ name: '', email: '', role: 'department_coordinator', department: '' });
                    setShowAddModal(true);
                  }}
                >
                  <i className="bi bi-person-plus-fill me-1"></i> Add Faculty / Officer
                </button>
              </div>
            </div>

            {/* Filter toolbar */}
            <div className="p-3 bg-light border-bottom">
              <div className="row g-2 align-items-center">
                <div className="col-12 col-md-4">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search name, email, department..."
                      value={staffSearch}
                      onChange={(e) => setStaffSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadStaff()}
                    />
                    <button className="btn btn-outline-secondary" onClick={loadStaff}>Search</button>
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="">All Roles</option>
                    <option value="placement_officer">Placement Officers</option>
                    <option value="department_coordinator">Department Coordinators</option>
                  </select>
                </div>

                <div className="col-6 col-md-2">
                  <select
                    className="form-select form-select-sm"
                    value={deptFilter}
                    onChange={(e) => setDeptFilter(e.target.value)}
                  >
                    <option value="">All Departments</option>
                    <option value="CSE">CSE</option>
                    <option value="IT">IT</option>
                    <option value="ECE">ECE</option>
                    <option value="EEE">EEE</option>
                    <option value="MECH">MECH</option>
                    <option value="Placement Cell">Placement Cell</option>
                  </select>
                </div>

                <div className="col-6 col-md-2">
                  <button
                    className="btn btn-sm btn-primary w-100 fw-semibold shadow-sm"
                    onClick={loadStaff}
                  >
                    <i className="bi bi-funnel-fill me-1"></i> Apply Filters
                  </button>
                </div>

                <div className="col-6 col-md-1">
                  <button
                    className="btn btn-sm btn-outline-secondary w-100"
                    onClick={() => {
                      setStaffSearch('');
                      setRoleFilter('');
                      setDeptFilter('');
                      loadStaff();
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-muted small text-uppercase">
                  <tr>
                    <th>Staff Name & Email</th>
                    <th>Role</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Password Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffLoading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-4 text-muted">Loading staff members...</td>
                    </tr>
                  ) : staffList.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-5 text-muted">No staff found matching criteria.</td>
                    </tr>
                  ) : (
                    staffList.map((u) => (
                      <tr key={u._id}>
                        <td>
                          <div className="fw-semibold text-dark">{u.name}</div>
                          <div className="text-muted small">{u.email}</div>
                        </td>
                        <td>
                          <span className={`badge ${u.role === 'placement_officer' ? 'badge-role-officer' : 'badge-role-coordinator'}`}>
                            {u.role === 'placement_officer' ? 'Placement Officer' : 'Dept Coordinator'}
                          </span>
                        </td>
                        <td><span className="fw-semibold text-secondary">{u.department || '—'}</span></td>
                        <td>
                          <button
                            onClick={() => handleToggleStatus(u)}
                            className={`badge border-0 cursor-pointer ${u.status === 'active' ? 'bg-success' : 'bg-secondary'}`}
                          >
                            {u.status === 'active' ? 'Active' : 'Inactive'}
                          </button>
                        </td>
                        <td>
                          {u.mustChangePassword ? (
                            <span className="badge bg-warning text-dark"><i className="bi bi-clock me-1"></i>Pending First Login</span>
                          ) : (
                            <span className="badge bg-light text-success border"><i className="bi bi-check-circle-fill me-1"></i>Permanent Set</span>
                          )}
                        </td>
                        <td className="text-end">
                          <div className="btn-group btn-group-sm">
                            <button
                              className="btn btn-outline-primary"
                              onClick={() => handleResendInvite(u)}
                              title="Resend 24-hr Temp Password"
                            >
                              <i className="bi bi-envelope-arrow-up"></i>
                            </button>
                            <button
                              className="btn btn-outline-secondary"
                              onClick={() => {
                                setSelectedUser(u);
                                setFormData({
                                  name: u.name,
                                  email: u.email,
                                  role: u.role,
                                  department: u.department || '',
                                });
                                setShowEditModal(true);
                              }}
                              title="Edit user details"
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button
                              className="btn btn-outline-danger"
                              onClick={() => handleDeleteStaff(u)}
                              title="Delete user"
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: LOGS & ERRORS */}
        {/* ======================================================== */}
        {activeTab === 'logs' && (
          <div className="card shadow-sm border-0 rounded-3">
            <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <h5 className="fw-bold mb-0 text-slate-800">
                <i className="bi bi-journal-code text-danger me-2"></i> System Logs & Error Diagnostics
              </h5>
              <button className="btn btn-outline-primary btn-sm" onClick={() => loadLogs(logPage)}>
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
              </button>
            </div>

            {/* Filter toolbar */}
            <div className="p-3 bg-light border-bottom">
              <div className="row g-2 align-items-center">
                <div className="col-12 col-md-3">
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={logStartDate}
                    onChange={(e) => setLogStartDate(e.target.value)}
                  />
                </div>
                <div className="col-12 col-md-3">
                  <input
                    type="date"
                    className="form-control form-control-sm"
                    value={logEndDate}
                    onChange={(e) => setLogEndDate(e.target.value)}
                  />
                </div>
                <div className="col-6 col-md-2">
                  <select
                    className="form-select form-select-sm"
                    value={logIsError}
                    onChange={(e) => setLogIsError(e.target.value)}
                  >
                    <option value="">All Events</option>
                    <option value="true">⚠️ Errors Only</option>
                    <option value="false">Normal Events</option>
                  </select>
                </div>
                <div className="col-6 col-md-2">
                  <select
                    className="form-select form-select-sm"
                    value={logLevel}
                    onChange={(e) => setLogLevel(e.target.value)}
                  >
                    <option value="all">All Levels</option>
                    <option value="error">Error</option>
                    <option value="warn">Warn</option>
                    <option value="info">Info</option>
                  </select>
                </div>
                <div className="col-12 col-md-2">
                  <button className="btn btn-primary btn-sm w-100" onClick={() => loadLogs(1)}>
                    Filter Logs
                  </button>
                </div>
              </div>
            </div>

            {/* Logs Table */}
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 font-monospace small">
                <thead className="table-light text-muted small text-uppercase">
                  <tr>
                    <th>Timestamp</th>
                    <th>Level</th>
                    <th>Module</th>
                    <th>Action</th>
                    <th>Message</th>
                    <th>Performed By</th>
                    <th className="text-end">Inspect</th>
                  </tr>
                </thead>
                <tbody>
                  {logsLoading ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4 text-muted">Loading logs...</td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-5 text-muted">No logs match the current filters.</td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr key={log._id} className={log.isError ? 'log-row-error' : ''}>
                        <td className="text-nowrap text-secondary">{new Date(log.timestamp).toLocaleString()}</td>
                        <td>
                          <span className={`badge ${log.isError ? 'bg-danger' : 'bg-info'}`}>
                            {log.level.toUpperCase()}
                          </span>
                        </td>
                        <td><span className="badge bg-light text-dark border">{log.module}</span></td>
                        <td className="fw-bold">{log.action}</td>
                        <td className="text-truncate" style={{ maxWidth: '300px' }}>{log.message}</td>
                        <td className="small text-muted">{log.performedBy?.name || 'System'}</td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-secondary py-0 px-2"
                            onClick={() => setSelectedLogDetail(log)}
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: TICKETS & SUPPORT DESK */}
        {/* ======================================================== */}
        {activeTab === 'tickets' && (
          <div className="space-y-4">
            {/* KPI Cards */}
            <div className="row g-3 mb-3">
              <div className="col-12 col-md-3">
                <div className="card shadow-sm border-0 border-start border-danger border-4 p-3 bg-white">
                  <span className="text-muted small fw-bold text-uppercase">Open Tickets</span>
                  <h3 className="fw-bold text-danger mb-0 mt-1">{ticketCounts.open || 0}</h3>
                  <small className="text-muted">Awaiting administrator response</small>
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="card shadow-sm border-0 border-start border-warning border-4 p-3 bg-white">
                  <span className="text-muted small fw-bold text-uppercase">In Progress</span>
                  <h3 className="fw-bold text-warning mb-0 mt-1">{ticketCounts.inProgress || 0}</h3>
                  <small className="text-muted">Under investigation / active discussion</small>
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="card shadow-sm border-0 border-start border-success border-4 p-3 bg-white">
                  <span className="text-muted small fw-bold text-uppercase">Resolved</span>
                  <h3 className="fw-bold text-success mb-0 mt-1">{ticketCounts.resolved || 0}</h3>
                  <small className="text-muted">Successfully addressed</small>
                </div>
              </div>
              <div className="col-12 col-md-3">
                <div className="card shadow-sm border-0 border-start border-primary border-4 p-3 bg-white">
                  <span className="text-muted small fw-bold text-uppercase">Total Raised</span>
                  <h3 className="fw-bold text-primary mb-0 mt-1">{ticketCounts.total || 0}</h3>
                  <small className="text-muted">All lifetime tickets</small>
                </div>
              </div>
            </div>

            {/* Ticket Management Card */}
            <div className="card shadow-sm border-0 rounded-3">
              <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
                <h5 className="fw-bold mb-0 text-slate-800">
                  <i className="bi bi-ticket-detailed-fill text-primary me-2"></i> Support & Feature Requests Desk
                </h5>
                <button className="btn btn-outline-primary btn-sm" onClick={loadTickets}>
                  <i className="bi bi-arrow-clockwise me-1"></i> Refresh Tickets
                </button>
              </div>

              {/* Filters */}
              <div className="p-3 bg-light border-bottom">
                <div className="row g-2 align-items-center">
                  <div className="col-12 col-md-4">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text"><i className="bi bi-search"></i></span>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Search ticket #, subject, raiser..."
                        value={ticketSearch}
                        onChange={(e) => setTicketSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadTickets()}
                      />
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={ticketTypeFilter}
                      onChange={(e) => setTicketTypeFilter(e.target.value)}
                    >
                      <option value="all">All Ticket Types</option>
                      <option value="problem_fix">Problem / Bug Fix (All Users)</option>
                      <option value="feature_modification">Feature / Modification (Officers & Coordinators)</option>
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={ticketStatusFilter}
                      onChange={(e) => setTicketStatusFilter(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="Open">Open</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Closed">Closed</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-2">
                    <button className="btn btn-primary btn-sm w-100" onClick={loadTickets}>
                      Apply Filters
                    </button>
                  </div>
                </div>
              </div>

              {/* Tickets Table */}
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light text-muted small text-uppercase">
                    <tr>
                      <th>Ticket #</th>
                      <th>Type</th>
                      <th>Subject & Snippet</th>
                      <th>Submitted By</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ticketsLoading ? (
                      <tr><td colSpan="8" className="text-center py-4 text-muted">Loading tickets...</td></tr>
                    ) : ticketsList.length === 0 ? (
                      <tr><td colSpan="8" className="text-center py-5 text-muted">No tickets match the criteria.</td></tr>
                    ) : (
                      ticketsList.map((t) => (
                        <tr key={t._id}>
                          <td className="fw-bold font-monospace text-primary">{t.ticketNumber}</td>
                          <td>
                            <span className={`badge ${t.ticketType === 'feature_modification' ? 'bg-purple text-white' : 'bg-secondary'}`} style={{ backgroundColor: t.ticketType === 'feature_modification' ? '#7c3aed' : undefined }}>
                              {t.ticketType === 'feature_modification' ? 'Feature / Mod' : 'Problem / Fix'}
                            </span>
                          </td>
                          <td style={{ maxWidth: '300px' }}>
                            <div className="fw-semibold text-dark text-truncate">{t.subject}</div>
                            <div className="small text-muted text-truncate">{t.description}</div>
                          </td>
                          <td>
                            <div className="fw-semibold small">{t.raisedBy.name}</div>
                            <div className="badge bg-light text-dark border font-monospace" style={{ fontSize: '10px' }}>
                              {t.raisedBy.role.replace('_', ' ')}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${t.priority === 'Critical' ? 'bg-danger' : t.priority === 'High' ? 'bg-warning text-dark' : 'bg-info text-dark'}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${t.status === 'Open' ? 'bg-danger' : t.status === 'In Progress' ? 'bg-warning text-dark' : t.status === 'Resolved' ? 'bg-success' : 'bg-secondary'}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className="small text-muted text-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
                          <td className="text-end">
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => setSelectedTicket(t)}
                            >
                              <i className="bi bi-chat-left-dots me-1"></i> Inspect & Reply
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: DYNAMIC FIELD & TEMPLATE HUB */}
        {/* ======================================================== */}
        {activeTab === 'templates' && (
          <div className="space-y-4">
            {/* Quick Action: Semester Activation Banner */}
            <div className="card shadow-sm border-0 border-start border-primary border-4 p-4 bg-white mb-4">
              <div className="row align-items-center">
                <div className="col-12 col-lg-8">
                  <h5 className="fw-bold text-primary mb-1">
                    <i className="bi bi-calendar2-check-fill me-2"></i> Semester Academic Records & SGPA Initialization
                  </h5>
                  <p className="text-muted small mb-0">
                    At the start of each semester, initialize the academic record slot. This updates all student profiles, auto-recalculates cumulative CGPAs upon score entry, and broadcasts an in-app notification to all students.
                  </p>
                </div>
                <div className="col-12 col-lg-4 mt-3 mt-lg-0">
                  <form onSubmit={handleActivateSemester} className="d-flex gap-2">
                    <select
                      className="form-select form-select-sm"
                      value={newSemNumber}
                      onChange={(e) => setNewSemNumber(Number(e.target.value))}
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                        <option key={n} value={n}>Semester {n} SGPA</option>
                      ))}
                    </select>
                    <button type="submit" className="btn btn-primary btn-sm text-nowrap" disabled={activatingSemester}>
                      {activatingSemester ? 'Initializing...' : 'Activate Semester'}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* Templates Table Card */}
            <div className="card shadow-sm border-0 rounded-3">
              <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="fw-bold mb-0 text-slate-800">
                    <i className="bi bi-sliders text-success me-2"></i> Dynamic Fields & Template Customizer
                  </h5>
                  <small className="text-muted">Add or customize details that students fill or that appear in Excel export customizers.</small>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-secondary btn-sm" onClick={loadTemplates}>
                    <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                  </button>
                  <button className="btn btn-success btn-sm" onClick={() => setShowAddFieldModal(true)}>
                    <i className="bi bi-plus-lg me-1"></i> Add New Field
                  </button>
                </div>
              </div>

              {/* Grouped Dynamic Fields */}
              <div className="p-3">
                {templatesLoading ? (
                  <div className="text-center py-5 text-muted">Loading templates...</div>
                ) : (
                  <div className="row g-4">
                    {/* Category: Semester Academics */}
                    <div className="col-12 col-md-6">
                      <div className="border rounded p-3 bg-light h-100">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="fw-bold text-dark mb-0">
                            <i className="bi bi-book-half text-primary me-2"></i> Semester Academic Slots
                          </h6>
                          <span className="badge bg-primary">{(templatesGrouped.semester_academics || []).length} Slots</span>
                        </div>
                        <ul className="list-group list-group-flush bg-transparent">
                          {(templatesGrouped.semester_academics || []).map((f) => (
                            <li key={f._id} className="list-group-item bg-transparent d-flex justify-content-between align-items-center px-0 py-2 border-bottom">
                              <div>
                                <span className="fw-semibold text-dark">{f.fieldName}</span>
                                <span className="text-muted small font-monospace ms-2">({f.fieldKey})</span>
                                <div><small className="text-muted">Type: {f.fieldType} | {f.isRequired ? 'Required' : 'Optional'}</small></div>
                              </div>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteTemplate(f._id, f.fieldName)}
                                title="Delete field"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Category: Student Profile Details */}
                    <div className="col-12 col-md-6">
                      <div className="border rounded p-3 bg-light h-100">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                          <h6 className="fw-bold text-dark mb-0">
                            <i className="bi bi-person-lines-fill text-success me-2"></i> Student Profile Fields & Templates
                          </h6>
                          <span className="badge bg-success">{(templatesGrouped.student_profile || []).length} Fields</span>
                        </div>
                        <ul className="list-group list-group-flush bg-transparent">
                          {(templatesGrouped.student_profile || []).map((f) => (
                            <li key={f._id} className="list-group-item bg-transparent d-flex justify-content-between align-items-center px-0 py-2 border-bottom">
                              <div>
                                <span className="fw-semibold text-dark">{f.fieldName}</span>
                                <span className="text-muted small font-monospace ms-2">({f.fieldKey})</span>
                                <div><small className="text-muted">Type: {f.fieldType} | {f.isRequired ? 'Mandatory' : 'Optional'}</small></div>
                              </div>
                              <button
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDeleteTemplate(f._id, f.fieldName)}
                                title="Delete field"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* MODAL: INSPECT & REPLY TO TICKET */}
      {selectedTicket && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-primary text-white">
                <div>
                  <h5 className="modal-title fw-bold">Ticket: {selectedTicket.ticketNumber}</h5>
                  <span className="small opacity-75">{selectedTicket.subject}</span>
                </div>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedTicket(null)}></button>
              </div>
              <div className="modal-body p-4" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
                {/* Meta details */}
                <div className="bg-light p-3 rounded mb-3 border">
                  <div className="row g-2 small">
                    <div className="col-6 col-md-3"><strong>Raiser:</strong> {selectedTicket.raisedBy.name}</div>
                    <div className="col-6 col-md-3"><strong>Role:</strong> {selectedTicket.raisedBy.role}</div>
                    <div className="col-6 col-md-3"><strong>Priority:</strong> {selectedTicket.priority}</div>
                    <div className="col-6 col-md-3">
                      <strong>Status:</strong>
                      <select
                        className="form-select form-select-sm mt-1"
                        value={selectedTicket.status}
                        onChange={(e) => handleUpdateTicketStatus(selectedTicket._id, e.target.value)}
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Resolved">Resolved</option>
                        <option value="Closed">Closed</option>
                      </select>
                    </div>
                  </div>
                  <hr className="my-2" />
                  <div>
                    <strong>Description:</strong>
                    <p className="mt-1 mb-0 text-secondary" style={{ whiteSpace: 'pre-wrap' }}>{selectedTicket.description}</p>
                  </div>
                </div>

                {/* Conversation / Replies */}
                <h6 className="fw-bold text-dark mb-2">Replies & Updates (Synced to Communication Hub)</h6>
                <div className="space-y-2 mb-3">
                  {(selectedTicket.replies || []).length === 0 ? (
                    <p className="text-muted small fst-italic">No replies recorded yet.</p>
                  ) : (
                    selectedTicket.replies.map((rep, idx) => (
                      <div key={idx} className={`p-3 rounded border mb-2 ${rep.senderRole === 'admin' ? 'bg-primary-subtle border-primary' : 'bg-white'}`}>
                        <div className="d-flex justify-content-between small fw-bold mb-1">
                          <span className={rep.senderRole === 'admin' ? 'text-primary' : 'text-dark'}>
                            {rep.senderName} ({rep.senderRole})
                          </span>
                          <span className="text-muted">{new Date(rep.sentAt).toLocaleString()}</span>
                        </div>
                        <div className="small text-secondary" style={{ whiteSpace: 'pre-wrap' }}>{rep.content}</div>
                      </div>
                    ))
                  )}
                </div>

                {/* Admin Reply Form */}
                <form onSubmit={handleReplyTicket}>
                  <label className="form-label small fw-semibold">Reply to User (dispatches in-app notification & Communication message):</label>
                  <textarea
                    className="form-control mb-2"
                    rows="3"
                    placeholder="Type your response to the user..."
                    value={ticketReplyText}
                    onChange={(e) => setTicketReplyText(e.target.value)}
                    required
                  ></textarea>
                  <div className="d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedTicket(null)}>
                      Close
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm" disabled={sendingTicketReply}>
                      {sendingTicketReply ? 'Sending...' : 'Send Response'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD DYNAMIC FIELD */}
      {showAddFieldModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">Add Dynamic Field / Template</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddFieldModal(false)}></button>
              </div>
              <form onSubmit={handleCreateTemplate}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Field Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. AWS Certification ID"
                      value={newFieldData.fieldName}
                      onChange={(e) => {
                        const name = e.target.value;
                        const key = name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                        setNewFieldData({ ...newFieldData, fieldName: name, fieldKey: key });
                      }}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Field Key (Identifier) *</label>
                    <input
                      type="text"
                      className="form-control font-monospace"
                      placeholder="e.g. aws_cert_id"
                      value={newFieldData.fieldKey}
                      onChange={(e) => setNewFieldData({ ...newFieldData, fieldKey: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Category</label>
                    <select
                      className="form-select"
                      value={newFieldData.category}
                      onChange={(e) => setNewFieldData({ ...newFieldData, category: e.target.value })}
                    >
                      <option value="student_profile">Student Profile Template</option>
                      <option value="semester_academics">Semester Academic Record</option>
                      <option value="excel_export">Excel Export Customizer</option>
                      <option value="placement_requirement">Placement Requirement</option>
                      <option value="general">General</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Field Type</label>
                    <select
                      className="form-select"
                      value={newFieldData.fieldType}
                      onChange={(e) => setNewFieldData({ ...newFieldData, fieldType: e.target.value })}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="select">Dropdown Select</option>
                      <option value="date">Date</option>
                      <option value="textarea">Textarea</option>
                      <option value="file">File Upload / URL</option>
                    </select>
                  </div>
                  <div className="mb-3 form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="fieldIsRequired"
                      checked={newFieldData.isRequired}
                      onChange={(e) => setNewFieldData({ ...newFieldData, isRequired: e.target.checked })}
                    />
                    <label className="form-check-label small fw-semibold" htmlFor="fieldIsRequired">
                      Mandatory / Required Field
                    </label>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Description / Instruction</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Instruction for students filling this field"
                      value={newFieldData.description}
                      onChange={(e) => setNewFieldData({ ...newFieldData, description: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddFieldModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success btn-sm">
                    Create & Broadcast Notification
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD STAFF */}
      {showAddModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">Add Placement Officer / Coordinator</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddModal(false)}></button>
              </div>
              <form onSubmit={handleCreateStaff}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Full Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Email Address *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Role *</label>
                    <select
                      className="form-select"
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="department_coordinator">Department Coordinator</option>
                      <option value="placement_officer">Placement Officer</option>
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Department</label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. CSE, ECE, Placement Cell"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>Create & Dispatch Temp Password</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STAFF */}
      {showEditModal && selectedUser && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-secondary text-white">
                <h5 className="modal-title fw-bold">Edit Staff Account</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditModal(false)}></button>
              </div>
              <form onSubmit={handleUpdateStaff}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Department</label>
                    <input
                      type="text"
                      className="form-control"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: BULK EXCEL UPLOAD */}
      {showBulkModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">Bulk Onboard Staff</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowBulkModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <form onSubmit={handleBulkUpload}>
                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Upload Excel or CSV</label>
                    <input
                      type="file"
                      className="form-control"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) => setExcelFile(e.target.files[0])}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-success w-100 py-2" disabled={bulkUploading}>
                    {bulkUploading ? 'Uploading & Dispatching Emails...' : 'Upload & Onboard'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LOG INSPECTION */}
      {selectedLogDetail && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow border-0">
              <div className={`modal-header ${selectedLogDetail.isError ? 'bg-danger text-white' : 'bg-dark text-white'}`}>
                <h5 className="modal-title fw-bold">Log Details: {selectedLogDetail.action}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedLogDetail(null)}></button>
              </div>
              <div className="modal-body p-4 font-monospace small">
                <p><strong>Message:</strong> {selectedLogDetail.message}</p>
                {selectedLogDetail.isError && selectedLogDetail.errorDetails && (
                  <div className="alert alert-danger">
                    <div><strong>Error:</strong> {selectedLogDetail.errorDetails.message}</div>
                    {selectedLogDetail.errorDetails.stack && (
                      <pre className="mt-2 p-2 bg-dark text-light rounded" style={{ maxHeight: '150px', overflowY: 'auto' }}>
                        {selectedLogDetail.errorDetails.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
