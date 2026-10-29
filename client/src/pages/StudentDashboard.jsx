import React, { useState, useEffect } from 'react';
import Swal from 'sweetalert2';
import Navbar from '../components/Navbar';
import CommunicationHub from '../components/CommunicationHub';
import TicketSupportCenter from '../components/TicketSupportCenter';
import { studentAPI } from '../services/api';

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
  const [drivesTab, setDrivesTab] = useState('placement'); // 'placement' or 'department'
  const [selectedDriveForOptIn, setSelectedDriveForOptIn] = useState(null);
  const [roleChoices, setRoleChoices] = useState([]);
  const [customResponses, setCustomResponses] = useState({});
  const [submittingOptIn, setSubmittingOptIn] = useState(false);

  // Unwillingness form state
  const [unwillingnessForm, setUnwillingnessForm] = useState(null);
  const [unwillingnessSubmission, setUnwillingnessSubmission] = useState(null);
  const [unwillingnessReason, setUnwillingnessReason] = useState('');
  const [unwillingnessCareerChoice, setUnwillingnessCareerChoice] = useState('Higher Studies');
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

  // Handle Profile Save
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await studentAPI.updateProfile(formData);
      if (res.data.success) {
        setProfile(res.data.profile);
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

  // Handle Drive Opt-In
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

  // Handle Unwillingness Submission
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
  const isNonPlacement = profile?.careerGoal === 'Higher Studies' || profile?.careerGoal === 'Entrepreneurship';

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
                  <span className="fw-semibold text-dark">{profile?.section || 'A'}</span> • CGPA:{' '}
                  <span className="badge bg-primary-subtle text-primary fw-bold">
                    {profile?.currentCGPA ? profile.currentCGPA.toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>

              {/* Completeness Badge */}
              <div className="d-flex align-items-center gap-3">
                <div style={{ width: '180px' }}>
                  <div className="d-flex justify-content-between small mb-1">
                    <span className="text-muted fw-semibold">Profile Completeness</span>
                    <span className={`fw-bold ${completeness >= 80 ? 'text-success' : completeness >= 50 ? 'text-primary' : 'text-warning'}`}>
                      {completeness}%
                    </span>
                  </div>
                  <div className="progress" style={{ height: '8px' }}>
                    <div
                      className={`progress-bar progress-bar-striped ${completeness >= 80 ? 'bg-success' : completeness >= 50 ? 'bg-primary' : 'bg-warning'}`}
                      role="progressbar"
                      style={{ width: `${completeness}%` }}
                    ></div>
                  </div>
                </div>

                <div className="badge bg-light text-dark border p-2 text-start">
                  <div className="text-muted" style={{ fontSize: '0.68rem' }}>Career Track</div>
                  <div className="fw-bold text-primary">{profile?.careerGoal || 'Undecided'}</div>
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
              <li className="nav-item">
                <button
                  className={`nav-link py-2 px-3 fw-semibold rounded-pill ${activeTab === 'unwillingness' ? 'active shadow-sm' : 'text-dark'}`}
                  onClick={() => setActiveTab('unwillingness')}
                >
                  <i className="bi bi-file-earmark-lock2-fill me-1"></i> Placement Unwillingness
                </button>
              </li>
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
        {/* TAB 1: PROFILE OVERVIEW (Non-sensitive showcase view) */}
        {/* ========================================================================= */}
        {activeTab === 'overview' && (
          <div className="row g-4">
            <div className="col-lg-4">
              <div className="card border-0 shadow-sm rounded-3 mb-4">
                <div className="card-body text-center p-4">
                  <div
                    className="rounded-circle bg-primary text-white d-flex align-items-center justify-content-center mx-auto mb-3 shadow"
                    style={{ width: '80px', height: '80px', fontSize: '2rem', fontWeight: 'bold' }}
                  >
                    {profile?.name ? profile.name.charAt(0).toUpperCase() : 'S'}
                  </div>
                  <h5 className="fw-bold text-dark mb-1">{profile?.name}</h5>
                  <div className="text-muted small mb-2">{profile?.rollNumber} • {profile?.department} ({profile?.section || 'A'})</div>
                  <span className="badge bg-primary-subtle text-primary border border-primary-subtle py-1 px-3 rounded-pill fw-semibold mb-3">
                    Goal: {profile?.careerGoal || 'Undecided'}
                  </span>

                  <div className="row g-2 text-start pt-3 border-top small">
                    <div className="col-6">
                      <div className="text-muted">Current CGPA</div>
                      <div className="fw-bold fs-6 text-dark">{profile?.currentCGPA ? profile.currentCGPA.toFixed(2) : '0.00'}</div>
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
                  </div>
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
                  {profile?.mentorRemarks?.generalRemarks || profile?.mentorRemarks?.placementRemarks ? (
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
                        Updated by {profile.mentorRemarks.updatedByName || 'Mentor'}
                      </div>
                    </div>
                  ) : (
                    <div className="text-muted small fst-italic">No remarks entered by mentor yet.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="col-lg-8">
              {/* Technical Profile Card */}
              <div className="card border-0 shadow-sm rounded-3 mb-4">
                <div className="card-header bg-white border-bottom p-3">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-code-slash text-primary"></i> Technical Profile & Skills
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

              {/* Projects & Certifications */}
              <div className="card border-0 shadow-sm rounded-3">
                <div className="card-header bg-white border-bottom p-3">
                  <h6 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                    <i className="bi bi-award-fill text-warning"></i> Projects & Certifications
                  </h6>
                </div>
                <div className="card-body p-3">
                  <div className="mb-3">
                    <div className="text-muted small fw-semibold mb-2">Projects</div>
                    {profile?.projects && profile.projects.length > 0 ? (
                      <div className="d-flex flex-column gap-2">
                        {profile.projects.map((proj, idx) => (
                          <div key={idx} className="p-2 border rounded bg-light small">
                            <div className="fw-bold text-dark">{proj.title || 'Untitled Project'}</div>
                            <div className="text-secondary">{proj.description}</div>
                            {proj.technologies && <small className="text-primary fw-semibold">Tech: {proj.technologies}</small>}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted small">No projects listed. Add projects in Profile Filling tab.</div>
                    )}
                  </div>

                  <div className="pt-2 border-top">
                    <div className="text-muted small fw-semibold mb-2">Certifications</div>
                    {profile?.certifications && profile.certifications.length > 0 ? (
                      <div className="d-flex flex-wrap gap-2">
                        {profile.certifications.map((c, idx) => (
                          <span key={idx} className="badge bg-success-subtle text-success border border-success-subtle p-2">
                            <i className="bi bi-patch-check-fill me-1"></i> {c.title || c.certificateName || c}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="text-muted small">No certifications registered.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: PROFILE FILLING PAGE (Complete editable form + Sensitive Watermark) */}
        {/* ========================================================================= */}
        {activeTab === 'profile_edit' && (
          <form onSubmit={handleSaveProfile} className="card border-0 shadow-sm rounded-3">
            <div className="card-header bg-white border-bottom p-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
              <div>
                <h5 className="fw-bold mb-0 text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-shield-lock-fill text-warning"></i> Student Profiling Form
                </h5>
                <small className="text-muted">Official comprehensive academic, family, and professional profile</small>
              </div>
              <button type="submit" className="btn btn-primary btn-sm fw-semibold" disabled={savingProfile}>
                {savingProfile ? 'Saving Changes...' : 'Save & Update Profile'}
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

              {/* 1. Personal Details */}
              <div className="mb-4">
                <h6 className="fw-bold text-primary border-bottom pb-2 mb-3">1. Personal Details</h6>
                <div className="row g-3">
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Register Number</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.registerNumber || ''}
                      onChange={(e) => setFormData({ ...formData, registerNumber: e.target.value })}
                      placeholder="e.g. 717822P101"
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small fw-semibold">Roll Number (Locked)</label>
                    <input type="text" className="form-control form-control-sm bg-light" value={formData.rollNumber || ''} disabled />
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
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Personal Email</label>
                    <input
                      type="email"
                      className="form-control form-control-sm"
                      value={formData.personalEmail || ''}
                      onChange={(e) => setFormData({ ...formData, personalEmail: e.target.value })}
                    />
                  </div>
                  <div className="col-md-6">
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

              {/* 2. Parent & Family Details */}
              <div className="mb-4">
                <h6 className="fw-bold text-primary border-bottom pb-2 mb-3">2. Parent & Family Details</h6>
                <div className="row g-3">
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Father's Name</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.fatherDetails?.name || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        fatherDetails: { ...formData.fatherDetails, name: e.target.value }
                      })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Father's Occupation</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.fatherDetails?.occupation || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        fatherDetails: { ...formData.fatherDetails, occupation: e.target.value }
                      })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Father's Contact Number</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.fatherDetails?.contactNumber || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        fatherDetails: { ...formData.fatherDetails, contactNumber: e.target.value }
                      })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Mother's Name</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.motherDetails?.name || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        motherDetails: { ...formData.motherDetails, name: e.target.value }
                      })}
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label small fw-semibold">Mother's Contact Number</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={formData.motherDetails?.contactNumber || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        motherDetails: { ...formData.motherDetails, contactNumber: e.target.value }
                      })}
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

              {/* 3. Technical & Professional Links */}
              <div className="mb-4">
                <h6 className="fw-bold text-primary border-bottom pb-2 mb-3">3. Technical & Professional Profile</h6>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Technical Skills (Comma separated)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={Array.isArray(formData.technicalSkills) ? formData.technicalSkills.join(', ') : ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        technicalSkills: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
                      placeholder="e.g. React, Node.js, Python, Java, Docker"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Languages Known (Comma separated)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={Array.isArray(formData.languages) ? formData.languages.join(', ') : ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        languages: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                      })}
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

              {/* 4. Career Goal & Intent */}
              <div className="mb-4">
                <h6 className="fw-bold text-primary border-bottom pb-2 mb-3">4. Final Career Goal</h6>
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
                          onChange={(e) => setFormData({
                            ...formData,
                            higherStudiesDetails: { ...formData.higherStudiesDetails, degree: e.target.value }
                          })}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Target Institution / University</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={formData.higherStudiesDetails?.institution || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            higherStudiesDetails: { ...formData.higherStudiesDetails, institution: e.target.value }
                          })}
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
                          onChange={(e) => setFormData({
                            ...formData,
                            entrepreneurshipDetails: { ...formData.entrepreneurshipDetails, startupName: e.target.value }
                          })}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small fw-semibold">Current Product / Startup Stage</label>
                        <select
                          className="form-select form-select-sm"
                          value={formData.entrepreneurshipDetails?.currentStage || 'Idea'}
                          onChange={(e) => setFormData({
                            ...formData,
                            entrepreneurshipDetails: { ...formData.entrepreneurshipDetails, currentStage: e.target.value }
                          })}
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
              </div>

              {/* 5. Self-Evaluation & Strengths */}
              <div className="mb-3">
                <h6 className="fw-bold text-primary border-bottom pb-2 mb-3">5. Strengths & Improvement Analysis</h6>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Key Strengths (Academic & Technical)</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="2"
                      value={formData.selfEvaluation?.strengths || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        selfEvaluation: { ...formData.selfEvaluation, strengths: e.target.value }
                      })}
                      placeholder="e.g. Strong problem solving, fast learner in Python"
                    ></textarea>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold">Areas Requiring Improvement / Support</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="2"
                      value={formData.selfEvaluation?.areasForImprovement || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        selfEvaluation: { ...formData.selfEvaluation, areasForImprovement: e.target.value }
                      })}
                      placeholder="e.g. Communication confidence in technical interviews"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="text-end pt-3 border-top">
                <button type="submit" className="btn btn-primary fw-semibold" disabled={savingProfile}>
                  {savingProfile ? 'Saving Changes...' : 'Save Complete Profile'}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: CAMPUS DRIVES (Placement Drives & Department Drives) */}
        {/* ========================================================================= */}
        {activeTab === 'drives' && (
          <div>
            {/* Banner if Career Goal is Not Placement */}
            {isNonPlacement && (
              <div className="alert alert-warning border-warning shadow-sm rounded-3 p-3 mb-4 d-flex align-items-center justify-content-between">
                <div>
                  <h6 className="fw-bold mb-1 text-dark">
                    <i className="bi bi-exclamation-triangle-fill text-warning me-2"></i>
                    Career Goal Track: {profile?.careerGoal}
                  </h6>
                  <p className="mb-0 small text-secondary">
                    You have opted for {profile?.careerGoal}. Campus placement participation is locked. Submit your Placement Unwillingness undertaking form to register your target path with the placement office.
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

            {/* Drives Channel Selector */}
            <div className="d-flex align-items-center justify-content-between mb-3">
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
              </div>

              <button className="btn btn-outline-secondary btn-sm" onClick={fetchDrives}>
                <i className="bi bi-arrow-clockwise me-1"></i> Refresh Drives
              </button>
            </div>

            {/* Drives List */}
            {(() => {
              const currentList = drivesTab === 'placement' ? drivesData.placementDrives : drivesData.departmentDrives;

              if (currentList.length === 0) {
                return (
                  <div className="card border-0 shadow-sm rounded-3 text-center py-5">
                    <i className="bi bi-briefcase text-secondary opacity-50 fs-1 mb-2"></i>
                    <h6 className="text-muted fw-semibold">No active drives posted in this category.</h6>
                    <small className="text-secondary">Announcements will appear here once announced by the Placement Cell.</small>
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

                            {/* Job Roles */}
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
                                      setRoleChoices(roleChoices.filter(x => x !== r.roleName));
                                    } else {
                                      if (roleChoices.length < (selectedDriveForOptIn.maxRoleChoicesAllowed || 1)) {
                                        setRoleChoices([...roleChoices, r.roleName]);
                                      } else {
                                        Swal.fire('Limit Reached', `Maximum ${selectedDriveForOptIn.maxRoleChoicesAllowed || 1} role(s) allowed.`, 'info');
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
                                onChange={(e) => setCustomResponses({
                                  ...customResponses,
                                  [cf.fieldLabel]: e.target.value,
                                })}
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
        {/* TAB 4: PLACEMENT UNWILLINGNESS UNDERTAKING FORM */}
        {/* ========================================================================= */}
        {activeTab === 'unwillingness' && (
          <div className="card border-0 shadow-sm rounded-3">
            <div className="card-header bg-white border-bottom p-3">
              <h5 className="fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                <i className="bi bi-file-earmark-lock2-fill text-danger"></i>
                Placement Unwillingness Undertaking & Documentation
              </h5>
              <small className="text-muted">
                Mandatory documentation for students choosing Higher Studies or Entrepreneurship
              </small>
            </div>

            <div className="card-body p-4">
              {unwillingnessSubmission ? (
                <div className="alert alert-success border-success-subtle p-4 rounded-3">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <i className="bi bi-check-circle-fill text-success fs-1"></i>
                    <div>
                      <h5 className="fw-bold text-success mb-1">Undertaking Form Formally Submitted</h5>
                      <div className="text-secondary small">
                        Submitted on {new Date(unwillingnessSubmission.submittedAt).toLocaleDateString()} at{' '}
                        {new Date(unwillingnessSubmission.submittedAt).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>

                  <div className="row g-3 small bg-white p-3 rounded border mb-3">
                    <div className="col-md-4">
                      <span className="text-muted">Chosen Track:</span>
                      <div className="fw-bold text-dark">{unwillingnessSubmission.careerGoalChoice}</div>
                    </div>
                    <div className="col-md-4">
                      <span className="text-muted">Record Lock Status:</span>
                      <div className="fw-bold text-danger">
                        {unwillingnessSubmission.isLocked ? 'Locked (Opt-in Bypassed)' : 'Unlocked'}
                      </div>
                    </div>
                    <div className="col-md-4">
                      <span className="text-muted">Permission to Switch:</span>
                      <div className="fw-bold text-dark">
                        {unwillingnessSubmission.allowPlacementSwitch ? 'Permitted' : 'Not Permitted (Placement Cell Locked)'}
                      </div>
                    </div>
                    <div className="col-12">
                      <span className="text-muted">Submitted Reason:</span>
                      <div className="text-dark mt-1">{unwillingnessSubmission.reasonForUnwillingness}</div>
                    </div>
                  </div>

                  <p className="small text-muted mb-0">
                    Your institutional record has been successfully updated in QS I-Gauge and Master Placement registers. To request any modification, please submit a ticket to the Placement Support Desk.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmitUnwillingness}>
                  <div className="alert alert-light border rounded-3 p-3 mb-4">
                    <h6 className="fw-bold text-dark mb-1">
                      {unwillingnessForm?.title || 'Placement Unwillingness Undertaking'}
                    </h6>
                    <p className="text-secondary small mb-2">
                      {unwillingnessForm?.instructions || 'Students choosing Higher Studies or Entrepreneurship must submit this formal undertaking.'}
                    </p>
                    {unwillingnessForm?.sampleDocumentUrl && (
                      <a href={unwillingnessForm.sampleDocumentUrl} target="_blank" rel="noreferrer" className="btn btn-outline-primary btn-sm">
                        <i className="bi bi-download me-1"></i> Download Blank Undertaking Form Template
                      </a>
                    )}
                  </div>

                  <div className="row g-3 mb-3">
                    <div className="col-md-6">
                      <label className="form-label small fw-semibold">Career Choice *</label>
                      <select
                        className="form-select form-select-sm fw-bold"
                        value={unwillingnessCareerChoice}
                        onChange={(e) => setUnwillingnessCareerChoice(e.target.value)}
                        required
                      >
                        <option value="Higher Studies">Higher Studies</option>
                        <option value="Entrepreneurship">Entrepreneurship / Startup</option>
                      </select>
                    </div>

                    {unwillingnessCareerChoice === 'Higher Studies' ? (
                      <>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">Target Degree *</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. MS, MBA, M.Tech"
                            value={higherStudiesDetails.targetDegree}
                            onChange={(e) => setHigherStudiesDetails({ ...higherStudiesDetails, targetDegree: e.target.value })}
                            required
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">Target Country / Region</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. USA, Germany, India"
                            value={higherStudiesDetails.countryPreference}
                            onChange={(e) => setHigherStudiesDetails({ ...higherStudiesDetails, countryPreference: e.target.value })}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">Competitive Entrance Exam</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. GRE, TOEFL, GATE, CAT"
                            value={higherStudiesDetails.entranceExam}
                            onChange={(e) => setHigherStudiesDetails({ ...higherStudiesDetails, entranceExam: e.target.value })}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">Startup / Venture Name *</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. NextGen Robotics Ltd"
                            value={entrepreneurshipDetails.startupName}
                            onChange={(e) => setEntrepreneurshipDetails({ ...entrepreneurshipDetails, startupName: e.target.value })}
                            required
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">Industry / Domain</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. EdTech, FinTech, AgriTech"
                            value={entrepreneurshipDetails.industry}
                            onChange={(e) => setEntrepreneurshipDetails({ ...entrepreneurshipDetails, industry: e.target.value })}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label small fw-semibold">Current Stage</label>
                          <select
                            className="form-select form-select-sm"
                            value={entrepreneurshipDetails.currentStage}
                            onChange={(e) => setEntrepreneurshipDetails({ ...entrepreneurshipDetails, currentStage: e.target.value })}
                          >
                            <option value="Idea">Idea Phase</option>
                            <option value="Prototype">Prototype / MVP Ready</option>
                            <option value="Registered">Incorporated Entity</option>
                          </select>
                        </div>
                      </>
                    )}

                    <div className="col-12">
                      <label className="form-label small fw-semibold">Reason for Placement Unwillingness *</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows="3"
                        placeholder="State your clear rationale for not participating in on-campus placement drives..."
                        value={unwillingnessReason}
                        onChange={(e) => setUnwillingnessReason(e.target.value)}
                        required
                      ></textarea>
                    </div>
                  </div>

                  <div className="alert alert-secondary small mb-3">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" id="parentAck" defaultChecked required />
                      <label className="form-check-label text-dark fw-semibold" htmlFor="parentAck">
                        I hereby declare that this decision has been taken with full acknowledgment of my parents / guardian.
                      </label>
                    </div>
                  </div>

                  <div className="text-end">
                    <button type="submit" className="btn btn-danger fw-semibold" disabled={submittingUnwillingness}>
                      {submittingUnwillingness ? 'Registering...' : 'Submit Unwillingness Undertaking'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 5: CENTRALIZED COMMUNICATION HUB */}
        {/* ========================================================================= */}
        {activeTab === 'communication' && (
          <CommunicationHub user={currentUser} />
        )}

        {/* ========================================================================= */}
        {/* TAB 6: SUPPORT DESK (TICKETS) */}
        {/* ========================================================================= */}
        {activeTab === 'tickets' && (
          <TicketSupportCenter user={currentUser} />
        )}
      </div>
    </div>
  );
}
