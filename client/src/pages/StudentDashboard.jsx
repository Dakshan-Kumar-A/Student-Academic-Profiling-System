import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Navbar from '../components/Navbar';
import CommunicationHub from '../components/CommunicationHub';
import TicketSupportCenter from '../components/TicketSupportCenter';
import { studentAPI } from '../services/api';

const getCareerGoalText = (cg) => {
  if (!cg) return 'Undecided';
  if (typeof cg === 'string') return cg;
  if (typeof cg === 'object') return cg.primaryGoal || 'Undecided';
  return 'Undecided';
};

// Helper to compute weighted CGPA from semesters
const computeCGPA = (semesters = []) => {
  let totalCredits = 0;
  let weightedSum = 0;
  let validCount = 0;
  let sumSgpa = 0;

  (semesters || []).forEach((s) => {
    const cred = parseFloat(s.credits) || 0;
    const sgpa = parseFloat(s.sgpa) || 0;
    if (sgpa > 0) {
      validCount++;
      sumSgpa += sgpa;
      if (cred > 0) {
        totalCredits += cred;
        weightedSum += sgpa * cred;
      }
    }
  });

  if (totalCredits > 0) {
    return (weightedSum / totalCredits).toFixed(2);
  }
  if (validCount > 0) {
    return (sumSgpa / validCount).toFixed(2);
  }
  return '0.00';
};

const computeTotalCredits = (semesters = []) => {
  return (semesters || []).reduce((acc, s) => acc + (parseFloat(s.credits) || 0), 0);
};

