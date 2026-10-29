import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
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
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { mentorAPI } from '../services/api';
import Navbar from '../components/Navbar';
import StudentProfileModal from '../components/StudentProfileModal';
import CustomExcelExportModal from '../components/CustomExcelExportModal';
import FloatingCohortWindow from '../components/FloatingCohortWindow';
import TicketSupportCenter from '../components/TicketSupportCenter';
import CommunicationHub from '../components/CommunicationHub';

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

export default function MentorDashboard({ user }) {
  const currentUser = user || JSON.parse(localStorage.getItem('user') || '{}');
  // Navigation Tabs: Analytics, Mentees Directory, Communication Hub
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'students' | 'communication'

  const dept = user?.department || 'CSE';

  // Scope: 'mentees' (default) or 'department' (entire department overview button)
  const [statsScope, setStatsScope] = useState('mentees');

  // ------------------------------------------
  // ANALYTICS STATE & DYNAMIC FILTERS
  // ------------------------------------------
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Primary Filters
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [analyticsSection, setAnalyticsSection] = useState('all');
  const [analyticsCategory, setAnalyticsCategory] = useState('all');
  const [analyticsCgpaBracket, setAnalyticsCgpaBracket] = useState('all');
  const [analyticsCareerGoal, setAnalyticsCareerGoal] = useState('all');
  const [analyticsHasArrears, setAnalyticsHasArrears] = useState('all'); // 'all' | 'none' | 'standing' | 'history'

  // Conditional Sub-Filters
  const [analyticsIsPlaced, setAnalyticsIsPlaced] = useState('all');
  const [analyticsPlacementType, setAnalyticsPlacementType] = useState('all');
  const [analyticsDomainInterest, setAnalyticsDomainInterest] = useState('all');
  const [analyticsStudyLocation, setAnalyticsStudyLocation] = useState('all');
  const [analyticsStartupStage, setAnalyticsStartupStage] = useState('all');
  const [analyticsArrearCount, setAnalyticsArrearCount] = useState('all');
  const [analyticsArrearStatusType, setAnalyticsArrearStatusType] = useState('all');

  // Floating Student Records Window
  const [showStudentRecordsWindow, setShowStudentRecordsWindow] = useState(true);
  const [showCustomExportModal, setShowCustomExportModal] = useState(false);

  // ------------------------------------------
  // MENTEES DIRECTORY STATE (VIEW ONLY)
  // ------------------------------------------
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentSection, setStudentSection] = useState('all');
  const [studentCategory, setStudentCategory] = useState('all');
  const [studentPagination, setStudentPagination] = useState({ page: 1, limit: 25, totalPages: 1, totalCount: 0 });
  const [selectedStudentForModal, setSelectedStudentForModal] = useState(null);

  // ------------------------------------------
  // COMMUNICATION HUB STATE (MENTEES & DEPT COORDINATORS ONLY)
  // ------------------------------------------
  const [recipientsData, setRecipientsData] = useState({ mentees: [], coordinators: [] });
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState([]);
  const [commRecipientSearch, setCommRecipientSearch] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageForm, setMessageForm] = useState({
    subject: '',
    content: '',
    messageType: 'message',
    priority: 'Normal',
    targetGroup: 'custom_selection',
  });
  const [replyText, setReplyText] = useState({});

  // ------------------------------------------
  // DATA LOADERS
  // ------------------------------------------
  const loadAnalytics = async (customParams = {}) => {
    setAnalyticsLoading(true);
    try {
      const activeGoal = customParams.careerGoal !== undefined ? customParams.careerGoal : analyticsCareerGoal;
      const activeArrear = customParams.arrearFilter !== undefined ? customParams.arrearFilter : analyticsHasArrears;
      const activeScope = customParams.scope !== undefined ? customParams.scope : statsScope;

      const params = {
        scope: activeScope,
        search: customParams.search !== undefined ? customParams.search : analyticsSearch,
        section: customParams.section !== undefined ? customParams.section : analyticsSection,
        studentCategory: customParams.studentCategory !== undefined ? customParams.studentCategory : analyticsCategory,
        cgpaBracket: customParams.cgpaBracket !== undefined ? customParams.cgpaBracket : analyticsCgpaBracket,
        careerGoal: activeGoal,
        arrearFilter: activeArrear,
        // Conditional sub-filters
        isPlaced: activeGoal === 'Placement' ? (customParams.isPlaced !== undefined ? customParams.isPlaced : analyticsIsPlaced) : 'all',
        placementType: activeGoal === 'Placement' ? (customParams.placementType !== undefined ? customParams.placementType : analyticsPlacementType) : 'all',
        domainInterest: activeGoal === 'Placement' ? (customParams.domainInterest !== undefined ? customParams.domainInterest : analyticsDomainInterest) : 'all',
        studyLocation: activeGoal === 'Higher Studies' ? (customParams.studyLocation !== undefined ? customParams.studyLocation : analyticsStudyLocation) : 'all',
        startupStage: activeGoal === 'Entrepreneurship' ? (customParams.startupStage !== undefined ? customParams.startupStage : analyticsStartupStage) : 'all',
        arrearCount: activeArrear === 'standing' || activeArrear === 'history' ? (customParams.arrearCount !== undefined ? customParams.arrearCount : analyticsArrearCount) : 'all',
        arrearStatusType: activeArrear === 'standing' || activeArrear === 'history' ? (customParams.arrearStatusType !== undefined ? customParams.arrearStatusType : analyticsArrearStatusType) : 'all',
      };

      const res = await mentorAPI.getAnalytics(params);
      if (res.data.success) {
        setAnalytics(res.data.analytics);
      }
    } catch (err) {
      console.error('Failed to load mentor analytics:', err);
      Swal.fire('Analytics Error', err.response?.data?.message || 'Failed to fetch analytics.', 'error');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const handleResetAnalyticsFilters = () => {
    setAnalyticsSearch('');
    setAnalyticsSection('all');
    setAnalyticsCategory('all');
    setAnalyticsCgpaBracket('all');
    setAnalyticsCareerGoal('all');
    setAnalyticsHasArrears('all');
    setAnalyticsIsPlaced('all');
    setAnalyticsPlacementType('all');
    setAnalyticsDomainInterest('all');
    setAnalyticsStudyLocation('all');
    setAnalyticsStartupStage('all');
    setAnalyticsArrearCount('all');
    setAnalyticsArrearStatusType('all');

    loadAnalytics({
      scope: statsScope,
      search: '',
      section: 'all',
      studentCategory: 'all',
      cgpaBracket: 'all',
      careerGoal: 'all',
      arrearFilter: 'all',
      isPlaced: 'all',
      placementType: 'all',
      domainInterest: 'all',
      studyLocation: 'all',
      startupStage: 'all',
      arrearCount: 'all',
      arrearStatusType: 'all',
    });
  };

  const loadMentees = async (page = 1) => {
    setStudentsLoading(true);
    try {
      const res = await mentorAPI.getStudents({
        page,
        limit: studentPagination.limit,
        search: studentSearch,
        section: studentSection,
        studentCategory,
      });
      if (res.data.success) {
        setStudents(res.data.students || []);
        setStudentPagination({
          page: res.data.currentPage,
          limit: studentPagination.limit,
          totalPages: res.data.totalPages,
          totalCount: res.data.totalCount,
        });
      }
    } catch (err) {
      console.error('Failed to load mentees:', err);
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadRecipients = async () => {
    setRecipientsLoading(true);
    try {
      const res = await mentorAPI.getCommunicationRecipients();
      if (res.data.success) {
        setRecipientsData(res.data.recipients || { mentees: [], coordinators: [] });
      }
    } catch (err) {
      console.error('Failed to load communication recipients:', err);
    } finally {
      setRecipientsLoading(false);
    }
  };

  const loadMessages = async () => {
    setMessagesLoading(true);
    try {
      const res = await mentorAPI.getMessages();
      if (res.data.success) {
        setMessages(res.data.messages || []);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadAnalytics();
    loadMentees(1);
    loadRecipients();
  }, [dept]);

  // Tab change triggers
  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics();
    if (activeTab === 'students') loadMentees(1);
    if (activeTab === 'communication') {
      loadMessages();
      loadRecipients();
    }
  }, [activeTab]);

  // Scope switcher trigger
  useEffect(() => {
    loadAnalytics({ scope: statsScope });
  }, [statsScope]);

  // ------------------------------------------
  // COMMUNICATION ACTIONS
  // ------------------------------------------
  const allEligibleRecipients = [
    ...(recipientsData.coordinators || []).map((c) => ({ ...c, isCoordinator: true })),
    ...(recipientsData.mentees || []).map((m) => ({ ...m, isCoordinator: false })),
  ];

  const filteredRecipients = allEligibleRecipients.filter(
    (r) =>
      r.name?.toLowerCase().includes(commRecipientSearch.toLowerCase()) ||
      r.email?.toLowerCase().includes(commRecipientSearch.toLowerCase()) ||
      r.rollNumber?.toLowerCase().includes(commRecipientSearch.toLowerCase())
  );

  const handleToggleRecipient = (userId) => {
    if (selectedRecipientIds.includes(userId)) {
      setSelectedRecipientIds(selectedRecipientIds.filter((id) => id !== userId));
    } else {
      setSelectedRecipientIds([...selectedRecipientIds, userId]);
    }
  };

  const handleSelectAllMentees = () => {
    const menteeIds = (recipientsData.mentees || []).map((m) => m._id);
    const set = new Set([...selectedRecipientIds, ...menteeIds]);
    setSelectedRecipientIds(Array.from(set));
  };

  const handleSelectAllCoordinators = () => {
    const coordIds = (recipientsData.coordinators || []).map((c) => c._id);
    const set = new Set([...selectedRecipientIds, ...coordIds]);
    setSelectedRecipientIds(Array.from(set));
  };

  const handleClearSelectedRecipients = () => {
    setSelectedRecipientIds([]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageForm.subject.trim() || !messageForm.content.trim()) {
      Swal.fire('Required Fields', 'Please enter both subject and message content.', 'warning');
      return;
    }

    if (selectedRecipientIds.length === 0) {
      Swal.fire('No Recipients Selected', 'Please select at least one mentee or department coordinator.', 'warning');
      return;
    }

    setSendingMessage(true);
    try {
      const res = await mentorAPI.sendMessage({
        ...messageForm,
        selectedUserIds: selectedRecipientIds,
      });

      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Message Sent',
          text: res.data.message,
          timer: 1500,
          showConfirmButton: false,
        });
        setMessageForm({
          subject: '',
          content: '',
          messageType: 'message',
          priority: 'Normal',
          targetGroup: 'custom_selection',
        });
        setSelectedRecipientIds([]);
        loadMessages();
      }
    } catch (err) {
      Swal.fire('Send Error', err.response?.data?.message || 'Failed to dispatch message.', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleReplyMessage = async (msgId) => {
    const text = replyText[msgId];
    if (!text || !text.trim()) {
      Swal.fire('Reply Empty', 'Please enter your reply text before sending.', 'warning');
      return;
    }

    try {
      const res = await mentorAPI.replyMessage(msgId, { content: text.trim() });
      if (res.data.success) {
        Swal.fire({
          icon: 'success',
          title: 'Reply Sent',
          text: 'Your reply has been added to the message thread.',
          timer: 1500,
          showConfirmButton: false,
        });
        setReplyText({ ...replyText, [msgId]: '' });
        loadMessages();
      }
    } catch (err) {
      Swal.fire('Reply Error', err.response?.data?.message || 'Failed to post reply.', 'error');
    }
  };

  return (
    <div className="min-vh-100 bg-light">
      <Navbar user={user} />

      {/* SUB-NAVBAR */}
      <div className="bg-white border-bottom shadow-sm px-3 py-2 sticky-top">
        <div className="container-fluid d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center flex-wrap gap-2">
            <span className="badge bg-primary px-3 py-2 fs-6">
              <i className="bi bi-building me-1"></i> Dept: {dept}
            </span>
            <span className="badge bg-info text-dark px-2 py-2">
              <i className="bi bi-person-check-fill me-1"></i> Faculty Mentor Workspace
            </span>
            <div className="btn-group btn-group-sm ms-md-2">
              <button
                className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('analytics')}
              >
                <i className="bi bi-pie-chart-fill me-1"></i> Analytics Dashboard
              </button>
              <button
                className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('students')}
              >
                <i className="bi bi-people-fill me-1"></i> My Mentees
                {studentPagination.totalCount > 0 && (
                  <span className="badge bg-light text-dark ms-1">{studentPagination.totalCount}</span>
                )}
              </button>
              <button
                className={`btn ${activeTab === 'communication' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('communication')}
              >
                <i className="bi bi-chat-dots-fill me-1"></i> Communication Hub
              </button>
              <button
                className={`btn ${activeTab === 'tickets' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('tickets')}
              >
                <i className="bi bi-ticket-perforated-fill me-1"></i> Support Tickets
              </button>
            </div>
          </div>

          <div className="d-flex gap-2 align-items-center">
            {activeTab === 'analytics' && (
              <button
                className="btn btn-outline-primary btn-sm"
                onClick={() => setShowStudentRecordsWindow(!showStudentRecordsWindow)}
                title="Toggle Floating Student Records Window"
              >
                <i className={`bi ${showStudentRecordsWindow ? 'bi-window-stack' : 'bi-window'} me-1`}></i>
                {showStudentRecordsWindow ? 'Hide Student Records' : 'Show Student Records'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container-fluid py-4 px-md-4">
        {/* ======================================================== */}
        {/* PAGE 1: ANALYTICS & INSIGHTS DASHBOARD */}
        {/* ======================================================== */}
        {activeTab === 'analytics' && (
          <div>
            {/* SCOPE SWITCHER BAR: MENTEES (DEFAULT) VS ENTIRE DEPARTMENT (Requirement 3) */}
            <div className="card shadow-sm border-0 mb-4 bg-white">
              <div className="card-body p-3 d-flex flex-wrap align-items-center justify-content-between gap-3">
                <div className="d-flex align-items-center gap-2">
                  <span className="fw-semibold text-secondary small text-uppercase">Analytics Scope:</span>
                  <div className="btn-group shadow-sm" role="group">
                    <button
                      type="button"
                      className={`btn btn-sm ${statsScope === 'mentees' ? 'btn-primary fw-bold' : 'btn-outline-primary'}`}
                      onClick={() => setStatsScope('mentees')}
                    >
                      <i className="bi bi-person-check-fill me-1"></i> My Mentees Statistics (Default)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${statsScope === 'department' ? 'btn-primary fw-bold' : 'btn-outline-primary'}`}
                      onClick={() => setStatsScope('department')}
                    >
                      <i className="bi bi-building me-1"></i> View Entire Department Statistics
                    </button>
                  </div>
                </div>

                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-sm btn-outline-success"
                    onClick={() => setShowCustomExportModal(true)}
                  >
                    <i className="bi bi-file-earmark-spreadsheet-fill me-1"></i> Export Custom Excel
                  </button>
                </div>
              </div>

              {statsScope === 'department' && (
                <div className="card-footer bg-light border-0 py-2 px-3 small text-muted d-flex align-items-center">
                  <i className="bi bi-info-circle-fill text-primary me-2"></i>
                  <span>
                    Viewing <strong>read-only statistics for all {dept} students</strong>. Toggle back to <strong>My Mentees Statistics</strong> to manage your assigned mentees.
                  </span>
                </div>
              )}
            </div>

            {/* COMPREHENSIVE DYNAMIC DASHBOARD FILTER TOOLBAR (Matches Coordinator Dashboard) */}
            <div className="card shadow-sm border-0 rounded-3 mb-4 bg-white p-3">
              <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                <div className="d-flex align-items-center gap-2">
                  <span className="badge bg-primary p-2">
                    <i className="bi bi-funnel-fill text-white fs-6"></i>
                  </span>
                  <div>
                    <h6 className="fw-bold mb-0 text-dark">Analytical Intelligence Filters</h6>
                    <small className="text-muted">Filter student metrics, charts, and records across all dimensions</small>
                  </div>
                </div>

                <div className="d-flex gap-2 flex-wrap">
                  <button
                    className="btn btn-sm btn-outline-primary px-3 shadow-sm"
                    onClick={() => setShowStudentRecordsWindow(true)}
                    title="Open floating window with filtered students"
                  >
                    <i className="bi bi-window-stack me-1"></i> Student Records Window ({analytics?.filteredStudents?.length || 0})
                  </button>
                  <button className="btn btn-sm btn-primary px-3 shadow-sm" onClick={() => loadAnalytics()}>
                    <i className="bi bi-search me-1"></i> Apply Filters
                  </button>
                  <button className="btn btn-sm btn-outline-secondary px-3" onClick={handleResetAnalyticsFilters}>
                    <i className="bi bi-arrow-counterclockwise me-1"></i> Reset All
                  </button>
                </div>
              </div>

              {/* PRIMARY CONTROLS GRID */}
              <div className="row g-2 mb-2">
                {/* 1. Search query */}
                <div className="col-12 col-md-3">
                  <label className="form-label small text-muted mb-1 fw-semibold">Search Student</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-light"><i className="bi bi-search"></i></span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Name, Roll No, Email..."
                      value={analyticsSearch}
                      onChange={(e) => setAnalyticsSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && loadAnalytics()}
                    />
                  </div>
                </div>

                {/* 2. Section */}
                <div className="col-6 col-md-1">
                  <label className="form-label small text-muted mb-1 fw-semibold">Section</label>
                  <select
                    className="form-select form-select-sm"
                    value={analyticsSection}
                    onChange={(e) => setAnalyticsSection(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="A">Sec A</option>
                    <option value="B">Sec B</option>
                    <option value="C">Sec C</option>
                    <option value="D">Sec D</option>
                  </select>
                </div>

                {/* 3. Category */}
                <div className="col-6 col-md-2">
                  <label className="form-label small text-muted mb-1 fw-semibold">Category</label>
                  <select
                    className="form-select form-select-sm"
                    value={analyticsCategory}
                    onChange={(e) => setAnalyticsCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    <option value="Day Scholar">Day Scholar</option>
                    <option value="Hosteller">Hosteller</option>
                  </select>
                </div>

                {/* 4. CGPA Range */}
                <div className="col-6 col-md-2">
                  <label className="form-label small text-muted mb-1 fw-semibold">CGPA Range</label>
                  <select
                    className="form-select form-select-sm"
                    value={analyticsCgpaBracket}
                    onChange={(e) => setAnalyticsCgpaBracket(e.target.value)}
                  >
                    <option value="all">All CGPA Ranges</option>
                    <option value="9+">&gt;= 9.0 (Outstanding)</option>
                    <option value="8-9">8.0 - 8.99 (Distinction)</option>
                    <option value="7-8">7.0 - 7.99 (First Class)</option>
                    <option value="6-7">6.0 - 6.99 (Second Class)</option>
                    <option value="<6">&lt; 6.0 (Needs Support)</option>
                  </select>
                </div>

                {/* 5. Career Goal (Primary Filter) */}
                <div className="col-6 col-md-2">
                  <label className="form-label small text-muted mb-1 fw-semibold">Career Goal</label>
                  <select
                    className="form-select form-select-sm"
                    value={analyticsCareerGoal}
                    onChange={(e) => setAnalyticsCareerGoal(e.target.value)}
                  >
                    <option value="all">All Career Goals</option>
                    <option value="Placement">Placement</option>
                    <option value="Higher Studies">Higher Studies</option>
                    <option value="Entrepreneurship">Entrepreneurship</option>
                    <option value="Undecided">Undecided</option>
                  </select>
                </div>

                {/* 6. Arrear Status (Primary Filter) */}
                <div className="col-6 col-md-2">
                  <label className="form-label small text-muted mb-1 fw-semibold">Arrear Status</label>
                  <select
                    className="form-select form-select-sm"
                    value={analyticsHasArrears}
                    onChange={(e) => setAnalyticsHasArrears(e.target.value)}
                  >
                    <option value="all">All Students</option>
                    <option value="none">Zero Arrears (Clean Record)</option>
                    <option value="standing">Has Standing Arrears</option>
                    <option value="history">Has History of Arrears</option>
                  </select>
                </div>
              </div>

              {/* DYNAMIC CONDITIONAL SUB-FILTERS ROW */}
              {(analyticsCareerGoal !== 'all' || analyticsHasArrears === 'standing' || analyticsHasArrears === 'history') && (
                <div className="p-3 mb-2 bg-light rounded-3 border border-primary-subtle animate__animated animate__fadeIn">
                  <div className="row g-2 align-items-center">
                    {/* Career Goal: Placement Conditional Sub-Filters */}
                    {analyticsCareerGoal === 'Placement' && (
                      <>
                        <div className="col-12 col-md-3">
                          <label className="form-label small text-primary mb-1 fw-semibold">
                            <i className="bi bi-briefcase-fill me-1"></i> Placement Status
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={analyticsIsPlaced}
                            onChange={(e) => setAnalyticsIsPlaced(e.target.value)}
                          >
                            <option value="all">All (Placed & Unplaced)</option>
                            <option value="true">Placed Students</option>
                            <option value="false">Unplaced Students</option>
                          </select>
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label small text-primary mb-1 fw-semibold">Placement Type</label>
                          <select
                            className="form-select form-select-sm"
                            value={analyticsPlacementType}
                            onChange={(e) => setAnalyticsPlacementType(e.target.value)}
                          >
                            <option value="all">All Placement Types</option>
                            <option value="On-Campus">On-Campus</option>
                            <option value="Off-Campus">Off-Campus</option>
                          </select>
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label small text-primary mb-1 fw-semibold">Domain Interest</label>
                          <select
                            className="form-select form-select-sm"
                            value={analyticsDomainInterest}
                            onChange={(e) => setAnalyticsDomainInterest(e.target.value)}
                          >
                            <option value="all">All Technical Domains</option>
                            <option value="Web Development">Web Development</option>
                            <option value="AI & Machine Learning">AI & Machine Learning</option>
                            <option value="Cloud Computing">Cloud Computing</option>
                            <option value="Cybersecurity">Cybersecurity</option>
                            <option value="Data Science">Data Science</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Career Goal: Higher Studies Conditional Sub-Filter */}
                    {analyticsCareerGoal === 'Higher Studies' && (
                      <div className="col-12 col-md-4">
                        <label className="form-label small text-primary mb-1 fw-semibold">
                          <i className="bi bi-mortarboard-fill me-1"></i> Study Destination
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={analyticsStudyLocation}
                          onChange={(e) => setAnalyticsStudyLocation(e.target.value)}
                        >
                          <option value="all">All Destinations</option>
                          <option value="India">Within India</option>
                          <option value="Abroad">Abroad</option>
                        </select>
                      </div>
                    )}

                    {/* Career Goal: Entrepreneurship Conditional Sub-Filter */}
                    {analyticsCareerGoal === 'Entrepreneurship' && (
                      <div className="col-12 col-md-4">
                        <label className="form-label small text-primary mb-1 fw-semibold">
                          <i className="bi bi-lightbulb-fill me-1"></i> Product / Company Status
                        </label>
                        <select
                          className="form-select form-select-sm"
                          value={analyticsStartupStage}
                          onChange={(e) => setAnalyticsStartupStage(e.target.value)}
                        >
                          <option value="all">All Stages</option>
                          <option value="Idea">Idea Stage</option>
                          <option value="Prototype">Prototype Stage</option>
                          <option value="MVP">MVP (Minimum Viable Product)</option>
                          <option value="Revenue">Revenue Generating</option>
                        </select>
                      </div>
                    )}

                    {/* Career Goal: Undecided Info */}
                    {analyticsCareerGoal === 'Undecided' && (
                      <div className="col-12 col-md-5">
                        <span className="badge bg-secondary-subtle text-secondary border px-3 py-2 small d-block text-start">
                          <i className="bi bi-question-circle me-1"></i> Filtering students currently undecided on their career pathway
                        </span>
                      </div>
                    )}

                    {/* Arrear Status: Standing or History Conditional Sub-Filters */}
                    {(analyticsHasArrears === 'standing' || analyticsHasArrears === 'history') && (
                      <>
                        <div className="col-12 col-md-3">
                          <label className="form-label small text-danger mb-1 fw-semibold">
                            <i className="bi bi-exclamation-triangle-fill me-1"></i> Arrear Count
                          </label>
                          <select
                            className="form-select form-select-sm"
                            value={analyticsArrearCount}
                            onChange={(e) => setAnalyticsArrearCount(e.target.value)}
                          >
                            <option value="all">Any Count</option>
                            <option value="1">Exactly 1 Arrear</option>
                            <option value="2">Exactly 2 Arrears</option>
                            <option value="3+">3 or More Arrears</option>
                          </select>
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label small text-danger mb-1 fw-semibold">Arrear Status Type</label>
                          <select
                            className="form-select form-select-sm"
                            value={analyticsArrearStatusType}
                            onChange={(e) => setAnalyticsArrearStatusType(e.target.value)}
                          >
                            <option value="all">All Statuses</option>
                            <option value="standing">Standing / Pending Only</option>
                            <option value="cleared">Cleared Arrears Only</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Active Filter Summary Bar */}
              {analytics && (
                <div className="mt-3 pt-2 border-top d-flex flex-wrap justify-content-between align-items-center">
                  <div className="small text-muted">
                    <i className="bi bi-info-circle-fill text-primary me-1"></i>
                    Displaying student analysis for <strong className="text-dark">{analytics.totalStudents}</strong> student(s) matching selected parameters.
                  </div>
                  <div className="d-flex gap-1 flex-wrap">
                    {analyticsSection !== 'all' && <span className="badge bg-light text-dark border">Section: {analyticsSection}</span>}
                    {analyticsCategory !== 'all' && <span className="badge bg-light text-dark border">{analyticsCategory}</span>}
                    {analyticsCgpaBracket !== 'all' && <span className="badge bg-light text-dark border">CGPA: {analyticsCgpaBracket}</span>}
                    {analyticsCareerGoal !== 'all' && <span className="badge bg-primary-subtle text-primary border border-primary-subtle">Goal: {analyticsCareerGoal}</span>}
                    {analyticsCareerGoal === 'Placement' && analyticsIsPlaced !== 'all' && <span className="badge bg-light text-dark border">{analyticsIsPlaced === 'true' ? 'Placed' : 'Unplaced'}</span>}
                    {analyticsCareerGoal === 'Placement' && analyticsPlacementType !== 'all' && <span className="badge bg-light text-dark border">Type: {analyticsPlacementType}</span>}
                    {analyticsCareerGoal === 'Placement' && analyticsDomainInterest !== 'all' && <span className="badge bg-light text-dark border">Domain: {analyticsDomainInterest}</span>}
                    {analyticsCareerGoal === 'Higher Studies' && analyticsStudyLocation !== 'all' && <span className="badge bg-light text-dark border">Dest: {analyticsStudyLocation}</span>}
                    {analyticsCareerGoal === 'Entrepreneurship' && analyticsStartupStage !== 'all' && <span className="badge bg-light text-dark border">Stage: {analyticsStartupStage}</span>}
                    {analyticsHasArrears !== 'all' && (
                      <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                        {analyticsHasArrears === 'none' ? 'Clean Record (0 Arrears)' : analyticsHasArrears === 'standing' ? 'Standing Arrears' : 'History of Arrears'}
                      </span>
                    )}
                    {(analyticsHasArrears === 'standing' || analyticsHasArrears === 'history') && analyticsArrearCount !== 'all' && (
                      <span className="badge bg-light text-dark border">Count: {analyticsArrearCount}</span>
                    )}
                    {(analyticsHasArrears === 'standing' || analyticsHasArrears === 'history') && analyticsArrearStatusType !== 'all' && (
                      <span className="badge bg-light text-dark border">Type: {analyticsArrearStatusType}</span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {analyticsLoading || !analytics ? (
              <div className="text-center py-5 text-muted bg-white rounded-3 shadow-sm">
                <span className="spinner-border text-primary me-2"></span> Loading intelligence & insights...
              </div>
            ) : (
              <div>
                {/* 1. TOP KEY METRICS CARDS (KPIS) */}
                <div className="row g-3 mb-4">
                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-primary border-4 p-3 bg-white h-100">
                      <span className="text-muted small text-uppercase fw-semibold">Total Students</span>
                      <h3 className="fw-bold mb-0 text-primary mt-1">{analytics.totalStudents}</h3>
                      <small className="text-muted mt-1 d-block">{analytics.dayScholarCount} Day / {analytics.hostellerCount} Hostel</small>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-success border-4 p-3 bg-white h-100">
                      <span className="text-muted small text-uppercase fw-semibold">Placement Rate</span>
                      <h3 className="fw-bold mb-0 text-success mt-1">{analytics.placementPercentage}%</h3>
                      <small className="text-muted mt-1 d-block">{analytics.placedCount} Placed ({analytics.onCampusCount} On / {analytics.offCampusCount} Off)</small>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-info border-4 p-3 bg-white h-100">
                      <span className="text-muted small text-uppercase fw-semibold">Average CGPA</span>
                      <h3 className="fw-bold mb-0 text-info mt-1">{analytics.averageCGPA}</h3>
                      <small className="text-muted mt-1 d-block">Highest: {analytics.highestCGPA} | Lowest: {analytics.lowestCGPA}</small>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-danger border-4 p-3 bg-white h-100">
                      <span className="text-muted small text-uppercase fw-semibold">Standing Arrears</span>
                      <h3 className="fw-bold mb-0 text-danger mt-1">{analytics.standingArrearsCount}</h3>
                      <small className="text-muted mt-1 d-block">{analytics.studentsWithArrears} students with arrears ({analytics.clearedArrearsCount} cleared)</small>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-warning border-4 p-3 bg-white h-100">
                      <span className="text-muted small text-uppercase fw-semibold">Remedial Support</span>
                      <h3 className="fw-bold mb-0 text-warning mt-1">{analytics.remedialSupportCount}</h3>
                      <small className="text-muted mt-1 d-block">Needing remedial coursework</small>
                    </div>
                  </div>

                  <div className="col-12 col-sm-6 col-xl-2">
                    <div className="card dashboard-card border-start border-danger border-4 p-3 bg-white h-100" style={{ borderLeftColor: '#dc2626' }}>
                      <span className="text-muted small text-uppercase fw-semibold">Intervention Alerts</span>
                      <h3 className="fw-bold mb-0 text-danger mt-1">{analytics.mentorInterventionCount || 0}</h3>
                      <small className="text-danger fw-semibold mt-1 d-block">Urgent Attention Needed</small>
                    </div>
                  </div>
                </div>

                {/* 2. VISUAL CHARTS ROW 1: SEMESTER SGPA PROGRESSION & ARREAR HOTSPOTS */}
                <div className="row g-4 mb-4">
                  {/* Semester-Wise Average SGPA Curve */}
                  <div className="col-12 col-lg-7">
                    <div className="card shadow-sm border-0 rounded-3 h-100 bg-white">
                      <div className="card-header bg-white py-3 fw-bold text-dark border-bottom d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-graph-up text-primary me-2"></i> Semester-Wise Average SGPA Progression Curve</span>
                        <span className="badge bg-light text-primary border">Student Academic Progression</span>
                      </div>
                      <div className="card-body p-4" style={{ height: '310px' }}>
                        {analytics.semesterAverageSGPA && analytics.semesterAverageSGPA.length > 0 ? (
                          <Line
                            data={{
                              labels: analytics.semesterAverageSGPA.map((s) => s.semester),
                              datasets: [
                                {
                                  label: 'Student Average SGPA',
                                  data: analytics.semesterAverageSGPA.map((s) => s.averageSGPA),
                                  borderColor: '#2563eb',
                                  backgroundColor: 'rgba(37, 99, 235, 0.1)',
                                  tension: 0.35,
                                  fill: true,
                                  pointRadius: 6,
                                  pointBackgroundColor: '#1e3a8a',
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              scales: {
                                y: { min: 0, max: 10, title: { display: true, text: 'SGPA' } },
                              },
                            }}
                          />
                        ) : (
                          <div className="text-center py-5 text-muted">
                            No semester records found for these students.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Arrear Bottleneck Subjects Hotspots */}
                  <div className="col-12 col-lg-5">
                    <div className="card shadow-sm border-0 rounded-3 h-100 bg-white">
                      <div className="card-header bg-white py-3 fw-bold text-dark border-bottom d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-exclamation-octagon-fill text-danger me-2"></i> Top Arrear Bottleneck Subjects</span>
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger">Hotspots</span>
                      </div>
                      <div className="card-body p-4" style={{ height: '310px' }}>
                        {analytics.subjectArrearHotspots && analytics.subjectArrearHotspots.length > 0 ? (
                          <Bar
                            data={{
                              labels: analytics.subjectArrearHotspots.map((s) => s.subjectCode),
                              datasets: [
                                {
                                  label: 'Pending Arrears',
                                  data: analytics.subjectArrearHotspots.map((s) => s.pendingCount),
                                  backgroundColor: '#ef4444',
                                  borderRadius: 4,
                                },
                                {
                                  label: 'Cleared Arrears',
                                  data: analytics.subjectArrearHotspots.map((s) => s.clearedCount),
                                  backgroundColor: '#10b981',
                                  borderRadius: 4,
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              scales: { y: { beginAtZero: true, title: { display: true, text: 'Arrear Count' } } },
                            }}
                          />
                        ) : (
                          <div className="text-center py-5 text-success">
                            <i className="bi bi-check2-circle fs-1 d-block mb-2"></i>
                            No standing or cleared arrears reported for this selection!
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. VISUAL CHARTS ROW 2: CGPA DISTRIBUTION & CTC SALARY RANGES */}
                <div className="row g-4 mb-4">
                  {/* CGPA Grade Distribution */}
                  <div className="col-12 col-lg-6">
                    <div className="card shadow-sm border-0 rounded-3 h-100 bg-white">
                      <div className="card-header bg-white py-3 fw-bold text-dark border-bottom d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-bar-chart-steps text-info me-2"></i> CGPA Grade Bracket Distribution</span>
                        <span className="badge bg-light text-dark border">Academic Stratification</span>
                      </div>
                      <div className="card-body p-4" style={{ height: '280px' }}>
                        <Bar
                          data={{
                            labels: Object.keys(analytics.cgpaDistribution || {}),
                            datasets: [
                              {
                                label: 'Student Count',
                                data: Object.values(analytics.cgpaDistribution || {}),
                                backgroundColor: ['#059669', '#10b981', '#3b82f6', '#f59e0b', '#ef4444'],
                                borderRadius: 4,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: { y: { beginAtZero: true, title: { display: true, text: 'Students' } } },
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* CTC Salary Distribution */}
                  <div className="col-12 col-lg-6">
                    <div className="card shadow-sm border-0 rounded-3 h-100 bg-white">
                      <div className="card-header bg-white py-3 fw-bold text-dark border-bottom d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-cash-stack text-success me-2"></i> CTC Package & Salary Range (Placed Students)</span>
                        <span className="badge bg-light text-success border">LPA Buckets</span>
                      </div>
                      <div className="card-body p-4" style={{ height: '280px' }}>
                        <Bar
                          data={{
                            labels: Object.keys(analytics.salaryDistribution || {}),
                            datasets: [
                              {
                                label: 'Students Placed',
                                data: Object.values(analytics.salaryDistribution || {}),
                                backgroundColor: ['#60a5fa', '#34d399', '#f59e0b', '#8b5cf6'],
                                borderRadius: 4,
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            scales: { y: { beginAtZero: true, title: { display: true, text: 'Placed Students' } } },
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. VISUAL CHARTS ROW 3: CAREER GOALS & DOMAIN INTERESTS */}
                <div className="row g-4 mb-4">
                  {/* Career Goal Breakdown Doughnut */}
                  <div className="col-12 col-lg-5">
                    <div className="card shadow-sm border-0 rounded-3 h-100 bg-white">
                      <div className="card-header bg-white py-3 fw-bold text-dark border-bottom">
                        <i className="bi bi-compass text-primary me-2"></i> Final Career Goal Distribution
                      </div>
                      <div className="card-body p-4 d-flex align-items-center justify-content-center" style={{ height: '290px' }}>
                        <Doughnut
                          data={{
                            labels: ['Placement', 'Higher Studies (India)', 'Higher Studies (Abroad)', 'Entrepreneurship', 'Undecided'],
                            datasets: [
                              {
                                data: [
                                  analytics.careerGoals?.placement || 0,
                                  analytics.higherStudiesLocation?.india || 0,
                                  analytics.higherStudiesLocation?.abroad || 0,
                                  analytics.careerGoals?.entrepreneurship || 0,
                                  analytics.careerGoals?.undecided || 0,
                                ],
                                backgroundColor: ['#0284c7', '#059669', '#10b981', '#f59e0b', '#94a3b8'],
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            plugins: { legend: { position: 'right' } },
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Technical Domain Interests Bar */}
                  <div className="col-12 col-lg-7">
                    <div className="card shadow-sm border-0 rounded-3 h-100 bg-white">
                      <div className="card-header bg-white py-3 fw-bold text-dark border-bottom d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-cpu-fill text-warning me-2"></i> Student Technical Domain Specializations</span>
                        <span className="badge bg-light text-dark border">Domain Preferences</span>
                      </div>
                      <div className="card-body p-4" style={{ height: '290px' }}>
                        {analytics.domainInterests && Object.keys(analytics.domainInterests).length > 0 ? (
                          <Bar
                            data={{
                              labels: Object.keys(analytics.domainInterests),
                              datasets: [
                                {
                                  label: 'Interested Students',
                                  data: Object.values(analytics.domainInterests),
                                  backgroundColor: ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb923c', '#4ade80'],
                                  borderRadius: 4,
                                },
                              ],
                            }}
                            options={{
                              responsive: true,
                              maintainAspectRatio: false,
                              indexAxis: 'y',
                              scales: { x: { beginAtZero: true, title: { display: true, text: 'Student Count' } } },
                            }}
                          />
                        ) : (
                          <div className="text-center py-5 text-muted">
                            No domain interests registered in this filter group.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. READINESS & PORTFOLIO SKILL GAPS */}
                <div className="card shadow-sm border-0 rounded-3 mb-4 bg-white">
                  <div className="card-header bg-white py-3 fw-bold text-dark border-bottom d-flex justify-content-between align-items-center">
                    <span><i className="bi bi-shield-exclamation text-warning me-2"></i> Student Readiness & Portfolio Skill Gaps</span>
                    <span className="badge bg-warning bg-opacity-10 text-dark border border-warning">Employability Readiness</span>
                  </div>
                  <div className="card-body p-4">
                    <div className="row g-3 text-center">
                      <div className="col-12 col-md-4">
                        <div className="p-3 border rounded-3 bg-light">
                          <span className="text-muted small d-block mb-1 fw-semibold">Students Without Certifications</span>
                          <h3 className="fw-bold text-danger mb-1">{analytics.skillGaps?.withoutCertifications || 0}</h3>
                          <span className="badge bg-warning text-dark">Lacks Industry Credentials</span>
                        </div>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="p-3 border rounded-3 bg-light">
                          <span className="text-muted small d-block mb-1 fw-semibold">Students Without Projects</span>
                          <h3 className="fw-bold text-danger mb-1">{analytics.skillGaps?.withoutProjects || 0}</h3>
                          <span className="badge bg-warning text-dark">No Practical Repositories</span>
                        </div>
                      </div>
                      <div className="col-12 col-md-4">
                        <div className="p-3 border rounded-3 bg-light">
                          <span className="text-muted small d-block mb-1 fw-semibold">Students Without GitHub / LinkedIn</span>
                          <h3 className="fw-bold text-danger mb-1">{analytics.skillGaps?.withoutProfiles || 0}</h3>
                          <span className="badge bg-secondary">No Online Visibility</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6. ACADEMIC MOMENTUM: IMPROVING VS DECLINING STUDENTS */}
                <div className="row g-4 mb-4">
                  {/* Improving Students */}
                  <div className="col-12 col-lg-6">
                    <div className="card shadow-sm border-0 rounded-3 h-100 bg-white">
                      <div className="card-header bg-white py-3 fw-bold text-success border-bottom d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-arrow-up-right-circle-fill me-2"></i> Continuous Academic Improvement ({analytics.improvingStudentsCount || 0})</span>
                        <span className="badge bg-success bg-opacity-10 text-success border border-success">Rising SGPA</span>
                      </div>
                      <div className="card-body p-3">
                        {analytics.improvingStudents && analytics.improvingStudents.length > 0 ? (
                          <div className="table-responsive">
                            <table className="table table-sm table-hover mb-0 small">
                              <thead className="table-light">
                                <tr>
                                  <th>Student</th>
                                  <th>Roll No</th>
                                  <th>Prev SGPA</th>
                                  <th>Latest SGPA</th>
                                  <th>Gain</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analytics.improvingStudents.map((st) => (
                                  <tr
                                    key={st.id}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedStudentForModal(st.id)}
                                  >
                                    <td className="fw-bold text-dark">{st.name}</td>
                                    <td><span className="badge bg-light text-dark border">{st.rollNumber}</span></td>
                                    <td>{st.prevSGPA}</td>
                                    <td className="fw-bold text-success">{st.latestSGPA}</td>
                                    <td><span className="badge bg-success">+{st.diff}</span></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <span className="text-muted small">No consecutive improvement records found in current selection.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Declining Students */}
                  <div className="col-12 col-lg-6">
                    <div className="card shadow-sm border-0 rounded-3 h-100 bg-white">
                      <div className="card-header bg-white py-3 fw-bold text-danger border-bottom d-flex justify-content-between align-items-center">
                        <span><i className="bi bi-arrow-down-right-circle-fill me-2"></i> Students with Declining SGPA ({analytics.decliningStudentsCount || 0})</span>
                        <span className="badge bg-danger bg-opacity-10 text-danger border border-danger">Needs Mentoring</span>
                      </div>
                      <div className="card-body p-3">
                        {analytics.decliningStudents && analytics.decliningStudents.length > 0 ? (
                          <div className="table-responsive">
                            <table className="table table-sm table-hover mb-0 small">
                              <thead className="table-light">
                                <tr>
                                  <th>Student</th>
                                  <th>Roll No</th>
                                  <th>Prev SGPA</th>
                                  <th>Latest SGPA</th>
                                  <th>Drop</th>
                                  <th>Mentor</th>
                                </tr>
                              </thead>
                              <tbody>
                                {analytics.decliningStudents.map((st) => (
                                  <tr
                                    key={st.id}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setSelectedStudentForModal(st.id)}
                                  >
                                    <td className="fw-bold text-dark">{st.name}</td>
                                    <td><span className="badge bg-light text-dark border">{st.rollNumber}</span></td>
                                    <td>{st.prevSGPA}</td>
                                    <td className="fw-bold text-danger">{st.latestSGPA}</td>
                                    <td><span className="badge bg-danger">-{st.diff}</span></td>
                                    <td className="text-primary">{st.mentorName}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <span className="text-muted small text-success">No student SGPA declines detected in current selection!</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 7. URGENT MENTOR INTERVENTION ROSTER */}
                <div className="card shadow-sm border-0 rounded-3 mb-4 bg-white">
                  <div className="card-header bg-white py-3 fw-bold text-danger border-bottom d-flex justify-content-between align-items-center">
                    <span>
                      <i className="bi bi-shield-fill-exclamation text-danger me-2"></i>
                      Students Requiring Mentor Intervention ({analytics.mentorInterventionCount || 0})
                    </span>
                    <span className="small text-muted">Flagged by: High standing arrears, remedial requirement, or low CGPA</span>
                  </div>
                  <div className="card-body p-0">
                    {analytics.mentorInterventionStudents && analytics.mentorInterventionStudents.length > 0 ? (
                      <div className="table-responsive">
                        <table className="table table-hover align-middle mb-0 small">
                          <thead className="table-light">
                            <tr>
                              <th>Roll Number</th>
                              <th>Student Name</th>
                              <th>Section</th>
                              <th>Current CGPA</th>
                              <th>Standing Arrears</th>
                              <th>Intervention Trigger</th>
                              <th>Assigned Mentor</th>
                              <th className="text-end">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.mentorInterventionStudents.map((st) => (
                              <tr key={st.id}>
                                <td className="fw-bold font-monospace">{st.rollNumber}</td>
                                <td>{st.name}</td>
                                <td><span className="badge bg-light text-dark border">Sec {st.section || 'A'}</span></td>
                                <td><strong>{st.cgpa || 0}</strong></td>
                                <td>
                                  {st.standingArrears > 0 ? (
                                    <span className="badge bg-danger">{st.standingArrears} Arrears</span>
                                  ) : (
                                    <span className="badge bg-success">0</span>
                                  )}
                                </td>
                                <td><span className="badge bg-warning text-dark">{st.reason}</span></td>
                                <td className="text-primary fw-semibold">{st.assignedMentor}</td>
                                <td className="text-end">
                                  <button
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => setSelectedStudentForModal(st.id)}
                                  >
                                    View Profile
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-success">
                        <i className="bi bi-shield-check fs-2 d-block mb-1"></i>
                        No students currently flagged for critical mentor intervention in these records.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PAGE 2: MY MENTEES DIRECTORY (VIEW ONLY - Requirement 1) */}
        {/* ======================================================== */}
        {activeTab === 'students' && (
          <div className="card shadow-sm border-0 rounded-3">
            <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h5 className="fw-bold mb-0 text-dark d-flex align-items-center">
                  <i className="bi bi-people-fill text-primary me-2"></i> My Mentees Directory
                </h5>
                <span className="text-muted small">
                  View-only directory of students assigned under your mentorship. Click on any student to open their comprehensive profile.
                </span>
              </div>
              <button
                className="btn btn-outline-success btn-sm"
                onClick={() => setShowCustomExportModal(true)}
              >
                <i className="bi bi-download me-1"></i> Export Mentees Excel
              </button>
            </div>

            <div className="card-body p-3 bg-light border-bottom">
              <div className="row g-2 align-items-end">
                <div className="col-12 col-md-4">
                  <label className="form-label small fw-semibold text-muted mb-1">Search Mentees</label>
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Search name, roll number, email..."
                      value={studentSearch}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </div>
                </div>

                <div className="col-6 col-md-3">
                  <label className="form-label small fw-semibold text-muted mb-1">Section</label>
                  <select
                    className="form-select form-select-sm"
                    value={studentSection}
                    onChange={(e) => setStudentSection(e.target.value)}
                  >
                    <option value="all">All Sections</option>
                    <option value="A">Section A</option>
                    <option value="B">Section B</option>
                    <option value="C">Section C</option>
                    <option value="D">Section D</option>
                  </select>
                </div>

                <div className="col-6 col-md-3">
                  <label className="form-label small fw-semibold text-muted mb-1">Category</label>
                  <select
                    className="form-select form-select-sm"
                    value={studentCategory}
                    onChange={(e) => setStudentCategory(e.target.value)}
                  >
                    <option value="all">All Categories</option>
                    <option value="Day Scholar">Day Scholar</option>
                    <option value="Hosteller">Hosteller</option>
                  </select>
                </div>

                <div className="col-12 col-md-2">
                  <button
                    className="btn btn-primary btn-sm w-100"
                    onClick={() => loadMentees(1)}
                  >
                    <i className="bi bi-funnel-fill me-1"></i> Filter
                  </button>
                </div>
              </div>
            </div>

            <div className="card-body p-0">
              {studentsLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status"></div>
                  <p className="mt-2 text-muted small">Loading your mentees...</p>
                </div>
              ) : students.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-person-x fs-1 text-secondary d-block mb-2"></i>
                  No mentees currently assigned to your mentorship matching the filter.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light small text-uppercase">
                      <tr>
                        <th>Roll Number</th>
                        <th>Student Name</th>
                        <th>Email</th>
                        <th>Sec</th>
                        <th>Category</th>
                        <th>CGPA</th>
                        <th>Standing Arrears</th>
                        <th>History</th>
                        <th>Placement</th>
                        <th>Career Goal</th>
                        <th className="text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((st) => (
                        <tr
                          key={st._id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => setSelectedStudentForModal(st._id)}
                        >
                          <td className="fw-bold font-monospace text-primary">{st.rollNumber}</td>
                          <td className="fw-semibold text-dark">{st.name}</td>
                          <td className="small text-muted">{st.email}</td>
                          <td><span className="badge bg-light text-dark border">{st.section || 'A'}</span></td>
                          <td>
                            <span className={`badge ${st.studentCategory === 'Hosteller' ? 'bg-secondary' : 'bg-light text-dark border'}`}>
                              {st.studentCategory || 'Day Scholar'}
                            </span>
                          </td>
                          <td className="fw-bold">{st.currentCGPA || '—'}</td>
                          <td>
                            {(st.standingArrearsCount || 0) > 0 ? (
                              <span className="badge bg-danger">
                                {st.standingArrearsCount} Standing
                              </span>
                            ) : (
                              <span className="badge bg-success-subtle text-success">Clear</span>
                            )}
                          </td>
                          <td>
                            {(Array.isArray(st.arrears) ? st.arrears.length : (st.historyArrearsCount || 0)) > 0 ? (
                              <span className="badge bg-warning-subtle text-dark border">
                                {Array.isArray(st.arrears) ? st.arrears.length : st.historyArrearsCount} Ever
                              </span>
                            ) : (
                              <span className="badge bg-light text-muted">0</span>
                            )}
                          </td>
                          <td>
                            {st.careerGoal?.primaryGoal === 'Placement' ? (
                              st.placementStatus?.isPlaced ? (
                                <span className="badge bg-success">
                                  Placed ({st.placementStatus.placementType || 'On'})
                                </span>
                              ) : (
                                <span className="badge bg-light text-muted">Unplaced</span>
                              )
                            ) : (
                              <span className="badge bg-light text-secondary border">Nil</span>
                            )}
                          </td>
                          <td>
                            <span className="badge bg-info-subtle text-info border">
                              {st.careerGoal?.primaryGoal || 'Undecided'}
                            </span>
                          </td>
                          <td className="text-end" onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => setSelectedStudentForModal(st._id)}
                              title="View Full Student Profile"
                            >
                              <i className="bi bi-eye-fill me-1"></i> Profile
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {studentPagination.totalPages > 1 && (
              <div className="card-footer bg-white d-flex justify-content-between align-items-center py-2">
                <span className="small text-muted">
                  Showing page {studentPagination.page} of {studentPagination.totalPages} ({studentPagination.totalCount} mentees)
                </span>
                <div className="btn-group btn-group-sm">
                  <button
                    className="btn btn-outline-secondary"
                    disabled={studentPagination.page <= 1}
                    onClick={() => loadMentees(studentPagination.page - 1)}
                  >
                    Previous
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    disabled={studentPagination.page >= studentPagination.totalPages}
                    onClick={() => loadMentees(studentPagination.page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ======================================================== */}
        {/* PAGE 3: CENTRALIZED COMMUNICATION HUB */}
        {/* ======================================================== */}
        {activeTab === 'communication' && (
          <CommunicationHub user={currentUser} />
        )}

        {/* ======================================================== */}
        {/* TAB 4: SUPPORT & TICKETS */}
        {/* ======================================================== */}
        {activeTab === 'tickets' && (
          <TicketSupportCenter user={user} />
        )}
      </div>

      {/* FLOATING STUDENT RECORDS WINDOW */}
      {showStudentRecordsWindow && activeTab === 'analytics' && (
        <FloatingCohortWindow
          isOpen={showStudentRecordsWindow}
          onClose={() => setShowStudentRecordsWindow(false)}
          onOpen={() => setShowStudentRecordsWindow(true)}
          filteredStudents={analytics?.filteredStudents || []}
          cohortData={analytics?.filteredStudents || []}
          onViewStudent={(st) => setSelectedStudentForModal(st)}
          onSelectStudent={(studentId) => setSelectedStudentForModal(studentId)}
        />
      )}

      {/* STUDENT PROFILE MODAL */}
      {selectedStudentForModal && (
        <StudentProfileModal
          student={typeof selectedStudentForModal === 'object' ? selectedStudentForModal : null}
          studentId={typeof selectedStudentForModal === 'string' ? selectedStudentForModal : selectedStudentForModal?._id}
          onClose={() => setSelectedStudentForModal(null)}
        />
      )}

      {/* CUSTOM EXCEL EXPORT MODAL */}
      {showCustomExportModal && (
        <CustomExcelExportModal
          filters={{
            department: dept,
            search: analyticsSearch,
            section: analyticsSection,
            studentCategory: analyticsCategory,
            careerGoal: analyticsCareerGoal,
          }}
          totalMatchingCount={analytics?.filteredStudents?.length || studentPagination.totalCount}
          onClose={() => setShowCustomExportModal(false)}
          customExportFn={mentorAPI.exportCustomExcel}
        />
      )}
    </div>
  );
}
