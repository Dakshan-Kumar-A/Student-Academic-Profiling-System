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
import { Bar, Doughnut } from 'react-chartjs-2';
import Navbar from '../components/Navbar';
import FloatingCohortWindow from '../components/FloatingCohortWindow';
import StudentProfileModal from '../components/StudentProfileModal';
import CommunicationHub from '../components/CommunicationHub';
import TicketSupportCenter from '../components/TicketSupportCenter';
import CustomExcelExportModal from '../components/CustomExcelExportModal';
import { placementAPI, ticketAPI, excelAPI } from '../services/api';

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

const DEPARTMENT_OPTIONS = ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS'];
const BATCH_OPTIONS = ['2023-2027', '2024-2028', '2025-2029'];

export default function PlacementDashboard({ user }) {
  const currentUser = user || JSON.parse(localStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState('analytics'); // analytics | drives | students | unwillingness | excels | communication | tickets
  const [showCustomExportModal, setShowCustomExportModal] = useState(false);

  // Policy State
  const [policy, setPolicy] = useState(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [policyForm, setPolicyForm] = useState({
    batch: '2023-2027',
    ctcMultiplier: 2,
    minCtcIncreaseLpa: 3,
    dreamTierThresholdLpa: 10,
    allowDreamUpgrade: true,
    policyDescription: '',
  });

  // Analytics & Filtering State
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [filterBatch, setFilterBatch] = useState('2023-2027');
  const [filterDept, setFilterDept] = useState('all');
  const [filterCgpa, setFilterCgpa] = useState('all');
  const [filterPlaced, setFilterPlaced] = useState('all');
  const [filterPlacementType, setFilterPlacementType] = useState('all');
  const [filterArrears, setFilterArrears] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');

  // Floating Student Records Window & Profile View
  const [showFloatingWindow, setShowFloatingWindow] = useState(true);
  const [selectedStudentForView, setSelectedStudentForView] = useState(null);

  // Drives State
  const [drivesList, setDrivesList] = useState([]);
  const [loadingDrives, setLoadingDrives] = useState(false);
  const [showCreateDriveModal, setShowCreateDriveModal] = useState(false);
  const [editingDrive, setEditingDrive] = useState(null);
  const [driveForm, setDriveForm] = useState({
    companyName: '',
    jobLocation: '',
    companyDescription: '',
    eligibleDepartments: ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS'],
    offerType: 'Full Time',
    internshipDurationMonths: 0,
    stipend: '',
    minCGPA: 6.5,
    standingArrearsAllowed: false,
    maxStandingArrears: 0,
    historyArrearsAllowed: false,
    maxHistoryArrears: 0,
    optInDeadline: '',
    roles: [
      {
        roleName: 'Associate Software Engineer',
        ctc: '7 LPA',
        minCGPA: 6.5,
        roleDescription: '',
        roleDuties: '',
        roleRequirements: '',
      },
    ],
  });

  // Round Evaluations State
  const [activeDriveForEvaluations, setActiveDriveForEvaluations] = useState(null);
  const [evaluationData, setEvaluationData] = useState(null);
  const [loadingEvaluations, setLoadingEvaluations] = useState(false);
  const [showRoundsEditor, setShowRoundsEditor] = useState(false);
  const [editableRounds, setEditableRounds] = useState([]);
  const [savingRounds, setSavingRounds] = useState(false);

  // Aspirants Filter State
  const [aspirantDeptFilter, setAspirantDeptFilter] = useState('all');
  const [aspirantCgpaFilter, setAspirantCgpaFilter] = useState('all');
  const [aspirantPlacedFilter, setAspirantPlacedFilter] = useState('all');
  const [aspirantSearch, setAspirantSearch] = useState('');

  // Unwillingness Form Builder State
  const [unwillingnessForm, setUnwillingnessForm] = useState(null);
  const [unwillingnessSubmissions, setUnwillingnessSubmissions] = useState([]);
  const [loadingUnwillingness, setLoadingUnwillingness] = useState(false);
  const [unwillingnessDeptFilter, setUnwillingnessDeptFilter] = useState('all');
  const [unwillingnessTypeFilter, setUnwillingnessTypeFilter] = useState('all');
  const [showUnwillingnessBuilder, setShowUnwillingnessBuilder] = useState(false);
  const [unwillingnessBuilderForm, setUnwillingnessBuilderForm] = useState({
    title: 'Placement Unwillingness Undertaking & Documentation Form',
    instructions: 'Mandatory undertaking for students opting for Higher Studies or Entrepreneurship instead of campus placement.',
    deadline: '',
    customFields: [
      {
        fieldLabel: 'Primary Career Track Choice',
        fieldType: 'multiple_choice',
        isRequired: true,
        options: ['Higher Studies', 'Entrepreneurship'],
      },
      {
        fieldLabel: 'Detailed Reason for Opting Out of Campus Placements',
        fieldType: 'paragraph',
        isRequired: true,
        options: [],
      },
      {
        fieldLabel: 'Target University / Institution or Startup Venture Name',
        fieldType: 'text',
        isRequired: true,
        options: [],
      },
      {
        fieldLabel: 'Parent / Guardian Consent Status',
        fieldType: 'multiple_choice',
        isRequired: true,
        options: ['Formal parental consent obtained', 'Consent in progress'],
      },
    ],
  });

  const handleAddBuilderQuestion = () => {
    setUnwillingnessBuilderForm((prev) => ({
      ...prev,
      customFields: [
        ...(prev.customFields || []),
        { fieldLabel: 'New Question', fieldType: 'text', isRequired: false, options: ['Option 1'] },
      ],
    }));
  };

  const handleRemoveBuilderQuestion = (idx) => {
    setUnwillingnessBuilderForm((prev) => ({
      ...prev,
      customFields: (prev.customFields || []).filter((_, i) => i !== idx),
    }));
  };

  const handleUpdateBuilderQuestion = (idx, key, val) => {
    setUnwillingnessBuilderForm((prev) => {
      const fields = [...(prev.customFields || [])];
      fields[idx] = { ...fields[idx], [key]: val };
      return { ...prev, customFields: fields };
    });
  };

  const handleAddBuilderOption = (qIdx) => {
    setUnwillingnessBuilderForm((prev) => {
      const fields = [...(prev.customFields || [])];
      const opts = [...(fields[qIdx].options || []), `Option ${(fields[qIdx].options || []).length + 1}`];
      fields[qIdx] = { ...fields[qIdx], options: opts };
      return { ...prev, customFields: fields };
    });
  };

  const handleRemoveBuilderOption = (qIdx, optIdx) => {
    setUnwillingnessBuilderForm((prev) => {
      const fields = [...(prev.customFields || [])];
      const opts = (fields[qIdx].options || []).filter((_, i) => i !== optIdx);
      fields[qIdx] = { ...fields[qIdx], options: opts };
      return { ...prev, customFields: fields };
    });
  };

  const handleUpdateBuilderOption = (qIdx, optIdx, val) => {
    setUnwillingnessBuilderForm((prev) => {
      const fields = [...(prev.customFields || [])];
      const opts = [...(fields[qIdx].options || [])];
      opts[optIdx] = val;
      fields[qIdx] = { ...fields[qIdx], options: opts };
      return { ...prev, customFields: fields };
    });
  };
  const [savingUnwillingnessForm, setSavingUnwillingnessForm] = useState(false);

  // QS I-Gauge Dept Filter
  const [excel1Dept, setExcel1Dept] = useState('all');

  // Communication 3-Channels State
  const [selectedChannel, setSelectedChannel] = useState('general'); // general | drive_announcements | drive_queries
  const [channelMessages, setChannelMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [newMsgSubject, setNewMsgSubject] = useState('');
  const [newMsgContent, setNewMsgContent] = useState('');
  const [newMsgDriveId, setNewMsgDriveId] = useState('');
  const [replyTextMap, setReplyTextMap] = useState({});

  // Ticket Support State
  const [ticketsList, setTicketsList] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [showCreateTicketModal, setShowCreateTicketModal] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    ticketType: 'feature_modification',
    category: 'Analytics/Dashboard',
    priority: 'Medium',
    subject: '',
    description: '',
  });

  // 1. Initial Load: Check Policy & Analytics
  const loadPolicy = async () => {
    try {
      const res = await placementAPI.getPolicy({ batch: filterBatch });
      if (res.data.success) {
        setPolicy(res.data.policy);
        if (!res.data.isConfigured) {
          setShowPolicyModal(true);
        } else {
          setPolicyForm(res.data.policy);
        }
      }
    } catch (err) {
      console.error('Failed to load policy:', err);
    }
  };

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const params = {
        batch: filterBatch,
        department: filterDept,
        cgpaBracket: filterCgpa,
        isPlaced: filterPlaced,
        placementType: filterPlacementType,
        arrearFilter: filterArrears,
        search: filterSearch,
      };
      const res = await placementAPI.getAnalytics(params);
      if (res.data.success) {
        setAnalytics(res.data);
      }
    } catch (err) {
      console.error('Failed to load placement analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const loadDrives = async () => {
    setLoadingDrives(true);
    try {
      const res = await placementAPI.getDrives();
      if (res.data.success) {
        setDrivesList(res.data.drives);
      }
    } catch (err) {
      console.error('Failed to load drives:', err);
    } finally {
      setLoadingDrives(false);
    }
  };

  const loadUnwillingnessSubmissions = async () => {
    setLoadingUnwillingness(true);
    try {
      const formRes = await placementAPI.getUnwillingnessForm();
      if (formRes.data.success && formRes.data.form) {
        setUnwillingnessForm(formRes.data.form);
        const f = formRes.data.form;
        if (f.customFields && f.customFields.length > 0) {
          setUnwillingnessBuilderForm({
            title: f.title || 'Placement Unwillingness Undertaking & Documentation Form',
            instructions: f.instructions || '',
            deadline: f.deadline ? f.deadline.split('T')[0] : '',
            customFields: f.customFields,
          });
        }
      }
      const subsRes = await placementAPI.getUnwillingnessSubmissions({
        department: unwillingnessDeptFilter,
        careerGoalChoice: unwillingnessTypeFilter,
      });
      if (subsRes.data.success) {
        setUnwillingnessSubmissions(subsRes.data.submissions);
      }
    } catch (err) {
      console.error('Failed to load unwillingness records:', err);
    } finally {
      setLoadingUnwillingness(false);
    }
  };

  const loadChannelMessages = async () => {
    setLoadingMessages(true);
    try {
      const res = await placementAPI.getChannelMessages({ channel: selectedChannel });
      if (res.data.success) {
        setChannelMessages(res.data.messages);
      }
    } catch (err) {
      console.error('Failed to load channel messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const res = await ticketAPI.getTickets();
      if (res.data.success) {
        setTicketsList(res.data.tickets);
      }
    } catch (err) {
      console.error('Failed to load tickets:', err);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    loadPolicy();
    loadAnalytics();
    loadDrives();
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics();
    if (activeTab === 'drives') loadDrives();
    if (activeTab === 'unwillingness') loadUnwillingnessSubmissions();
    if (activeTab === 'communication') loadChannelMessages();
    if (activeTab === 'tickets') loadTickets();
  }, [activeTab, selectedChannel, unwillingnessDeptFilter, unwillingnessTypeFilter]);

  // Policy Save Handler
  const handleSavePolicy = async (e) => {
    e.preventDefault();
    try {
      const res = await placementAPI.savePolicy(policyForm);
      if (res.data.success) {
        setPolicy(res.data.policy);
        setShowPolicyModal(false);
        Swal.fire({
          icon: 'success',
          title: 'Policy Configured',
          text: 'Post-placement eligibility criteria is now active.',
          timer: 1800,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save policy', 'error');
    }
  };

  // Create / Edit Drive Handler
  const handleCreateDrive = async (e) => {
    e.preventDefault();
    try {
      let res;
      if (editingDrive) {
        res = await placementAPI.updateDrive(editingDrive._id, driveForm);
      } else {
        res = await placementAPI.createDrive(driveForm);
      }

      if (res.data.success) {
        setShowCreateDriveModal(false);
        setEditingDrive(null);
        loadDrives();
        Swal.fire({
          icon: 'success',
          title: editingDrive ? 'Drive Updated!' : 'Placement Drive Posted!',
          text: `${driveForm.companyName} has been ${editingDrive ? 'updated' : 'published'} successfully.`,
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save drive', 'error');
    }
  };

  const handleOpenEditDrive = (drive) => {
    setEditingDrive(drive);
    setDriveForm({
      companyName: drive.companyName || '',
      jobLocation: drive.jobLocation || '',
      companyDescription: drive.companyDescription || '',
      eligibleDepartments: drive.eligibleDepartments || ['CSE', 'IT', 'ECE', 'EEE', 'MECH', 'CIVIL', 'AIDS'],
      offerType: drive.offerType || 'Full Time',
      internshipDurationMonths: drive.internshipDurationMonths || 0,
      stipend: drive.stipend || '',
      minCGPA: drive.minCGPA || 0,
      standingArrearsAllowed: drive.standingArrearsAllowed || false,
      maxStandingArrears: drive.maxStandingArrears || 0,
      historyArrearsAllowed: drive.historyArrearsAllowed || false,
      maxHistoryArrears: drive.maxHistoryArrears || 0,
      optInDeadline: drive.optInDeadline ? drive.optInDeadline.substring(0, 16) : '',
      roles: drive.roles?.length > 0 ? drive.roles : [
        { roleName: 'Associate Software Engineer', ctc: '7 LPA', minCGPA: 6.5 }
      ],
    });
    setShowCreateDriveModal(true);
  };

  const handleDeleteDrive = async (driveId, companyName) => {
    const confirm = await Swal.fire({
      title: `Delete ${companyName}?`,
      text: 'Are you sure you want to delete this placement drive? All opt-ins and round evaluations will be removed.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, Delete Drive',
    });

    if (confirm.isConfirmed) {
      try {
        const res = await placementAPI.deleteDrive(driveId);
        if (res.data.success) {
          Swal.fire('Deleted', res.data.message || 'Drive deleted successfully.', 'success');
          loadDrives();
        }
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Failed to delete drive', 'error');
      }
    }
  };

  // Open Round Evaluations Modal
  const handleOpenEvaluations = async (drive) => {
    setActiveDriveForEvaluations(drive);
    setLoadingEvaluations(true);
    setShowRoundsEditor(false);
    try {
      const res = await placementAPI.getEvaluations(drive._id);
      if (res.data.success) {
        setEvaluationData(res.data);
        setEditableRounds(res.data.rounds || drive.rounds || []);
      }
    } catch (err) {
      Swal.fire('Error', 'Failed to load round evaluations', 'error');
    } finally {
      setLoadingEvaluations(false);
    }
  };

  // Save Dynamic Rounds of Drive
  const handleSaveDynamicRounds = async () => {
    if (!activeDriveForEvaluations) return;
    if (editableRounds.length === 0) {
      Swal.fire('Required', 'At least one round is required.', 'warning');
      return;
    }

    setSavingRounds(true);
    try {
      const res = await placementAPI.updateDriveRounds(activeDriveForEvaluations._id, {
        rounds: editableRounds,
      });
      if (res.data.success) {
        setEvaluationData({
          ...evaluationData,
          rounds: res.data.rounds,
          evaluations: res.data.evaluations,
        });
        setShowRoundsEditor(false);
        Swal.fire({
          icon: 'success',
          title: 'Rounds Synchronized',
          text: 'Drive rounds updated and synchronized across all candidate evaluations.',
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save rounds', 'error');
    } finally {
      setSavingRounds(false);
    }
  };

  // Update a Student Round Evaluation
  const handleUpdateStudentRound = async (studentId, roundNumber, status, isFinal = false, defaultRole = '', defaultCTC = '') => {
    if (!activeDriveForEvaluations) return;

    let placedRole = defaultRole;
    let placedCTC = defaultCTC;

    if (status === 'Placed') {
      const { value: formValues } = await Swal.fire({
        title: 'Mark Student as Placed',
        html: `
          <div class="text-start mb-2">
            <label class="form-label small fw-semibold text-muted">Job Role Offered</label>
            <input id="swal-role" class="form-control form-control-sm" value="${defaultRole || activeDriveForEvaluations.roles?.[0]?.roleName || 'Software Engineer'}" />
          </div>
          <div class="text-start">
            <label class="form-label small fw-semibold text-muted">Package CTC (LPA)</label>
            <input id="swal-ctc" class="form-control form-control-sm" value="${defaultCTC || activeDriveForEvaluations.roles?.[0]?.ctc || '7.5 LPA'}" />
          </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Confirm Placement',
        preConfirm: () => {
          return [
            document.getElementById('swal-role').value,
            document.getElementById('swal-ctc').value,
          ];
        },
      });

      if (!formValues) return;
      [placedRole, placedCTC] = formValues;
    }

    try {
      const res = await placementAPI.updateEvaluation(activeDriveForEvaluations._id, {
        studentId,
        roundNumber,
        status,
        isFinalRound: isFinal,
        placedRole,
        placedCTC,
      });
      if (res.data.success) {
        const updatedRes = await placementAPI.getEvaluations(activeDriveForEvaluations._id);
        if (updatedRes.data.success) {
          setEvaluationData(updatedRes.data);
        }
        Swal.fire({
          icon: 'success',
          title: 'Evaluation Updated',
          text: `Outcome marked as ${status}. Dynamic Excels updated.`,
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Update failed', 'error');
    }
  };

  // Save Custom Unwillingness Form Builder
  const handleSaveUnwillingnessForm = async (e) => {
    e.preventDefault();
    setSavingUnwillingnessForm(true);
    try {
      const res = await placementAPI.saveUnwillingnessForm(unwillingnessBuilderForm);
      if (res.data.success) {
        setUnwillingnessForm(res.data.form);
        setShowUnwillingnessBuilder(false);
        Swal.fire({
          icon: 'success',
          title: 'Unwillingness Form Updated',
          text: 'New instructions and undertaking template published for non-placement students.',
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save form settings', 'error');
    } finally {
      setSavingUnwillingnessForm(false);
    }
  };

  // Permit Placement Switch (Unlock Unwillingness)
  const handlePermitPlacementSwitch = async (submissionId, studentName) => {
    const result = await Swal.fire({
      title: 'Permit Placement Opt-in?',
      html: `Allow <strong>${studentName}</strong> to switch back to Campus Placement? This will unlock their profile and make them eligible for placement drives.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Permit Switch',
      confirmButtonColor: '#16a34a',
    });

    if (result.isConfirmed) {
      try {
        const res = await placementAPI.permitPlacementSwitch(submissionId);
        if (res.data.success) {
          loadUnwillingnessSubmissions();
          Swal.fire('Permission Granted', res.data.message, 'success');
        }
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Failed to permit switch', 'error');
      }
    }
  };

  // Send Message in 3-Channels
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMsgSubject.trim() || !newMsgContent.trim()) return;

    try {
      const res = await placementAPI.postChannelMessage({
        channel: selectedChannel,
        driveId: newMsgDriveId || undefined,
        subject: newMsgSubject,
        content: newMsgContent,
      });

      if (res.data.success) {
        setNewMsgSubject('');
        setNewMsgContent('');
        setNewMsgDriveId('');
        loadChannelMessages();
        Swal.fire({
          icon: 'success',
          title: 'Message Posted',
          text: `Message published to ${selectedChannel.replace('_', ' ')}.`,
          timer: 1500,
          showConfirmButton: false,
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to post message', 'error');
    }
  };

  // Reply to Message Thread
  const handleReplyMessage = async (msgId) => {
    const replyContent = replyTextMap[msgId];
    if (!replyContent || !replyContent.trim()) return;

    try {
      const res = await placementAPI.replyChannelMessage(msgId, { content: replyContent });
      if (res.data.success) {
        setReplyTextMap({ ...replyTextMap, [msgId]: '' });
        loadChannelMessages();
      }
    } catch (err) {
      Swal.fire('Error', 'Failed to submit reply', 'error');
    }
  };

  // Create Ticket
  const handleCreateTicket = async (e) => {
    e.preventDefault();
    try {
      const res = await ticketAPI.createTicket(ticketForm);
      if (res.data.success) {
        setShowCreateTicketModal(false);
        setTicketForm({
          ticketType: 'feature_modification',
          category: 'Analytics/Dashboard',
          priority: 'Medium',
          subject: '',
          description: '',
        });
        loadTickets();
        Swal.fire('Ticket Raised', res.data.message, 'success');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to raise ticket', 'error');
    }
  };

  // Chart Data: Department Placements
  const deptLabels = Object.keys(analytics?.departmentBreakdown || {});
  const deptPlacedCounts = deptLabels.map((d) => analytics.departmentBreakdown[d].placed);
  const deptTotalCounts = deptLabels.map((d) => analytics.departmentBreakdown[d].total);

  const deptChartData = {
    labels: deptLabels,
    datasets: [
      {
        label: 'Placed Students',
        data: deptPlacedCounts,
        backgroundColor: '#16a34a',
      },
      {
        label: 'Total Aspirants',
        data: deptTotalCounts,
        backgroundColor: '#cbd5e1',
      },
    ],
  };

  return (
    <div className="min-vh-100 bg-light">
      <Navbar user={user} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* TOP SUB-NAVBAR */}
      <div className="bg-white border-bottom shadow-sm px-3 py-2 sticky-top">
        <div className="container-fluid d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="btn-group btn-group-sm flex-wrap">
            <button
              className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('analytics')}
            >
              <i className="bi bi-graph-up-arrow me-1"></i> Placement Intelligence
            </button>
            <button
              className={`btn ${activeTab === 'drives' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('drives')}
            >
              <i className="bi bi-briefcase-fill me-1"></i> Placement Drives ({drivesList.length})
            </button>
            <button
              className={`btn ${activeTab === 'students' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('students')}
            >
              <i className="bi bi-people-fill me-1"></i> Placement Aspirants
            </button>
            <button
              className={`btn ${activeTab === 'unwillingness' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('unwillingness')}
            >
              <i className="bi bi-file-earmark-lock-fill me-1"></i> Unwillingness Forms
            </button>
            <button
              className={`btn ${activeTab === 'excels' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('excels')}
            >
              <i className="bi bi-file-earmark-excel-fill text-success me-1"></i> Excels Center
            </button>
            <button
              className={`btn ${activeTab === 'communication' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('communication')}
            >
              <i className="bi bi-chat-left-dots-fill me-1"></i> Communication
            </button>
            <button
              className={`btn ${activeTab === 'tickets' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('tickets')}
            >
              <i className="bi bi-ticket-perforated me-1"></i> Support Desk
            </button>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-sm btn-outline-dark"
              onClick={() => setShowPolicyModal(true)}
              title="Post-placement drive eligibility criteria"
            >
              <i className="bi bi-gear-fill me-1"></i> Criteria Policy {policy && !policy.isConfigured && <span className="badge bg-danger ms-1">Pending</span>}
            </button>
            {activeTab === 'analytics' && (
              <button
                className="btn btn-sm btn-outline-primary"
                onClick={() => setShowFloatingWindow(!showFloatingWindow)}
                title="Toggle Student Records Floating Window"
              >
                <i className="bi bi-window-stack me-1"></i> Student Records Window
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="container-fluid px-3 px-md-4 py-3">

        {/* POLICY PENDING WARNING BANNER */}
        {policy && !policy.isConfigured && (
          <div className="alert alert-warning border-warning shadow-sm d-flex justify-content-between align-items-center mb-3">
            <div>
              <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
              <strong>Action Required:</strong> Post-placement drive policy criteria has not been configured for batch {filterBatch}. Please configure multiplier and dream rules.
            </div>
            <button className="btn btn-warning btn-sm fw-bold" onClick={() => setShowPolicyModal(true)}>
              Configure Criteria
            </button>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: PLACEMENT INTELLIGENCE & ANALYTICS */}
        {/* ======================================================== */}
        {activeTab === 'analytics' && (
          <div className="space-y-4">
            {/* KPI METRIC CARDS - PLACEMENT ONLY */}
            <div className="row g-3 mb-3">
              <div className="col-6 col-md-3">
                <div className="card shadow-sm border-0 border-start border-primary border-4 p-3 bg-white h-100">
                  <span className="text-muted small fw-bold text-uppercase">Placement Aspirants</span>
                  <h3 className="fw-bold text-primary mb-0 mt-1">{analytics?.metrics?.totalAspirants || 0}</h3>
                  <small className="text-muted">Opted for campus placement</small>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card shadow-sm border-0 border-start border-success border-4 p-3 bg-white h-100">
                  <span className="text-muted small fw-bold text-uppercase">Placed / Rate</span>
                  <div className="d-flex align-items-baseline gap-2 mt-1">
                    <h3 className="fw-bold text-success mb-0">{analytics?.metrics?.totalPlaced || 0}</h3>
                    <span className="badge bg-success-subtle text-success fs-6">
                      {analytics?.metrics?.placementRate || 0}%
                    </span>
                  </div>
                  <small className="text-muted">{analytics?.metrics?.totalUnplaced || 0} currently unplaced</small>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card shadow-sm border-0 border-start border-info border-4 p-3 bg-white h-100">
                  <span className="text-muted small fw-bold text-uppercase">Average CTC</span>
                  <h3 className="fw-bold text-info text-dark mb-0 mt-1">{analytics?.metrics?.avgCtc || 0} LPA</h3>
                  <small className="text-muted">Median: {analytics?.metrics?.medianCtc || 0} LPA</small>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card shadow-sm border-0 border-start border-warning border-4 p-3 bg-white h-100">
                  <span className="text-muted small fw-bold text-uppercase">Highest CTC</span>
                  <h3 className="fw-bold text-warning mb-0 mt-1">{analytics?.metrics?.highestCtc || 0} LPA</h3>
                  <small className="text-muted">{analytics?.metrics?.activeDrives || 0} active drives</small>
                </div>
              </div>
            </div>

            {/* DYNAMIC PLACEMENT FILTER TOOLBAR */}
            <div className="card shadow-sm border-0 rounded-3 mb-4">
              <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0 text-slate-800">
                  <i className="bi bi-funnel-fill text-primary me-2"></i> Placement Intelligence Filters
                </h6>
                <div className="d-flex align-items-center gap-2">
                  <button
                    className="btn btn-primary btn-sm fw-semibold"
                    onClick={loadAnalytics}
                  >
                    <i className="bi bi-funnel-fill me-1"></i> Apply Filters
                  </button>
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => {
                      setFilterBatch('2023-2027');
                      setFilterDept('all');
                      setFilterCgpa('all');
                      setFilterPlaced('all');
                      setFilterPlacementType('all');
                      setFilterArrears('all');
                      setFilterSearch('');
                      loadAnalytics();
                    }}
                  >
                    <i className="bi bi-arrow-counterclockwise me-1"></i> Reset Filters
                  </button>
                </div>
              </div>
              <div className="card-body p-3 bg-light">
                <div className="row g-2">
                  <div className="col-6 col-md-2">
                    <label className="form-label small fw-semibold text-muted mb-1">Batch / Year</label>
                    <select
                      className="form-select form-select-sm"
                      value={filterBatch}
                      onChange={(e) => setFilterBatch(e.target.value)}
                    >
                      <option value="all">All Batches</option>
                      {BATCH_OPTIONS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label small fw-semibold text-muted mb-1">Department</label>
                    <select
                      className="form-select form-select-sm"
                      value={filterDept}
                      onChange={(e) => setFilterDept(e.target.value)}
                    >
                      <option value="all">All Departments</option>
                      {DEPARTMENT_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label small fw-semibold text-muted mb-1">CGPA Range</label>
                    <select
                      className="form-select form-select-sm"
                      value={filterCgpa}
                      onChange={(e) => setFilterCgpa(e.target.value)}
                    >
                      <option value="all">All CGPA</option>
                      <option value="9-10">&ge; 9.0 CGPA</option>
                      <option value="8-8.99">8.0 - 8.99 CGPA</option>
                      <option value="7-7.99">7.0 - 7.99 CGPA</option>
                      <option value="6-6.99">6.0 - 6.99 CGPA</option>
                      <option value="below-6">&lt; 6.0 CGPA</option>
                    </select>
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label small fw-semibold text-muted mb-1">Placement Status</label>
                    <select
                      className="form-select form-select-sm"
                      value={filterPlaced}
                      onChange={(e) => setFilterPlaced(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="true">Placed Only</option>
                      <option value="false">Unplaced Only</option>
                    </select>
                  </div>
                  <div className="col-6 col-md-2">
                    <label className="form-label small fw-semibold text-muted mb-1">Arrears</label>
                    <select
                      className="form-select form-select-sm"
                      value={filterArrears}
                      onChange={(e) => setFilterArrears(e.target.value)}
                    >
                      <option value="all">All Arrear Records</option>
                      <option value="zero_standing">0 Standing Arrears</option>
                      <option value="has_standing">Has Standing Arrears</option>
                      <option value="history_cleared">History of Cleared Arrears</option>
                    </select>
                  </div>
                  <div className="col-12 col-md-2">
                    <label className="form-label small fw-semibold text-muted mb-1">Search Student</label>
                    <div className="input-group input-group-sm">
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Roll #, Name..."
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadAnalytics()}
                      />
                      <button className="btn btn-primary" onClick={loadAnalytics}>
                        <i className="bi bi-search"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CHARTS ROW */}
            <div className="row g-3">
              <div className="col-12 col-lg-8">
                <div className="card shadow-sm border-0 rounded-3 p-3 bg-white h-100">
                  <h6 className="fw-bold text-dark mb-3">
                    <i className="bi bi-bar-chart-fill text-primary me-2"></i> Department-wise Placement Statistics
                  </h6>
                  <div style={{ minHeight: '260px' }}>
                    <Bar
                      data={deptChartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'top' } },
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="col-12 col-lg-4">
                <div className="card shadow-sm border-0 rounded-3 p-3 bg-white h-100">
                  <h6 className="fw-bold text-dark mb-3">
                    <i className="bi bi-trophy-fill text-warning me-2"></i> Top Recruiting Companies
                  </h6>
                  <ul className="list-group list-group-flush">
                    {(analytics?.companyLeaderboard || []).length === 0 ? (
                      <li className="list-group-item text-muted small py-3">No placements recorded yet.</li>
                    ) : (
                      analytics.companyLeaderboard.map((item, idx) => (
                        <li key={idx} className="list-group-item d-flex justify-content-between align-items-center px-0 py-2">
                          <span className="fw-semibold text-dark">{item.company}</span>
                          <span className="badge bg-primary rounded-pill">{item.count} offers</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: PLACEMENT DRIVES (CRUD + ROUNDS) */}
        {/* ======================================================== */}
        {activeTab === 'drives' && (
          <div className="space-y-4">
            <div className="card shadow-sm border-0 rounded-3">
              <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <h5 className="fw-bold mb-0 text-slate-800">
                    <i className="bi bi-briefcase-fill text-primary me-2"></i> Campus Placement Drives & Rounds Evaluator
                  </h5>
                  <small className="text-muted">Manage college-wide recruitment drives, configure offer types, and evaluate rounds.</small>
                </div>
                <div className="d-flex gap-2">
                  <button className="btn btn-outline-primary btn-sm" onClick={loadDrives}>
                    <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowCreateDriveModal(true)}>
                    <i className="bi bi-plus-lg me-1"></i> Create Placement Drive
                  </button>
                </div>
              </div>

              {/* Drives Table / Cards */}
              <div className="p-3">
                {loadingDrives ? (
                  <div className="text-center py-5 text-muted">Loading drives...</div>
                ) : drivesList.length === 0 ? (
                  <div className="text-center py-5 text-muted">No placement drives posted yet.</div>
                ) : (
                  <div className="row g-3">
                    {drivesList.map((d) => (
                      <div key={d._id} className="col-12 col-lg-6">
                        <div className="card shadow-sm border rounded-3 p-3 bg-white h-100">
                          <div className="d-flex justify-content-between align-items-start mb-2">
                            <div>
                              <h5 className="fw-bold text-dark mb-1">{d.companyName}</h5>
                              <span className="badge bg-primary-subtle text-primary border border-primary me-2">
                                {d.offerType}
                              </span>
                              <span className="text-muted small">
                                <i className="bi bi-geo-alt me-1"></i> {d.jobLocation}
                              </span>
                            </div>
                            <span className={`badge ${d.status === 'Active' ? 'bg-success' : 'bg-secondary'}`}>
                              {d.status}
                            </span>
                          </div>

                          <div className="small text-muted mb-2">
                            <strong>Eligible Depts:</strong> {(d.eligibleDepartments || []).join(', ')}
                          </div>
                          <div className="small text-muted mb-2">
                            <strong>Roles & Package:</strong> {(d.roles || []).map((r) => `${r.roleName} (${r.ctc})`).join('; ')}
                          </div>
                          {d.offerType.includes('Intern') && (
                            <div className="small text-muted mb-2">
                              <strong>Intern Duration:</strong> {d.internshipDurationMonths} months | <strong>Stipend:</strong> {d.stipend || 'Unspecified'}
                            </div>
                          )}
                          <div className="small text-muted mb-3">
                            <strong>Opt-in Deadline:</strong> {new Date(d.optInDeadline).toLocaleString()}
                          </div>

                          <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-auto">
                            <span className="small fw-semibold text-secondary">
                              <i className="bi bi-people me-1"></i> {(d.optIns || []).filter((o) => o.status === 'Opted-In').length} Opted-In
                            </span>
                            <div className="btn-group btn-group-sm">
                              <button
                                className="btn btn-primary"
                                onClick={() => handleOpenEvaluations(d)}
                              >
                                <i className="bi bi-list-check me-1"></i> Rounds Evaluator
                              </button>
                              <button
                                className="btn btn-outline-secondary"
                                onClick={() => handleOpenEditDrive(d)}
                                title="Edit Drive Details"
                              >
                                <i className="bi bi-pencil"></i> Edit
                              </button>
                              <button
                                className="btn btn-outline-danger"
                                onClick={() => handleDeleteDrive(d._id, d.companyName)}
                                title="Delete Drive"
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: PLACEMENT ASPIRANTS DIRECTORY */}
        {/* ======================================================== */}
        {activeTab === 'students' && (
          <div className="card shadow-sm border-0 rounded-3">
            <div className="card-header bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
              <div>
                <h5 className="fw-bold mb-0 text-slate-800">
                  <i className="bi bi-people-fill text-primary me-2"></i> Campus Placement Aspirants
                </h5>
                <small className="text-muted">Showing students opted for Placement, ordered by Roll Number by default.</small>
              </div>
              <button className="btn btn-outline-primary btn-sm" onClick={loadAnalytics}>
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh
              </button>
            </div>

            {/* Aspirants Filter Controls */}
            <div className="card-body p-3 bg-light border-bottom">
              <div className="row g-2">
                <div className="col-6 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={aspirantDeptFilter}
                    onChange={(e) => setAspirantDeptFilter(e.target.value)}
                  >
                    <option value="all">All Departments</option>
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="col-6 col-md-2">
                  <select
                    className="form-select form-select-sm"
                    value={aspirantCgpaFilter}
                    onChange={(e) => setAspirantCgpaFilter(e.target.value)}
                  >
                    <option value="all">All CGPA</option>
                    <option value="9">&ge; 9.0 CGPA</option>
                    <option value="8">&ge; 8.0 CGPA</option>
                    <option value="7">&ge; 7.0 CGPA</option>
                    <option value="6">&ge; 6.0 CGPA</option>
                  </select>
                </div>
                <div className="col-6 col-md-2">
                  <select
                    className="form-select form-select-sm"
                    value={aspirantPlacedFilter}
                    onChange={(e) => setAspirantPlacedFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="placed">Placed Only</option>
                    <option value="unplaced">Unplaced Only</option>
                  </select>
                </div>
                <div className="col-12 col-md-3">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Search Roll #, Name..."
                    value={aspirantSearch}
                    onChange={(e) => setAspirantSearch(e.target.value)}
                  />
                </div>
                <div className="col-12 col-md-2 text-end">
                  <button
                    className="btn btn-sm btn-outline-secondary w-100"
                    onClick={() => {
                      setAspirantDeptFilter('all');
                      setAspirantCgpaFilter('all');
                      setAspirantPlacedFilter('all');
                      setAspirantSearch('');
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light text-muted small text-uppercase">
                  <tr>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Dept & Sec</th>
                    <th>CGPA</th>
                    <th>Standing Arrears</th>
                    <th>Placement Status</th>
                    <th>Placed Role & Package</th>
                    <th className="text-end">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filteredAspirants = (analytics?.students || []).filter((st) => {
                      if (aspirantDeptFilter !== 'all' && (st.department || '').toUpperCase() !== aspirantDeptFilter.toUpperCase()) return false;
                      if (aspirantCgpaFilter !== 'all' && (st.currentCGPA || 0) < Number(aspirantCgpaFilter)) return false;
                      if (aspirantPlacedFilter === 'placed' && !st.placementStatus?.isPlaced && st.isPlaced !== 'Yes') return false;
                      if (aspirantPlacedFilter === 'unplaced' && (st.placementStatus?.isPlaced || st.isPlaced === 'Yes')) return false;
                      if (aspirantSearch.trim()) {
                        const q = aspirantSearch.trim().toLowerCase();
                        const match = (st.name || '').toLowerCase().includes(q) || (st.rollNumber || '').toLowerCase().includes(q);
                        if (!match) return false;
                      }
                      return true;
                    });

                    if (filteredAspirants.length === 0) {
                      return <tr><td colSpan="8" className="text-center py-5 text-muted">No placement aspirants found matching filters.</td></tr>;
                    }

                    return filteredAspirants.map((st) => (
                      <tr key={st._id}>
                        <td className="fw-bold font-monospace text-primary">{st.rollNumber}</td>
                        <td className="fw-semibold text-dark">{st.name}</td>
                        <td>{st.department} - {st.section}</td>
                        <td className="fw-bold">{st.currentCGPA?.toFixed(2)}</td>
                        <td>
                          <span className={`badge ${st.standingArrearsCount > 0 ? 'bg-danger' : 'bg-success'}`}>
                            {st.standingArrearsCount} Standing
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${st.placementStatus?.isPlaced || st.isPlaced === 'Yes' ? 'bg-success' : 'bg-secondary'}`}>
                            {st.placementStatus?.isPlaced || st.isPlaced === 'Yes' ? 'Placed' : 'Unplaced'}
                          </span>
                        </td>
                        <td className="small">
                          {st.placementStatus?.isPlaced || st.isPlaced === 'Yes'
                            ? `${st.placementStatus?.companyName || st.placedCompany} (${st.placementStatus?.packageCTC || st.salaryPackage} LPA)`
                            : '-'}
                        </td>
                        <td className="text-end">
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => setSelectedStudentForView(st)}
                          >
                            <i className="bi bi-eye me-1"></i> View
                          </button>
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: UNWILLINGNESS FORMS & APPROVALS */}
        {/* ======================================================== */}
        {activeTab === 'unwillingness' && (
          <div className="space-y-4">
            <div className="card shadow-sm border-0 rounded-3">
              <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
                <div>
                  <h5 className="fw-bold mb-0 text-slate-800">
                    <i className="bi bi-file-earmark-lock-fill text-danger me-2"></i> Placement Unwillingness Undertakings
                  </h5>
                  <small className="text-muted">Mandatory undertakings from students opting for Higher Studies or Entrepreneurship. Choices are locked until explicitly unlocked.</small>
                </div>
                <div className="d-flex gap-2">
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setShowUnwillingnessBuilder(!showUnwillingnessBuilder)}
                  >
                    <i className="bi bi-pencil-square me-1"></i> Form Builder & Guidelines
                  </button>
                  <a
                    href="/api/excels/5-unwillingness-and-placed"
                    download
                    className="btn btn-outline-success btn-sm"
                  >
                    <i className="bi bi-file-earmark-excel me-1"></i> Download Unwillingness Excel
                  </a>
                  <button className="btn btn-outline-primary btn-sm" onClick={loadUnwillingnessSubmissions}>
                    <i className="bi bi-arrow-clockwise me-1"></i> Refresh
                  </button>
                </div>
              </div>

              {/* Form Customization Builder Panel */}
              {showUnwillingnessBuilder && (
                <div className="p-4 bg-light border-bottom animate__animated animate__fadeIn">
                  <div className="card shadow-sm border-0 rounded-4 overflow-hidden mb-4">
                    <div style={{ height: '8px', backgroundColor: '#673ab7' }}></div>
                    <div className="card-body p-4">
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h5 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                          <i className="bi bi-ui-checks-grid text-primary"></i>
                          Google / Microsoft Form Style Builder & Publisher
                        </h5>
                        <span className="badge bg-purple-subtle text-dark border">Dynamic Online Undertaking</span>
                      </div>
                      <p className="small text-muted mb-4">
                        Build and publish dynamic questionnaires for students who opt for Higher Studies or Entrepreneurship. Published questions appear directly on the student portal.
                      </p>

                      <form onSubmit={handleSaveUnwillingnessForm}>
                        <div className="row g-3 mb-4">
                          <div className="col-md-8">
                            <label className="form-label small fw-semibold">Form Title *</label>
                            <input
                              type="text"
                              className="form-control"
                              value={unwillingnessBuilderForm.title}
                              onChange={(e) => setUnwillingnessBuilderForm({ ...unwillingnessBuilderForm, title: e.target.value })}
                              required
                            />
                          </div>
                          <div className="col-md-4">
                            <label className="form-label small fw-semibold">Submission Deadline (Optional)</label>
                            <input
                              type="date"
                              className="form-control"
                              value={unwillingnessBuilderForm.deadline || ''}
                              onChange={(e) => setUnwillingnessBuilderForm({ ...unwillingnessBuilderForm, deadline: e.target.value })}
                            />
                          </div>
                          <div className="col-12">
                            <label className="form-label small fw-semibold">Form Instructions / Description *</label>
                            <textarea
                              className="form-control"
                              rows="2"
                              value={unwillingnessBuilderForm.instructions}
                              onChange={(e) => setUnwillingnessBuilderForm({ ...unwillingnessBuilderForm, instructions: e.target.value })}
                              required
                            ></textarea>
                          </div>
                        </div>

                        {/* Questions Builder Section */}
                        <div className="mb-4">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="fw-bold text-dark mb-0">
                              Form Questions ({unwillingnessBuilderForm.customFields?.length || 0})
                            </h6>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary fw-semibold"
                              onClick={handleAddBuilderQuestion}
                            >
                              <i className="bi bi-plus-circle me-1"></i> Add Question
                            </button>
                          </div>

                          <div className="d-flex flex-column gap-3">
                            {(unwillingnessBuilderForm.customFields || []).map((q, qIdx) => (
                              <div key={qIdx} className="card border shadow-sm rounded-3 p-3 bg-white">
                                <div className="row g-3 align-items-center mb-2">
                                  <div className="col-md-7">
                                    <label className="form-label small text-muted mb-1">Question Prompt #{qIdx + 1}</label>
                                    <input
                                      type="text"
                                      className="form-control form-control-sm fw-semibold"
                                      placeholder="e.g. Target University or Startup details"
                                      value={q.fieldLabel}
                                      onChange={(e) => handleUpdateBuilderQuestion(qIdx, 'fieldLabel', e.target.value)}
                                      required
                                    />
                                  </div>
                                  <div className="col-md-3">
                                    <label className="form-label small text-muted mb-1">Question Type</label>
                                    <select
                                      className="form-select form-select-sm"
                                      value={q.fieldType}
                                      onChange={(e) => handleUpdateBuilderQuestion(qIdx, 'fieldType', e.target.value)}
                                    >
                                      <option value="text">Short Answer</option>
                                      <option value="paragraph">Paragraph</option>
                                      <option value="multiple_choice">Multiple Choice (Radio)</option>
                                      <option value="checkboxes">Checkboxes</option>
                                      <option value="dropdown">Dropdown</option>
                                      <option value="number">Number</option>
                                      <option value="link">URL / Link</option>
                                    </select>
                                  </div>
                                  <div className="col-md-2 text-end pt-3">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-danger"
                                      onClick={() => handleRemoveBuilderQuestion(qIdx)}
                                      title="Delete question"
                                    >
                                      <i className="bi bi-trash"></i>
                                    </button>
                                  </div>
                                </div>

                                {/* Options Builder for Multiple Choice, Checkboxes, Dropdown */}
                                {(q.fieldType === 'multiple_choice' || q.fieldType === 'checkboxes' || q.fieldType === 'dropdown') && (
                                  <div className="bg-light p-3 rounded mb-2">
                                    <div className="small fw-semibold text-muted mb-2">Options:</div>
                                    <div className="d-flex flex-column gap-2 mb-2">
                                      {(q.options || []).map((opt, optIdx) => (
                                        <div key={optIdx} className="input-group input-group-sm" style={{ maxWidth: '450px' }}>
                                          <span className="input-group-text bg-white">
                                            {q.fieldType === 'multiple_choice' ? (
                                              <i className="bi bi-circle"></i>
                                            ) : q.fieldType === 'checkboxes' ? (
                                              <i className="bi bi-square"></i>
                                            ) : (
                                              <i className="bi bi-caret-down"></i>
                                            )}
                                          </span>
                                          <input
                                            type="text"
                                            className="form-control"
                                            value={opt}
                                            onChange={(e) => handleUpdateBuilderOption(qIdx, optIdx, e.target.value)}
                                            placeholder="Option label"
                                            required
                                          />
                                          <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={() => handleRemoveBuilderOption(qIdx, optIdx)}
                                            disabled={(q.options || []).length <= 1}
                                          >
                                            <i className="bi bi-x"></i>
                                          </button>
                                        </div>
                                      ))}
                                    </div>
                                    <button
                                      type="button"
                                      className="btn btn-link btn-sm p-0 text-decoration-none"
                                      onClick={() => handleAddBuilderOption(qIdx)}
                                    >
                                      <i className="bi bi-plus-lg me-1"></i> Add option
                                    </button>
                                  </div>
                                )}

                                <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                                  <div className="form-check form-switch small">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      id={`req_${qIdx}`}
                                      checked={Boolean(q.isRequired)}
                                      onChange={(e) => handleUpdateBuilderQuestion(qIdx, 'isRequired', e.target.checked)}
                                    />
                                    <label className="form-check-label text-muted" htmlFor={`req_${qIdx}`}>
                                      Required question
                                    </label>
                                  </div>
                                  <small className="text-muted">Type: {q.fieldType}</small>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="text-end pt-3 border-top">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm me-2"
                            onClick={() => setShowUnwillingnessBuilder(false)}
                          >
                            Close Builder
                          </button>
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm fw-semibold"
                            style={{ backgroundColor: '#673ab7', borderColor: '#673ab7' }}
                            disabled={savingUnwillingnessForm}
                          >
                            {savingUnwillingnessForm ? 'Publishing...' : 'Publish Form to Students'}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              )}

                            {/* Submissions Filter */}
              <div className="p-3 bg-light border-bottom">
                <div className="row g-2">
                  <div className="col-6 col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={unwillingnessDeptFilter}
                      onChange={(e) => setUnwillingnessDeptFilter(e.target.value)}
                    >
                      <option value="all">All Departments</option>
                      {DEPARTMENT_OPTIONS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-6 col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={unwillingnessTypeFilter}
                      onChange={(e) => setUnwillingnessTypeFilter(e.target.value)}
                    >
                      <option value="all">All Career Goals</option>
                      <option value="Higher Studies">Higher Studies</option>
                      <option value="Entrepreneurship">Entrepreneurship</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submissions Table */}
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="table-light text-muted small text-uppercase">
                    <tr>
                      <th>Roll Number</th>
                      <th>Student Name</th>
                      <th>Department</th>
                      <th>Career Path</th>
                      <th>Details / Destination</th>
                      <th>Reason & Attachment</th>
                      <th>Status</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingUnwillingness ? (
                      <tr><td colSpan="8" className="text-center py-4 text-muted">Loading submissions...</td></tr>
                    ) : unwillingnessSubmissions.length === 0 ? (
                      <tr><td colSpan="8" className="text-center py-5 text-muted">No unwillingness undertakings submitted yet.</td></tr>
                    ) : (
                      unwillingnessSubmissions.map((sub) => (
                        <tr key={sub._id}>
                          <td className="fw-bold font-monospace text-primary">{sub.rollNumber}</td>
                          <td className="fw-semibold text-dark">{sub.name}</td>
                          <td>{sub.department}</td>
                          <td>
                            <span className={`badge ${sub.careerGoalChoice === 'Higher Studies' ? 'bg-info text-dark' : 'bg-warning text-dark'}`}>
                              {sub.careerGoalChoice}
                            </span>
                          </td>
                          <td className="small" style={{ maxWidth: '250px' }}>
                            {sub.careerGoalChoice === 'Higher Studies'
                              ? `${sub.higherStudiesDetails?.targetDegree || 'Masters'} in ${sub.higherStudiesDetails?.specialization || 'Tech'} (${sub.higherStudiesDetails?.countryPreference || 'India'})`
                              : `${sub.entrepreneurshipDetails?.startupName || 'Startup'} (${sub.entrepreneurshipDetails?.currentStage || 'Idea'})`}
                          </td>
                          <td className="small text-truncate" style={{ maxWidth: '220px' }}>
                            {sub.reasonForUnwillingness}
                          </td>
                          <td>
                            {sub.allowPlacementSwitch ? (
                              <span className="badge bg-success">Permitted to Opt-in</span>
                            ) : sub.isLocked ? (
                              <span className="badge bg-danger">Locked (Unwilling)</span>
                            ) : (
                              <span className="badge bg-secondary">Pending</span>
                            )}
                          </td>
                          <td className="text-end">
                            {!sub.allowPlacementSwitch && (
                              <button
                                className="btn btn-sm btn-outline-success"
                                onClick={() => handlePermitPlacementSwitch(sub._id, sub.name)}
                                title="Explicitly permit student to opt back into placement"
                              >
                                <i className="bi bi-unlock me-1"></i> Permit Placement
                              </button>
                            )}
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
        {/* TAB 5: 5 INSTITUTIONAL SYSTEM EXCELS CENTER */}
        {/* ======================================================== */}
        {activeTab === 'excels' && (
          <div className="space-y-4">
            <div className="card shadow-sm border-0 rounded-3 mb-4">
              <div className="card-header bg-white py-3 border-bottom">
                <h5 className="fw-bold mb-1 text-slate-800 d-flex align-items-center gap-2">
                  <i className="bi bi-file-earmark-spreadsheet-fill text-success"></i>
                  Institutional System Excels Center
                </h5>
                <small className="text-muted">
                  5 Dynamic System Excels reflecting real-time database updates, sorted by Roll Number ascending.
                </small>
              </div>

              <div className="card-body p-4">
                <div className="row g-4">
                  {/* QS I-GAUGE DATA 2025-26 */}
                  <div className="col-12 col-lg-6">
                    <div className="card shadow-sm border rounded-3 p-3 bg-white h-100 d-flex flex-column">
                      <div className="d-flex align-items-center mb-3">
                        <div className="bg-success-subtle p-3 rounded-circle text-success me-3">
                          <i className="bi bi-file-earmark-check-fill fs-3"></i>
                        </div>
                        <div>
                          <h6 className="fw-bold text-dark mb-0">QS I-Gauge Data (2025–26)</h6>
                          <small className="text-muted">Exact template with Placement 1 & 2, Entrepreneurship & Higher Studies</small>
                        </div>
                      </div>
                      <p className="small text-secondary mb-3">
                        Official QS I-Gauge return format with 19 standardized columns. Combines placement salary packages, designation, startup details, target PG/PhD programs, and mentor/coordinator remarks. Non-applicable fields are marked as 'NA'.
                      </p>
                      <div className="mt-auto">
                        <div className="mb-2">
                          <label className="form-label small text-muted mb-1">Department Filter:</label>
                          <select
                            className="form-select form-select-sm"
                            value={excel1Dept}
                            onChange={(e) => setExcel1Dept(e.target.value)}
                          >
                            <option value="all">All College Departments</option>
                            {DEPARTMENT_OPTIONS.map((d) => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <a
                          href={`/api/excels/1-qs-gauge?department=${excel1Dept}`}
                          download
                          className="btn btn-success btn-sm w-100 fw-semibold"
                        >
                          <i className="bi bi-download me-1"></i> Download QS I-Gauge Excel
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* CUSTOM FILTERED EXCEL */}
                  <div className="col-12 col-lg-6">
                    <div className="card shadow-sm border rounded-3 p-3 bg-white h-100 d-flex flex-column">
                      <div className="d-flex align-items-center mb-3">
                        <div className="bg-primary-subtle p-3 rounded-circle text-primary me-3">
                          <i className="bi bi-sliders fs-3"></i>
                        </div>
                        <div>
                          <h6 className="fw-bold text-dark mb-0">Custom Filtered Student Records</h6>
                          <small className="text-muted">Filtered student records with active dashboard filter criteria</small>
                        </div>
                      </div>
                      <p className="small text-secondary mb-3">
                        Exports student profiles matching your current filters (Batch: {filterBatch}, Dept: {filterDept}, CGPA: {filterCgpa}, Status: {filterPlaced}). Customizable column selection with 'NA' for missing attributes.
                      </p>
                      <div className="mt-auto">
                        <button
                          className="btn btn-primary btn-sm w-100 fw-semibold"
                          onClick={() => setShowCustomExportModal(true)}
                        >
                          <i className="bi bi-sliders me-1"></i> Choose Fields & Download Custom Excel
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* DRIVE DETAIL WORKBOOK */}
                  <div className="col-12 col-lg-4">
                    <div className="card shadow-sm border rounded-3 p-3 bg-white h-100 d-flex flex-column">
                      <div className="d-flex align-items-center mb-3">
                        <div className="bg-info-subtle p-3 rounded-circle text-info me-3">
                          <i className="bi bi-folder2-open fs-3 text-info"></i>
                        </div>
                        <div>
                          <h6 className="fw-bold text-dark mb-0">Drive-Specific Details & Round Analysis</h6>
                          <small className="text-muted">Separate sheet per drive</small>
                        </div>
                      </div>
                      <p className="small text-secondary mb-3">
                        Multi-sheet workbook containing each drive in a dedicated sheet named after the drive. Maintains eligible students with opt-in status (Opted-In, Opted-Out, Removed, Blocked) and round evaluations.
                      </p>
                      <div className="mt-auto">
                        <a
                          href="/api/excels/3-drives-detail"
                          download
                          className="btn btn-outline-primary btn-sm w-100 fw-semibold"
                        >
                          <i className="bi bi-download me-1"></i> Download Drives Analysis Workbook
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* MASTER PLACEMENT MATRIX */}
                  <div className="col-12 col-lg-4">
                    <div className="card shadow-sm border rounded-3 p-3 bg-white h-100 d-flex flex-column">
                      <div className="d-flex align-items-center mb-3">
                        <div className="bg-warning-subtle p-3 rounded-circle text-warning me-3">
                          <i className="bi bi-grid-3x3-gap-fill fs-3 text-warning"></i>
                        </div>
                        <div>
                          <h6 className="fw-bold text-dark mb-0">Master Placement Tracking Matrix</h6>
                          <small className="text-muted">Drives on X-axis, students on Y-axis</small>
                        </div>
                      </div>
                      <p className="small text-secondary mb-3">
                        Comprehensive matrix for placement-opted students. Y-axis: Roll Number, Name, Dept, Email. X-axis: All recruitment drives with Eligible/Not, Opted/Not, Placed/Not, and CTC package.
                      </p>
                      <div className="mt-auto">
                        <a
                          href="/api/excels/4-master-tracking"
                          download
                          className="btn btn-outline-warning btn-sm w-100 fw-semibold text-dark"
                        >
                          <i className="bi bi-download me-1"></i> Download Master Placement Matrix
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* UNWILLINGNESS & PLACED WORKBOOK */}
                  <div className="col-12 col-lg-4">
                    <div className="card shadow-sm border rounded-3 p-3 bg-white h-100 d-flex flex-column">
                      <div className="d-flex align-items-center mb-3">
                        <div className="bg-danger-subtle p-3 rounded-circle text-danger me-3">
                          <i className="bi bi-layers-fill fs-3 text-danger"></i>
                        </div>
                        <div>
                          <h6 className="fw-bold text-dark mb-0">Placement Unwillingness & Placed Students Register</h6>
                          <small className="text-muted">Dual-sheet institutional register</small>
                        </div>
                      </div>
                      <p className="small text-secondary mb-3">
                        Sheet 1: Unwillingness records for Higher Studies and Entrepreneurship students. Sheet 2: Detailed placement records (company, role, CTC, on/off campus, offer types) for placed students.
                      </p>
                      <div className="mt-auto">
                        <a
                          href="/api/excels/5-unwillingness-and-placed"
                          download
                          className="btn btn-outline-danger btn-sm w-100 fw-semibold"
                        >
                          <i className="bi bi-download me-1"></i> Download Dual Register Excel
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 6: CENTRALIZED COMMUNICATION HUB */}
        {/* ======================================================== */}
        {activeTab === 'communication' && (
          <CommunicationHub user={currentUser} />
        )}

        {/* ======================================================== */}
        {/* TAB 7: SUPPORT DESK (TICKETS) */}
        {/* ======================================================== */}
        {activeTab === 'tickets' && (
          <TicketSupportCenter user={currentUser} />
        )}

      </div>

      {/* CUSTOM EXCEL FIELD SELECTION MODAL */}
      {showCustomExportModal && (
        <CustomExcelExportModal
          filters={{
            batch: filterBatch,
            department: filterDept,
            cgpaMin: filterCgpa === '9-10' ? 9 : filterCgpa === '8-8.99' ? 8 : 0,
            cgpaMax: filterCgpa === '9-10' ? 10 : filterCgpa === '8-8.99' ? 8.99 : 10,
            isPlaced: filterPlaced,
            placementType: filterPlacementType,
            careerGoal: 'Placement',
            search: filterSearch,
          }}
          totalMatchingCount={analytics?.placementStats?.totalOpted || 0}
          onClose={() => setShowCustomExportModal(false)}
          customExportFn={async ({ filters, fields }) => {
            return await excelAPI.downloadExcel2_Custom({
              ...filters,
              selectedFields: fields,
            });
          }}
        />
      )}

      {/* FLOATING STUDENT RECORDS WINDOW (ONLY VISIBLE ON DASHBOARD TAB) */}
      {activeTab === 'analytics' && (
        <FloatingCohortWindow
          isOpen={showFloatingWindow}
          onClose={() => setShowFloatingWindow(false)}
          onOpen={() => setShowFloatingWindow(true)}
          filteredStudents={analytics?.students || []}
          cohortData={analytics?.students || []}
          onViewStudent={(st) => setSelectedStudentForView(st)}
          onSelectStudent={(idOrSt) => setSelectedStudentForView(idOrSt)}
        />
      )}

      {/* STUDENT PROFILE INSPECTOR MODAL */}
      {selectedStudentForView && (
        <StudentProfileModal
          student={selectedStudentForView}
          onClose={() => setSelectedStudentForView(null)}
        />
      )}

      {/* MODAL: POST-PLACEMENT POLICY CONFIGURATION */}
      {showPolicyModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0">
              <div className="modal-header bg-dark text-white">
                <h5 className="modal-title fw-bold">Post-Placement Drive Policy</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowPolicyModal(false)}></button>
              </div>
              <form onSubmit={handleSavePolicy}>
                <div className="modal-body p-4">
                  <p className="text-muted small">
                    Configure eligibility criteria for students who have already accepted a placement offer before they can attend new drives.
                  </p>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Target Batch</label>
                    <select
                      className="form-select"
                      value={policyForm.batch}
                      onChange={(e) => setPolicyForm({ ...policyForm, batch: e.target.value })}
                    >
                      {BATCH_OPTIONS.map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">CTC Multiplier (e.g. 2 means 2x placed CTC)</label>
                    <input
                      type="number"
                      step="0.1"
                      className="form-control"
                      value={policyForm.ctcMultiplier}
                      onChange={(e) => setPolicyForm({ ...policyForm, ctcMultiplier: parseFloat(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Dream Tier CTC Threshold (LPA)</label>
                    <input
                      type="number"
                      step="0.5"
                      className="form-control"
                      value={policyForm.dreamTierThresholdLpa}
                      onChange={(e) => setPolicyForm({ ...policyForm, dreamTierThresholdLpa: parseFloat(e.target.value) })}
                      required
                    />
                    <small className="text-muted">Students can attend drives offering at or above this CTC regardless of multiplier.</small>
                  </div>
                  <div className="mb-3 form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="allowDreamUpgrade"
                      checked={policyForm.allowDreamUpgrade}
                      onChange={(e) => setPolicyForm({ ...policyForm, allowDreamUpgrade: e.target.checked })}
                    />
                    <label className="form-check-label small fw-semibold" htmlFor="allowDreamUpgrade">
                      Allow Dream Upgrade Option
                    </label>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowPolicyModal(false)}>
                    Close
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    Save & Activate Criteria
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CREATE PLACEMENT DRIVE (WITH SCROLLBAR!) */}
      {showCreateDriveModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow border-0" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">
                  {editingDrive ? 'Edit Placement Drive' : 'Create Campus Placement Drive'}
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => {
                    setShowCreateDriveModal(false);
                    setEditingDrive(null);
                  }}
                ></button>
              </div>
              <form onSubmit={handleCreateDrive} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Scrollable Modal Body */}
                <div className="modal-body p-4" style={{ overflowY: 'auto' }}>
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Company Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Google India"
                        value={driveForm.companyName}
                        onChange={(e) => setDriveForm({ ...driveForm, companyName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-6">
                      <label className="form-label small fw-semibold">Job Location *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Bengaluru / Hyderabad"
                        value={driveForm.jobLocation}
                        onChange={(e) => setDriveForm({ ...driveForm, jobLocation: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Company Description</label>
                    <textarea
                      className="form-control"
                      rows="2"
                      placeholder="About company..."
                      value={driveForm.companyDescription}
                      onChange={(e) => setDriveForm({ ...driveForm, companyDescription: e.target.value })}
                    ></textarea>
                  </div>

                  {/* Eligible Departments Selection */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Eligible Departments *</label>
                    <div className="d-flex flex-wrap gap-2">
                      {DEPARTMENT_OPTIONS.map((dept) => {
                        const isChecked = driveForm.eligibleDepartments.includes(dept);
                        return (
                          <label key={dept} className={`badge border p-2 cursor-pointer ${isChecked ? 'bg-primary text-white border-primary' : 'bg-light text-dark'}`}>
                            <input
                              type="checkbox"
                              className="d-none"
                              checked={isChecked}
                              onChange={() => {
                                const newDepts = isChecked
                                  ? driveForm.eligibleDepartments.filter((d) => d !== dept)
                                  : [...driveForm.eligibleDepartments, dept];
                                setDriveForm({ ...driveForm, eligibleDepartments: newDepts });
                              }}
                            />
                            {dept}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Offer Type Configuration */}
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Offer Type</label>
                      <select
                        className="form-select"
                        value={driveForm.offerType}
                        onChange={(e) => setDriveForm({ ...driveForm, offerType: e.target.value })}
                      >
                        <option value="Full Time">Full Time</option>
                        <option value="Intern">Intern</option>
                        <option value="Intern + Full Time">Intern + Full Time</option>
                        <option value="Intern + Conversion Based on Performance">Intern + Conversion Based on Performance</option>
                      </select>
                    </div>
                    {driveForm.offerType.includes('Intern') && (
                      <>
                        <div className="col-6 col-md-4">
                          <label className="form-label small fw-semibold">Internship Months</label>
                          <input
                            type="number"
                            className="form-control"
                            placeholder="e.g. 6"
                            value={driveForm.internshipDurationMonths}
                            onChange={(e) => setDriveForm({ ...driveForm, internshipDurationMonths: e.target.value })}
                          />
                        </div>
                        <div className="col-6 col-md-4">
                          <label className="form-label small fw-semibold">Monthly Stipend</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="e.g. ₹35,000 / month"
                            value={driveForm.stipend}
                            onChange={(e) => setDriveForm({ ...driveForm, stipend: e.target.value })}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Academic Criteria */}
                  <div className="row g-3 mb-3">
                    <div className="col-6 col-md-4">
                      <label className="form-label small fw-semibold">Min CGPA Required</label>
                      <input
                        type="number"
                        step="0.1"
                        className="form-control"
                        value={driveForm.minCGPA}
                        onChange={(e) => setDriveForm({ ...driveForm, minCGPA: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="col-6 col-md-4">
                      <label className="form-label small fw-semibold">Standing Arrears Allowed?</label>
                      <select
                        className="form-select"
                        value={driveForm.standingArrearsAllowed ? 'yes' : 'no'}
                        onChange={(e) => setDriveForm({ ...driveForm, standingArrearsAllowed: e.target.value === 'yes' })}
                      >
                        <option value="no">No Standing Arrears Allowed</option>
                        <option value="yes">Allow Standing Arrears</option>
                      </select>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Opt-in Deadline *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={driveForm.optInDeadline}
                        onChange={(e) => setDriveForm({ ...driveForm, optInDeadline: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  {/* Role Configuration */}
                  <div className="border rounded p-3 bg-light">
                    <h6 className="fw-bold text-dark mb-2">Job Role Details</h6>
                    <div className="row g-2">
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold">Role Name</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={driveForm.roles[0]?.roleName || ''}
                          onChange={(e) => {
                            const newRoles = [...driveForm.roles];
                            newRoles[0].roleName = e.target.value;
                            setDriveForm({ ...driveForm, roles: newRoles });
                          }}
                          required
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <label className="form-label small fw-semibold">CTC (LPA)</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          placeholder="e.g. 10 LPA"
                          value={driveForm.roles[0]?.ctc || ''}
                          onChange={(e) => {
                            const newRoles = [...driveForm.roles];
                            newRoles[0].ctc = e.target.value;
                            setDriveForm({ ...driveForm, roles: newRoles });
                          }}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer with Save Buttons */}
                <div className="modal-footer bg-light" style={{ flexShrink: 0 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setShowCreateDriveModal(false);
                      setEditingDrive(null);
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm px-4">
                    {editingDrive ? 'Update Drive Details' : 'Create & Broadcast Drive'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ROUNDS EVALUATOR */}
      {activeDriveForEvaluations && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content shadow border-0" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header bg-dark text-white d-flex justify-content-between align-items-center">
                <div>
                  <h5 className="modal-title fw-bold mb-0">Rounds Evaluator: {activeDriveForEvaluations.companyName}</h5>
                  <span className="small opacity-75">Update round outcomes. Add, modify or rename rounds dynamically.</span>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <button
                    type="button"
                    className="btn btn-outline-light btn-sm"
                    onClick={() => setShowRoundsEditor(!showRoundsEditor)}
                  >
                    <i className="bi bi-gear-wide-connected me-1"></i> {showRoundsEditor ? 'Hide Rounds Editor' : 'Configure Rounds'}
                  </button>
                  <button type="button" className="btn-close btn-close-white" onClick={() => setActiveDriveForEvaluations(null)}></button>
                </div>
              </div>

              {/* Dynamic Rounds Configuration Sub-Panel */}
              {showRoundsEditor && (
                <div className="p-3 bg-light border-bottom animate__animated animate__fadeIn">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <h6 className="fw-bold text-primary mb-0 small">
                      <i className="bi bi-diagram-3-fill me-1"></i> Add / Rename / Reorder Recruitment Rounds
                    </h6>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => {
                        const nextNum = editableRounds.length + 1;
                        setEditableRounds([...editableRounds, { roundNumber: nextNum, roundName: `Round ${nextNum}` }]);
                      }}
                    >
                      <i className="bi bi-plus-circle me-1"></i> Add New Round
                    </button>
                  </div>

                  <div className="row g-2 mb-2">
                    {editableRounds.map((rnd, rIdx) => (
                      <div key={rIdx} className="col-md-4">
                        <div className="input-group input-group-sm">
                          <span className="input-group-text bg-white fw-bold">R{rIdx + 1}</span>
                          <input
                            type="text"
                            className="form-control"
                            value={rnd.roundName}
                            onChange={(e) => {
                              const copy = [...editableRounds];
                              copy[rIdx].roundName = e.target.value;
                              setEditableRounds(copy);
                            }}
                            placeholder="Round name..."
                          />
                          {editableRounds.length > 1 && (
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              onClick={() => {
                                const copy = editableRounds.filter((_, idx) => idx !== rIdx);
                                setEditableRounds(copy);
                              }}
                              title="Delete Round"
                            >
                              <i className="bi bi-x"></i>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="text-end">
                    <button
                      type="button"
                      className="btn btn-sm btn-success fw-semibold"
                      disabled={savingRounds}
                      onClick={handleSaveDynamicRounds}
                    >
                      {savingRounds ? 'Saving Changes...' : 'Save & Synchronize Rounds Across Candidates'}
                    </button>
                  </div>
                </div>
              )}

              <div className="modal-body p-3" style={{ overflowY: 'auto' }}>
                {loadingEvaluations ? (
                  <div className="text-center py-5 text-muted">Loading evaluation records...</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 small">
                      <thead className="table-light text-muted small text-uppercase">
                        <tr>
                          <th>Roll Number</th>
                          <th>Student Name</th>
                          <th>Dept</th>
                          {(evaluationData?.rounds || []).map((r) => (
                            <th key={r.roundNumber}>Round {r.roundNumber}: {r.roundName}</th>
                          ))}
                          <th>Final Status</th>
                          <th className="text-end">Placement Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(evaluationData?.evaluations || []).length === 0 ? (
                          <tr><td colSpan="8" className="text-center py-4 text-muted">No students have opted into this drive yet.</td></tr>
                        ) : (
                          evaluationData.evaluations.map((ev) => (
                            <tr key={ev._id}>
                              <td className="fw-bold font-monospace text-primary">{ev.rollNumber}</td>
                              <td className="fw-semibold">{ev.studentName}</td>
                              <td>{ev.department}</td>
                              {(evaluationData?.rounds || []).map((r) => {
                                const currentRoundItem = (ev.rounds || []).find((rnd) => rnd.roundNumber === r.roundNumber);
                                const status = currentRoundItem ? currentRoundItem.status : 'Failed';
                                return (
                                  <td key={r.roundNumber}>
                                    <select
                                      className={`form-select form-select-sm fw-bold ${status === 'Passed' ? 'text-success' : status === 'Absent' ? 'text-danger' : 'text-secondary'}`}
                                      value={status}
                                      onChange={(e) => handleUpdateStudentRound(ev.studentId, r.roundNumber, e.target.value)}
                                    >
                                      <option value="Failed">Failed</option>
                                      <option value="Passed">Passed</option>
                                      <option value="Absent">Absent</option>
                                      <option value="-">-</option>
                                    </select>
                                  </td>
                                );
                              })}
                              <td>
                                <span className={`badge ${ev.finalStatus === 'Placed' ? 'bg-success' : 'bg-secondary'}`}>
                                  {ev.finalStatus}
                                </span>
                              </td>
                              <td className="text-end">
                                {ev.finalStatus !== 'Placed' ? (
                                  <button
                                    className="btn btn-sm btn-success py-0 px-2 fw-semibold"
                                    onClick={() => handleUpdateStudentRound(ev.studentId, evaluationData.rounds.length, 'Placed', true, ev.placedRole, ev.placedCTC)}
                                  >
                                    <i className="bi bi-check2-circle me-1"></i> Mark Placed
                                  </button>
                                ) : (
                                  <span className="text-success small fw-bold">Placed ({ev.placedCTC})</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light" style={{ flexShrink: 0 }}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveDriveForEvaluations(null)}>
                  Close Evaluator
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
