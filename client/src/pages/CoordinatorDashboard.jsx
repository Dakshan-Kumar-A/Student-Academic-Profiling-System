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
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import { coordinatorAPI } from '../services/api';
import Navbar from '../components/Navbar';
import StudentProfileModal from '../components/StudentProfileModal';
import CustomExcelExportModal from '../components/CustomExcelExportModal';
import FloatingCohortWindow from '../components/FloatingCohortWindow';
import DriveManagementModal from '../components/DriveManagementModal';
import TicketSupportCenter from '../components/TicketSupportCenter';

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

export default function CoordinatorDashboard({ user }) {
  const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' | 'management' | 'communication' | 'drives'
  const [managementSubTab, setManagementSubTab] = useState('students'); // 'students' | 'mentors' | 'allocation'

  // Coordinator Department
  const dept = user?.department || 'CSE';

  // State: Analytics & Dynamic Filters
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsSearch, setAnalyticsSearch] = useState('');
  const [analyticsSection, setAnalyticsSection] = useState('all');
  const [analyticsCategory, setAnalyticsCategory] = useState('all');
  const [analyticsCgpaBracket, setAnalyticsCgpaBracket] = useState('all');
  const [analyticsCareerGoal, setAnalyticsCareerGoal] = useState('all');
  const [analyticsHasArrears, setAnalyticsHasArrears] = useState('all'); // 'all' | 'none' | 'standing' | 'history'

  // Conditional Sub-Filters: Placement
  const [analyticsIsPlaced, setAnalyticsIsPlaced] = useState('all');
  const [analyticsPlacementType, setAnalyticsPlacementType] = useState('all');
  const [analyticsDomainInterest, setAnalyticsDomainInterest] = useState('all');

  // Conditional Sub-Filters: Higher Studies
  const [analyticsStudyLocation, setAnalyticsStudyLocation] = useState('all');

  // Conditional Sub-Filters: Entrepreneurship
  const [analyticsStartupStage, setAnalyticsStartupStage] = useState('all');

  // Conditional Sub-Filters: Arrears
  const [analyticsArrearCount, setAnalyticsArrearCount] = useState('all');
  const [analyticsArrearStatusType, setAnalyticsArrearStatusType] = useState('all'); // 'all' | 'standing' | 'cleared'

  const [analyticsMentorStatus, setAnalyticsMentorStatus] = useState('all');

  // State: Students
  const [students, setStudents] = useState([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentPagination, setStudentPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 });
  const [selectedStudentForView, setSelectedStudentForView] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  // Student Filters
  const [search, setSearch] = useState('');
  const [cgpaMin, setCgpaMin] = useState('');
  const [cgpaMax, setCgpaMax] = useState('');
  const [isPlaced, setIsPlaced] = useState('');
  const [placementType, setPlacementType] = useState('');
  const [hasArrears, setHasArrears] = useState('');
  const [careerGoal, setCareerGoal] = useState('');
  const [studyLocation, setStudyLocation] = useState('');
  const [domainInterest, setDomainInterest] = useState('');
  const [studentCategory, setStudentCategory] = useState('');
  const [section, setSection] = useState('');
  const [mentorFilter, setMentorFilter] = useState('');

  // State: Mentors
  const [mentors, setMentors] = useState([]);
  const [mentorsLoading, setMentorsLoading] = useState(false);

  // Modals
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [showBulkStudentModal, setShowBulkStudentModal] = useState(false);
  const [showAddMentorModal, setShowAddMentorModal] = useState(false);
  const [showEditMentorModal, setShowEditMentorModal] = useState(false);
  const [showAddDriveModal, setShowAddDriveModal] = useState(false);
  const [showEditDriveModal, setShowEditDriveModal] = useState(false);
  const [showCustomExportModal, setShowCustomExportModal] = useState(false);
  const [showStudentRecordsWindow, setShowStudentRecordsWindow] = useState(true); // Floating Student Records Window
  const [selectedDriveForManage, setSelectedDriveForManage] = useState(null); // Drive & Role Management Modal

  // Form States
  const [studentForm, setStudentForm] = useState({
    name: '',
    rollNumber: '',
    email: '',
    department: dept,
    section: 'A',
    studentCategory: 'Day Scholar',
  });
  const [editingStudent, setEditingStudent] = useState(null);

  const [mentorForm, setMentorForm] = useState({
    name: '',
    email: '',
    department: dept,
  });
  const [editingMentor, setEditingMentor] = useState(null);

  const [excelFile, setExcelFile] = useState(null);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkResults, setBulkResults] = useState(null);

  // Allocation State & Inline Filters (Requirement 2)
  const [selectedMentorForAllocation, setSelectedMentorForAllocation] = useState('');
  const [allocSearch, setAllocSearch] = useState('');
  const [allocSection, setAllocSection] = useState('all');
  const [allocMentorStatus, setAllocMentorStatus] = useState('all'); // 'all' | 'unassigned' | 'assigned'
  const [allocCategory, setAllocCategory] = useState('all');

  // Department Drives State & Form (Requirement 1)
  const [drives, setDrives] = useState([]);
  const [drivesLoading, setDrivesLoading] = useState(false);
  const [driveForm, setDriveForm] = useState({
    companyName: '',
    jobLocation: '',
    companyDescription: '',
    department: dept,
    optInDeadline: '',
    maxRoleChoicesAllowed: 1,
    roles: [
      {
        roleName: '',
        ctc: '',
        minCGPA: 6.0,
        standingArrearsAllowed: false,
        maxStandingArrears: 0,
        historyArrearsAllowed: false,
        maxHistoryArrears: 0,
        arrearsAllowed: false,
        maxArrearsAllowed: 0,
        roleDescription: '',
        roleDuties: '',
        roleRequirements: '',
        otherDetails: '',
        fileAttachment: '',
      },
    ],
    customFormFields: [],
  });
  const [editingDrive, setEditingDrive] = useState(null);

  // Communication
  const [messages, setMessages] = useState([]);
  const [messageForm, setMessageForm] = useState({
    subject: '',
    content: '',
    messageType: 'circular',
    priority: 'Normal',
    targetGroup: 'all_students',
  });
  const [commRecipientSearch, setCommRecipientSearch] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [replyText, setReplyText] = useState({});

  // ------------------------------------------
  // DATA LOADERS
  // ------------------------------------------
  const loadAnalytics = async (customParams = {}) => {
    setAnalyticsLoading(true);
    try {
      const activeGoal = customParams.careerGoal !== undefined ? customParams.careerGoal : analyticsCareerGoal;
      const activeArrear = customParams.hasArrears !== undefined ? customParams.hasArrears : analyticsHasArrears;

      const res = await coordinatorAPI.getAnalytics({
        department: dept,
        search: customParams.search !== undefined ? customParams.search : analyticsSearch,
        section: customParams.section !== undefined ? customParams.section : analyticsSection,
        studentCategory: customParams.studentCategory !== undefined ? customParams.studentCategory : analyticsCategory,
        cgpaBracket: customParams.cgpaBracket !== undefined ? customParams.cgpaBracket : analyticsCgpaBracket,
        careerGoal: activeGoal,
        // Conditional Placement params (only relevant if Placement selected)
        isPlaced: activeGoal === 'Placement'
          ? (customParams.isPlaced !== undefined ? (customParams.isPlaced === 'all' ? '' : customParams.isPlaced) : (analyticsIsPlaced === 'all' ? '' : analyticsIsPlaced))
          : '',
        placementType: activeGoal === 'Placement'
          ? (customParams.placementType !== undefined ? customParams.placementType : analyticsPlacementType)
          : '',
        domainInterest: activeGoal === 'Placement'
          ? (customParams.domainInterest !== undefined ? customParams.domainInterest : analyticsDomainInterest)
          : '',
        // Conditional Higher Studies params (only relevant if Higher Studies selected)
        studyLocation: activeGoal === 'Higher Studies'
          ? (customParams.studyLocation !== undefined ? customParams.studyLocation : analyticsStudyLocation)
          : '',
        // Conditional Entrepreneurship params (only relevant if Entrepreneurship selected)
        startupStage: activeGoal === 'Entrepreneurship'
          ? (customParams.startupStage !== undefined ? customParams.startupStage : analyticsStartupStage)
          : '',
        // Arrears params
        hasArrears: activeArrear,
        arrearFilter: activeArrear,
        arrearCount: (activeArrear === 'standing' || activeArrear === 'history')
          ? (customParams.arrearCount !== undefined ? customParams.arrearCount : analyticsArrearCount)
          : 'all',
        arrearStatusType: (activeArrear === 'standing' || activeArrear === 'history')
          ? (customParams.arrearStatusType !== undefined ? customParams.arrearStatusType : analyticsArrearStatusType)
          : 'all',
        mentorStatus: customParams.mentorStatus !== undefined ? customParams.mentorStatus : analyticsMentorStatus,
      });
      if (res.data.success) {
        setAnalytics(res.data.analytics);
      }
    } catch (err) {
      console.error('Failed to load analytics:', err);
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
    setAnalyticsMentorStatus('all');
    loadAnalytics({
      search: '',
      section: 'all',
      studentCategory: 'all',
      cgpaBracket: 'all',
      careerGoal: 'all',
      hasArrears: 'all',
      isPlaced: 'all',
      placementType: 'all',
      domainInterest: 'all',
      studyLocation: 'all',
      startupStage: 'all',
      arrearCount: 'all',
      arrearStatusType: 'all',
      mentorStatus: 'all',
    });
  };

  const loadStudents = async (page = 1) => {
    setStudentsLoading(true);
    try {
      const params = {
        department: dept,
        page,
        limit: 50,
        search,
        cgpaMin,
        cgpaMax,
        isPlaced,
        placementType,
        hasArrears,
        careerGoal,
        studyLocation,
        domainInterest,
        studentCategory,
        section,
        mentorId: mentorFilter,
      };
      const res = await coordinatorAPI.getStudents(params);
      if (res.data.success) {
        setStudents(res.data.students);
        setStudentPagination(res.data.pagination);
      }
    } catch (err) {
      console.error('Failed to load students:', err);
    } finally {
      setStudentsLoading(false);
    }
  };

  const loadMentors = async () => {
    setMentorsLoading(true);
    try {
      const res = await coordinatorAPI.getMentors({ department: dept });
      if (res.data.success) {
        setMentors(res.data.mentors);
      }
    } catch (err) {
      console.error('Failed to load mentors:', err);
    } finally {
      setMentorsLoading(false);
    }
  };

  const loadDrives = async () => {
    setDrivesLoading(true);
    try {
      const res = await coordinatorAPI.getDrives({ department: dept });
      if (res.data.success) {
        setDrives(res.data.drives);
      }
    } catch (err) {
      console.error('Failed to load drives:', err);
    } finally {
      setDrivesLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const res = await coordinatorAPI.getMessages();
      if (res.data.success) {
        setMessages(res.data.messages);
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  };

  useEffect(() => {
    loadAnalytics();
    loadMentors();
    loadStudents(1);
  }, [dept]);

  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics();
    if (activeTab === 'management') {
      loadStudents(1);
      loadMentors();
    }
    if (activeTab === 'communication') {
      loadMessages();
      loadStudents(1);
      loadMentors();
    }
    if (activeTab === 'drives') loadDrives();
  }, [activeTab]);

  // ------------------------------------------
  // ACTIONS: STUDENTS
  // ------------------------------------------
  const handleCreateStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await coordinatorAPI.createStudent(studentForm);
      if (res.data.success) {
        setShowAddStudentModal(false);
        setStudentForm({ name: '', rollNumber: '', email: '', department: dept, section: 'A', studentCategory: 'Day Scholar' });
        loadStudents(1);
        loadAnalytics();

        let alertHtml = `<p>${res.data.message}</p>`;
        if (res.data.demoTempPassword) {
          alertHtml += `<div class="p-2 bg-light border rounded text-dark font-monospace mt-2">
            <strong>Single-Use Temp Password:</strong> ${res.data.demoTempPassword}
          </div>`;
        }
        Swal.fire({
          icon: 'success',
          title: 'Student Created & Email Sent',
          html: alertHtml,
          confirmButtonColor: '#1e3a8a',
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to create student.', 'error');
    }
  };

  const handleUpdateStudent = async (e) => {
    e.preventDefault();
    if (!editingStudent) return;
    try {
      const res = await coordinatorAPI.updateStudent(editingStudent._id, studentForm);
      if (res.data.success) {
        setShowEditStudentModal(false);
        setEditingStudent(null);
        loadStudents(studentPagination.page);
        Swal.fire('Updated', 'Student details updated successfully.', 'success');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update student.', 'error');
    }
  };

  const handleDeleteStudent = (s) => {
    Swal.fire({
      title: 'Delete Student?',
      html: `Are you sure you want to delete <strong>${s.name}</strong> (${s.rollNumber})?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, Delete',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await coordinatorAPI.deleteStudent(s._id);
          if (res.data.success) {
            Swal.fire('Deleted', res.data.message, 'success');
            loadStudents(studentPagination.page);
            loadAnalytics();
          }
        } catch (err) {
          Swal.fire('Error', err.response?.data?.message || 'Failed to delete student.', 'error');
        }
      }
    });
  };

  const handleBulkStudentUpload = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      Swal.fire('File Required', 'Please select an Excel or CSV file.', 'warning');
      return;
    }
    const formData = new FormData();
    formData.append('file', excelFile);
    formData.append('department', dept);

    setBulkUploading(true);
    try {
      const res = await coordinatorAPI.bulkUploadStudents(formData);
      if (res.data.success) {
        setBulkResults(res.data.results);
        loadStudents(1);
        loadAnalytics();
        Swal.fire('Completed', `Processed ${res.data.results.totalRows} rows. Created ${res.data.results.createdCount} accounts.`, 'success');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to process spreadsheet.', 'error');
    } finally {
      setBulkUploading(false);
    }
  };

  const downloadStudentTemplate = () => {
    const sample = [
      { 'Student Name': 'Aravind Kumar', 'Roll Number': '23CS101', 'Email': 'aravind.23cs@college.edu', 'Department': dept, 'Section': 'A', 'Category': 'Day Scholar' },
      { 'Student Name': 'Divya R', 'Roll Number': '23CS102', 'Email': 'divya.23cs@college.edu', 'Department': dept, 'Section': 'A', 'Category': 'Hosteller' },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Student_Import');
    XLSX.writeFile(wb, 'Student_Bulk_Import_Template.xlsx');
  };

  // ------------------------------------------
  // ACTIONS: MENTORS
  // ------------------------------------------
  const handleCreateMentor = async (e) => {
    e.preventDefault();
    try {
      const res = await coordinatorAPI.createMentor(mentorForm);
      if (res.data.success) {
        setShowAddMentorModal(false);
        setMentorForm({ name: '', email: '', department: dept });
        loadMentors();
        let alertHtml = `<p>${res.data.message}</p>`;
        if (res.data.demoTempPassword) {
          alertHtml += `<div class="p-2 bg-light border rounded text-dark font-monospace mt-2">
            <strong>Single-Use Temp Password:</strong> ${res.data.demoTempPassword}
          </div>`;
        }
        Swal.fire({ icon: 'success', title: 'Mentor Added', html: alertHtml });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to add mentor.', 'error');
    }
  };

  const handleUpdateMentor = async (e) => {
    e.preventDefault();
    if (!editingMentor) return;
    try {
      const res = await coordinatorAPI.updateMentor(editingMentor._id, mentorForm);
      if (res.data.success) {
        setShowEditMentorModal(false);
        setEditingMentor(null);
        loadMentors();
        Swal.fire('Updated', 'Mentor details updated successfully.', 'success');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update mentor.', 'error');
    }
  };

  const handleDeleteMentor = (m) => {
    Swal.fire({
      title: 'Delete Mentor?',
      text: `Delete ${m.name}? All their assigned students will become unassigned.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, Delete',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          const res = await coordinatorAPI.deleteMentor(m._id);
          if (res.data.success) {
            Swal.fire('Deleted', res.data.message, 'success');
            loadMentors();
            loadStudents(studentPagination.page);
          }
        } catch (err) {
          Swal.fire('Error', 'Failed to delete mentor.', 'error');
        }
      }
    });
  };

  // ------------------------------------------
  // ACTIONS: STUDENT-MENTOR ALLOCATION (REQUIREMENT 2)
  // ------------------------------------------
  const handleAssignMentor = async (mentorIdToAssign) => {
    if (selectedStudentIds.length === 0) {
      Swal.fire('No Students Selected', 'Please check at least one student from the roster to allocate.', 'warning');
      return;
    }

    const targetMentor = mentors.find((m) => m._id === mentorIdToAssign);
    const targetMentorName = targetMentor ? targetMentor.name : 'Unassigned';

    // Identify which selected students already have a mentor mapped (and not already the target mentor)
    const conflictingStudents = students.filter(
      (s) => selectedStudentIds.includes(s._id) && s.mentorId && s.mentorId._id !== mentorIdToAssign
    );

    const executeAllocation = async () => {
      try {
        const res = await coordinatorAPI.assignMentor({
          studentProfileIds: selectedStudentIds,
          mentorId: mentorIdToAssign || null,
        });
        if (res.data.success) {
          Swal.fire({
            icon: 'success',
            title: 'Allocation Successful',
            text: res.data.message,
          });
          setSelectedStudentIds([]);
          loadStudents(studentPagination.page);
          loadMentors();
          loadAnalytics();
        }
      } catch (err) {
        Swal.fire('Allocation Failed', err.response?.data?.message || 'Assignment failed.', 'error');
      }
    };

    // If any student has an existing mentor, throw warning modal listing students with their mentors!
    if (conflictingStudents.length > 0) {
      const conflictListHtml = conflictingStudents
        .map(
          (s) =>
            `<li class="mb-1 text-start"><strong>${s.name}</strong> (${s.rollNumber}) — Current: <span class="text-primary fw-semibold">${s.mentorId.name}</span></li>`
        )
        .join('');

      Swal.fire({
        title: 'Reassign Existing Mentor(s)?',
        html: `
          <div class="text-start">
            <p class="mb-2">The following <strong>${conflictingStudents.length}</strong> selected student(s) are already assigned to a faculty mentor:</p>
            <ul class="small text-muted ps-3 mb-3 border rounded p-2 bg-light" style="max-height: 150px; overflow-y: auto;">
              ${conflictListHtml}
            </ul>
            <div class="alert alert-warning py-2 small mb-0">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              Are you sure you want to change the mentor for all selected students to <strong>${targetMentorName}</strong>?
            </div>
          </div>
        `,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Reassign All',
        cancelButtonText: 'Cancel',
      }).then((result) => {
        if (result.isConfirmed) {
          executeAllocation();
        }
      });
    } else {
      executeAllocation();
    }
  };

  const toggleStudentSelection = (id) => {
    if (selectedStudentIds.includes(id)) {
      setSelectedStudentIds(selectedStudentIds.filter((sId) => sId !== id));
    } else {
      setSelectedStudentIds([...selectedStudentIds, id]);
    }
  };

  const toggleSelectAll = () => {
    if (selectedStudentIds.length === students.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(students.map((s) => s._id));
    }
  };

  // ------------------------------------------
  // ACTIONS: DEPARTMENT DRIVES (CRUD & ROLES & EXCEL)
  // ------------------------------------------
  const handleAddDriveRole = () => {
    setDriveForm({
      ...driveForm,
      roles: [
        ...driveForm.roles,
        {
          roleName: '',
          ctc: '',
          minCGPA: 6.0,
          standingArrearsAllowed: false,
          maxStandingArrears: 0,
          historyArrearsAllowed: false,
          maxHistoryArrears: 0,
          arrearsAllowed: false,
          maxArrearsAllowed: 0,
          roleDescription: '',
          roleDuties: '',
          roleRequirements: '',
          otherDetails: '',
          fileAttachment: '',
        },
      ],
    });
  };

  const handleRemoveDriveRole = (index) => {
    const updated = driveForm.roles.filter((_, idx) => idx !== index);
    setDriveForm({ ...driveForm, roles: updated });
  };

  const handleRoleChange = (index, field, value) => {
    const updated = [...driveForm.roles];
    updated[index][field] = value;
    setDriveForm({ ...driveForm, roles: updated });
  };

  const handleAddCustomField = () => {
    setDriveForm({
      ...driveForm,
      customFormFields: [
        ...(driveForm.customFormFields || []),
        { fieldLabel: '', fieldType: 'text', isRequired: false },
      ],
    });
  };

  const handleRemoveCustomField = (index) => {
    const updated = (driveForm.customFormFields || []).filter((_, idx) => idx !== index);
    setDriveForm({ ...driveForm, customFormFields: updated });
  };

  const handleCustomFieldChange = (index, field, value) => {
    const updated = [...(driveForm.customFormFields || [])];
    updated[index][field] = value;
    setDriveForm({ ...driveForm, customFormFields: updated });
  };

  const handleCreateDrive = async (e) => {
    e.preventDefault();
    if (!driveForm.companyName.trim() || !driveForm.jobLocation.trim()) {
      Swal.fire('Required Fields', 'Company Name and Job Location are required.', 'warning');
      return;
    }
    if (!driveForm.optInDeadline) {
      Swal.fire('Deadline Required', 'Please set an opt-in deadline date/time for students.', 'warning');
      return;
    }

    try {
      const res = await coordinatorAPI.createDrive(driveForm);
      if (res.data.success) {
        setShowAddDriveModal(false);
        setDriveForm({
          companyName: '',
          jobLocation: '',
          companyDescription: '',
          department: dept,
          optInDeadline: '',
          maxRoleChoicesAllowed: 1,
          roles: [
            {
              roleName: '',
              ctc: '',
              minCGPA: 6.0,
              standingArrearsAllowed: false,
              maxStandingArrears: 0,
              historyArrearsAllowed: false,
              maxHistoryArrears: 0,
              arrearsAllowed: false,
              maxArrearsAllowed: 0,
              roleDescription: '',
              roleDuties: '',
              roleRequirements: '',
              otherDetails: '',
              fileAttachment: '',
            },
          ],
          customFormFields: [],
        });
        loadDrives();
        Swal.fire({
          icon: 'success',
          title: 'Department Drive Published!',
          text: 'This drive is marked under the department flag (hidden from placement officers).',
        });
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to create drive.', 'error');
    }
  };

  const handleUpdateDrive = async (e) => {
    e.preventDefault();
    if (!editingDrive) return;
    try {
      const res = await coordinatorAPI.updateDrive(editingDrive._id, driveForm);
      if (res.data.success) {
        setShowEditDriveModal(false);
        setEditingDrive(null);
        loadDrives();
        Swal.fire('Updated', 'Department drive updated successfully.', 'success');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to update drive.', 'error');
    }
  };

  const handleDeleteDrive = (d) => {
    Swal.fire({
      title: 'Delete Department Drive?',
      text: `Are you sure you want to remove the drive for ${d.companyName}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, Delete',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await coordinatorAPI.deleteDrive(d._id);
          loadDrives();
          Swal.fire('Deleted', 'Drive removed successfully.', 'success');
        } catch (err) {
          Swal.fire('Error', 'Failed to delete drive.', 'error');
        }
      }
    });
  };

  const handleDownloadDriveExcel = async (d) => {
    try {
      const res = await coordinatorAPI.downloadDriveExcel(d._id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeComp = d.companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute('download', `${safeComp}_Drive_Details.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      Swal.fire('Downloaded', `Exported 2-sheet workbook for ${d.companyName}.`, 'success');
    } catch (err) {
      Swal.fire('Download Failed', 'Could not export drive Excel sheet.', 'error');
    }
  };

  // ------------------------------------------
  // ACTIONS: COMMUNICATION HUB
  // ------------------------------------------
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (messageForm.targetGroup === 'custom_selection' && selectedStudentIds.length === 0) {
      Swal.fire('No Recipients Selected', 'Please check at least one student below in the recipient selector.', 'warning');
      return;
    }

    setSendingMessage(true);
    try {
      const res = await coordinatorAPI.sendMessage({
        ...messageForm,
        selectedUserIds: selectedStudentIds,
      });
      if (res.data.success) {
        setMessageForm({
          subject: '',
          content: '',
          messageType: 'circular',
          priority: 'Normal',
          targetGroup: 'all_students',
        });
        loadMessages();
        Swal.fire('Dispatched', res.data.message, 'success');
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to send message.', 'error');
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendReply = async (messageId) => {
    const text = replyText[messageId];
    if (!text || text.trim() === '') return;
    try {
      const res = await coordinatorAPI.replyMessage(messageId, { content: text });
      if (res.data.success) {
        setReplyText({ ...replyText, [messageId]: '' });
        loadMessages();
      }
    } catch (err) {
      Swal.fire('Error', 'Failed to post reply', 'error');
    }
  };

  // Filtered students for Communication Hub inline selection
  const commFilteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(commRecipientSearch.toLowerCase()) ||
      s.rollNumber.toLowerCase().includes(commRecipientSearch.toLowerCase()) ||
      s.email.toLowerCase().includes(commRecipientSearch.toLowerCase())
  );

  return (
    <div className="min-vh-100 bg-light">
      <Navbar user={user} />

      {/* SUB-NAVBAR */}
      <div className="bg-white border-bottom shadow-sm px-3 py-2 sticky-top">
        <div className="container-fluid d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center">
            <span className="badge bg-success me-2 px-3 py-2 fs-6">
              <i className="bi bi-building me-1"></i> Dept: {dept}
            </span>
            <div className="btn-group btn-group-sm">
              <button
                className={`btn ${activeTab === 'analytics' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('analytics')}
              >
                <i className="bi bi-pie-chart-fill me-1"></i> Analytics Dashboard
              </button>
              <button
                className={`btn ${activeTab === 'management' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('management')}
              >
                <i className="bi bi-people-fill me-1"></i> Students & Mentors
              </button>
              <button
                className={`btn ${activeTab === 'communication' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('communication')}
              >
                <i className="bi bi-chat-dots-fill me-1"></i> Communication Hub
              </button>
              <button
                className={`btn ${activeTab === 'drives' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('drives')}
              >
                <i className="bi bi-briefcase-fill me-1"></i> Dept Drives
                <span className="badge bg-warning text-dark ms-1">Special Flag</span>
              </button>
              <button
                className={`btn ${activeTab === 'tickets' ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('tickets')}
              >
                <i className="bi bi-ticket-perforated-fill me-1"></i> Support Tickets
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container-fluid py-4 px-md-4">
        {/* ======================================================== */}
        {/* PAGE A: COMPREHENSIVE ANALYTICS & INSIGHTS DASHBOARD */}
        {/* ======================================================== */}
        {activeTab === 'analytics' && (
          <div>
            {/* COMPREHENSIVE DYNAMIC DASHBOARD FILTER TOOLBAR */}
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

              {/* DYNAMIC CONDITIONAL SUB-FILTERS ROW (Requirement 2) */}
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
                <span className="spinner-border text-primary me-2"></span> Loading departmental intelligence & insights...
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
                      <small className="text-danger fw-semibold mt-1 d-block">Urgent Mentor Attention</small>
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
                                  <tr key={st.id}>
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
                                  <tr key={st.id}>
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
                                    onClick={() => {
                                      const found = analytics.filteredStudents?.find((s) => s._id === st.id) || students.find((s) => s._id === st.id);
                                      if (found) setSelectedStudentForView(found.fullProfile || found);
                                    }}
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

            {/* FLOATING STUDENT RECORDS WINDOW WIDGET */}
            <FloatingCohortWindow
              isOpen={showStudentRecordsWindow}
              onClose={() => setShowStudentRecordsWindow(false)}
              onOpen={() => setShowStudentRecordsWindow(true)}
              filteredStudents={analytics?.filteredStudents || []}
              cohortData={analytics?.filteredStudents || []}
              onViewStudent={(st) => setSelectedStudentForView(st)}
              onSelectStudent={(idOrSt) => setSelectedStudentForView(idOrSt)}
            />
          </div>
        )}

        {/* ======================================================== */}
        {/* PAGE B: STUDENTS & MENTORS MANAGEMENT */}
        {/* ======================================================== */}
        {activeTab === 'management' && (
          <div className="card shadow-sm border-0 rounded-3">
            <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div className="btn-group btn-group-sm">
                <button
                  className={`btn ${managementSubTab === 'students' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setManagementSubTab('students')}
                >
                  <i className="bi bi-person-lines-fill me-1"></i> Students Directory ({students.length})
                </button>
                <button
                  className={`btn ${managementSubTab === 'mentors' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setManagementSubTab('mentors')}
                >
                  <i className="bi bi-person-badge-fill me-1"></i> Mentors Directory ({mentors.length})
                </button>
                <button
                  className={`btn ${managementSubTab === 'allocation' ? 'btn-primary' : 'btn-outline-secondary'}`}
                  onClick={() => setManagementSubTab('allocation')}
                >
                  <i className="bi bi-diagram-3-fill me-1"></i> Student-Mentor Allocation
                </button>
              </div>

              {managementSubTab === 'students' && (
                <div className="d-flex gap-2">
                  {/* Custom Excel Export Builder Button (Requirements 2 & 3) */}
                  <button
                    className="btn btn-outline-success btn-sm fw-semibold"
                    onClick={() => setShowCustomExportModal(true)}
                    title="Choose custom columns and download filtered excel"
                  >
                    <i className="bi bi-file-earmark-excel-fill me-1"></i> Download Filtered Excel (Custom Fields)
                  </button>
                  <button
                    className="btn btn-outline-primary btn-sm"
                    onClick={() => setShowBulkStudentModal(true)}
                  >
                    <i className="bi bi-cloud-arrow-up me-1"></i> Bulk Excel Import
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setStudentForm({ name: '', rollNumber: '', email: '', department: dept, section: 'A', studentCategory: 'Day Scholar' });
                      setShowAddStudentModal(true);
                    }}
                  >
                    <i className="bi bi-person-plus-fill me-1"></i> Add Student
                  </button>
                </div>
              )}

              {managementSubTab === 'mentors' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setMentorForm({ name: '', email: '', department: dept });
                    setShowAddMentorModal(true);
                  }}
                >
                  <i className="bi bi-person-plus-fill me-1"></i> Add Mentor
                </button>
              )}
            </div>

            {/* SUB-TAB 1: STUDENTS DIRECTORY & FILTERS */}
            {managementSubTab === 'students' && (
              <div>
                {/* Filter Toolbar */}
                <div className="p-3 bg-light border-bottom">
                  <div className="row g-2">
                    <div className="col-12 col-md-3">
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        placeholder="Search name, roll no, email..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadStudents(1)}
                      />
                    </div>
                    <div className="col-6 col-md-2">
                      <div className="input-group input-group-sm">
                        <span className="input-group-text bg-white">CGPA</span>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Min"
                          className="form-control"
                          value={cgpaMin}
                          onChange={(e) => setCgpaMin(e.target.value)}
                        />
                        <input
                          type="number"
                          step="0.1"
                          placeholder="Max"
                          className="form-control"
                          value={cgpaMax}
                          onChange={(e) => setCgpaMax(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="col-6 col-md-2">
                      <select
                        className="form-select form-select-sm"
                        value={isPlaced}
                        onChange={(e) => setIsPlaced(e.target.value)}
                      >
                        <option value="">All Placement Status</option>
                        <option value="true">✅ Placed</option>
                        <option value="false">❌ Not Placed</option>
                      </select>
                    </div>
                    <div className="col-6 col-md-2">
                      <select
                        className="form-select form-select-sm"
                        value={hasArrears}
                        onChange={(e) => setHasArrears(e.target.value)}
                      >
                        <option value="">All Arrear Status</option>
                        <option value="false">Zero Arrears</option>
                        <option value="true">Standing Arrears</option>
                      </select>
                    </div>
                    <div className="col-6 col-md-3 d-flex gap-2">
                      <button className="btn btn-sm btn-primary flex-grow-1" onClick={() => loadStudents(1)}>
                        Apply Filters
                      </button>
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => {
                          setSearch('');
                          setCgpaMin('');
                          setCgpaMax('');
                          setIsPlaced('');
                          setPlacementType('');
                          setHasArrears('');
                          setCareerGoal('');
                          loadStudents(1);
                        }}
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {/* Students Table */}
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0 small">
                    <thead className="table-light text-muted small text-uppercase">
                      <tr>
                        <th style={{ width: '40px' }}>
                          <input
                            type="checkbox"
                            className="form-check-input"
                            checked={selectedStudentIds.length === students.length && students.length > 0}
                            onChange={toggleSelectAll}
                          />
                        </th>
                        <th>Roll No & Student</th>
                        <th>Sec & Category</th>
                        <th>CGPA</th>
                        <th>Arrears</th>
                        <th>Placement</th>
                        <th>Assigned Mentor</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentsLoading ? (
                        <tr>
                          <td colSpan="8" className="text-center py-4 text-muted">Loading students...</td>
                        </tr>
                      ) : students.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="text-center py-5 text-muted">No students found matching criteria.</td>
                        </tr>
                      ) : (
                        students.map((s) => (
                          <tr key={s._id}>
                            <td>
                              <input
                                type="checkbox"
                                className="form-check-input"
                                checked={selectedStudentIds.includes(s._id)}
                                onChange={() => toggleStudentSelection(s._id)}
                              />
                            </td>
                            <td>
                              <button
                                className="btn btn-link p-0 text-decoration-none fw-bold text-primary text-start"
                                onClick={() => setSelectedStudentForView(s)}
                                title="Click to view full student profile"
                              >
                                {s.name}
                              </button>
                              <div className="text-muted font-monospace" style={{ fontSize: '0.75rem' }}>
                                {s.rollNumber} • {s.email}
                              </div>
                            </td>
                            <td>
                              <span className="badge bg-light text-dark border me-1">Sec {s.section || 'A'}</span>
                              <span className="badge bg-light text-secondary">{s.studentCategory || 'Day Scholar'}</span>
                            </td>
                            <td><strong className="text-dark">{s.currentCGPA || 0}</strong></td>
                            <td>
                              {s.standingArrearsCount > 0 ? (
                                <span className="badge bg-danger">{s.standingArrearsCount} Active</span>
                              ) : (
                                <span className="badge bg-success">0</span>
                              )}
                            </td>
                            <td>
                              {s.careerGoal?.primaryGoal === 'Placement' ? (
                                s.placementStatus?.isPlaced ? (
                                  <span className="badge bg-success">{s.placementStatus.companyName || 'Placed'}</span>
                                ) : (
                                  <span className="badge bg-secondary">Unplaced</span>
                                )
                              ) : (
                                <span className="badge bg-light text-secondary border">Nil</span>
                              )}
                            </td>
                            <td>
                              {s.mentorId ? (
                                <span className="text-primary fw-semibold">{s.mentorId.name}</span>
                              ) : (
                                <span className="text-warning small"><i className="bi bi-clock me-1"></i>Unassigned</span>
                              )}
                            </td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <button
                                  className="btn btn-outline-primary"
                                  onClick={() => setSelectedStudentForView(s)}
                                  title="View full profile"
                                >
                                  <i className="bi bi-eye"></i>
                                </button>
                                <button
                                  className="btn btn-outline-secondary"
                                  onClick={() => {
                                    setEditingStudent(s);
                                    setStudentForm({
                                      name: s.name,
                                      rollNumber: s.rollNumber,
                                      email: s.email,
                                      department: s.department,
                                      section: s.section || 'A',
                                      studentCategory: s.studentCategory || 'Day Scholar',
                                    });
                                    setShowEditStudentModal(true);
                                  }}
                                  title="Edit student"
                                >
                                  <i className="bi bi-pencil"></i>
                                </button>
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => handleDeleteStudent(s)}
                                  title="Delete student"
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

            {/* SUB-TAB 2: MENTORS DIRECTORY & EDIT */}
            {managementSubTab === 'mentors' && (
              <div className="p-3">
                <div className="table-responsive">
                  <table className="table table-hover align-middle mb-0">
                    <thead className="table-light text-muted small text-uppercase">
                      <tr>
                        <th>Mentor Name</th>
                        <th>Email Address</th>
                        <th>Department</th>
                        <th>Assigned Mentees Count</th>
                        <th>Status</th>
                        <th className="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mentorsLoading ? (
                        <tr><td colSpan="6" className="text-center py-4 text-muted">Loading mentors...</td></tr>
                      ) : mentors.length === 0 ? (
                        <tr><td colSpan="6" className="text-center py-4 text-muted">No mentors found.</td></tr>
                      ) : (
                        mentors.map((m) => (
                          <tr key={m._id}>
                            <td className="fw-bold text-dark">{m.name}</td>
                            <td className="text-muted">{m.email}</td>
                            <td><span className="badge bg-light text-dark border">{m.department}</span></td>
                            <td><span className="badge bg-primary fs-6">{m.assignedStudentCount || 0} Students</span></td>
                            <td><span className={`badge ${m.status === 'active' ? 'bg-success' : 'bg-secondary'}`}>{m.status}</span></td>
                            <td className="text-end">
                              <div className="btn-group btn-group-sm">
                                <button
                                  className="btn btn-outline-secondary"
                                  onClick={() => {
                                    setEditingMentor(m);
                                    setMentorForm({ name: m.name, email: m.email, department: m.department });
                                    setShowEditMentorModal(true);
                                  }}
                                  title="Edit mentor"
                                >
                                  <i className="bi bi-pencil"></i> Edit
                                </button>
                                <button
                                  className="btn btn-outline-danger"
                                  onClick={() => handleDeleteMentor(m)}
                                  title="Delete mentor"
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

            {/* SUB-TAB 3: STUDENT-MENTOR ALLOCATION (REQUIREMENT 2: INLINE MAPPING & CONFLICT DIALOG) */}
            {managementSubTab === 'allocation' && (() => {
              const allocFilteredStudents = students.filter((s) => {
                if (allocSearch.trim()) {
                  const term = allocSearch.toLowerCase();
                  const match =
                    s.name?.toLowerCase().includes(term) ||
                    s.rollNumber?.toLowerCase().includes(term) ||
                    s.email?.toLowerCase().includes(term);
                  if (!match) return false;
                }
                if (allocSection !== 'all' && (s.section || 'A') !== allocSection) return false;
                if (allocCategory !== 'all' && (s.studentCategory || 'Day Scholar') !== allocCategory) return false;
                if (allocMentorStatus === 'unassigned' && s.mentorId) return false;
                if (allocMentorStatus === 'assigned' && !s.mentorId) return false;
                return true;
              });

              const isAllFilteredSelected =
                allocFilteredStudents.length > 0 &&
                allocFilteredStudents.every((s) => selectedStudentIds.includes(s._id));

              const toggleSelectAllFiltered = () => {
                if (isAllFilteredSelected) {
                  // Deselect visible filtered students
                  const filteredIds = new Set(allocFilteredStudents.map((s) => s._id));
                  setSelectedStudentIds(selectedStudentIds.filter((id) => !filteredIds.has(id)));
                } else {
                  // Select all visible filtered students
                  const newSelected = new Set([...selectedStudentIds, ...allocFilteredStudents.map((s) => s._id)]);
                  setSelectedStudentIds(Array.from(newSelected));
                }
              };

              return (
                <div className="p-4">
                  {/* Rule Banner */}
                  <div className="alert alert-info py-2 small mb-4 d-flex justify-content-between align-items-center">
                    <div>
                      <i className="bi bi-info-circle-fill me-2"></i>
                      <strong>Mentorship Rule:</strong> A student can be assigned to only <strong>one mentor</strong> at a time. If an already-assigned student is selected, you will be prompted to confirm reassigning them.
                    </div>
                    <span className="badge bg-white text-info border">
                      {mentors.length} Faculty Mentors Active
                    </span>
                  </div>

                  {/* Top Allocation Action Bar */}
                  <div className="card shadow-sm border p-3 mb-4 rounded-3 bg-white">
                    <div className="row g-3 align-items-center">
                      <div className="col-12 col-md-4">
                        <div className="d-flex align-items-center gap-2">
                          <span className="badge bg-primary fs-6 px-3 py-2">
                            <i className="bi bi-check2-square me-1"></i> {selectedStudentIds.length}
                          </span>
                          <div>
                            <span className="fw-bold text-dark d-block small">Student(s) Selected</span>
                            <small className="text-muted" style={{ fontSize: '11px' }}>
                              Select students from roster below to allocate
                            </small>
                          </div>
                        </div>
                      </div>

                      <div className="col-12 col-md-5">
                        <div className="input-group input-group-sm">
                          <span className="input-group-text bg-light fw-semibold">Target Mentor:</span>
                          <select
                            className="form-select form-select-sm"
                            value={selectedMentorForAllocation}
                            onChange={(e) => setSelectedMentorForAllocation(e.target.value)}
                          >
                            <option value="">-- Choose Faculty Mentor --</option>
                            {mentors.map((m) => (
                              <option key={m._id} value={m._id}>
                                {m.name} ({m.assignedStudentCount || 0} active mentees)
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="col-12 col-md-3 d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm flex-grow-1 shadow-sm"
                          disabled={selectedStudentIds.length === 0 || !selectedMentorForAllocation}
                          onClick={() => handleAssignMentor(selectedMentorForAllocation)}
                          title="Assign selected students to chosen faculty mentor"
                        >
                          <i className="bi bi-person-check-fill me-1"></i> Assign Selected
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm"
                          disabled={selectedStudentIds.length === 0}
                          onClick={() => handleAssignMentor(null)}
                          title="Unassign selected students from any mentor"
                        >
                          Unassign
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Inline Allocation Filters */}
                  <div className="card border-0 bg-light p-3 mb-3 rounded-3">
                    <div className="row g-2 align-items-center">
                      <div className="col-12 col-md-4">
                        <div className="input-group input-group-sm">
                          <span className="input-group-text bg-white"><i className="bi bi-search"></i></span>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Filter by name, roll no, email..."
                            value={allocSearch}
                            onChange={(e) => setAllocSearch(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="col-6 col-md-2">
                        <select
                          className="form-select form-select-sm"
                          value={allocSection}
                          onChange={(e) => setAllocSection(e.target.value)}
                        >
                          <option value="all">All Sections</option>
                          <option value="A">Section A</option>
                          <option value="B">Section B</option>
                          <option value="C">Section C</option>
                        </select>
                      </div>

                      <div className="col-6 col-md-3">
                        <select
                          className="form-select form-select-sm"
                          value={allocMentorStatus}
                          onChange={(e) => setAllocMentorStatus(e.target.value)}
                        >
                          <option value="all">All Students</option>
                          <option value="unassigned">⚠️ Unassigned Students Only</option>
                          <option value="assigned">✓ Already Assigned Students</option>
                        </select>
                      </div>

                      <div className="col-6 col-md-2">
                        <select
                          className="form-select form-select-sm"
                          value={allocCategory}
                          onChange={(e) => setAllocCategory(e.target.value)}
                        >
                          <option value="all">All Categories</option>
                          <option value="Day Scholar">Day Scholar</option>
                          <option value="Hosteller">Hosteller</option>
                        </select>
                      </div>

                      <div className="col-6 col-md-1 text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary w-100"
                          onClick={() => {
                            setAllocSearch('');
                            setAllocSection('all');
                            setAllocMentorStatus('all');
                            setAllocCategory('all');
                          }}
                          title="Reset allocation filters"
                        >
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Allocation Student Roster Table */}
                  <div className="card shadow-sm border-0 rounded-3 bg-white">
                    <div className="card-header bg-white py-2 px-3 border-bottom d-flex justify-content-between align-items-center">
                      <div className="form-check mb-0">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id="allocSelectAll"
                          checked={isAllFilteredSelected}
                          onChange={toggleSelectAllFiltered}
                        />
                        <label className="form-check-label small fw-semibold" htmlFor="allocSelectAll">
                          Select All Visible ({allocFilteredStudents.length} Students)
                        </label>
                      </div>

                      <span className="text-muted small">
                        Showing {allocFilteredStudents.length} of {students.length} students
                      </span>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0 small">
                        <thead className="table-light text-muted small text-uppercase">
                          <tr>
                            <th style={{ width: '40px' }}></th>
                            <th>Roll Number</th>
                            <th>Student Name</th>
                            <th>Sec & Category</th>
                            <th>CGPA</th>
                            <th>Arrears</th>
                            <th>Currently Assigned Mentor</th>
                            <th className="text-end">Profile</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allocFilteredStudents.length === 0 ? (
                            <tr>
                              <td colSpan="8" className="text-center py-5 text-muted">
                                <i className="bi bi-person-x fs-2 d-block mb-2"></i>
                                No students match the active allocation filters.
                              </td>
                            </tr>
                          ) : (
                            allocFilteredStudents.map((s) => {
                              const isChecked = selectedStudentIds.includes(s._id);
                              return (
                                <tr key={s._id} className={isChecked ? 'table-primary-subtle' : ''}>
                                  <td>
                                    <input
                                      type="checkbox"
                                      className="form-check-input"
                                      checked={isChecked}
                                      onChange={() => toggleStudentSelection(s._id)}
                                    />
                                  </td>
                                  <td className="fw-bold font-monospace text-primary">{s.rollNumber}</td>
                                  <td>
                                    <div className="fw-bold text-dark">{s.name}</div>
                                    <span className="text-muted" style={{ fontSize: '11px' }}>{s.email}</span>
                                  </td>
                                  <td>
                                    <span className="badge bg-light text-dark border me-1">Sec {s.section || 'A'}</span>
                                    <span className="badge bg-secondary-subtle text-dark">{s.studentCategory || 'Day Scholar'}</span>
                                  </td>
                                  <td>
                                    <span className={`badge ${s.currentCGPA >= 8.5 ? 'bg-success' : s.currentCGPA >= 7.0 ? 'bg-primary' : s.currentCGPA >= 6.0 ? 'bg-warning text-dark' : 'bg-danger'}`}>
                                      {s.currentCGPA || 0}
                                    </span>
                                  </td>
                                  <td>
                                    {s.standingArrearsCount > 0 ? (
                                      <span className="badge bg-danger">{s.standingArrearsCount} Arrears</span>
                                    ) : (
                                      <span className="badge bg-success-subtle text-success border border-success">0 Clean</span>
                                    )}
                                  </td>
                                  <td>
                                    {s.mentorId ? (
                                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1">
                                        <i className="bi bi-person-badge me-1"></i> {s.mentorId.name}
                                      </span>
                                    ) : (
                                      <span className="badge bg-warning-subtle text-dark border border-warning px-2 py-1">
                                        <i className="bi bi-clock me-1"></i> Unassigned
                                      </span>
                                    )}
                                  </td>
                                  <td className="text-end">
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary"
                                      onClick={() => setSelectedStudentForView(s)}
                                      title="View student profile"
                                    >
                                      <i className="bi bi-eye"></i>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ======================================================== */}
        {/* PAGE C: COMMUNICATION HUB (DIRECT RECIPIENT SELECTION) */}
        {/* ======================================================== */}
        {activeTab === 'communication' && (
          <div className="row g-4">
            {/* Compose Card */}
            <div className="col-12 col-lg-6">
              <div className="card shadow-sm border-0 rounded-3">
                <div className="card-header bg-primary text-white py-3 fw-bold">
                  <i className="bi bi-pencil-square me-2"></i> Compose Circular / Message / Enquiry
                </div>
                <form onSubmit={handleSendMessage} className="card-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Subject / Title *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Core Placement Drive Schedule"
                      value={messageForm.subject}
                      onChange={(e) => setMessageForm({ ...messageForm, subject: e.target.value })}
                      required
                    />
                  </div>

                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Type</label>
                      <select
                        className="form-select form-select-sm"
                        value={messageForm.messageType}
                        onChange={(e) => setMessageForm({ ...messageForm, messageType: e.target.value })}
                      >
                        <option value="circular">Circular</option>
                        <option value="message">General Message</option>
                        <option value="enquiry">Enquiry / Survey</option>
                        <option value="announcement">Announcement</option>
                      </select>
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Priority</label>
                      <select
                        className="form-select form-select-sm"
                        value={messageForm.priority}
                        onChange={(e) => setMessageForm({ ...messageForm, priority: e.target.value })}
                      >
                        <option value="Normal">Normal</option>
                        <option value="Important">Important</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  {/* Target Audience selection */}
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Target Audience</label>
                    <div className="d-flex flex-column gap-1 small mb-2">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="targetGroup"
                          id="tg1"
                          value="all_students"
                          checked={messageForm.targetGroup === 'all_students'}
                          onChange={(e) => setMessageForm({ ...messageForm, targetGroup: e.target.value })}
                        />
                        <label className="form-check-label" htmlFor="tg1">
                          All Students in {dept} ({students.length} students)
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="targetGroup"
                          id="tg2"
                          value="all_mentors"
                          checked={messageForm.targetGroup === 'all_mentors'}
                          onChange={(e) => setMessageForm({ ...messageForm, targetGroup: e.target.value })}
                        />
                        <label className="form-check-label" htmlFor="tg2">
                          All Mentors in {dept} ({mentors.length} mentors)
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="targetGroup"
                          id="tg3"
                          value="custom_selection"
                          checked={messageForm.targetGroup === 'custom_selection'}
                          onChange={(e) => setMessageForm({ ...messageForm, targetGroup: e.target.value })}
                        />
                        <label className="form-check-label fw-bold text-primary" htmlFor="tg3">
                          Select Specific Students Directly Below ({selectedStudentIds.length} currently selected)
                        </label>
                      </div>
                    </div>

                    {/* Requirement 4: DIRECT STUDENT SELECTION IN COMMUNICATION HUB */}
                    {messageForm.targetGroup === 'custom_selection' && (
                      <div className="border rounded p-3 bg-light mt-2">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="small fw-bold text-dark">
                            Select Recipients Directly ({selectedStudentIds.length} chosen):
                          </span>
                          <div className="btn-group btn-group-sm">
                            <button
                              type="button"
                              className="btn btn-outline-primary py-0 px-2"
                              onClick={() => setSelectedStudentIds(students.map((s) => s._id))}
                            >
                              Check All
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline-secondary py-0 px-2"
                              onClick={() => setSelectedStudentIds([])}
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          className="form-control form-control-sm mb-2"
                          placeholder="Quick search student by name or roll number..."
                          value={commRecipientSearch}
                          onChange={(e) => setCommRecipientSearch(e.target.value)}
                        />

                        <div className="bg-white border rounded p-2" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                          {commFilteredStudents.length === 0 ? (
                            <span className="text-muted small">No students found matching search.</span>
                          ) : (
                            commFilteredStudents.map((s) => (
                              <div key={s._id} className="form-check small py-1 border-bottom border-light">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`comm_s_${s._id}`}
                                  checked={selectedStudentIds.includes(s._id)}
                                  onChange={() => toggleStudentSelection(s._id)}
                                />
                                <label className="form-check-label text-dark" htmlFor={`comm_s_${s._id}`}>
                                  <strong>{s.rollNumber}</strong> - {s.name} ({s.email})
                                </label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Message Body *</label>
                    <textarea
                      rows="4"
                      className="form-control form-control-sm"
                      placeholder="Type circular details or message content..."
                      value={messageForm.content}
                      onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                      required
                    ></textarea>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-sm w-100 py-2 fw-semibold"
                    disabled={sendingMessage}
                  >
                    {sendingMessage ? 'Dispatching...' : 'Dispatch Message / Circular'}
                  </button>
                </form>
              </div>
            </div>

            {/* Broadcasts History */}
            <div className="col-12 col-lg-6">
              <div className="card shadow-sm border-0 rounded-3">
                <div className="card-header bg-white py-3 fw-bold text-dark border-bottom d-flex justify-content-between align-items-center">
                  <span><i className="bi bi-inbox-fill text-primary me-2"></i> Broadcasts & Enquiry Threads</span>
                  <button className="btn btn-sm btn-outline-secondary" onClick={loadMessages}>
                    <i className="bi bi-arrow-clockwise"></i>
                  </button>
                </div>
                <div className="card-body p-3" style={{ maxHeight: '680px', overflowY: 'auto' }}>
                  {messages.length === 0 ? (
                    <div className="text-center py-5 text-muted">No communication circulars or messages found.</div>
                  ) : (
                    messages.map((m) => (
                      <div key={m._id} className="card mb-3 border shadow-none rounded-3">
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between align-items-center mb-1">
                            <h6 className="fw-bold mb-0 text-dark">{m.subject}</h6>
                            <span className="badge bg-secondary text-uppercase">{m.messageType}</span>
                          </div>
                          <div className="text-muted small mb-2">
                            From: <strong>{m.sender?.name}</strong> • {new Date(m.createdAt).toLocaleString()} • {m.recipients?.length || 0} recipient(s)
                          </div>
                          <p className="mb-2 text-dark small" style={{ whiteSpace: 'pre-wrap' }}>{m.content}</p>

                          {m.replies?.map((r, rIdx) => (
                            <div key={rIdx} className="small mb-1 p-2 bg-light rounded">
                              <strong>{r.senderName}</strong>: {r.content}
                            </div>
                          ))}

                          <div className="input-group input-group-sm mt-2">
                            <input
                              type="text"
                              className="form-control"
                              placeholder="Write a follow-up reply..."
                              value={replyText[m._id] || ''}
                              onChange={(e) => setReplyText({ ...replyText, [m._id]: e.target.value })}
                              onKeyDown={(e) => e.key === 'Enter' && handleSendReply(m._id)}
                            />
                            <button className="btn btn-outline-primary" onClick={() => handleSendReply(m._id)}>
                              Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PAGE D: DEPARTMENT DRIVES (WITH EDITING & SPECIAL FLAG) */}
        {/* ======================================================== */}
        {activeTab === 'drives' && (
          <div className="card shadow-sm border-0 rounded-3">
            <div className="card-header bg-white py-3 border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <h5 className="fw-bold mb-0 text-slate-800 d-flex align-items-center">
                  <i className="bi bi-briefcase-fill text-warning me-2"></i> Department-Specific Placement Drives
                </h5>
                <span className="text-muted small">
                  Marked under a dedicated department flag. Hidden from placement officers. Visible only to {dept} coordinators, students, and mentors.
                </span>
              </div>
              <div className="d-flex flex-wrap gap-2">
                <a
                  href={`/api/excels/1-qs-gauge?department=${dept}`}
                  download
                  className="btn btn-outline-success btn-sm fw-semibold"
                  title="Download QS I-Gauge Excel for your department (Excel 1)"
                >
                  <i className="bi bi-file-earmark-check-fill me-1"></i> QS I-Gauge (Excel 1)
                </a>
                <a
                  href="/api/excels/3-drives-detail"
                  download
                  className="btn btn-outline-info btn-sm fw-semibold"
                  title="Download Drives Multi-Sheet Workbook (Excel 3)"
                >
                  <i className="bi bi-folder2-open me-1"></i> Drives Detail (Excel 3)
                </a>
                <a
                  href={`/api/excels/4-master-tracking?department=${dept}`}
                  download
                  className="btn btn-outline-warning btn-sm fw-semibold text-dark"
                  title="Download Master Placement Tracking Matrix for your department (Excel 4)"
                >
                  <i className="bi bi-grid-3x3-gap-fill me-1"></i> Master Matrix (Excel 4)
                </a>
                <a
                  href={`/api/excels/5-unwillingness-and-placed?department=${dept}`}
                  download
                  className="btn btn-outline-danger btn-sm fw-semibold"
                  title="Download Unwillingness & Placed Dual Workbook (Excel 5)"
                >
                  <i className="bi bi-layers-fill me-1"></i> Unwillingness & Placed (Excel 5)
                </a>
                <button
                  className="btn btn-warning text-dark btn-sm fw-semibold shadow-sm"
                  onClick={() => {
                    setDriveForm({
                      companyName: '',
                      jobLocation: '',
                      companyDescription: '',
                      department: dept,
                      optInDeadline: '',
                      maxRoleChoicesAllowed: 1,
                      roles: [
                        {
                          roleName: '',
                          ctc: '',
                          minCGPA: 6.0,
                          standingArrearsAllowed: false,
                          maxStandingArrears: 0,
                          historyArrearsAllowed: false,
                          maxHistoryArrears: 0,
                          arrearsAllowed: false,
                          maxArrearsAllowed: 0,
                          roleDescription: '',
                          roleDuties: '',
                          roleRequirements: '',
                          otherDetails: '',
                          fileAttachment: '',
                        },
                      ],
                      customFormFields: [],
                    });
                    setShowAddDriveModal(true);
                  }}
                >
                  <i className="bi bi-plus-circle-fill me-1"></i> Post Department Drive
                </button>
              </div>
            </div>

            <div className="p-4">
              {drivesLoading ? (
                <div className="text-center py-5 text-muted">
                  <div className="spinner-border spinner-border-sm text-warning me-2" role="status"></div>
                  Loading department drives...
                </div>
              ) : drives.length === 0 ? (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-briefcase text-secondary display-5 d-block mb-2"></i>
                  No department drives posted yet for {dept}.
                </div>
              ) : (
                <div className="row g-4">
                  {drives.map((d) => {
                    const isExpired = d.optInDeadline && new Date() > new Date(d.optInDeadline);
                    const optedInCount = d.optIns?.filter((o) => o.status === 'opted_in').length || 0;
                    return (
                      <div key={d._id} className="col-12 col-md-6 col-xl-4">
                        <div className="card h-100 border shadow-sm rounded-3 d-flex flex-column">
                          <div className="card-header bg-light py-2 px-3 d-flex justify-content-between align-items-center">
                            <span className="badge bg-warning text-dark">
                              <i className="bi bi-shield-lock-fill me-1"></i> Dept Drive Only
                            </span>
                            {isExpired ? (
                              <span className="badge bg-danger">
                                <i className="bi bi-clock-history me-1"></i> Deadline Expired
                              </span>
                            ) : (
                              <span className="badge bg-success">
                                <i className="bi bi-check-circle-fill me-1"></i> Active
                              </span>
                            )}
                          </div>

                          <div className="card-body p-3 flex-grow-1">
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <h5 className="fw-bold text-primary mb-0">{d.companyName}</h5>
                            </div>
                            <div className="text-muted small mb-2">
                              <i className="bi bi-geo-alt-fill text-danger me-1"></i>
                              {d.jobLocation || d.location || 'Location Not Specified'}
                            </div>
                            <p className="small text-secondary mb-3" style={{ minHeight: '38px' }}>
                              {d.companyDescription || d.aboutCompany || 'No description provided.'}
                            </p>

                            {/* Opt-In Rules & Badges */}
                            <div className="d-flex flex-wrap gap-1 mb-3">
                              <span className="badge bg-light text-dark border">
                                <i className="bi bi-ui-checks-grid me-1 text-primary"></i>
                                Choice Limit: <strong>{d.maxRoleChoicesAllowed || 1}</strong>
                              </span>
                              <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">
                                <i className="bi bi-person-check-fill me-1"></i>
                                {optedInCount} Opted In
                              </span>
                              {d.customFormFields?.length > 0 && (
                                <span className="badge bg-info bg-opacity-10 text-info border border-info border-opacity-25">
                                  <i className="bi bi-card-checklist me-1"></i>
                                  {d.customFormFields.length} Custom Qs
                                </span>
                              )}
                            </div>

                            {/* Opt-in Deadline Display */}
                            {d.optInDeadline && (
                              <div className="alert alert-secondary py-1 px-2 small mb-3 d-flex align-items-center justify-content-between">
                                <span className="text-muted">
                                  <i className="bi bi-alarm me-1 text-danger"></i> Deadline:
                                </span>
                                <span className={`fw-bold ${isExpired ? 'text-danger' : 'text-dark'}`}>
                                  {new Date(d.optInDeadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                            )}

                            {/* Roles Summary */}
                            <h6 className="fw-bold small text-uppercase text-muted border-top pt-2 mb-2">
                              Job Roles ({d.roles?.length || 0}):
                            </h6>
                            <div className="d-flex flex-column gap-2 mb-2" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                              {d.roles?.map((r, rIdx) => (
                                <div key={rIdx} className="p-2 border rounded bg-light small">
                                  <div className="d-flex justify-content-between align-items-center">
                                    <strong className="text-dark">{r.roleName || r.jobRole}</strong>
                                    <span className="text-success fw-bold">{r.ctc || r.salary || 'Best in Industry'}</span>
                                  </div>
                                  <div className="d-flex flex-wrap gap-2 text-muted mt-1" style={{ fontSize: '0.75rem' }}>
                                    <span>Min CGPA: <strong>{r.minCGPA || 0}</strong></span>
                                    <span>•</span>
                                    <span className="text-danger">
                                      {(r.standingArrearsAllowed || r.arrearsAllowed) ? `Standing ≤ ${r.maxStandingArrears ?? r.maxArrearsAllowed ?? 0}` : '0 Standing'}
                                    </span>
                                    <span>•</span>
                                    <span className="text-secondary">
                                      {r.historyArrearsAllowed ? `History ≤ ${r.maxHistoryArrears || 'Any'}` : 'Clean History'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Card Footer: Management & Multi-sheet Excel */}
                          <div className="card-footer bg-white border-top p-2 d-flex flex-column gap-2">
                            <div className="d-flex gap-1 w-100">
                              <button
                                className="btn btn-primary btn-sm flex-fill fw-semibold"
                                onClick={() => setSelectedDriveForManage(d)}
                              >
                                <i className="bi bi-gear-fill me-1"></i> Manage & Roles
                              </button>
                              <button
                                className="btn btn-outline-success btn-sm flex-fill fw-semibold"
                                title="Download 2-sheet Excel report: Eligible vs Opted-in students"
                                onClick={() => handleDownloadDriveExcel(d)}
                              >
                                <i className="bi bi-file-earmark-excel-fill me-1"></i> Excel Report
                              </button>
                            </div>
                            <div className="d-flex justify-content-between align-items-center pt-1 border-top">
                              <button
                                className="btn btn-link btn-sm text-secondary p-0 text-decoration-none"
                                onClick={() => {
                                  setEditingDrive(d);
                                  setDriveForm({
                                    companyName: d.companyName || '',
                                    jobLocation: d.jobLocation || d.location || '',
                                    companyDescription: d.companyDescription || d.aboutCompany || '',
                                    department: d.department,
                                    optInDeadline: d.optInDeadline ? new Date(d.optInDeadline).toISOString().slice(0, 16) : '',
                                    maxRoleChoicesAllowed: d.maxRoleChoicesAllowed || 1,
                                    roles: d.roles && d.roles.length > 0 ? d.roles.map(r => ({
                                      roleName: r.roleName || r.jobRole || '',
                                      ctc: r.ctc || r.salary || '',
                                      minCGPA: r.minCGPA || 0,
                                      standingArrearsAllowed: r.standingArrearsAllowed ?? (r.arrearsAllowed === true || r.arrearsAllowed === 'true'),
                                      maxStandingArrears: r.maxStandingArrears ?? r.maxArrearsAllowed ?? 0,
                                      historyArrearsAllowed: r.historyArrearsAllowed ?? false,
                                      maxHistoryArrears: r.maxHistoryArrears ?? 0,
                                      arrearsAllowed: r.standingArrearsAllowed ?? (r.arrearsAllowed === true || r.arrearsAllowed === 'true'),
                                      maxArrearsAllowed: r.maxStandingArrears ?? r.maxArrearsAllowed ?? 0,
                                      roleDescription: r.roleDescription || r.jobDescription || '',
                                      roleDuties: r.roleDuties || '',
                                      roleRequirements: r.roleRequirements || '',
                                      otherDetails: r.otherDetails || '',
                                      fileAttachment: r.fileAttachment || '',
                                    })) : [
                                      {
                                        roleName: '',
                                        ctc: '',
                                        minCGPA: 6.0,
                                        standingArrearsAllowed: false,
                                        maxStandingArrears: 0,
                                        historyArrearsAllowed: false,
                                        maxHistoryArrears: 0,
                                        arrearsAllowed: false,
                                        maxArrearsAllowed: 0,
                                        roleDescription: '',
                                        roleDuties: '',
                                        roleRequirements: '',
                                        otherDetails: '',
                                        fileAttachment: '',
                                      }
                                    ],
                                    customFormFields: d.customFormFields && d.customFormFields.length > 0 ? d.customFormFields.map(f => ({
                                      fieldLabel: f.fieldLabel || '',
                                      fieldType: f.fieldType || 'text',
                                      isRequired: f.isRequired === true,
                                    })) : [],
                                  });
                                  setShowEditDriveModal(true);
                                }}
                              >
                                <i className="bi bi-pencil me-1"></i> Edit Info
                              </button>
                              <button
                                className="btn btn-link btn-sm text-danger p-0 text-decoration-none"
                                onClick={() => handleDeleteDrive(d)}
                              >
                                <i className="bi bi-trash me-1"></i> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* PAGE E: SUPPORT & HELP TICKETS */}
        {/* ======================================================== */}
        {activeTab === 'tickets' && (
          <TicketSupportCenter user={user} />
        )}

      </div>

      {/* MODAL: CUSTOM EXCEL EXPORT BUILDER (Requirements 2 & 3) */}
      {showCustomExportModal && (
        <CustomExcelExportModal
          filters={{
            department: dept,
            search,
            cgpaMin,
            cgpaMax,
            isPlaced,
            placementType,
            hasArrears,
            careerGoal,
            studyLocation,
            domainInterest,
            studentCategory,
            section,
            mentorId: mentorFilter,
          }}
          totalMatchingCount={students.length}
          onClose={() => setShowCustomExportModal(false)}
        />
      )}

      {/* MODAL: FULL STUDENT PROFILE VIEW */}
      {selectedStudentForView && (
        <StudentProfileModal
          student={selectedStudentForView}
          onClose={() => setSelectedStudentForView(null)}
        />
      )}

      {/* MODAL: ADD STUDENT */}
      {showAddStudentModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">Add Student to {dept}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddStudentModal(false)}></button>
              </div>
              <form onSubmit={handleCreateStudent}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Student Full Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Roll Number *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={studentForm.rollNumber}
                      onChange={(e) => setStudentForm({ ...studentForm, rollNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Email *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={studentForm.email}
                      onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddStudentModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Create Student</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT STUDENT (Requirement 6) */}
      {showEditStudentModal && editingStudent && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-secondary text-white">
                <h5 className="modal-title fw-bold">Edit Student: {editingStudent.name}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditStudentModal(false)}></button>
              </div>
              <form onSubmit={handleUpdateStudent}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Full Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={studentForm.name}
                      onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Roll Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={studentForm.rollNumber}
                      onChange={(e) => setStudentForm({ ...studentForm, rollNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Email</label>
                    <input
                      type="email"
                      className="form-control"
                      value={studentForm.email}
                      onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Section</label>
                      <input
                        type="text"
                        className="form-control"
                        value={studentForm.section}
                        onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">Category</label>
                      <select
                        className="form-select"
                        value={studentForm.studentCategory}
                        onChange={(e) => setStudentForm({ ...studentForm, studentCategory: e.target.value })}
                      >
                        <option value="Day Scholar">Day Scholar</option>
                        <option value="Hosteller">Hosteller</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditStudentModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD MENTOR */}
      {showAddMentorModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">Add Mentor for {dept}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowAddMentorModal(false)}></button>
              </div>
              <form onSubmit={handleCreateMentor}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Faculty / Mentor Name *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={mentorForm.name}
                      onChange={(e) => setMentorForm({ ...mentorForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Email Address *</label>
                    <input
                      type="email"
                      className="form-control"
                      value={mentorForm.email}
                      onChange={(e) => setMentorForm({ ...mentorForm, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddMentorModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Add Mentor</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT MENTOR (Requirement 6) */}
      {showEditMentorModal && editingMentor && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-secondary text-white">
                <h5 className="modal-title fw-bold">Edit Mentor: {editingMentor.name}</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditMentorModal(false)}></button>
              </div>
              <form onSubmit={handleUpdateMentor}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Mentor Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={mentorForm.name}
                      onChange={(e) => setMentorForm({ ...mentorForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Email Address</label>
                    <input
                      type="email"
                      className="form-control"
                      value={mentorForm.email}
                      onChange={(e) => setMentorForm({ ...mentorForm, email: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditMentorModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: POST DEPARTMENT DRIVE */}
      {showAddDriveModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-xl" style={{ maxHeight: '90vh' }}>
            <div className="modal-content border-0 shadow" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="modal-header bg-warning text-dark flex-shrink-0">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-briefcase-fill me-2"></i>Post Department-Specific Drive
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowAddDriveModal(false)}></button>
              </div>
              <form onSubmit={handleCreateDrive} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <div className="modal-body p-4" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                  <div className="alert alert-info py-2 small mb-3">
                    <i className="bi bi-shield-lock-fill me-1"></i>
                    This drive will be tagged under your department (<strong>{dept}</strong>) and hidden from placement officers. Only your department's coordinators, mentors, and students have access.
                  </div>

                  {/* Company & Core Drive Info */}
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-5">
                      <label className="form-label small fw-semibold">Company Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Zoho, Microsoft, Freshworks"
                        value={driveForm.companyName}
                        onChange={(e) => setDriveForm({ ...driveForm, companyName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Job Location *</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Chennai, Bangalore, Hybrid"
                        value={driveForm.jobLocation}
                        onChange={(e) => setDriveForm({ ...driveForm, jobLocation: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold text-danger">Opt-In Deadline *</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={driveForm.optInDeadline}
                        onChange={(e) => setDriveForm({ ...driveForm, optInDeadline: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label small fw-semibold">About Company / Description</label>
                      <textarea
                        rows="2"
                        className="form-control"
                        placeholder="Overview of the company, headquarters, culture, etc."
                        value={driveForm.companyDescription}
                        onChange={(e) => setDriveForm({ ...driveForm, companyDescription: e.target.value })}
                      ></textarea>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Max Role Choices Per Student</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        className="form-control"
                        value={driveForm.maxRoleChoicesAllowed}
                        onChange={(e) => setDriveForm({ ...driveForm, maxRoleChoicesAllowed: parseInt(e.target.value) || 1 })}
                      />
                      <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                        Limit how many roles a student can select when opting into this drive.
                      </span>
                    </div>
                  </div>

                  {/* Section: Job Roles Builder */}
                  <div className="card mb-4 border rounded-3 bg-light">
                    <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
                      <span className="fw-bold text-dark small text-uppercase">
                        <i className="bi bi-person-workspace text-primary me-1"></i> Job Roles & Criteria ({driveForm.roles.length})
                      </span>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleAddDriveRole}>
                        <i className="bi bi-plus-circle me-1"></i> Add Another Role
                      </button>
                    </div>
                    <div className="card-body p-3 d-flex flex-column gap-3">
                      {driveForm.roles.map((r, idx) => (
                        <div key={idx} className="p-3 border rounded bg-white shadow-sm position-relative">
                          <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                            <span className="fw-bold small text-secondary">Role #{idx + 1}</span>
                            {driveForm.roles.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger py-0 px-2"
                                onClick={() => handleRemoveDriveRole(idx)}
                              >
                                <i className="bi bi-trash"></i> Remove
                              </button>
                            )}
                          </div>
                          <div className="row g-2 mb-2">
                            <div className="col-12 col-md-3">
                              <label className="form-label small fw-semibold">Role Name *</label>
                              <input
                                type="text"
                                placeholder="e.g. Software Engineer"
                                className="form-control form-control-sm"
                                value={r.roleName}
                                onChange={(e) => handleRoleChange(idx, 'roleName', e.target.value)}
                                required
                              />
                            </div>
                            <div className="col-12 col-md-2">
                              <label className="form-label small fw-semibold">CTC / Salary *</label>
                              <input
                                type="text"
                                placeholder="e.g. 8.5 LPA"
                                className="form-control form-control-sm"
                                value={r.ctc}
                                onChange={(e) => handleRoleChange(idx, 'ctc', e.target.value)}
                                required
                              />
                            </div>
                            <div className="col-12 col-md-1">
                              <label className="form-label small fw-semibold">Min CGPA</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                className="form-control form-control-sm"
                                value={r.minCGPA}
                                onChange={(e) => handleRoleChange(idx, 'minCGPA', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            {/* Standing Arrears Policy (Separate Entity) */}
                            <div className="col-12 col-md-3">
                              <label className="form-label small fw-semibold text-danger">Standing Arrears Policy</label>
                              <div className="d-flex align-items-center gap-2 mt-1">
                                <div className="form-check mb-0">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`add_stand_arr_${idx}`}
                                    checked={r.standingArrearsAllowed ?? r.arrearsAllowed ?? false}
                                    onChange={(e) => {
                                      handleRoleChange(idx, 'standingArrearsAllowed', e.target.checked);
                                      handleRoleChange(idx, 'arrearsAllowed', e.target.checked);
                                    }}
                                  />
                                  <label className="form-check-label small" htmlFor={`add_stand_arr_${idx}`}>Permitted</label>
                                </div>
                                {(r.standingArrearsAllowed || r.arrearsAllowed) && (
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    className="form-control form-control-sm"
                                    placeholder="Max"
                                    value={r.maxStandingArrears ?? r.maxArrearsAllowed ?? 0}
                                    onChange={(e) => {
                                      handleRoleChange(idx, 'maxStandingArrears', parseInt(e.target.value) || 0);
                                      handleRoleChange(idx, 'maxArrearsAllowed', parseInt(e.target.value) || 0);
                                    }}
                                    style={{ width: '70px' }}
                                  />
                                )}
                              </div>
                            </div>
                            {/* History of Arrears Policy (Separate Entity) */}
                            <div className="col-12 col-md-3">
                              <label className="form-label small fw-semibold text-secondary">History of Arrears</label>
                              <div className="d-flex align-items-center gap-2 mt-1">
                                <div className="form-check mb-0">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`add_hist_arr_${idx}`}
                                    checked={r.historyArrearsAllowed ?? false}
                                    onChange={(e) => handleRoleChange(idx, 'historyArrearsAllowed', e.target.checked)}
                                  />
                                  <label className="form-check-label small" htmlFor={`add_hist_arr_${idx}`}>Permitted</label>
                                </div>
                                {r.historyArrearsAllowed && (
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    className="form-control form-control-sm"
                                    placeholder="Max past"
                                    value={r.maxHistoryArrears || 0}
                                    onChange={(e) => handleRoleChange(idx, 'maxHistoryArrears', parseInt(e.target.value) || 0)}
                                    style={{ width: '80px' }}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="row g-2 mb-2">
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-semibold">Role Description</label>
                              <textarea
                                rows="2"
                                className="form-control form-control-sm"
                                placeholder="Core summary of this role..."
                                value={r.roleDescription}
                                onChange={(e) => handleRoleChange(idx, 'roleDescription', e.target.value)}
                              ></textarea>
                            </div>
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-semibold">Role Duties & Responsibilities</label>
                              <textarea
                                rows="2"
                                className="form-control form-control-sm"
                                placeholder="Key day-to-day duties..."
                                value={r.roleDuties}
                                onChange={(e) => handleRoleChange(idx, 'roleDuties', e.target.value)}
                              ></textarea>
                            </div>
                          </div>
                          <div className="row g-2">
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-semibold">Role Requirements / Tech Stack</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="e.g. React, Node, DSA, SQL"
                                value={r.roleRequirements}
                                onChange={(e) => handleRoleChange(idx, 'roleRequirements', e.target.value)}
                              />
                            </div>
                            <div className="col-12 col-md-3">
                              <label className="form-label small fw-semibold">Other Details</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="e.g. 2-yr Service Bond"
                                value={r.otherDetails}
                                onChange={(e) => handleRoleChange(idx, 'otherDetails', e.target.value)}
                              />
                            </div>
                            <div className="col-12 col-md-3">
                              <label className="form-label small fw-semibold">File / JD URL</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="https://..."
                                value={r.fileAttachment}
                                onChange={(e) => handleRoleChange(idx, 'fileAttachment', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section: Custom Form Builder */}
                  <div className="card border rounded-3 bg-light">
                    <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
                      <div>
                        <span className="fw-bold text-dark small text-uppercase">
                          <i className="bi bi-ui-checks text-warning me-1"></i> Custom Opt-In Form Fields ({driveForm.customFormFields?.length || 0})
                        </span>
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                          Collect extra specific details (e.g. GitHub profile, LeetCode link, preferred track) exclusively from students who opt-in.
                        </div>
                      </div>
                      <button type="button" className="btn btn-sm btn-outline-warning text-dark" onClick={handleAddCustomField}>
                        <i className="bi bi-plus-lg me-1"></i> Add Extra Field
                      </button>
                    </div>
                    <div className="card-body p-3">
                      {(!driveForm.customFormFields || driveForm.customFormFields.length === 0) ? (
                        <div className="text-muted small text-center py-2">
                          No custom questions added. Click <strong>+ Add Extra Field</strong> if you need extra details from candidates.
                        </div>
                      ) : (
                        <div className="d-flex flex-column gap-2">
                          {driveForm.customFormFields.map((cf, cIdx) => (
                            <div key={cIdx} className="d-flex align-items-center gap-2 p-2 bg-white border rounded">
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Question / Field Title (e.g. GitHub Profile Link)"
                                value={cf.fieldLabel}
                                onChange={(e) => handleCustomFieldChange(cIdx, 'fieldLabel', e.target.value)}
                                required
                              />
                              <select
                                className="form-select form-select-sm"
                                style={{ width: '130px' }}
                                value={cf.fieldType}
                                onChange={(e) => handleCustomFieldChange(cIdx, 'fieldType', e.target.value)}
                              >
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="url">URL / Link</option>
                                <option value="textarea">Textarea</option>
                              </select>
                              <div className="form-check mb-0 text-nowrap">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id={`cf_req_${cIdx}`}
                                  checked={cf.isRequired}
                                  onChange={(e) => handleCustomFieldChange(cIdx, 'isRequired', e.target.checked)}
                                />
                                <label className="form-check-label small" htmlFor={`cf_req_${cIdx}`}>Required</label>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleRemoveCustomField(cIdx)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light flex-shrink-0">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAddDriveModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-warning btn-sm fw-semibold">
                    <i className="bi bi-send-check me-1"></i> Publish Department Drive
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DEPARTMENT DRIVE */}
      {showEditDriveModal && editingDrive && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
          <div className="modal-dialog modal-dialog-centered modal-xl" style={{ maxHeight: '90vh' }}>
            <div className="modal-content border-0 shadow" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="modal-header bg-secondary text-white flex-shrink-0">
                <h5 className="modal-title fw-bold">
                  <i className="bi bi-pencil-square me-2"></i>Edit Drive: {editingDrive.companyName}
                </h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowEditDriveModal(false)}></button>
              </div>
              <form onSubmit={handleUpdateDrive} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                <div className="modal-body p-4" style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-5">
                      <label className="form-label small fw-semibold">Company Name *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={driveForm.companyName}
                        onChange={(e) => setDriveForm({ ...driveForm, companyName: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Job Location *</label>
                      <input
                        type="text"
                        className="form-control"
                        value={driveForm.jobLocation}
                        onChange={(e) => setDriveForm({ ...driveForm, jobLocation: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-12 col-md-3">
                      <label className="form-label small fw-semibold text-danger">Opt-In Deadline</label>
                      <input
                        type="datetime-local"
                        className="form-control"
                        value={driveForm.optInDeadline}
                        onChange={(e) => setDriveForm({ ...driveForm, optInDeadline: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-12 col-md-8">
                      <label className="form-label small fw-semibold">About Company / Description</label>
                      <textarea
                        rows="2"
                        className="form-control"
                        value={driveForm.companyDescription}
                        onChange={(e) => setDriveForm({ ...driveForm, companyDescription: e.target.value })}
                      ></textarea>
                    </div>
                    <div className="col-12 col-md-4">
                      <label className="form-label small fw-semibold">Max Role Choices Per Student</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        className="form-control"
                        value={driveForm.maxRoleChoicesAllowed}
                        onChange={(e) => setDriveForm({ ...driveForm, maxRoleChoicesAllowed: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                  </div>

                  {/* Section: Job Roles Builder */}
                  <div className="card mb-4 border rounded-3 bg-light">
                    <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
                      <span className="fw-bold text-dark small text-uppercase">
                        <i className="bi bi-person-workspace text-primary me-1"></i> Job Roles & Criteria ({driveForm.roles.length})
                      </span>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={handleAddDriveRole}>
                        <i className="bi bi-plus-circle me-1"></i> Add Another Role
                      </button>
                    </div>
                    <div className="card-body p-3 d-flex flex-column gap-3">
                      {driveForm.roles.map((r, idx) => (
                        <div key={idx} className="p-3 border rounded bg-white shadow-sm position-relative">
                          <div className="d-flex justify-content-between align-items-center mb-2 pb-1 border-bottom">
                            <span className="fw-bold small text-secondary">Role #{idx + 1}</span>
                            {driveForm.roles.length > 1 && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger py-0 px-2"
                                onClick={() => handleRemoveDriveRole(idx)}
                              >
                                <i className="bi bi-trash"></i> Remove
                              </button>
                            )}
                          </div>
                          <div className="row g-2 mb-2">
                            <div className="col-12 col-md-3">
                              <label className="form-label small fw-semibold">Role Name *</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={r.roleName}
                                onChange={(e) => handleRoleChange(idx, 'roleName', e.target.value)}
                                required
                              />
                            </div>
                            <div className="col-12 col-md-2">
                              <label className="form-label small fw-semibold">CTC / Salary *</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={r.ctc}
                                onChange={(e) => handleRoleChange(idx, 'ctc', e.target.value)}
                                required
                              />
                            </div>
                            <div className="col-12 col-md-1">
                              <label className="form-label small fw-semibold">Min CGPA</label>
                              <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="10"
                                className="form-control form-control-sm"
                                value={r.minCGPA}
                                onChange={(e) => handleRoleChange(idx, 'minCGPA', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            {/* Standing Arrears Policy (Separate Entity) */}
                            <div className="col-12 col-md-3">
                              <label className="form-label small fw-semibold text-danger">Standing Arrears Policy</label>
                              <div className="d-flex align-items-center gap-2 mt-1">
                                <div className="form-check mb-0">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`edit_stand_arr_${idx}`}
                                    checked={r.standingArrearsAllowed ?? r.arrearsAllowed ?? false}
                                    onChange={(e) => {
                                      handleRoleChange(idx, 'standingArrearsAllowed', e.target.checked);
                                      handleRoleChange(idx, 'arrearsAllowed', e.target.checked);
                                    }}
                                  />
                                  <label className="form-check-label small" htmlFor={`edit_stand_arr_${idx}`}>Permitted</label>
                                </div>
                                {(r.standingArrearsAllowed || r.arrearsAllowed) && (
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    className="form-control form-control-sm"
                                    placeholder="Max"
                                    value={r.maxStandingArrears ?? r.maxArrearsAllowed ?? 0}
                                    onChange={(e) => {
                                      handleRoleChange(idx, 'maxStandingArrears', parseInt(e.target.value) || 0);
                                      handleRoleChange(idx, 'maxArrearsAllowed', parseInt(e.target.value) || 0);
                                    }}
                                    style={{ width: '70px' }}
                                  />
                                )}
                              </div>
                            </div>
                            {/* History of Arrears Policy (Separate Entity) */}
                            <div className="col-12 col-md-3">
                              <label className="form-label small fw-semibold text-secondary">History of Arrears</label>
                              <div className="d-flex align-items-center gap-2 mt-1">
                                <div className="form-check mb-0">
                                  <input
                                    className="form-check-input"
                                    type="checkbox"
                                    id={`edit_hist_arr_${idx}`}
                                    checked={r.historyArrearsAllowed ?? false}
                                    onChange={(e) => handleRoleChange(idx, 'historyArrearsAllowed', e.target.checked)}
                                  />
                                  <label className="form-check-label small" htmlFor={`edit_hist_arr_${idx}`}>Permitted</label>
                                </div>
                                {r.historyArrearsAllowed && (
                                  <input
                                    type="number"
                                    min="0"
                                    max="20"
                                    className="form-control form-control-sm"
                                    placeholder="Max past"
                                    value={r.maxHistoryArrears || 0}
                                    onChange={(e) => handleRoleChange(idx, 'maxHistoryArrears', parseInt(e.target.value) || 0)}
                                    style={{ width: '80px' }}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="row g-2 mb-2">
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-semibold">Role Description</label>
                              <textarea
                                rows="2"
                                className="form-control form-control-sm"
                                value={r.roleDescription}
                                onChange={(e) => handleRoleChange(idx, 'roleDescription', e.target.value)}
                              ></textarea>
                            </div>
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-semibold">Role Duties & Responsibilities</label>
                              <textarea
                                rows="2"
                                className="form-control form-control-sm"
                                value={r.roleDuties}
                                onChange={(e) => handleRoleChange(idx, 'roleDuties', e.target.value)}
                              ></textarea>
                            </div>
                          </div>
                          <div className="row g-2">
                            <div className="col-12 col-md-6">
                              <label className="form-label small fw-semibold">Role Requirements / Tech Stack</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={r.roleRequirements}
                                onChange={(e) => handleRoleChange(idx, 'roleRequirements', e.target.value)}
                              />
                            </div>
                            <div className="col-12 col-md-3">
                              <label className="form-label small fw-semibold">Other Details</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={r.otherDetails}
                                onChange={(e) => handleRoleChange(idx, 'otherDetails', e.target.value)}
                              />
                            </div>
                            <div className="col-12 col-md-3">
                              <label className="form-label small fw-semibold">File / JD URL</label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                value={r.fileAttachment}
                                onChange={(e) => handleRoleChange(idx, 'fileAttachment', e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Section: Custom Form Builder */}
                  <div className="card border rounded-3 bg-light">
                    <div className="card-header bg-white py-2 d-flex justify-content-between align-items-center">
                      <span className="fw-bold text-dark small text-uppercase">
                        <i className="bi bi-ui-checks text-warning me-1"></i> Custom Opt-In Form Fields ({driveForm.customFormFields?.length || 0})
                      </span>
                      <button type="button" className="btn btn-sm btn-outline-warning text-dark" onClick={handleAddCustomField}>
                        <i className="bi bi-plus-lg me-1"></i> Add Extra Field
                      </button>
                    </div>
                    <div className="card-body p-3">
                      {(!driveForm.customFormFields || driveForm.customFormFields.length === 0) ? (
                        <div className="text-muted small text-center py-2">
                          No custom questions added. Click <strong>+ Add Extra Field</strong> if you need extra details from candidates.
                        </div>
                      ) : (
                        <div className="d-flex flex-column gap-2">
                          {driveForm.customFormFields.map((cf, cIdx) => (
                            <div key={cIdx} className="d-flex align-items-center gap-2 p-2 bg-white border rounded">
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Question / Field Title (e.g. GitHub Profile Link)"
                                value={cf.fieldLabel}
                                onChange={(e) => handleCustomFieldChange(cIdx, 'fieldLabel', e.target.value)}
                                required
                              />
                              <select
                                className="form-select form-select-sm"
                                style={{ width: '130px' }}
                                value={cf.fieldType}
                                onChange={(e) => handleCustomFieldChange(cIdx, 'fieldType', e.target.value)}
                              >
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="url">URL / Link</option>
                                <option value="textarea">Textarea</option>
                              </select>
                              <div className="form-check mb-0 text-nowrap">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id={`edit_cf_req_${cIdx}`}
                                  checked={cf.isRequired}
                                  onChange={(e) => handleCustomFieldChange(cIdx, 'isRequired', e.target.checked)}
                                />
                                <label className="form-check-label small" htmlFor={`edit_cf_req_${cIdx}`}>Required</label>
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleRemoveCustomField(cIdx)}
                              >
                                <i className="bi bi-trash"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="modal-footer bg-light flex-shrink-0">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEditDriveModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm">Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* DRIVE & ROLE MANAGEMENT MODAL */}
      {selectedDriveForManage && (
        <DriveManagementModal
          drive={selectedDriveForManage}
          onClose={() => setSelectedDriveForManage(null)}
          onRefresh={() => {
            loadDrives();
            coordinatorAPI.getDrives({ department: dept }).then((res) => {
              if (res.data.success) {
                const refreshed = res.data.drives.find((d) => d._id === selectedDriveForManage._id);
                if (refreshed) setSelectedDriveForManage(refreshed);
              }
            });
          }}
        />
      )}



      {/* MODAL: BULK STUDENT IMPORT */}
      {showBulkStudentModal && (
        <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content border-0 shadow">
              <div className="modal-header bg-success text-white">
                <h5 className="modal-title fw-bold">Bulk Student Onboarding</h5>
                <button type="button" className="btn-close btn-close-white" onClick={() => setShowBulkStudentModal(false)}></button>
              </div>
              <div className="modal-body p-4">
                <div className="d-flex justify-content-between align-items-center mb-3 p-3 bg-light rounded border">
                  <div>
                    <h6 className="fw-bold mb-1">Standard Spreadsheet Template</h6>
                    <span className="text-muted small">Columns: <code>Student Name</code>, <code>Roll Number</code>, <code>Email</code>, <code>Section</code>, <code>Category</code></span>
                  </div>
                  <button className="btn btn-sm btn-outline-success" onClick={downloadStudentTemplate}>
                    Download Template (.xlsx)
                  </button>
                </div>
                <form onSubmit={handleBulkStudentUpload}>
                  <div className="mb-3">
                    <input
                      type="file"
                      className="form-control"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) => setExcelFile(e.target.files[0])}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-success w-100 py-2" disabled={bulkUploading}>
                    {bulkUploading ? 'Uploading...' : 'Upload & Onboard'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