export default function StudentDashboard() {
  const [currentUser] = useState(() => {
    return JSON.parse(localStorage.getItem('user') || '{}');
  });

  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'profile_edit', 'drives', 'unwillingness', 'communication', 'tickets'
  const [profile, setProfile] = useState(null);
  const [unwillingnessStatus, setUnwillingnessStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  // Drives state
  const [drivesData, setDrivesData] = useState({ departmentDrives: [], placementDrives: [] });
  const [drivesTab, setDrivesTab] = useState('placement'); // 'placement', 'department', 'my_tracking'
  const [drivesSearch, setDrivesSearch] = useState('');
  const [drivesFilterOffer, setDrivesFilterOffer] = useState('all');
  const [drivesFilterStatus, setDrivesFilterStatus] = useState('all');
  const [trackerFilter, setTrackerFilter] = useState('all'); // 'all', 'opted', 'eligible_pending', 'not_opted'
  const [selectedDriveForOptIn, setSelectedDriveForOptIn] = useState(null);
  const [roleChoices, setRoleChoices] = useState([]);
  const [customResponses, setCustomResponses] = useState({});
  const [submittingOptIn, setSubmittingOptIn] = useState(false);

  // Unwillingness form state
  const [unwillingnessForm, setUnwillingnessForm] = useState(null);
  const [unwillingnessSubmission, setUnwillingnessSubmission] = useState(null);
  const [unwillingnessReason, setUnwillingnessReason] = useState('');
  const [unwillingnessCareerChoice, setUnwillingnessCareerChoice] = useState('Higher Studies');
  const [unwillingnessResponses, setUnwillingnessResponses] = useState({});
  const [higherStudiesDetails, setHigherStudiesDetails] = useState({
    targetDegree: '',
    specialization: '',
    countryPreference: '',
    entranceExam: '',
    expectedAdmissionYear: '',
  });
  const [entrepreneurshipDetails, setEntrepreneurshipDetails] = useState({
    startupName: '',
    industry: '',
    currentStage: 'Idea',
    summary: '',
  });
  const [submittingUnwillingness, setSubmittingUnwillingness] = useState(false);

  // Profile Edit Form State
  const [formData, setFormData] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await studentAPI.getProfile();
      if (res.data.success) {
        setProfile(res.data.profile);
        setUnwillingnessStatus(res.data.unwillingnessStatus);
        setFormData(res.data.profile);
      }
    } catch (err) {
      console.error('Failed to fetch student profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrives = async () => {
    try {
      const res = await studentAPI.getDrives();
      if (res.data.success) {
        setDrivesData({
          departmentDrives: res.data.departmentDrives || [],
          placementDrives: res.data.placementDrives || [],
        });
      }
    } catch (err) {
      console.error('Failed to fetch drives:', err);
    }
  };

  const fetchUnwillingness = async () => {
    try {
      const res = await studentAPI.getUnwillingnessForm();
      if (res.data.success) {
        setUnwillingnessForm(res.data.form || null);
        setUnwillingnessSubmission(res.data.submission || null);
        if (res.data.submission) {
          setUnwillingnessCareerChoice(res.data.submission.careerGoalChoice || 'Higher Studies');
          setUnwillingnessReason(res.data.submission.reasonForUnwillingness || '');
          if (res.data.submission.higherStudiesDetails) {
            setHigherStudiesDetails(res.data.submission.higherStudiesDetails);
          }
          if (res.data.submission.entrepreneurshipDetails) {
            setEntrepreneurshipDetails(res.data.submission.entrepreneurshipDetails);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch unwillingness form:', err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchDrives();
    fetchUnwillingness();
  }, []);

  // Handle Section-by-Section Save
  const handleSaveSection = async (sectionName, sectionData = {}) => {
    setSavingProfile(true);
    try {
      const mergedPayload = {
        ...formData,
        ...sectionData,
      };
      const res = await studentAPI.updateProfile(mergedPayload);
      if (res.data.success) {
        setProfile(res.data.profile);
        setFormData(res.data.profile);
        Swal.fire({
          icon: 'success',
          title: `${sectionName} Saved`,
          text: `Section updated successfully! Current profile completeness is ${res.data.profileCompleteness}%.`,
          timer: 2000,
          showConfirmButton: false,
        });
        fetchProfile();
        fetchDrives();
      }
    } catch (err) {
      Swal.fire('Save Error', err.response?.data?.message || `Failed to save ${sectionName}.`, 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Complete Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await studentAPI.updateProfile(formData);
      if (res.data.success) {
        setProfile(res.data.profile);
        setFormData(res.data.profile);
        Swal.fire({
          icon: 'success',
          title: 'Profile Saved',
          text: `Profile completeness is now ${res.data.profileCompleteness}%.`,
          timer: 2000,
          showConfirmButton: false,
        });
        fetchProfile();
        fetchDrives();
      }
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save profile changes.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Semester Change (SGPA and Credits)
  const handleSemesterChange = (semNum, field, val) => {
    const currentList = Array.isArray(formData.semesters) ? [...formData.semesters] : [];
    const existingIdx = currentList.findIndex((s) => s.semesterNumber === semNum);

    let updatedList;
    if (existingIdx >= 0) {
      updatedList = currentList.map((s, idx) => {
        if (idx === existingIdx) {
          return {
            ...s,
            [field]: val === '' ? '' : Number(val),
          };
        }
        return s;
      });
    } else {
      updatedList = [
        ...currentList,
        {
          semesterNumber: semNum,
          sgpa: field === 'sgpa' ? (val === '' ? '' : Number(val)) : 0,
          credits: field === 'credits' ? (val === '' ? '' : Number(val)) : 0,
          attendancePercentage: 0,
        },
      ];
    }

    const newCGPA = Number(computeCGPA(updatedList));

    setFormData((prev) => ({
      ...prev,
      semesters: updatedList,
      currentCGPA: newCGPA,
    }));
  };

  // Dynamic Projects Handlers
  const handleAddProject = () => {
    const current = Array.isArray(formData.projects) ? [...formData.projects] : [];
    setFormData((prev) => ({
      ...prev,
      projects: [
        ...current,
        {
          title: '',
          domain: '',
          role: '',
          githubLink: '',
          liveDemoUrl: '',
          description: '',
        },
      ],
    }));
  };

  const handleUpdateProject = (index, field, value) => {
    const current = Array.isArray(formData.projects) ? [...formData.projects] : [];
    current[index] = {
      ...current[index],
      [field]: value,
    };
    setFormData((prev) => ({
      ...prev,
      projects: current,
    }));
  };

  const handleRemoveProject = (index) => {
    const current = Array.isArray(formData.projects) ? [...formData.projects] : [];
    current.splice(index, 1);
    setFormData((prev) => ({
      ...prev,
      projects: current,
    }));
  };

  // Dynamic Certifications Handlers
  const handleAddCertification = () => {
    const current = Array.isArray(formData.certifications) ? [...formData.certifications] : [];
    setFormData((prev) => ({
      ...prev,
      certifications: [
        ...current,
        {
          name: '',
          certificationType: 'Global Certification',
          issuingOrganization: '',
          issueDate: '',
          credentialId: '',
          credentialUrl: '',
        },
      ],
    }));
  };

  const handleUpdateCertification = (index, field, value) => {
    const current = Array.isArray(formData.certifications) ? [...formData.certifications] : [];
    current[index] = {
      ...current[index],
      [field]: value,
    };
    setFormData((prev) => ({
      ...prev,
      certifications: current,
    }));
  };

  const handleRemoveCertification = (index) => {
    const current = Array.isArray(formData.certifications) ? [...formData.certifications] : [];
    current.splice(index, 1);
    setFormData((prev) => ({
      ...prev,
      certifications: current,
    }));
  };

  // Drive Opt-In Modal
  const handleOpenOptInModal = (drive) => {
    setSelectedDriveForOptIn(drive);
    setRoleChoices(drive.roles?.[0]?.roleName ? [drive.roles[0].roleName] : []);
    setCustomResponses({});
  };

  const handleSubmitOptIn = async () => {
    if (!selectedDriveForOptIn) return;
    setSubmittingOptIn(true);
    try {
      const res = await studentAPI.optInDrive(selectedDriveForOptIn._id, {
        selectedRoles: roleChoices,
        customFormResponses: customResponses,
      });
      if (res.data.success) {
        Swal.fire('Opt-in Successful!', res.data.message, 'success');
        setSelectedDriveForOptIn(null);
        fetchDrives();
      }
    } catch (err) {
      Swal.fire('Opt-In Failed', err.response?.data?.message || 'Eligibility criteria not met.', 'error');
    } finally {
      setSubmittingOptIn(false);
    }
  };

  const handleOptOut = async (driveId, companyName) => {
    const confirm = await Swal.fire({
      title: `Opt out of ${companyName}?`,
      text: 'Are you sure you want to withdraw your application from this drive?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Yes, Opt Out',
    });

    if (confirm.isConfirmed) {
      try {
        const res = await studentAPI.optOutDrive(driveId);
        if (res.data.success) {
          Swal.fire('Opted Out', res.data.message, 'info');
          fetchDrives();
        }
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Failed to opt out.', 'error');
      }
    }
  };

  // Unwillingness Submission
  const handleSubmitUnwillingness = async (e) => {
    e.preventDefault();
    if (!unwillingnessReason.trim()) {
      Swal.fire('Required', 'Please enter your reason for opting out of placement.', 'warning');
      return;
    }

    const confirm = await Swal.fire({
      title: 'Submit Placement Unwillingness Undertaking?',
      text: 'Once submitted, your career choice is formally recorded and campus placement drives will be locked. You cannot switch back to Placement without explicit permission from the Placement Officer.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#1e3a8a',
      confirmButtonText: 'Yes, Submit Undertaking',
    });

    if (confirm.isConfirmed) {
      setSubmittingUnwillingness(true);
      try {
        const res = await studentAPI.submitUnwillingnessForm({
          careerGoalChoice: unwillingnessCareerChoice,
          higherStudiesDetails,
          entrepreneurshipDetails,
          reasonForUnwillingness: unwillingnessReason.trim(),
        });

        if (res.data.success) {
          Swal.fire('Undertaking Submitted', res.data.message, 'success');
          fetchProfile();
          fetchUnwillingness();
          fetchDrives();
        }
      } catch (err) {
        Swal.fire('Submission Error', err.response?.data?.message || 'Failed to submit form.', 'error');
      } finally {
        setSubmittingUnwillingness(false);
      }
    }
  };

  const completeness = profile?.profileCompleteness || 0;
  const currentGoalText = getCareerGoalText(formData.careerGoal || profile?.careerGoal);
  const isPlacement = currentGoalText === 'Placement';
  const isNonPlacement = currentGoalText === 'Higher Studies' || currentGoalText === 'Entrepreneurship';

  // Compute live values for academic profile
  const liveSemesters = [1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
    const existing = (formData.semesters || []).find((s) => s.semesterNumber === num);
    return existing || { semesterNumber: num, sgpa: '', credits: '', attendancePercentage: '' };
  });
  const liveCGPA = computeCGPA(formData.semesters);
  const liveCredits = computeTotalCredits(formData.semesters);
  const completedSemestersCount = (formData.semesters || []).filter((s) => parseFloat(s.sgpa) > 0).length;

  // Filtered drives logic
  const allDepartmentDrives = [
    ...(drivesData.placementDrives || []),
    ...(drivesData.departmentDrives || []),
  ];

  const applyDrivesFilter = (list) => {
    return list.filter((drive) => {
      // Search filter
      if (drivesSearch.trim()) {
        const q = drivesSearch.toLowerCase().trim();
        const comp = (drive.companyName || '').toLowerCase();
        const loc = (drive.jobLocation || '').toLowerCase();
        const roles = (drive.roles || []).map((r) => (r.roleName || '').toLowerCase()).join(' ');
        if (!comp.includes(q) && !loc.includes(q) && !roles.includes(q)) {
          return false;
        }
      }

      // Offer Type filter
      if (drivesFilterOffer !== 'all') {
        if ((drive.offerType || '').toLowerCase() !== drivesFilterOffer.toLowerCase()) {
          return false;
        }
      }

      // Status filter
      if (drivesFilterStatus === 'eligible') {
        if (!drive.isEligible) return false;
      } else if (drivesFilterStatus === 'opted_in') {
        if (!drive.hasOptedIn) return false;
      } else if (drivesFilterStatus === 'opted_out') {
        if (!drive.hasOptedOut) return false;
      }

      return true;
    });
  };

  return (
    <div className="min-vh-100 bg-light">
      <Navbar user={currentUser} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Container */}
      <div className="container-fluid py-4 px-3 px-md-4">
        {/* Navigation Tabs Header */}
        <div className="card border-0 shadow-sm rounded-3 mb-4">
          <div className="card-body p-3">
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div>
                <h4 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-person-badge-fill text-primary"></i>
                  {profile?.name || currentUser.name || 'Student Portal'}
                </h4>
                <div className="text-muted small">
                  Roll: <span className="fw-semibold text-dark">{profile?.rollNumber || '—'}</span> • Dept:{' '}
                  <span className="fw-semibold text-dark">{profile?.department || '—'}</span> • Sec:{' '}
                  <span className="fw-semibold text-dark">{profile?.section || 'A'}</span> • Computed CGPA:{' '}
                  <span className="badge bg-primary-subtle text-primary fw-bold">
                    {Number(profile?.currentCGPA || liveCGPA || 0).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Completeness Badge */}
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '180px' }}>
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="text-muted fw-semibold">Profile Completeness</span>
                    <span
                      className={`fw-bold ${
                        completeness >= 80 ? 'text-success' : completeness >= 50 ? 'text-primary' : 'text-warning'
                      }`}
                    >
                      {completeness}%
                    </span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div
                      className={`progress-bar progress-bar-striped ${
                        completeness >= 80 ? 'bg-success' : completeness >= 50 ? 'bg-primary' : 'bg-warning'
                      }`}
                      role="progressbar"
                      style={{ width: `${completeness}%` }}
                    ></div>
                  </div>
                </div>

                <div className="badge bg-light text-dark border p-2 text-start">
                  <div className="text-muted" style={{ fontSize: '0.68rem' }}>Career Track</div>
                  <div className="fw-bold text-primary">{currentGoalText}</div>
                </div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <ul className="nav nav-pills mt-3 gap-2 border-top pt-3">
              <li className="nav-item">
                <button
                  className={`nav-link py-2 px-3 fw-semibold rounded-pill ${activeTab === 'overview' ? 'active shadow-sm' : 'text-dark'}`}
                  onClick={() => setActiveTab('overview')}
                >
                  <i className="bi bi-file-earmark-person-fill me-1"></i> Profile Overview
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link py-2 px-3 fw-semibold rounded-pill ${activeTab === 'profile_edit' ? 'active shadow-sm' : 'text-dark'}`}
                  onClick={() => setActiveTab('profile_edit')}
                >
                  <i className="bi bi-pencil-square me-1"></i> Profile Filling Page
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link py-2 px-3 fw-semibold rounded-pill ${activeTab === 'drives' ? 'active shadow-sm' : 'text-dark'}`}
                  onClick={() => setActiveTab('drives')}
                >
                  <i className="bi bi-briefcase-fill me-1"></i> Campus Drives
                </button>
              </li>

              {/* Requirement: Placement unwillingness forms becomes visible ONLY after student chooses Career Goal other than placement */}
              {isNonPlacement && (
                <li className="nav-item">
                  <button
                    className={`nav-link py-2 px-3 fw-semibold rounded-pill ${activeTab === 'unwillingness' ? 'active shadow-sm' : 'text-dark'}`}
                    onClick={() => setActiveTab('unwillingness')}
                  >
                    <i className="bi bi-file-earmark-lock2-fill me-1"></i> Placement Unwillingness
                  </button>
                </li>
              )}

              <li className="nav-item">
                <button
                  className={`nav-link py-2 px-3 fw-semibold rounded-pill ${activeTab === 'communication' ? 'active shadow-sm' : 'text-dark'}`}
                  onClick={() => setActiveTab('communication')}
                >
                  <i className="bi bi-chat-left-text-fill me-1"></i> Central Communication
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link py-2 px-3 fw-semibold rounded-pill ${activeTab === 'tickets' ? 'active shadow-sm' : 'text-dark'}`}
                  onClick={() => setActiveTab('tickets')}
                >
                  <i className="bi bi-ticket-detailed-fill me-1"></i> Support Desk
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PROFILE OVERVIEW (Neatly Aligned Responsive Showcase) */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="row g-4">
            {/* Left Column (4 cols): Identity, Family Contact, Remarks */}
            <div className="col-lg-4">
              {/* Identity Card */}
              <div className="card border-0 shadow-sm rounded-3 mb-4">
                <div className="card-body text-center p-4">
                  <div
                    className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center mx-auto mb-3 shadow"
                    style={{ width: '75px', height: '75px', fontSize: '1.8rem', fontWeight: 'bold' }}
                  >
                    {profile?.name ? profile.name.charAt(0).toUpperCase() : 'S'}
                  </div>
                  <h5 className="fw-bold text-dark mb-1">{profile?.name || 'Student Name'}</h5>
                  <div className="text-muted small mb-2">
                    <span className="badge bg-light text-dark border me-1">{profile?.rollNumber || '—'}</span>
                    {profile?.department} ({profile?.section || 'A'})
                  </div>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle py-1 px-3 rounded-pill fw-semibold mb-3">
                    Goal: {currentGoalText}
                  </span>

                  <div className="row g-2 text-start pt-3 border-top small">
                    <div className="col-6">
                      <div className="text-muted">Computed CGPA</div>
                      <div className="fw-bold fs-6 text-primary">
                        {Number(profile?.currentCGPA || liveCGPA || 0).toFixed(2)}
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted">Category</div>
                      <div className="fw-bold text-dark">{profile?.studentCategory || 'Day Scholar'}</div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted">Standing Arrears</div>
                      <div className={`fw-bold ${profile?.standingArrearsCount > 0 ? 'text-danger' : 'text-success'}`}>
                        {profile?.standingArrearsCount || 0}
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-muted">History Arrears</div>
                      <div className="fw-bold text-dark">{profile?.historyArrearsCount || 0}</div>
                    </div>
                    {profile?.studentCategory === 'Hosteller' && profile?.hostelName && (
                      <div className="col-12 mt-1">
                        <span className="text-muted">Hostel:</span> <strong className="text-dark">{profile.hostelName}</strong>
                      </div>
                    )}
                    {profile?.studentCategory === 'Day Scholar' && profile?.distanceToCollege > 0 && (
                      <div className="col-12 mt-1">
                        <span className="text-muted">Commute Distance:</span>{' '}
                        <strong className="text-dark">{profile.distanceToCollege} km</strong>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Family & Contact Card */}
              <div className="card border-0 shadow-sm rounded-3 mb-4">
                <div className="card-header bg-white border-bottom p-3">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-people-fill text-primary"></i> Parent & Contact Details
                  </h6>
                </div>
                <div className="card-body p-3 small">
                  <div className="mb-2">
                    <span className="text-muted d-block">Personal Email:</span>
                    <strong className="text-dark">{profile?.personalEmail || '—'}</strong>
                  </div>
                  <div className="mb-2">
                    <span className="text-muted d-block">Mobile Contact:</span>
                    <strong className="text-dark">{profile?.contactNumber || '—'}</strong>
                  </div>
                  <div className="mb-2">
                    <span className="text-muted d-block">Father:</span>
                    <strong className="text-dark">{profile?.fatherDetails?.name || '—'}</strong>{' '}
                    {profile?.fatherDetails?.occupation && <span className="text-muted">({profile.fatherDetails.occupation})</span>}
                  </div>
                  <div className="mb-2">
                    <span className="text-muted d-block">Mother:</span>
                    <strong className="text-dark">{profile?.motherDetails?.name || '—'}</strong>
                  </div>
                  {profile?.emergencyContactNumber && (
                    <div className="mb-2">
                      <span className="text-muted d-block">Emergency Contact:</span>
                      <strong className="text-danger">{profile.emergencyContactNumber}</strong>
                    </div>
                  )}
                  {profile?.residentialAddress && (
                    <div>
                      <span className="text-muted d-block">Residential Address:</span>
                      <span className="text-dark">{profile.residentialAddress}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Mentor Remarks Card */}
              <div className="card border-0 shadow-sm rounded-3">
                <div className="card-header bg-white border-bottom p-3">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-chat-square-quote-fill text-primary"></i> Mentor & Coordinator Remarks
                  </h6>
                </div>
                <div className="card-body p-3">
                  {profile?.mentorRemarks?.generalRemarks ||
                  profile?.mentorRemarks?.placementRemarks ||
                  profile?.mentorRemarks?.higherStudiesRemarks ||
                  profile?.mentorRemarks?.entrepreneurshipRemarks ? (
                    <div className="small">
                      {profile?.mentorRemarks?.placementRemarks && (
                        <div className="mb-2">
                          <span className="fw-bold text-dark">Placement:</span> {profile.mentorRemarks.placementRemarks}
                        </div>
                      )}
                      {profile?.mentorRemarks?.higherStudiesRemarks && (
                        <div className="mb-2">
                          <span className="fw-bold text-dark">Higher Studies:</span> {profile.mentorRemarks.higherStudiesRemarks}
                        </div>
                      )}
                      {profile?.mentorRemarks?.entrepreneurshipRemarks && (
                        <div className="mb-2">
                          <span className="fw-bold text-dark">Entrepreneurship:</span> {profile.mentorRemarks.entrepreneurshipRemarks}
                        </div>
                      )}
                      {profile?.mentorRemarks?.generalRemarks && (
                        <div className="mb-2">
                          <span className="fw-bold text-dark">General:</span> {profile.mentorRemarks.generalRemarks}
                        </div>
                      )}
                      <div className="text-muted mt-2 fst-italic" style={{ fontSize: '0.72rem' }}>
                        Recorded by {profile.mentorRemarks.updatedByName || 'Faculty Mentor'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted small fst-italic">No remarks recorded by faculty mentor yet.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column (8 cols): Academic Performance, Career Goal, Projects & Certs, Skills */}
            <div className="col-lg-8">
              {/* 1. Academic Performance & Progression (SGPA, Credits, Computed CGPA) */}
              <div className="card border-0 shadow-sm rounded-3 mb-4">
                <div className="card-header bg-white border-bottom p-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-mortarboard-fill text-primary"></i> Academic Profile & Progression
                  </h6>
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-primary fs-6 px-3 py-1">
                      Final CGPA: {Number(profile?.currentCGPA || liveCGPA || 0).toFixed(2)}
                    </span>
                    <span className="badge bg-light text-dark border">
                      Total Credits: {liveCredits}
                    </span>
                  </div>
                </div>
                <div className="card-body p-3">
                  <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0 text-center small">
                      <thead className="table-light">
                        <tr>
                          <th>Semester</th>
                          <th>SGPA</th>
                          <th>Credits</th>
                          <th>Weighted Score</th>
                          <th>Attendance %</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((num) => {
                          const s = (profile?.semesters || formData.semesters || []).find((x) => x.semesterNumber === num);
                          const sgpaVal = s?.sgpa ? Number(s.sgpa).toFixed(2) : '—';
                          const credVal = s?.credits ? Number(s.credits) : '—';
                          const weightedVal =
                            s?.sgpa && s?.credits ? (Number(s.sgpa) * Number(s.credits)).toFixed(1) : '—';
                          const attVal = s?.attendancePercentage ? `${s.attendancePercentage}%` : '—';
                          const hasData = Boolean(s && (s.sgpa > 0 || s.credits > 0));

                          return (
                            <tr key={num} className={hasData ? '' : 'text-muted opacity-50'}>
                              <td className="fw-bold text-dark">Semester {num}</td>
                              <td className="fw-semibold text-primary">{sgpaVal}</td>
                              <td>{credVal}</td>
                              <td>{weightedVal}</td>
                              <td>{attVal}</td>
                              <td>
                                {hasData ? (
                                  <span className="badge bg-success-subtle text-success">Recorded</span>
                                ) : (
                                  <span className="badge bg-light text-secondary border">Upcoming</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="d-flex justify-content-between align-items-center mt-3 pt-2 border-top small text-muted">
                    <span>
                      <i className="bi bi-info-circle me-1 text-primary"></i>
                      Formula: <code>CGPA = Sum(SGPA * Credits) / Sum(Credits)</code>
                    </span>
                    <span>Completed Semesters: <strong className="text-dark">{completedSemestersCount}</strong></span>
                  </div>
                </div>
              </div>

              {/* 2. Career Goal Overview */}
              <div className="card border-0 shadow-sm rounded-3 mb-4">
                <div className="card-header bg-white border-bottom p-3">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-compass-fill text-primary"></i> Career Direction & Goals
                  </h6>
                </div>
                <div className="card-body p-3 small">
                  <div className="d-flex align-items-center justify-content-between mb-3 p-2 bg-light rounded">
                    <div>
                      <span className="text-muted">Primary Career Choice:</span>{' '}
                      <strong className="text-primary fs-6">{currentGoalText}</strong>
                    </div>
                    {isNonPlacement && (
                      <span className="badge bg-warning-subtle text-dark border border-warning-subtle py-1 px-2">
                        <i className="bi bi-file-lock me-1"></i> Placement Unwillingness Track
                      </span>
                    )}
                  </div>

                  {currentGoalText === 'Placement' && (
                    <div className="row g-2">
                      <div className="col-md-6">
                        <span className="text-muted">Preferred Technical Domain:</span>{' '}
                        <strong className="text-dark">{formData.technicalProfile?.domainInterest || formData.domainInterest || 'Software Engineering'}</strong>
                      </div>
                      <div className="col-md-6">
                        <span className="text-muted">Placement Status:</span>{' '}
                        {profile?.placementStatus?.isPlaced ? (
                          <span className="badge bg-success">Placed at {profile.placementStatus.companyName}</span>
                        ) : (
                          <span className="badge bg-secondary">Aspirant (Unplaced)</span>
                        )}
                      </div>
                    </div>
                  )}

                  {currentGoalText === 'Higher Studies' && (
                    <div className="row g-2">
                      <div className="col-md-6">
                        <span className="text-muted">Target Degree:</span>{' '}
                        <strong className="text-dark">{formData.higherStudiesDetails?.degree || formData.higherStudiesDetails?.targetDegree || 'Master of Science'}</strong>
                      </div>
                      <div className="col-md-6">
                        <span className="text-muted">Target Institution / Country:</span>{' '}
                        <strong className="text-dark">{formData.higherStudiesDetails?.institution || formData.higherStudiesDetails?.countryPreference || '—'}</strong>
                      </div>
                    </div>
                  )}

                  {currentGoalText === 'Entrepreneurship' && (
                    <div className="row g-2">
                      <div className="col-md-6">
                        <span className="text-muted">Venture / Startup:</span>{' '}
                        <strong className="text-dark">{formData.entrepreneurshipDetails?.startupName || '—'}</strong>
                      </div>
                      <div className="col-md-6">
                        <span className="text-muted">Stage:</span>{' '}
                        <span className="badge bg-info-subtle text-dark border">{formData.entrepreneurshipDetails?.currentStage || 'Idea'}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Projects Portfolio (Revealed when Placement is chosen) */}
              {isPlacement && (
                <div className="card border-0 shadow-sm rounded-3 mb-4">
                  <div className="card-header bg-white border-bottom p-3 d-flex align-items-center justify-content-between">
                    <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                      <i className="bi bi-folder-check text-primary"></i> Technical Projects Portfolio
                    </h6>
                    <span className="badge bg-light text-dark border">
                      {(formData.projects || profile?.projects || []).length} Projects
                    </span>
                  </div>
                  <div className="card-body p-3">
                    {(formData.projects || profile?.projects || []).length > 0 ? (
                      <div className="d-flex flex-column gap-3">
                        {(formData.projects || profile?.projects || []).map((proj, idx) => (
                          <div key={idx} className="p-3 border rounded bg-light">
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <h6 className="fw-bold text-dark mb-0">{proj.title || 'Untitled Project'}</h6>
                              {proj.domain && (
                                <span className="badge bg-primary-subtle text-primary border border-primary-subtle small">
                                  {proj.domain}
                                </span>
                              )}
                            </div>
                            {proj.role && <div className="text-muted small mb-2">Role: {proj.role}</div>}
                            <p className="text-secondary small mb-2">{proj.description || 'No description provided.'}</p>
                            <div className="d-flex gap-2">
                              {proj.githubLink && (
                                <a
                                  href={proj.githubLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-outline-dark btn-sm py-1 px-2"
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  <i className="bi bi-github me-1"></i> Repository
                                </a>
                              )}
                              {proj.liveDemoUrl && (
                                <a
                                  href={proj.liveDemoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="btn btn-outline-primary btn-sm py-1 px-2"
                                  style={{ fontSize: '0.75rem' }}
                                >
                                  <i className="bi bi-box-arrow-up-right me-1"></i> Live Demo
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted small fst-italic">
                        No projects added yet. Open the Profile Filling Page to add technical projects.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 4. Certifications & Credentials (Revealed when Placement is chosen) */}
              {isPlacement && (
                <div className="card border-0 shadow-sm rounded-3 mb-4">
                  <div className="card-header bg-white border-bottom p-3 d-flex align-items-center justify-content-between">
                    <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                      <i className="bi bi-patch-check-fill text-success"></i> Certifications & Credentials
                    </h6>
                    <span className="badge bg-light text-dark border">
                      {(formData.certifications || profile?.certifications || []).length} Credentials
                    </span>
                  </div>
                  <div className="card-body p-3">
                    {(formData.certifications || profile?.certifications || []).length > 0 ? (
                      <div className="row g-3">
                        {(formData.certifications || profile?.certifications || []).map((c, idx) => {
                          const certName = typeof c === 'string' ? c : c.name || c.title || 'Certificate';
                          const certType = typeof c === 'object' ? c.certificationType : 'Global Certification';
                          const org = typeof c === 'object' ? c.issuingOrganization : '';
                          const credUrl = typeof c === 'object' ? c.credentialUrl : '';
                          const credId = typeof c === 'object' ? c.credentialId : '';

                          return (
                            <div key={idx} className="col-md-6">
                              <div className="p-3 border rounded bg-light h-100 d-flex flex-column justify-content-between">
                                <div>
                                  <span className="badge bg-success-subtle text-success border border-success-subtle mb-2">
                                    {certType || 'Certification'}
                                  </span>
                                  <h6 className="fw-bold text-dark mb-1">{certName}</h6>
                                  {org && <div className="text-muted small">Issuer: {org}</div>}
                                  {credId && <div className="text-muted small" style={{ fontSize: '0.75rem' }}>ID: {credId}</div>}
                                </div>
                                {credUrl && (
                                  <div className="mt-2 pt-2 border-top">
                                    <a
                                      href={credUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="small text-primary text-decoration-none fw-semibold"
                                    >
                                      <i className="bi bi-link-45deg me-1"></i> Verify Credential
                                    </a>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-muted small fst-italic">
                        No certifications registered yet. Add certifications in the Profile Filling Page.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5. Technical Skills & Profile Links */}
              <div className="card border-0 shadow-sm rounded-3 mb-4">
                <div className="card-header bg-white border-bottom p-3">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-code-slash text-primary"></i> Technical Skills & Profiles
                  </h6>
                </div>
                <div className="card-body p-3">
                  <div className="mb-3">
                    <div className="text-muted small fw-semibold mb-2">Technical Skills & Technologies</div>
                    <div className="d-flex flex-wrap gap-2">
                      {profile?.technicalSkills && profile.technicalSkills.length > 0 ? (
                        profile.technicalSkills.map((sk, idx) => (
                          <span key={idx} className="badge bg-light text-dark border px-2 py-1">
                            {sk}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted small">None listed yet.</span>
                      )}
                    </div>
                  </div>

                  <div className="row g-3 small pt-2 border-top">
                    <div className="col-md-6">
                      <div className="text-muted">GitHub Profile</div>
                      {profile?.githubProfile ? (
                        <a href={profile.githubProfile} target="_blank" rel="noreferrer" className="text-decoration-none fw-semibold">
                          <i className="bi bi-github me-1"></i> {profile.githubProfile}
                        </a>
                      ) : (
                        <span className="text-muted">Not linked</span>
                      )}
                    </div>
                    <div className="col-md-6">
                      <div className="text-muted">LinkedIn Profile</div>
                      {profile?.linkedinProfile ? (
                        <a href={profile.linkedinProfile} target="_blank" rel="noreferrer" className="text-decoration-none fw-semibold">
                          <i className="bi bi-linkedin me-1 text-primary"></i> {profile.linkedinProfile}
                        </a>
                      ) : (
                        <span className="text-muted">Not linked</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 6. Self-Evaluation & Mentoring Goals */}
              <div className="card border-0 shadow-sm rounded-3">
                <div className="card-header bg-white border-bottom p-3">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-lightning-charge-fill text-warning"></i> Strengths & Improvement Analysis
                  </h6>
                </div>
                <div className="card-body p-3 small">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <span className="text-muted d-block fw-semibold">Key Strengths:</span>
                      <p className="text-dark mb-0">{profile?.selfEvaluation?.strengths || 'Not specified yet.'}</p>
                    </div>
                    <div className="col-md-6">
                      <span className="text-muted d-block fw-semibold">Areas for Improvement:</span>
                      <p className="text-dark mb-0">{profile?.selfEvaluation?.areasForImprovement || 'Not specified yet.'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PROFILE FILLING PAGE (Section-by-Section Save + Academic Profile) */}
        {/* ========================================================================= */}
        {activeTab === 'profile_edit' && (
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-header bg-white border-bottom p-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div>
                <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-shield-lock-fill text-warning"></i> Student Profiling Form
                </h5>
                <small className="text-muted">Save sections individually or update the full record at once.</small>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm fw-semibold"
                disabled={savingProfile}
                onClick={handleSaveProfile}
              >
                <i className="bi bi-check2-all me-1"></i> {savingProfile ? 'Saving Changes...' : 'Save All Changes'}
              </button>
            </div>

            <div className="card-body p-4 position-relative">
              {/* Sensitive Info Watermark Notice */}
              <div className="alert alert-warning border-warning-subtle small d-flex align-items-center gap-2 mb-4">
                <i className="bi bi-shield-shaded fs-5 text-warning"></i>
                <div>
                  <strong>Protected Student Record:</strong> Sensitive personal & parental data is restricted to authorized academic counselors, mentors, and placement officers for institutional verification only.
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 1: PERSONAL DETAILS (Register number removed) */}
              {/* ------------------------------------------------------------- */}
              <div className="card border-0 shadow-sm mb-4 bg-light">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                    <h6 className="fw-bold text-primary mb-0">1. Personal Details</h6>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm py-1 px-3 fw-semibold"
                      disabled={savingProfile}
                      onClick={() =>
                        handleSaveSection('Personal Details', {
                          name: formData.name,
                          gender: formData.gender,
                          studentCategory: formData.studentCategory,
                          hostelName: formData.hostelName,
                          distanceToCollege: formData.distanceToCollege,
                          contactNumber: formData.contactNumber,
                          personalEmail: formData.personalEmail,
                          residentialAddress: formData.residentialAddress,
                        })
                      }
                    >
                      <i className="bi bi-floppy me-1"></i> Save Personal Details
                    </button>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Roll Number (Locked)</label>
                      <input type="text" className="form-control form-control-sm bg-white" value={formData.rollNumber || ''} disabled />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Full Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.name || ''}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Gender</label>
                      <select
                        className="form-select form-select-sm"
                        value={formData.gender || 'Male'}
                        onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Student Category</label>
                      <select
                        className="form-select form-select-sm"
                        value={formData.studentCategory || 'Day Scholar'}
                        onChange={(e) => setFormData({ ...formData, studentCategory: e.target.value })}
                      >
                        <option value="Hosteller">Hosteller</option>
                        <option value="Day Scholar">Day Scholar</option>
                      </select>
                    </div>
                    {formData.studentCategory === 'Hosteller' && (
                      <div className="col-md-3">
                        <label className="form-label small fw-semibold">Hostel Name / Room</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.hostelName || ''}
                          onChange={(e) => setFormData({ ...formData, hostelName: e.target.value })}
                        />
                      </div>
                    )}
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Distance to College (km)</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        value={formData.distanceToCollege || 0}
                        onChange={(e) => setFormData({ ...formData, distanceToCollege: Number(e.target.value) })}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Mobile Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.contactNumber || ''}
                        onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                      />
                    </div>
                    <div className="col-md-3">
                      <label className="form-label small fw-semibold">Personal Email</label>
                      <input
                        type="email"
                        className="form-control form-control-sm"
                        value={formData.personalEmail || ''}
                        onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                      />
                    </div>
                    <div className="col-md-12">
                      <label className="form-label small fw-semibold">Residential Address</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.residentialAddress || ''}
                        onChange={(e) => setFormData({ ...formData, residentialAddress: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 2: PARENT & FAMILY DETAILS */}
              {/* ------------------------------------------------------------- */}
              <div className="card border-0 shadow-sm mb-4 bg-light">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                    <h6 className="fw-bold text-primary mb-0">2. Parent & Family Details</h6>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm py-1 px-3 fw-semibold"
                      disabled={savingProfile}
                      onClick={() =>
                        handleSaveSection('Parent Details', {
                          fatherDetails: formData.fatherDetails,
                          motherDetails: formData.motherDetails,
                          emergencyContactNumber: formData.emergencyContactNumber,
                          firstGenGraduate: formData.firstGenGraduate,
                          scholarshipAvailed: formData.scholarshipAvailed,
                          mentorshipGuidanceRequired: formData.mentorshipGuidanceRequired,
                        })
                      }
                    >
                      <i className="bi bi-floppy me-1"></i> Save Parent Details
                    </button>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Father's Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.fatherDetails?.name || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fatherDetails: { ...formData.fatherDetails, name: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Father's Occupation</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.fatherDetails?.occupation || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fatherDetails: { ...formData.fatherDetails, occupation: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Father's Contact Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.fatherDetails?.contactNumber || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            fatherDetails: { ...formData.fatherDetails, contactNumber: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Mother's Name</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.motherDetails?.name || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motherDetails: { ...formData.motherDetails, name: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Mother's Contact Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.motherDetails?.contactNumber || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            motherDetails: { ...formData.motherDetails, contactNumber: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Emergency Contact Number</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={formData.emergencyContactNumber || ''}
                        onChange={(e) => setFormData({ ...formData, emergencyContactNumber: e.target.value })}
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">First Generation Graduate?</label>
                      <select
                        className="form-select form-select-sm"
                        value={formData.firstGenGraduate || 'No'}
                        onChange={(e) => setFormData({ ...formData, firstGenGraduate: e.target.value })}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Scholarship Availed?</label>
                      <select
                        className="form-select form-select-sm"
                        value={formData.scholarshipAvailed || 'No'}
                        onChange={(e) => setFormData({ ...formData, scholarshipAvailed: e.target.value })}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Mentorship Guidance Required?</label>
                      <select
                        className="form-select form-select-sm"
                        value={formData.mentorshipGuidanceRequired || 'No'}
                        onChange={(e) => setFormData({ ...formData, mentorshipGuidanceRequired: e.target.value })}
                      >
                        <option value="Yes">Yes</option>
                        <option value="No">No</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 3: ACADEMIC PROFILE (BEFORE Technical & Professional Profile) */}
              {/* Asks for each sem SGPA along with credits, computes final CGPA automatically */}
              {/* ------------------------------------------------------------- */}
              <div className="card border-0 shadow-sm mb-4 bg-light">
                <div className="card-body p-3">
                  <div className="d-flex flex-wrap justify-content-between align-items-center border-bottom pb-2 mb-3 gap-2">
                    <div>
                      <h6 className="fw-bold text-primary mb-0">3. Academic Profile (Semester SGPAs & Credits)</h6>
                      <small className="text-muted">Enter SGPA and credits for each completed semester. Final CGPA updates automatically.</small>
                    </div>
                    <div className="d-flex align-items-center gap-2">
                      <div className="badge bg-primary fs-6 px-3 py-1">
                        Computed CGPA: {liveCGPA}
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm py-1 px-3 fw-semibold"
                        disabled={savingProfile}
                        onClick={() =>
                          handleSaveSection('Academic Profile', {
                            semesters: formData.semesters,
                            currentCGPA: Number(liveCGPA),
                          })
                        }
                      >
                        <i className="bi bi-floppy me-1"></i> Save Academic Profile
                      </button>
                    </div>
                  </div>

                  {/* Summary metric banner */}
                  <div className="row g-2 mb-3 text-center">
                    <div className="col-md-4">
                      <div className="bg-white p-2 rounded border">
                        <small className="text-muted d-block">Overall CGPA (Computed)</small>
                        <span className="fw-bold fs-5 text-primary">{liveCGPA}</span>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="bg-white p-2 rounded border">
                        <small className="text-muted d-block">Total Earned Credits</small>
                        <span className="fw-bold fs-5 text-dark">{liveCredits}</span>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="bg-white p-2 rounded border">
                        <small className="text-muted d-block">Completed Semesters</small>
                        <span className="fw-bold fs-5 text-success">{completedSemestersCount} / 8</span>
                      </div>
                    </div>
                  </div>

                  {/* Semesters 1 to 8 Table Inputs */}
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered bg-white text-center align-middle small mb-2">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: '15%' }}>Semester</th>
                          <th style={{ width: '25%' }}>SGPA (0.00 - 10.00)</th>
                          <th style={{ width: '25%' }}>Credits for Semester</th>
                          <th style={{ width: '20%' }}>Weighted Score (SGPA × Credits)</th>
                          <th style={{ width: '15%' }}>Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveSemesters.map((s) => {
                          const sgpaVal = s.sgpa !== undefined && s.sgpa !== null ? s.sgpa : '';
                          const credVal = s.credits !== undefined && s.credits !== null ? s.credits : '';
                          const points =
                            parseFloat(sgpaVal) > 0 && parseFloat(credVal) > 0
                              ? (parseFloat(sgpaVal) * parseFloat(credVal)).toFixed(2)
                              : '0.00';

                          return (
                            <tr key={s.semesterNumber}>
                              <td className="fw-bold text-dark">Semester {s.semesterNumber}</td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="10"
                                  className="form-control form-control-sm text-center"
                                  placeholder="e.g. 8.45"
                                  value={sgpaVal}
                                  onChange={(e) => handleSemesterChange(s.semesterNumber, 'sgpa', e.target.value)}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="40"
                                  className="form-control form-control-sm text-center"
                                  placeholder="e.g. 24"
                                  value={credVal}
                                  onChange={(e) => handleSemesterChange(s.semesterNumber, 'credits', e.target.value)}
                                />
                              </td>
                              <td className="fw-bold text-secondary">{points}</td>
                              <td>
                                <input
                                  type="number"
                                  min="0"
                                  max="100"
                                  className="form-control form-control-sm text-center"
                                  placeholder="e.g. 88"
                                  value={s.attendancePercentage || ''}
                                  onChange={(e) => handleSemesterChange(s.semesterNumber, 'attendancePercentage', e.target.value)}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <small className="text-muted d-block">
                    <i className="bi bi-info-circle me-1 text-primary"></i>
                    Automatic Formula: <code>CGPA = Sum(SGPA × Credits) / Sum(Credits)</code>. If credits are left blank, an unweighted mean of recorded SGPAs is utilized.
                  </small>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 4: TECHNICAL & PROFESSIONAL PROFILE */}
              {/* ------------------------------------------------------------- */}
              <div className="card border-0 shadow-sm mb-4 bg-light">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                    <h6 className="fw-bold text-primary mb-0">4. Technical & Professional Profile</h6>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm py-1 px-3 fw-semibold"
                      disabled={savingProfile}
                      onClick={() =>
                        handleSaveSection('Technical Profile', {
                          technicalSkills: formData.technicalSkills,
                          languages: formData.languages,
                          githubProfile: formData.githubProfile,
                          linkedinProfile: formData.linkedinProfile,
                          domainInterest: formData.domainInterest,
                        })
                      }
                    >
                      <i className="bi bi-floppy me-1"></i> Save Technical Profile
                    </button>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Technical Skills (Comma separated)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={Array.isArray(formData.technicalSkills) ? formData.technicalSkills.join(', ') : ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            technicalSkills: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        placeholder="e.g. React, Node.js, Python, Java, Docker, AWS"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Languages Known (Comma separated)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={Array.isArray(formData.languages) ? formData.languages.join(', ') : ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            languages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          })
                        }
                        placeholder="e.g. English, Tamil, Hindi"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">GitHub Profile URL</label>
                      <input
                        type="url"
                        className="form-control form-control-sm"
                        value={formData.githubProfile || ''}
                        onChange={(e) => setFormData({ ...formData, githubProfile: e.target.value })}
                        placeholder="https://github.com/username"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">LinkedIn Profile URL</label>
                      <input
                        type="url"
                        className="form-control form-control-sm"
                        value={formData.linkedinProfile || ''}
                        onChange={(e) => setFormData({ ...formData, linkedinProfile: e.target.value })}
                        placeholder="https://linkedin.com/in/username"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 5: FINAL CAREER GOAL */}
              {/* ------------------------------------------------------------- */}
              <div className="card border-0 shadow-sm mb-4 bg-light">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                    <h6 className="fw-bold text-primary mb-0">5. Final Career Goal</h6>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm py-1 px-3 fw-semibold"
                      disabled={savingProfile}
                      onClick={() =>
                        handleSaveSection('Career Goal', {
                          careerGoal: formData.careerGoal,
                          higherStudiesDetails: formData.higherStudiesDetails,
                          entrepreneurshipDetails: formData.entrepreneurshipDetails,
                        })
                      }
                    >
                      <i className="bi bi-floppy me-1"></i> Save Career Goal
                    </button>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-4">
                      <label className="form-label small fw-semibold">Select Primary Career Goal</label>
                      <select
                        className="form-select form-select-sm fw-bold"
                        value={formData.careerGoal || 'Undecided'}
                        disabled={unwillingnessStatus?.isLocked && !unwillingnessStatus?.allowPlacementSwitch}
                        onChange={(e) => setFormData({ ...formData, careerGoal: e.target.value })}
                      >
                        <option value="Placement">Placement (Campus Recruiter)</option>
                        <option value="Higher Studies">Higher Studies (Master's / Ph.D.)</option>
                        <option value="Entrepreneurship">Entrepreneurship / Startup</option>
                        <option value="Undecided">Undecided</option>
                      </select>
                      {unwillingnessStatus?.isLocked && !unwillingnessStatus?.allowPlacementSwitch && (
                        <small className="text-danger d-block mt-1">
                          Locked by formal Unwillingness undertaking. Contact Placement Officer to permit changes.
                        </small>
                      )}
                    </div>

                    {formData.careerGoal === 'Higher Studies' && (
                      <>
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold">Target Degree (e.g. MS, M.Tech, MBA)</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={formData.higherStudiesDetails?.degree || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                higherStudiesDetails: { ...formData.higherStudiesDetails, degree: e.target.value },
                              })
                            }
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold">Target Institution / University</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={formData.higherStudiesDetails?.institution || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                higherStudiesDetails: { ...formData.higherStudiesDetails, institution: e.target.value },
                              })
                            }
                          />
                        </div>
                      </>
                    )}

                    {formData.careerGoal === 'Entrepreneurship' && (
                      <>
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold">Startup / Company Name</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={formData.entrepreneurshipDetails?.startupName || ''}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                entrepreneurshipDetails: { ...formData.entrepreneurshipDetails, startupName: e.target.value },
                              })
                            }
                          />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label small fw-semibold">Current Product / Startup Stage</label>
                          <select
                            className="form-select form-select-sm"
                            value={formData.entrepreneurshipDetails?.currentStage || 'Idea'}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                entrepreneurshipDetails: { ...formData.entrepreneurshipDetails, currentStage: e.target.value },
                              })
                            }
                          >
                            <option value="Idea">Idea Phase</option>
                            <option value="Prototype">Prototype / MVP</option>
                            <option value="Registered">Registered Entity</option>
                            <option value="Revenue Generating">Revenue Generating</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Immediate prompt if Non-Placement chosen */}
                  {isNonPlacement && (
                    <div className="alert alert-info border-info-subtle mt-3 p-3 rounded-3 d-flex align-items-center justify-content-between">
                      <div>
                        <strong><i className="bi bi-info-circle-fill me-1 text-primary"></i> Placement Unwillingness Form Unlocked:</strong>
                        <div className="small text-muted">
                          Since you selected {currentGoalText}, your formal Placement Unwillingness undertaking form is now visible.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm fw-semibold text-nowrap ms-2"
                        onClick={() => setActiveTab('unwillingness')}
                      >
                        Open Unwillingness Form <i className="bi bi-arrow-right ms-1"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* SECTION 6: PROJECTS (Only reveals if student chooses Placement) */}
              {/* ------------------------------------------------------------- */}
              {isPlacement && (
                <div className="card border-0 shadow-sm mb-4 bg-light">
                  <div className="card-body p-3">
                    <div className="d-flex flex-wrap justify-content-between align-items-center border-bottom pb-2 mb-3 gap-2">
                      <div>
                        <h6 className="fw-bold text-primary mb-0">6. Technical Projects (Placement Portfolio)</h6>
                        <small className="text-muted">Showcase your technical projects for campus recruiters.</small>
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm py-1 px-3 fw-semibold"
                          onClick={handleAddProject}
                        >
                          <i className="bi bi-plus-circle me-1"></i> Add Project
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm py-1 px-3 fw-semibold"
                          disabled={savingProfile}
                          onClick={() => handleSaveSection('Projects', { projects: formData.projects })}
                        >
                          <i className="bi bi-floppy me-1"></i> Save Projects
                        </button>
                      </div>
                    </div>

                    {(formData.projects || []).length === 0 ? (
                      <div className="text-center py-4 bg-white rounded border">
                        <i className="bi bi-folder-plus text-muted fs-2 d-block mb-2"></i>
                        <span className="text-muted small">No projects added yet. Click "+ Add Project" to record your technical work.</span>
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-3">
                        {(formData.projects || []).map((proj, idx) => (
                          <div key={idx} className="card border shadow-none bg-white p-3 rounded-3 position-relative">
                            <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                              <span className="fw-bold text-dark small">Project #{idx + 1}</span>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm py-0 px-2"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => handleRemoveProject(idx)}
                              >
                                <i className="bi bi-trash me-1"></i> Remove
                              </button>
                            </div>
                            <div className="row g-2">
                              <div className="col-md-6">
                                <label className="form-label small fw-semibold">Project Title *</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="e.g. Campus Recruitment Portal"
                                  value={proj.title || ''}
                                  onChange={(e) => handleUpdateProject(idx, 'title', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small fw-semibold">Domain / Tech Stack</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="e.g. MERN Stack, Docker"
                                  value={proj.domain || ''}
                                  onChange={(e) => handleUpdateProject(idx, 'domain', e.target.value)}
                                />
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small fw-semibold">Role / Team Size</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="e.g. Full-Stack Lead / 3 Members"
                                  value={proj.role || ''}
                                  onChange={(e) => handleUpdateProject(idx, 'role', e.target.value)}
                                />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label small fw-semibold">GitHub / Repository Link</label>
                                <input
                                  type="url"
                                  className="form-control form-control-sm"
                                  placeholder="https://github.com/..."
                                  value={proj.githubLink || ''}
                                  onChange={(e) => handleUpdateProject(idx, 'githubLink', e.target.value)}
                                />
                              </div>
                              <div className="col-md-6">
                                <label className="form-label small fw-semibold">Live Demo / Deployment Link</label>
                                <input
                                  type="url"
                                  className="form-control form-control-sm"
                                  placeholder="https://demo-site.app..."
                                  value={proj.liveDemoUrl || ''}
                                  onChange={(e) => handleUpdateProject(idx, 'liveDemoUrl', e.target.value)}
                                />
                              </div>
                              <div className="col-12">
                                <label className="form-label small fw-semibold">Project Description & Key Deliverables</label>
                                <textarea
                                  className="form-control form-control-sm"
                                  rows="2"
                                  placeholder="Briefly describe what this project does and key problems solved..."
                                  value={proj.description || ''}
                                  onChange={(e) => handleUpdateProject(idx, 'description', e.target.value)}
                                ></textarea>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 7: CERTIFICATIONS (Only reveals if student chooses Placement) */}
              {/* ------------------------------------------------------------- */}
              {isPlacement && (
                <div className="card border-0 shadow-sm mb-4 bg-light">
                  <div className="card-body p-3">
                    <div className="d-flex flex-wrap justify-content-between align-items-center border-bottom pb-2 mb-3 gap-2">
                      <div>
                        <h6 className="fw-bold text-primary mb-0">7. Certifications (Global & Industry)</h6>
                        <small className="text-muted">Record recognized certifications (AWS, Google, Microsoft, NPTEL, etc.).</small>
                      </div>
                      <div className="d-flex gap-2">
                        <button
                          type="button"
                          className="btn btn-outline-success btn-sm py-1 px-3 fw-semibold"
                          onClick={handleAddCertification}
                        >
                          <i className="bi bi-plus-circle me-1"></i> Add Certification
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm py-1 px-3 fw-semibold"
                          disabled={savingProfile}
                          onClick={() => handleSaveSection('Certifications', { certifications: formData.certifications })}
                        >
                          <i className="bi bi-floppy me-1"></i> Save Certifications
                        </button>
                      </div>
                    </div>

                    {(formData.certifications || []).length === 0 ? (
                      <div className="text-center py-4 bg-white rounded border">
                        <i className="bi bi-award text-muted fs-2 d-block mb-2"></i>
                        <span className="text-muted small">No certifications registered yet. Click "+ Add Certification" to add one.</span>
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-3">
                        {(formData.certifications || []).map((c, idx) => (
                          <div key={idx} className="card border shadow-none bg-white p-3 rounded-3 position-relative">
                            <div className="d-flex justify-content-between align-items-center mb-2 pb-2 border-bottom">
                              <span className="fw-bold text-dark small">Certification #{idx + 1}</span>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm py-0 px-2"
                                style={{ fontSize: '0.75rem' }}
                                onClick={() => handleRemoveCertification(idx)}
                              >
                                <i className="bi bi-trash me-1"></i> Remove
                              </button>
                            </div>
                            <div className="row g-2">
                              <div className="col-md-5">
                                <label className="form-label small fw-semibold">Certification Name *</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="e.g. AWS Certified Solutions Architect"
                                  value={c.name || ''}
                                  onChange={(e) => handleUpdateCertification(idx, 'name', e.target.value)}
                                  required
                                />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label small fw-semibold">Certification Type</label>
                                <select
                                  className="form-select form-select-sm"
                                  value={c.certificationType || 'Global Certification'}
                                  onChange={(e) => handleUpdateCertification(idx, 'certificationType', e.target.value)}
                                >
                                  <option value="Global Certification">Global Certification (AWS/Google/Microsoft/Cisco)</option>
                                  <option value="Industry Recognized">Industry Recognized (Oracle/IBM/RedHat)</option>
                                  <option value="Academic / MOOC">Academic / MOOC (NPTEL/Coursera/edX)</option>
                                  <option value="Other">Other Technical Credential</option>
                                </select>
                              </div>
                              <div className="col-md-3">
                                <label className="form-label small fw-semibold">Issuing Organization</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="e.g. Amazon Web Services"
                                  value={c.issuingOrganization || ''}
                                  onChange={(e) => handleUpdateCertification(idx, 'issuingOrganization', e.target.value)}
                                />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label small fw-semibold">Issue Date / Validity</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="e.g. May 2024"
                                  value={c.issueDate || ''}
                                  onChange={(e) => handleUpdateCertification(idx, 'issueDate', e.target.value)}
                                />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label small fw-semibold">Credential ID / License</label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="e.g. AWS-PSA-12345"
                                  value={c.credentialId || ''}
                                  onChange={(e) => handleUpdateCertification(idx, 'credentialId', e.target.value)}
                                />
                              </div>
                              <div className="col-md-4">
                                <label className="form-label small fw-semibold">Verification URL</label>
                                <input
                                  type="url"
                                  className="form-control form-control-sm"
                                  placeholder="https://credly.com/..."
                                  value={c.credentialUrl || ''}
                                  onChange={(e) => handleUpdateCertification(idx, 'credentialUrl', e.target.value)}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ------------------------------------------------------------- */}
              {/* SECTION 8: SELF-EVALUATION & STRENGTHS */}
              {/* ------------------------------------------------------------- */}
              <div className="card border-0 shadow-sm mb-4 bg-light">
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                    <h6 className="fw-bold text-primary mb-0">8. Strengths & Improvement Analysis</h6>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm py-1 px-3 fw-semibold"
                      disabled={savingProfile}
                      onClick={() =>
                        handleSaveSection('Strengths & Improvement', {
                          selfEvaluation: formData.selfEvaluation,
                        })
                      }
                    >
                      <i className="bi bi-floppy me-1"></i> Save Strengths & Improvement
                    </button>
                  </div>

                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Key Strengths (Academic & Technical)</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows="2"
                        value={formData.selfEvaluation?.strengths || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            selfEvaluation: { ...formData.selfEvaluation, strengths: e.target.value },
                          })
                        }
                        placeholder="e.g. Strong problem solving, fast learner in Python"
                      ></textarea>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Areas Requiring Improvement / Support</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows="2"
                        value={formData.selfEvaluation?.areasForImprovement || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            selfEvaluation: { ...formData.selfEvaluation, areasForImprovement: e.target.value },
                          })
                        }
                        placeholder="e.g. Communication confidence in technical interviews"
                      ></textarea>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Complete Save Button */}
              <div className="d-flex justify-content-between align-items-center pt-3 border-top">
                <small className="text-muted">Changes saved section-by-section are immediately updated in your profile.</small>
                <button type="button" className="btn btn-primary fw-semibold px-4" disabled={savingProfile} onClick={handleSaveProfile}>
                  <i className="bi bi-check2-all me-1"></i> {savingProfile ? 'Saving Changes...' : 'Save All Changes'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CAMPUS DRIVES (With Search, Filter, & 3rd Department Tracking Tab) */}
        {/* ========================================================================= */}
        {activeTab === 'drives' && (
          <div>
            {/* Banner if Career Goal is Not Placement */}
            {isNonPlacement && (
              <div className="alert alert-warning border-warning shadow-sm rounded-3 p-3 mb-4 d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="fw-bold mb-1 text-dark">
                    <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                    Career Goal Track: {currentGoalText}
                  </h6>
                  <p className="mb-0 small text-secondary">
                    You have chosen {currentGoalText}. Campus placement registration is locked for this academic year. Please verify your Placement Unwillingness undertaking form.
                  </p>
                </div>
                <button
                  className="btn btn-warning btn-sm fw-semibold text-nowrap ms-3"
                  onClick={() => setActiveTab('unwillingness')}
                >
                  Go to Unwillingness Form
                </button>
              </div>
            )}

            {/* Drives Channel Selector (3 Tabs: On-Campus, Off-Campus, and 3rd Student Drive Tracker) */}
            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
              <div className="btn-group shadow-sm">
                <button
                  className={`btn btn-sm ${drivesTab === 'placement' ? 'btn-primary' : 'btn-outline-secondary'} fw-semibold py-2 px-3`}
                  onClick={() => setDrivesTab('placement')}
                >
                  <i className="bi bi-buildings-fill me-1"></i> Placement Drives (On-Campus)
                  <span className="badge bg-white text-dark ms-2">{drivesData.placementDrives.length}</span>
                </button>
                <button
                  className={`btn btn-sm ${drivesTab === 'department' ? 'btn-primary' : 'btn-outline-secondary'} fw-semibold py-2 px-3`}
                  onClick={() => setDrivesTab('department')}
                >
                  <i className="bi bi-mortarboard-fill me-1"></i> Department Drives (Off-Campus)
                  <span className="badge bg-white text-dark ms-2">{drivesData.departmentDrives.length}</span>
                </button>
                <button
                  className={`btn btn-sm ${drivesTab === 'my_tracking' ? 'btn-primary' : 'btn-outline-secondary'} fw-semibold py-2 px-3`}
                  onClick={() => setDrivesTab('my_tracking')}
                >
                  <i className="bi bi-list-check me-1"></i> My Department Drive Tracker
                  <span className="badge bg-white text-dark ms-2">{allDepartmentDrives.length}</span>
                </button>
              </div>

              <button className="btn btn-outline-secondary btn-sm" onClick={fetchDrives}>
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh Drives
              </button>
            </div>

            {/* Search and Filters Toolbar */}
            <div className="card border-0 shadow-sm rounded-3 mb-4 bg-white">
              <div className="card-body p-3">
                <div className="row g-2 align-items-center">
                  <div className="col-md-5">
                    <div className="input-group input-group-sm">
                      <span className="input-group-text bg-light border-end-0">
                        <i className="bi bi-search text-muted"></i>
                      </span>
                      <input
                        type="text"
                        className="form-control border-start-0"
                        placeholder="Search company name, role, or location..."
                        value={drivesSearch}
                        onChange={(e) => setDrivesSearch(e.target.value)}
                      />
                      {drivesSearch && (
                        <button className="btn btn-outline-secondary" type="button" onClick={() => setDrivesSearch('')}>
                          <i className="bi bi-x"></i>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={drivesFilterOffer}
                      onChange={(e) => setDrivesFilterOffer(e.target.value)}
                    >
                      <option value="all">All Offer Types</option>
                      <option value="Full Time">Full Time</option>
                      <option value="Intern">Intern</option>
                      <option value="Intern + Full Time">Intern + Full Time</option>
                    </select>
                  </div>

                  <div className="col-md-3">
                    <select
                      className="form-select form-select-sm"
                      value={drivesFilterStatus}
                      onChange={(e) => setDrivesFilterStatus(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="eligible">Eligible Only</option>
                      <option value="opted_in">Opted-In Only</option>
                      <option value="opted_out">Opted-Out Only</option>
                    </select>
                  </div>

                  <div className="col-md-1 text-end">
                    <button
                      className="btn btn-light btn-sm text-secondary w-100"
                      title="Clear filters"
                      onClick={() => {
                        setDrivesSearch('');
                        setDrivesFilterOffer('all');
                        setDrivesFilterStatus('all');
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------------- */}
            {/* SUB-TAB 3: MY DEPARTMENT DRIVE TRACKER (Dedicated Student Tracking View) */}
            {/* ------------------------------------------------------------- */}
            {drivesTab === 'my_tracking' && (
              <div>
                {/* Tracker Metric Cards */}
                {(() => {
                  const optedList = allDepartmentDrives.filter((d) => d.hasOptedIn);
                  const eligiblePending = allDepartmentDrives.filter(
                    (d) => d.isEligible && !d.hasOptedIn && !d.hasOptedOut && !d.isBlockedOrRemoved
                  );
                  const notOptedList = allDepartmentDrives.filter(
                    (d) => (!d.isEligible || d.hasOptedOut || d.isBlockedOrRemoved) && !d.hasOptedIn
                  );

                  let displayList = allDepartmentDrives;
                  if (trackerFilter === 'opted') displayList = optedList;
                  else if (trackerFilter === 'eligible_pending') displayList = eligiblePending;
                  else if (trackerFilter === 'not_opted') displayList = notOptedList;

                  const filteredList = applyDrivesFilter(displayList);

                  return (
                    <div>
                      {/* Metric Strips */}
                      <div className="row g-3 mb-4">
                        <div className="col-md-3">
                          <div
                            className={`card border-0 shadow-sm p-3 rounded-3 text-center cursor-pointer ${
                              trackerFilter === 'all' ? 'border border-primary bg-primary-subtle' : 'bg-white'
                            }`}
                            onClick={() => setTrackerFilter('all')}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="text-muted small fw-semibold">Total Department Drives</span>
                            <h3 className="fw-bold text-dark mb-0 mt-1">{allDepartmentDrives.length}</h3>
                            <small className="text-muted" style={{ fontSize: '0.72rem' }}>All drives for {profile?.department || 'Dept'}</small>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div
                            className={`card border-0 shadow-sm p-3 rounded-3 text-center cursor-pointer ${
                              trackerFilter === 'opted' ? 'border border-success bg-success-subtle' : 'bg-white'
                            }`}
                            onClick={() => setTrackerFilter('opted')}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="text-muted small fw-semibold">Opted-In Drives</span>
                            <h3 className="fw-bold text-success mb-0 mt-1">{optedList.length}</h3>
                            <small className="text-muted" style={{ fontSize: '0.72rem' }}>Applications Submitted</small>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div
                            className={`card border-0 shadow-sm p-3 rounded-3 text-center cursor-pointer ${
                              trackerFilter === 'eligible_pending' ? 'border border-info bg-info-subtle' : 'bg-white'
                            }`}
                            onClick={() => setTrackerFilter('eligible_pending')}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="text-muted small fw-semibold">Eligible (Action Needed)</span>
                            <h3 className="fw-bold text-primary mb-0 mt-1">{eligiblePending.length}</h3>
                            <small className="text-muted" style={{ fontSize: '0.72rem' }}>Eligible & Not Opted-In Yet</small>
                          </div>
                        </div>
                        <div className="col-md-3">
                          <div
                            className={`card border-0 shadow-sm p-3 rounded-3 text-center cursor-pointer ${
                              trackerFilter === 'not_opted' ? 'border border-danger bg-danger-subtle' : 'bg-white'
                            }`}
                            onClick={() => setTrackerFilter('not_opted')}
                            style={{ cursor: 'pointer' }}
                          >
                            <span className="text-muted small fw-semibold">Not Opted / Ineligible</span>
                            <h3 className="fw-bold text-secondary mb-0 mt-1">{notOptedList.length}</h3>
                            <small className="text-muted" style={{ fontSize: '0.72rem' }}>Ineligible or Opted-Out</small>
                          </div>
                        </div>
                      </div>

                      {/* Tracker Filter Pills */}
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <div className="btn-group btn-group-sm">
                          <button
                            className={`btn ${trackerFilter === 'all' ? 'btn-dark' : 'btn-outline-secondary'}`}
                            onClick={() => setTrackerFilter('all')}
                          >
                            All ({allDepartmentDrives.length})
                          </button>
                          <button
                            className={`btn ${trackerFilter === 'opted' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                            onClick={() => setTrackerFilter('opted')}
                          >
                            Opted-In ({optedList.length})
                          </button>
                          <button
                            className={`btn ${trackerFilter === 'eligible_pending' ? 'btn-primary' : 'btn-outline-secondary'}`}
                            onClick={() => setTrackerFilter('eligible_pending')}
                          >
                            Eligible but Not Opted ({eligiblePending.length})
                          </button>
                          <button
                            className={`btn ${trackerFilter === 'not_opted' ? 'btn-secondary text-white' : 'btn-outline-secondary'}`}
                            onClick={() => setTrackerFilter('not_opted')}
                          >
                            Not Opted / Ineligible ({notOptedList.length})
                          </button>
                        </div>
                        <span className="text-muted small">Showing {filteredList.length} drive records</span>
                      </div>

                      {/* Drive Cards List */}
                      {filteredList.length === 0 ? (
                        <div className="card border-0 shadow-sm rounded-3 text-center py-5">
                          <i className="bi bi-folder2-open text-secondary opacity-50 fs-1 mb-2"></i>
                          <h6 className="text-muted fw-semibold">No department drives matching this tracking category.</h6>
                        </div>
                      ) : (
                        <div className="row g-3">
                          {filteredList.map((drive) => {
                            const isEligible = drive.isEligible;
                            const hasOptedIn = drive.hasOptedIn;
                            const hasOptedOut = drive.hasOptedOut;
                            const isPastDeadline = drive.isPastDeadline;

                            return (
                              <div key={drive._id} className="col-lg-6">
                                <div className="card border-0 shadow-sm rounded-3 h-100">
                                  <div className="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-start">
                                    <div>
                                      <h5 className="fw-bold mb-1 text-dark">{drive.companyName}</h5>
                                      <div className="text-muted small">
                                        <i className="bi bi-geo-alt me-1"></i>{drive.jobLocation} •{' '}
                                        <span className="badge bg-light text-dark border">{drive.driveType || 'On-Campus'}</span>
                                      </div>
                                    </div>

                                    <div>
                                      {hasOptedIn ? (
                                        <span className="badge bg-success-subtle text-success border border-success-subtle py-2 px-3 fw-bold">
                                          <i className="bi bi-check-circle-fill me-1"></i> Opted-In
                                        </span>
                                      ) : hasOptedOut ? (
                                        <span className="badge bg-secondary py-2 px-3">Opted-Out</span>
                                      ) : isEligible ? (
                                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle py-2 px-3 fw-bold">
                                          Eligible (Pending Opt-In)
                                        </span>
                                      ) : (
                                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle py-2 px-3 fw-bold">
                                          Not Eligible
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="card-body p-3">
                                    <p className="text-secondary small mb-3">{drive.companyDescription || 'No company overview provided.'}</p>

                                    <div className="row g-2 small mb-3 bg-light p-2 rounded">
                                      <div className="col-6">
                                        <span className="text-muted">Offer Type:</span> <strong className="text-dark">{drive.offerType || 'Full Time'}</strong>
                                      </div>
                                      <div className="col-6">
                                        <span className="text-muted">Min CGPA:</span> <strong className="text-dark">{drive.minCGPA || 'None'}</strong>
                                      </div>
                                      <div className="col-6">
                                        <span className="text-muted">Standing Arrears:</span>{' '}
                                        <strong className="text-dark">{drive.standingArrearsAllowed ? `Allowed (Max ${drive.maxStandingArrears})` : 'Not Allowed'}</strong>
                                      </div>
                                      <div className="col-6">
                                        <span className="text-muted">Deadline:</span>{' '}
                                        <strong className={isPastDeadline ? 'text-danger' : 'text-dark'}>
                                          {drive.optInDeadline ? new Date(drive.optInDeadline).toLocaleDateString() : 'Open'}
                                        </strong>
                                      </div>
                                    </div>

                                    {/* Ineligibility alerts */}
                                    {!isEligible && drive.ineligibilityReasons?.length > 0 && (
                                      <div className="alert alert-danger p-2 small mb-3">
                                        <div className="fw-bold mb-1">Ineligibility Criteria:</div>
                                        <ul className="mb-0 ps-3">
                                          {drive.ineligibilityReasons.map((r, i) => (
                                            <li key={i}>{r}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Roles Offered */}
                                    {drive.roles && drive.roles.length > 0 && (
                                      <div className="mb-2">
                                        <div className="text-muted small fw-semibold mb-1">Roles Offered:</div>
                                        <div className="d-flex flex-wrap gap-1">
                                          {drive.roles.map((r, idx) => (
                                            <span key={idx} className="badge bg-white text-dark border small">
                                              {r.roleName} ({r.ctc})
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  <div className="card-footer bg-white border-top p-3 d-flex justify-content-end gap-2">
                                    {hasOptedIn ? (
                                      <button
                                        className="btn btn-outline-danger btn-sm fw-semibold"
                                        onClick={() => handleOptOut(drive._id, drive.companyName)}
                                      >
                                        Withdraw / Opt Out
                                      </button>
                                    ) : (
                                      <button
                                        className="btn btn-primary btn-sm fw-semibold"
                                        disabled={!isEligible || isPastDeadline || isNonPlacement}
                                        onClick={() => handleOpenOptInModal(drive)}
                                      >
                                        <i className="bi bi-box-arrow-in-right me-1"></i> Opt In for Drive
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* SUB-TABS 1 & 2: ON-CAMPUS & OFF-CAMPUS DRIVES LISTS */}
            {/* ------------------------------------------------------------- */}
            {drivesTab !== 'my_tracking' &&
              (() => {
                const rawList = drivesTab === 'placement' ? drivesData.placementDrives : drivesData.departmentDrives;
                const currentList = applyDrivesFilter(rawList);

                if (currentList.length === 0) {
                  return (
                    <div className="card border-0 shadow-sm rounded-3 text-center py-5">
                      <i className="bi bi-briefcase text-secondary opacity-50 fs-1 mb-2"></i>
                      <h6 className="text-muted fw-semibold">No drives match your current search/filter.</h6>
                      <small className="text-secondary">Try clearing the search query or changing filter criteria.</small>
                    </div>
                  );
                }

                return (
                  <div className="row g-3">
                    {currentList.map((drive) => {
                      const isEligible = drive.isEligible;
                      const hasOptedIn = drive.hasOptedIn;
                      const hasOptedOut = drive.hasOptedOut;
                      const isPastDeadline = drive.isPastDeadline;

                      return (
                        <div key={drive._id} className="col-lg-6">
                          <div className="card border-0 shadow-sm rounded-3 h-100">
                            <div className="card-header bg-white border-bottom p-3 d-flex justify-content-between align-items-start">
                              <div>
                                <h5 className="fw-bold mb-1 text-dark">{drive.companyName}</h5>
                                <div className="text-muted small">
                                  <i className="bi bi-geo-alt me-1"></i>{drive.jobLocation} •{' '}
                                  <span className="badge bg-light text-dark border">{drive.driveType || 'On-Campus'}</span>
                                </div>
                              </div>

                              <div>
                                {hasOptedIn ? (
                                  <span className="badge bg-success-subtle text-success border border-success-subtle py-2 px-3 fw-bold">
                                    <i className="bi bi-check-circle-fill me-1"></i> Opted-In
                                  </span>
                                ) : hasOptedOut ? (
                                  <span className="badge bg-secondary py-2 px-3">Opted-Out</span>
                                ) : isEligible ? (
                                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle py-2 px-3 fw-bold">
                                    Eligible
                                  </span>
                                ) : (
                                  <span className="badge bg-danger-subtle text-danger border border-danger-subtle py-2 px-3 fw-bold">
                                    Not Eligible
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="card-body p-3">
                              <p className="text-secondary small mb-3">{drive.companyDescription || 'No company overview provided.'}</p>

                              <div className="row g-2 small mb-3 bg-light p-2 rounded">
                                <div className="col-6">
                                  <span className="text-muted">Offer Type:</span> <strong className="text-dark">{drive.offerType || 'Full Time'}</strong>
                                </div>
                                <div className="col-6">
                                  <span className="text-muted">Min CGPA:</span> <strong className="text-dark">{drive.minCGPA || 'None'}</strong>
                                </div>
                                <div className="col-6">
                                  <span className="text-muted">Standing Arrears:</span>{' '}
                                  <strong className="text-dark">{drive.standingArrearsAllowed ? `Allowed (Max ${drive.maxStandingArrears})` : 'Not Allowed'}</strong>
                                </div>
                                <div className="col-6">
                                  <span className="text-muted">Deadline:</span>{' '}
                                  <strong className={isPastDeadline ? 'text-danger' : 'text-dark'}>
                                    {drive.optInDeadline ? new Date(drive.optInDeadline).toLocaleDateString() : 'Open'}
                                  </strong>
                                </div>
                              </div>

                              {/* Ineligibility alerts */}
                              {!isEligible && drive.ineligibilityReasons?.length > 0 && (
                                <div className="alert alert-danger p-2 small mb-3">
                                  <div className="fw-bold mb-1">Ineligibility Criteria:</div>
                                  <ul className="mb-0 ps-3">
                                    {drive.ineligibilityReasons.map((r, i) => (
                                      <li key={i}>{r}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Roles Offered */}
                              {drive.roles && drive.roles.length > 0 && (
                                <div className="mb-3">
                                  <div className="text-muted small fw-semibold mb-1">Roles Offered:</div>
                                  <div className="d-flex flex-wrap gap-1">
                                    {drive.roles.map((r, idx) => (
                                      <span key={idx} className="badge bg-white text-dark border small">
                                        {r.roleName} ({r.ctc})
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="card-footer bg-white border-top p-3 d-flex justify-content-end gap-2">
                              {hasOptedIn ? (
                                <button
                                  className="btn btn-outline-danger btn-sm fw-semibold"
                                  onClick={() => handleOptOut(drive._id, drive.companyName)}
                                >
                                  Withdraw / Opt Out
                                </button>
                              ) : (
                                <button
                                  className="btn btn-primary btn-sm fw-semibold"
                                  disabled={!isEligible || isPastDeadline || isNonPlacement}
                                  onClick={() => handleOpenOptInModal(drive)}
                                >
                                  <i className="bi bi-box-arrow-in-right me-1"></i> Opt In for Drive
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

            {/* Opt-In Modal */}
            {selectedDriveForOptIn && (
              <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 }}>
                <div className="modal-dialog modal-dialog-centered">
                  <div className="modal-content shadow border-0">
                    <div className="modal-header bg-primary text-white">
                      <h5 className="modal-title fw-bold">
                        Opt-In: {selectedDriveForOptIn.companyName}
                      </h5>
                      <button type="button" className="btn-close btn-close-white" onClick={() => setSelectedDriveForOptIn(null)}></button>
                    </div>

                    <div className="modal-body p-3">
                      <div className="alert alert-info small mb-3">
                        You can select up to <strong>{selectedDriveForOptIn.maxRoleChoicesAllowed || 1}</strong> role(s).
                      </div>

                      {/* Role checkboxes */}
                      <div className="mb-3">
                        <label className="form-label small fw-semibold">Choose Role(s):</label>
                        {selectedDriveForOptIn.roles && selectedDriveForOptIn.roles.length > 0 ? (
                          selectedDriveForOptIn.roles.map((r, rIdx) => {
                            const isChecked = roleChoices.includes(r.roleName);
                            return (
                              <div key={rIdx} className="form-check mb-2">
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  id={`role_${rIdx}`}
                                  checked={isChecked}
                                  onChange={() => {
                                    if (isChecked) {
                                      setRoleChoices(roleChoices.filter((x) => x !== r.roleName));
                                    } else {
                                      if (roleChoices.length < (selectedDriveForOptIn.maxRoleChoicesAllowed || 1)) {
                                        setRoleChoices([...roleChoices, r.roleName]);
                                      } else {
                                        Swal.fire(
                                          'Limit Reached',
                                          `Maximum ${selectedDriveForOptIn.maxRoleChoicesAllowed || 1} role(s) allowed.`,
                                          'info'
                                        );
                                      }
                                    }
                                  }}
                                />
                                <label className="form-check-label small" htmlFor={`role_${rIdx}`}>
                                  <strong>{r.roleName}</strong> — CTC: {r.ctc}
                                </label>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-muted small">Standard campus role</div>
                        )}
                      </div>

                      {/* Custom Form Fields if defined */}
                      {selectedDriveForOptIn.customFormFields && selectedDriveForOptIn.customFormFields.length > 0 && (
                        <div className="pt-2 border-top">
                          <label className="form-label small fw-semibold mb-2">Drive Specific Questions:</label>
                          {selectedDriveForOptIn.customFormFields.map((cf, cIdx) => (
                            <div key={cIdx} className="mb-2">
                              <label className="form-label small text-muted mb-1">
                                {cf.fieldLabel} {cf.isRequired && <span className="text-danger">*</span>}
                              </label>
                              <input
                                type={cf.fieldType === 'number' ? 'number' : 'text'}
                                className="form-control form-control-sm"
                                required={cf.isRequired}
                                value={customResponses[cf.fieldLabel] || ''}
                                onChange={(e) =>
                                  setCustomResponses({
                                    ...customResponses,
                                    [cf.fieldLabel]: e.target.value,
                                  })
                                }
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="modal-footer bg-light py-2">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedDriveForOptIn(null)}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm fw-semibold"
                        disabled={submittingOptIn || roleChoices.length === 0}
                        onClick={handleSubmitOptIn}
                      >
                        {submittingOptIn ? 'Confirming...' : 'Confirm Registration'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: PLACEMENT UNWILLINGNESS UNDERTAKING FORM (GOOGLE / MICROSOFT FORM STYLE) */}
        {/* ========================================================================= */}
        {activeTab === 'unwillingness' && (
          <div className="py-2" style={{ maxWidth: '780px', margin: '0 auto' }}>
            {unwillingnessSubmission ? (
              <div className="card shadow-sm border-0 rounded-4 overflow-hidden mb-4">
                <div style={{ height: '10px', backgroundColor: '#673ab7' }}></div>
                <div className="card-body p-4 p-md-5">
                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="rounded-circle d-flex align-items-center justify-content-center bg-success-subtle text-success p-3">
                      <i className="bi bi-check2-circle fs-1"></i>
                    </div>
                    <div>
                      <h4 className="fw-bold text-dark mb-1">Your response has been recorded.</h4>
                      <p className="text-secondary small mb-0">
                        Formal Placement Unwillingness Undertaking submitted on{' '}
                        {new Date(unwillingnessSubmission.submittedAt).toLocaleDateString()} at{' '}
                        {new Date(unwillingnessSubmission.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
                      </p>
                    </div>
                  </div>

                  <div className="alert alert-light border rounded-3 p-3 mb-4">
                    <div className="row g-3 small">
                      <div className="col-sm-6">
                        <span className="text-muted d-block">Career Track Chosen:</span>
                        <strong className="text-primary fs-6">{unwillingnessSubmission.careerGoalChoice}</strong>
                      </div>
                      <div className="col-sm-6">
                        <span className="text-muted d-block">Placement Eligibility Status:</span>
                        <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                          Locked (Bypassed from Campus Drives)
                        </span>
                      </div>
                      <div className="col-12">
                        <span className="text-muted d-block">Stated Reason:</span>
                        <div className="text-dark bg-white p-2 rounded border mt-1">
                          {unwillingnessSubmission.reasonForUnwillingness}
                        </div>
                      </div>
                      {unwillingnessSubmission.customResponses && Object.keys(unwillingnessSubmission.customResponses).length > 0 && (
                        <div className="col-12">
                          <span className="text-muted d-block mb-1">Submitted Form Answers:</span>
                          <div className="d-flex flex-column gap-2 bg-white p-2 rounded border">
                            {Object.entries(unwillingnessSubmission.customResponses).map(([qKey, aVal], aIdx) => (
                              <div key={aIdx} className="small">
                                <span className="fw-semibold text-secondary">{qKey}:</span>{' '}
                                <span className="text-dark fw-bold">{Array.isArray(aVal) ? aVal.join(', ') : String(aVal)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="d-flex justify-content-between align-items-center pt-2">
                    <small className="text-muted">
                      Need to switch back to Placement? Please contact the Placement Officer or raise a ticket.
                    </small>
                    <button className="btn btn-outline-secondary btn-sm" onClick={() => setActiveTab('overview')}>
                      Back to Overview
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitUnwillingness} className="d-flex flex-column gap-4">
                {/* Form Header Card */}
                <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
                  <div style={{ height: '10px', backgroundColor: '#673ab7' }}></div>
                  <div className="card-body p-4 p-md-5">
                    <h3 className="fw-bold text-dark mb-2">
                      {unwillingnessForm?.title || 'Placement Unwillingness Undertaking & Documentation Form'}
                    </h3>
                    <p className="text-secondary small mb-3" style={{ whiteSpace: 'pre-line' }}>
                      {unwillingnessForm?.instructions ||
                        'Mandatory undertaking form for students pursuing Higher Studies or Entrepreneurship instead of campus placement drives. Completing this form locks your preference and updates institutional records.'}
                    </p>
                    <hr className="my-3 text-muted" />
                    <div className="d-flex justify-content-between align-items-center text-muted small">
                      <span>* Indicates required question</span>
                      <span className="badge bg-light text-dark border">Official Undertaking</span>
                    </div>
                  </div>
                </div>

                {/* Prefilled Student Identity Card */}
                <div className="card shadow-sm border-0 rounded-4 p-4">
                  <h6 className="fw-bold text-dark mb-3">
                    <i className="bi bi-person-badge-fill text-primary me-2"></i> Student Identification
                  </h6>
                  <div className="row g-2 small text-secondary">
                    <div className="col-sm-6">
                      Name: <strong className="text-dark">{profile?.name || currentUser?.name}</strong>
                    </div>
                    <div className="col-sm-6">
                      Roll Number: <strong className="text-dark">{profile?.rollNumber || '—'}</strong>
                    </div>
                    <div className="col-sm-6">
                      Department: <strong className="text-dark">{profile?.department || '—'} ({profile?.section || 'A'})</strong>
                    </div>
                    <div className="col-sm-6">
                      Current CGPA: <strong className="text-dark">{Number(profile?.currentCGPA || liveCGPA || 0).toFixed(2)}</strong>
                    </div>
                  </div>
                </div>

                {/* Question: Career Track Choice */}
                <div className="card shadow-sm border-0 rounded-4 p-4">
                  <label className="fw-bold text-dark mb-2">
                    Primary Career Track Choice <span className="text-danger">*</span>
                  </label>
                  <div className="d-flex flex-column gap-2 mt-2">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="careerTrackOption"
                        id="trackHigher"
                        value="Higher Studies"
                        checked={unwillingnessCareerChoice === 'Higher Studies'}
                        onChange={(e) => setUnwillingnessCareerChoice(e.target.value)}
                        required
                      />
                      <label className="form-check-label fw-semibold text-dark" htmlFor="trackHigher">
                        Higher Studies (Masters / MS / MBA / M.Tech / PhD)
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="radio"
                        name="careerTrackOption"
                        id="trackStartup"
                        value="Entrepreneurship"
                        checked={unwillingnessCareerChoice === 'Entrepreneurship'}
                        onChange={(e) => setUnwillingnessCareerChoice(e.target.value)}
                        required
                      />
                      <label className="form-check-label fw-semibold text-dark" htmlFor="trackStartup">
                        Entrepreneurship / Starting own Venture / Family Business
                      </label>
                    </div>
                  </div>
                </div>

                {/* Track Details Card */}
                {unwillingnessCareerChoice === 'Higher Studies' ? (
                  <div className="card shadow-sm border-0 rounded-4 p-4">
                    <h6 className="fw-bold text-dark mb-3">Higher Studies Target Details</h6>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Target Degree <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. MS in Computer Science, MBA, M.Tech"
                          value={higherStudiesDetails.targetDegree}
                          onChange={(e) => setHigherStudiesDetails({ ...higherStudiesDetails, targetDegree: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Country / Study Destination</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. India, USA, Germany, UK"
                          value={higherStudiesDetails.countryPreference}
                          onChange={(e) => setHigherStudiesDetails({ ...higherStudiesDetails, countryPreference: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Entrance / Language Exam</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. GATE, GRE, IELTS, TOEFL, CAT"
                          value={higherStudiesDetails.entranceExam}
                          onChange={(e) => setHigherStudiesDetails({ ...higherStudiesDetails, entranceExam: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Expected Year of Admission</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. 2027"
                          value={higherStudiesDetails.expectedAdmissionYear}
                          onChange={(e) => setHigherStudiesDetails({ ...higherStudiesDetails, expectedAdmissionYear: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="card shadow-sm border-0 rounded-4 p-4">
                    <h6 className="fw-bold text-dark mb-3">Venture & Startup Details</h6>
                    <div className="row g-3">
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Venture / Startup Name <span className="text-danger">*</span></label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. Nexus AI Solutions"
                          value={entrepreneurshipDetails.startupName}
                          onChange={(e) => setEntrepreneurshipDetails({ ...entrepreneurshipDetails, startupName: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Industry / Domain</label>
                        <input
                          type="text"
                          className="form-control"
                          placeholder="e.g. EdTech, SaaS, CleanTech"
                          value={entrepreneurshipDetails.industry}
                          onChange={(e) => setEntrepreneurshipDetails({ ...entrepreneurshipDetails, industry: e.target.value })}
                        />
                      </div>
                      <div className="col-md-6">
                        <label className="form-label small fw-semibold">Current Stage</label>
                        <select
                          className="form-select"
                          value={entrepreneurshipDetails.currentStage}
                          onChange={(e) => setEntrepreneurshipDetails({ ...entrepreneurshipDetails, currentStage: e.target.value })}
                        >
                          <option value="Idea">Idea Phase</option>
                          <option value="Prototype">Prototype / MVP Ready</option>
                          <option value="Registered">Incorporated Entity</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reason for Opting Out */}
                <div className="card shadow-sm border-0 rounded-4 p-4">
                  <label className="fw-bold text-dark mb-2">
                    Reason for Opting Out of Campus Placements <span className="text-danger">*</span>
                  </label>
                  <p className="text-muted small mb-2">
                    State your specific objectives and preparation plans for your chosen track.
                  </p>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Your answer"
                    value={unwillingnessReason}
                    onChange={(e) => setUnwillingnessReason(e.target.value)}
                    required
                  ></textarea>
                </div>

                {/* Dynamic Questions from Form Builder */}
                {unwillingnessForm?.customFields &&
                  unwillingnessForm.customFields.length > 0 &&
                  unwillingnessForm.customFields.map((q, qIdx) => (
                    <div key={qIdx} className="card shadow-sm border-0 rounded-4 p-4">
                      <label className="fw-bold text-dark mb-2">
                        {q.fieldLabel} {q.isRequired && <span className="text-danger">*</span>}
                      </label>

                      {(q.fieldType === 'text' || q.fieldType === 'number' || q.fieldType === 'link') && (
                        <input
                          type={q.fieldType === 'number' ? 'number' : q.fieldType === 'link' ? 'url' : 'text'}
                          className="form-control"
                          placeholder="Your answer"
                          required={q.isRequired}
                          value={unwillingnessResponses[q.fieldLabel] || ''}
                          onChange={(e) =>
                            setUnwillingnessResponses({
                              ...unwillingnessResponses,
                              [q.fieldLabel]: e.target.value,
                            })
                          }
                        />
                      )}

                      {(q.fieldType === 'paragraph' || q.fieldType === 'textarea') && (
                        <textarea
                          className="form-control"
                          rows="3"
                          placeholder="Your answer"
                          required={q.isRequired}
                          value={unwillingnessResponses[q.fieldLabel] || ''}
                          onChange={(e) =>
                            setUnwillingnessResponses({
                              ...unwillingnessResponses,
                              [q.fieldLabel]: e.target.value,
                            })
                          }
                        ></textarea>
                      )}

                      {q.fieldType === 'multiple_choice' && (
                        <div className="d-flex flex-column gap-2 mt-2">
                          {(q.options || []).map((opt, optIdx) => (
                            <div key={optIdx} className="form-check">
                              <input
                                className="form-check-input"
                                type="radio"
                                name={`mc_${qIdx}`}
                                id={`mc_${qIdx}_${optIdx}`}
                                value={opt}
                                checked={unwillingnessResponses[q.fieldLabel] === opt}
                                onChange={(e) =>
                                  setUnwillingnessResponses({
                                    ...unwillingnessResponses,
                                    [q.fieldLabel]: e.target.value,
                                  })
                                }
                                required={q.isRequired}
                              />
                              <label className="form-check-label text-dark" htmlFor={`mc_${qIdx}_${optIdx}`}>
                                {opt}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}

                      {q.fieldType === 'dropdown' && (
                        <select
                          className="form-select mt-2"
                          value={unwillingnessResponses[q.fieldLabel] || ''}
                          onChange={(e) =>
                            setUnwillingnessResponses({
                              ...unwillingnessResponses,
                              [q.fieldLabel]: e.target.value,
                            })
                          }
                          required={q.isRequired}
                        >
                          <option value="">Choose</option>
                          {(q.options || []).map((opt, optIdx) => (
                            <option key={optIdx} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}

                      {q.fieldType === 'checkboxes' && (
                        <div className="d-flex flex-column gap-2 mt-2">
                          {(q.options || []).map((opt, optIdx) => {
                            const curList = Array.isArray(unwillingnessResponses[q.fieldLabel])
                              ? unwillingnessResponses[q.fieldLabel]
                              : [];
                            const isChecked = curList.includes(opt);
                            return (
                              <div key={optIdx} className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id={`cb_${qIdx}_${optIdx}`}
                                  checked={isChecked}
                                  onChange={(e) => {
                                    const nextList = e.target.checked
                                      ? [...curList, opt]
                                      : curList.filter((item) => item !== opt);
                                    setUnwillingnessResponses({
                                      ...unwillingnessResponses,
                                      [q.fieldLabel]: nextList,
                                    });
                                  }}
                                />
                                <label className="form-check-label text-dark" htmlFor={`cb_${qIdx}_${optIdx}`}>
                                  {opt}
                                </label>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                {/* Formal Undertaking Declaration Card */}
                <div className="card shadow-sm border-0 rounded-4 p-4 bg-light">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="formalDeclaration"
                      defaultChecked
                      required
                    />
                    <label className="form-check-label text-dark small fw-semibold" htmlFor="formalDeclaration">
                      I solemnly affirm and undertake that I have voluntarily chosen not to participate in campus recruitment drives. I understand that my placement records will be locked and this decision cannot be revoked without explicit permission from the Placement Officer.
                    </label>
                  </div>
                </div>

                {/* Submit Action */}
                <div className="d-flex justify-content-between align-items-center mb-5">
                  <button
                    type="submit"
                    className="btn fw-semibold px-4 py-2 text-white shadow-sm"
                    style={{ backgroundColor: '#673ab7' }}
                    disabled={submittingUnwillingness}
                  >
                    {submittingUnwillingness ? (
                      <span>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>Submitting...
                      </span>
                    ) : (
                      'Submit Form'
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-link text-muted btn-sm text-decoration-none"
                    onClick={() => {
                      setUnwillingnessResponses({});
                      setUnwillingnessReason('');
                    }}
                  >
                    Clear form
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: CENTRALIZED COMMUNICATION HUB */}
        {/* ========================================================================= */}
        {activeTab === 'communication' && <CommunicationHub user={currentUser} />}

        {/* ========================================================================= */}
        {/* TAB 6: SUPPORT DESK (TICKETS) */}
        {/* ========================================================================= */}
        {activeTab === 'tickets' && <TicketSupportCenter user={currentUser} />}
      </div>
    </div>
  );
}
