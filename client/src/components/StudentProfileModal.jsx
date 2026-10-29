import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function StudentProfileModal({ student: initialStudent, studentId, onClose }) {
  const [student, setStudent] = useState(
    initialStudent && typeof initialStudent === 'object' && initialStudent.name ? initialStudent : null
  );
  const [loading, setLoading] = useState(
    !(initialStudent && typeof initialStudent === 'object' && initialStudent.name) && Boolean(studentId || initialStudent)
  );

  const [editingRemarks, setEditingRemarks] = useState(false);
  const [savingRemarks, setSavingRemarks] = useState(false);
  const [remarksForm, setRemarksForm] = useState({
    placementRemarks: '',
    entrepreneurshipRemarks: '',
    higherStudiesRemarks: '',
    generalRemarks: '',
  });

  useEffect(() => {
    if (student?.mentorRemarks) {
      setRemarksForm({
        placementRemarks: student.mentorRemarks.placementRemarks || '',
        entrepreneurshipRemarks: student.mentorRemarks.entrepreneurshipRemarks || '',
        higherStudiesRemarks: student.mentorRemarks.higherStudiesRemarks || '',
        generalRemarks: student.mentorRemarks.generalRemarks || '',
      });
    }
  }, [student]);

  const handleSaveRemarks = async () => {
    if (!student?._id) return;
    setSavingRemarks(true);
    try {
      let res;
      try {
        res = await api.put(`/coordinator/students/${student._id}/remarks`, remarksForm);
      } catch {
        try {
          res = await api.put(`/mentor/students/${student._id}/remarks`, remarksForm);
        } catch {
          res = await api.put(`/placement/students/${student._id}/remarks`, remarksForm);
        }
      }

      if (res?.data?.success) {
        setStudent({
          ...student,
          mentorRemarks: res.data.mentorRemarks,
        });
        setEditingRemarks(false);
      }
    } catch (err) {
      console.error('Failed to update student remarks:', err);
    } finally {
      setSavingRemarks(false);
    }
  };

  useEffect(() => {
    if (initialStudent && typeof initialStudent === 'object' && initialStudent.name) {
      setStudent(initialStudent);
      setLoading(false);
      return;
    }

    const idToFetch =
      studentId ||
      (typeof initialStudent === 'string'
        ? initialStudent
        : initialStudent?._id || initialStudent?.id);

    if (!idToFetch) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const fetchDetails = async () => {
      try {
        let res;
        try {
          res = await api.get(`/coordinator/students/${idToFetch}`);
        } catch {
          try {
            res = await api.get(`/mentor/students/${idToFetch}`);
          } catch {
            res = await api.get(`/placement/students/${idToFetch}`);
          }
        }
        if (isMounted && res?.data?.student) {
          setStudent(res.data.student);
        }
      } catch (err) {
        console.error('Failed to fetch student details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();
    return () => {
      isMounted = false;
    };
  }, [initialStudent, studentId]);

  if (!student && !loading) return null;

  if (loading) {
    return (
      <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(3px)' }}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content shadow-lg border-0 rounded-3 p-5 text-center bg-white">
            <div className="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <h6 className="fw-bold text-dark mb-1">Loading Student Profile...</h6>
            <small className="text-muted">Fetching academic history, certifications, and progression</small>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(3px)' }}>
      <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
        <div className="modal-content shadow-lg border-0 rounded-3">
          {/* Header */}
          <div className="modal-header bg-primary text-white py-3 px-4">
            <div className="d-flex align-items-center">
              <div className="bg-white text-primary rounded-circle p-2 me-3 fw-bold fs-5" style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {student.name.charAt(0)}
              </div>
              <div>
                <h5 className="modal-title fw-bold mb-0">{student.name}</h5>
                <span className="badge bg-light text-dark me-2">{student.rollNumber}</span>
                <span className="badge bg-primary-subtle text-white border border-light me-2">{student.department} - Sec {student.section || 'A'}</span>
                <span className="small opacity-75">{student.email}</span>
              </div>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          {/* Body */}
          <div className="modal-body p-4 bg-light">
            {/* Quick Metrics Bar */}
            <div className="row g-3 mb-4">
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white text-center rounded-3">
                  <span className="text-muted small text-uppercase fw-semibold">Current CGPA</span>
                  <h3 className="fw-bold text-primary mb-0 mt-1">{student.currentCGPA || 0}</h3>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white text-center rounded-3">
                  <span className="text-muted small text-uppercase fw-semibold">Standing Arrears</span>
                  <h3 className={`fw-bold mb-0 mt-1 ${student.standingArrearsCount > 0 ? 'text-danger' : 'text-success'}`}>
                    {student.standingArrearsCount || 0}
                  </h3>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white text-center rounded-3">
                  <span className="text-muted small text-uppercase fw-semibold">Placement Status</span>
                  <div className="mt-1">
                    {student.careerGoal?.primaryGoal === 'Placement' ? (
                      student.placementStatus?.isPlaced ? (
                        <span className="badge bg-success fs-6">Placed ({student.placementStatus?.placementType || 'Campus'})</span>
                      ) : (
                        <span className="badge bg-secondary fs-6">Not Placed</span>
                      )
                    ) : (
                      <span className="badge bg-light text-secondary border fs-6">Nil</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="card border-0 shadow-sm p-3 bg-white text-center rounded-3">
                  <span className="text-muted small text-uppercase fw-semibold">Career Goal</span>
                  <h6 className="fw-bold text-dark mb-0 mt-2">{student.careerGoal?.primaryGoal || 'Undecided'}</h6>
                </div>
              </div>
            </div>

            {/* Section 1: Personal & Category */}
            <div className="card border-0 shadow-sm mb-3 rounded-3">
              <div className="card-header bg-white py-2 px-3 fw-bold text-primary border-bottom">
                <i className="bi bi-person-lines-fill me-2"></i> 1. Personal & Category Details
              </div>
              <div className="card-body p-3">
                <div className="row g-3 small">
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Gender:</span>
                    <strong>{student.gender || 'Not specified'}</strong>
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Category:</span>
                    <strong>{student.studentCategory || 'Day Scholar'}</strong>
                    {student.studentCategory === 'Hosteller' && student.hostelName && (
                      <span className="text-muted"> ({student.hostelName})</span>
                    )}
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Distance from College:</span>
                    <strong>{student.distanceFromCollege ? `${student.distanceFromCollege} km` : '—'}</strong>
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Mobile:</span>
                    <strong>{student.mobileNumber || '—'}</strong>
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Personal Email:</span>
                    <strong>{student.personalEmail || '—'}</strong>
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Assigned Mentor:</span>
                    <strong className="text-primary">{student.mentorId?.name || 'Unassigned'}</strong>
                  </div>
                  <div className="col-12">
                    <span className="text-muted d-block">Residential Address:</span>
                    <span>{student.residentialAddress || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Parent & Family Details */}
            <div className="card border-0 shadow-sm mb-3 rounded-3">
              <div className="card-header bg-white py-2 px-3 fw-bold text-secondary border-bottom">
                <i className="bi bi-people me-2"></i> 2. Parent & Family Details (Confidential)
              </div>
              <div className="card-body p-3">
                <div className="row g-3 small">
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Father:</span>
                    <strong>{student.parentDetails?.fatherName || '—'}</strong>
                    <div className="text-muted">{student.parentDetails?.fatherOccupation || ''} {student.parentDetails?.fatherIncomeRange ? `(${student.parentDetails.fatherIncomeRange})` : ''}</div>
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Mother:</span>
                    <strong>{student.parentDetails?.motherName || '—'}</strong>
                    <div className="text-muted">{student.parentDetails?.motherOccupation || ''}</div>
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Emergency Contact:</span>
                    <strong>{student.parentDetails?.emergencyContact || '—'}</strong>
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">First-Gen Graduate:</span>
                    <strong>{student.parentDetails?.firstGenerationGraduate || 'No'}</strong>
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Scholarship Received:</span>
                    <strong>{student.parentDetails?.scholarshipReceived || 'No'}</strong>
                  </div>
                  <div className="col-sm-4">
                    <span className="text-muted d-block">Scholarship Guidance Required:</span>
                    <strong>{student.parentDetails?.financialGuidanceRequired || 'No'}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Semester Academic Performance */}
            <div className="card border-0 shadow-sm mb-3 rounded-3">
              <div className="card-header bg-white py-2 px-3 fw-bold text-primary border-bottom d-flex justify-content-between">
                <span><i className="bi bi-graph-up me-2"></i> 3. Semester-Wise Academic Progression</span>
                <span className="badge bg-light text-dark">CGPA: {student.currentCGPA || 0}</span>
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-sm table-bordered table-striped mb-0 text-center small">
                    <thead className="table-light">
                      <tr>
                        <th>Semester</th>
                        <th>SGPA</th>
                        <th>CGPA</th>
                        <th>Attendance %</th>
                        <th>Arrear Status</th>
                        <th>No. of Arrears</th>
                        <th>Achievements & Strong Subjects</th>
                      </tr>
                    </thead>
                    <tbody>
                      {student.semesters && student.semesters.length > 0 ? (
                        student.semesters.map((s, idx) => (
                          <tr key={idx}>
                            <td className="fw-bold">Sem {s.semesterNumber}</td>
                            <td>{s.sgpa}</td>
                            <td>{s.cgpa}</td>
                            <td>{s.attendancePercentage}%</td>
                            <td>
                              <span className={`badge ${s.arrearStatus === 'Yes' ? 'bg-danger' : 'bg-success'}`}>
                                {s.arrearStatus}
                              </span>
                            </td>
                            <td>{s.numberOfArrears}</td>
                            <td className="text-start">{s.academicAchievements || s.strongSubjects || '—'}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="text-center py-2 text-muted">No semester records uploaded yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section 4: Arrear Details History */}
            <div className="card border-0 shadow-sm mb-3 rounded-3">
              <div className="card-header bg-white py-2 px-3 fw-bold text-danger border-bottom">
                <i className="bi bi-clock-history me-2"></i> 4. Arrear History (Pending & Cleared)
              </div>
              <div className="card-body p-0">
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0 text-center small">
                    <thead className="table-light">
                      <tr>
                        <th>Sem Occurred</th>
                        <th>Subject Code</th>
                        <th>Subject Name</th>
                        <th>Attempts</th>
                        <th>Current Status</th>
                        <th>Sem Cleared</th>
                        <th>Grade</th>
                        <th>Remedial Needed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {student.arrears && student.arrears.length > 0 ? (
                        student.arrears.map((a, idx) => (
                          <tr key={idx} className={a.currentStatus === 'Pending' ? 'table-warning' : ''}>
                            <td>Sem {a.semesterOccurred}</td>
                            <td className="fw-bold">{a.subjectCode}</td>
                            <td className="text-start">{a.subjectName}</td>
                            <td>{a.numberOfAttempts}</td>
                            <td>
                              <span className={`badge ${a.currentStatus === 'Pending' ? 'bg-danger' : 'bg-success'}`}>
                                {a.currentStatus}
                              </span>
                            </td>
                            <td>{a.clearedSemester ? `Sem ${a.clearedSemester}` : '—'}</td>
                            <td>{a.gradeAfterClearing || '—'}</td>
                            <td>
                              <span className={`badge ${a.remedialSupportRequired === 'Yes' ? 'bg-warning text-dark' : 'bg-light text-muted'}`}>
                                {a.remedialSupportRequired}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="8" className="text-center py-2 text-success">
                            <i className="bi bi-check2-circle me-1"></i> No arrear history recorded. Clean academic track!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Section 5: Technical & Professional Profile */}
            <div className="card border-0 shadow-sm mb-3 rounded-3">
              <div className="card-header bg-white py-2 px-3 fw-bold text-dark border-bottom">
                <i className="bi bi-code-slash me-2"></i> 5. Technical & Professional Profile
              </div>
              <div className="card-body p-3 small">
                <div className="row g-3">
                  <div className="col-md-6">
                    <span className="text-muted d-block">Preferred Technical Domain:</span>
                    <strong>{student.technicalProfile?.domainInterest || 'Not specified'}</strong>
                  </div>
                  <div className="col-md-6">
                    <span className="text-muted d-block">Programming Languages:</span>
                    <div>
                      {student.technicalProfile?.programmingLanguages?.length > 0 ? (
                        student.technicalProfile.programmingLanguages.map((lang, idx) => (
                          <span key={idx} className="badge bg-secondary me-1">{lang}</span>
                        ))
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <span className="text-muted d-block">Certifications:</span>
                    <span>{student.technicalProfile?.certifications?.join(', ') || '—'}</span>
                  </div>
                  <div className="col-md-6">
                    <span className="text-muted d-block">Internship Experience:</span>
                    <span>{student.technicalProfile?.internshipExperience || '—'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Section 6: Final Career Goal */}
            <div className="card border-0 shadow-sm rounded-3">
              <div className="card-header bg-white py-2 px-3 fw-bold text-success border-bottom">
                <i className="bi bi-compass me-2"></i> 6. Career Pathway Details ({student.careerGoal?.primaryGoal || 'Undecided'})
              </div>
              <div className="card-body p-3 small">
                {student.careerGoal?.primaryGoal === 'Placement' && (
                  <div>
                    <div className="row g-2 mb-3">
                      <div className="col-sm-4"><span className="text-muted d-block">Target Role:</span> <strong>{student.careerGoal?.placement?.preferredRole || '—'}</strong></div>
                      <div className="col-sm-4"><span className="text-muted d-block">Target Companies:</span> <strong>{student.careerGoal?.placement?.targetCompanies || '—'}</strong></div>
                      <div className="col-sm-4"><span className="text-muted d-block">Expected Salary:</span> <strong>{student.careerGoal?.placement?.expectedSalaryRange || '—'}</strong></div>
                    </div>
                    {student.placementStatus?.isPlaced ? (
                      <div className="p-2 bg-success-subtle border border-success-subtle rounded-2 d-flex flex-wrap gap-3 align-items-center">
                        <span className="badge bg-success">Placed</span>
                        <span><strong>Company:</strong> {student.placementStatus?.companyName || '—'}</span>
                        <span><strong>Package:</strong> {student.placementStatus?.packageCTC ? `${student.placementStatus.packageCTC} LPA` : '—'}</span>
                        <span><strong>Mode:</strong> {student.placementStatus?.placementType || 'Campus'}</span>
                        <span><strong>Role:</strong> {student.placementStatus?.jobRole || '—'}</span>
                      </div>
                    ) : (
                      <span className="badge bg-secondary-subtle text-secondary border">Currently in Placement Preparation</span>
                    )}
                  </div>
                )}
                {student.careerGoal?.primaryGoal === 'Higher Studies' && (
                  <div className="row g-2">
                    <div className="col-sm-4"><span className="text-muted d-block">Destination:</span> <strong>{student.careerGoal?.higherStudies?.studyLocation || '—'} {student.careerGoal?.higherStudies?.preferredCountry ? `(${student.careerGoal.higherStudies.preferredCountry})` : ''}</strong></div>
                    <div className="col-sm-4"><span className="text-muted d-block">Target Programme:</span> <strong>{student.careerGoal?.higherStudies?.preferredProgramme || '—'}</strong></div>
                    <div className="col-sm-4"><span className="text-muted d-block">Target Institutions:</span> <strong>{student.careerGoal?.higherStudies?.targetInstitutions || '—'}</strong></div>
                    <div className="col-sm-4"><span className="text-muted d-block">Target Exam:</span> <strong>{student.careerGoal?.higherStudies?.targetExam || 'GRE / GATE / IELTS'}</strong></div>
                  </div>
                )}
                {student.careerGoal?.primaryGoal === 'Entrepreneurship' && (
                  <div className="row g-2">
                    <div className="col-sm-4"><span className="text-muted d-block">Startup Idea:</span> <strong>{student.careerGoal?.entrepreneurship?.startupIdea || '—'}</strong></div>
                    <div className="col-sm-4"><span className="text-muted d-block">Current Stage:</span> <span className="badge bg-primary">{student.careerGoal?.entrepreneurship?.currentStage || 'Idea Stage'}</span></div>
                    <div className="col-sm-4"><span className="text-muted d-block">Team Size:</span> <strong>{student.careerGoal?.entrepreneurship?.teamSize || '1 (Solo)'}</strong></div>
                    <div className="col-sm-4"><span className="text-muted d-block">Incubation / Mentorship:</span> <strong>{student.careerGoal?.entrepreneurship?.incubationRequired || 'Yes'}</strong></div>
                  </div>
                )}
                {(!student.careerGoal?.primaryGoal || student.careerGoal?.primaryGoal === 'Undecided') && (
                  <div className="text-muted py-2">
                    <i className="bi bi-info-circle me-1"></i> Career pathway is currently <strong>Undecided</strong>. Path-specific parameters are set to <strong>Nil</strong>.
                  </div>
                )}
              </div>
            </div>
            {/* Section 7: Mentor & Coordinator Remarks (for QS I-Gauge Excel 1 & Mentoring) */}
            <div className="card border-0 shadow-sm rounded-3">
              <div className="card-header bg-white py-2 px-3 fw-bold text-dark border-bottom d-flex justify-content-between align-items-center">
                <span>
                  <i className="bi bi-chat-square-quote-fill text-primary me-2"></i> 7. Mentor & Coordinator Remarks (QS I-Gauge)
                </span>
                {editingRemarks ? (
                  <button
                    className="btn btn-sm btn-primary py-0 px-2 fw-semibold"
                    disabled={savingRemarks}
                    onClick={handleSaveRemarks}
                  >
                    {savingRemarks ? 'Saving...' : 'Save Remarks'}
                  </button>
                ) : (
                  <button
                    className="btn btn-sm btn-outline-primary py-0 px-2 fw-semibold"
                    onClick={() => setEditingRemarks(true)}
                  >
                    <i className="bi bi-pencil-square me-1"></i> Edit Remarks
                  </button>
                )}
              </div>
              <div className="card-body p-3 small">
                {editingRemarks ? (
                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label text-muted fw-semibold mb-1">Placement Remarks (QS Col 10)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={remarksForm.placementRemarks}
                        onChange={(e) => setRemarksForm({ ...remarksForm, placementRemarks: e.target.value })}
                        placeholder="e.g. Cleared campus technical assessment"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-muted fw-semibold mb-1">Entrepreneurship Remarks (QS Col 14)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={remarksForm.entrepreneurshipRemarks}
                        onChange={(e) => setRemarksForm({ ...remarksForm, entrepreneurshipRemarks: e.target.value })}
                        placeholder="e.g. Registered with institutional MSME cell"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-muted fw-semibold mb-1">Higher Studies Remarks (QS Col 19)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={remarksForm.higherStudiesRemarks}
                        onChange={(e) => setRemarksForm({ ...remarksForm, higherStudiesRemarks: e.target.value })}
                        placeholder="e.g. Qualified GATE exam / Score 620"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label text-muted fw-semibold mb-1">General Mentoring Remarks</label>
                      <input
                        type="text"
                        className="form-control form-control-sm"
                        value={remarksForm.generalRemarks}
                        onChange={(e) => setRemarksForm({ ...remarksForm, generalRemarks: e.target.value })}
                        placeholder="e.g. Excellent academic progress and attendance"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="row g-2">
                    <div className="col-md-6">
                      <span className="text-muted d-block">Placement Remarks:</span>
                      <strong>{student.mentorRemarks?.placementRemarks || '—'}</strong>
                    </div>
                    <div className="col-md-6">
                      <span className="text-muted d-block">Entrepreneurship Remarks:</span>
                      <strong>{student.mentorRemarks?.entrepreneurshipRemarks || '—'}</strong>
                    </div>
                    <div className="col-md-6">
                      <span className="text-muted d-block">Higher Studies Remarks:</span>
                      <strong>{student.mentorRemarks?.higherStudiesRemarks || '—'}</strong>
                    </div>
                    <div className="col-md-6">
                      <span className="text-muted d-block">General Remarks:</span>
                      <strong>{student.mentorRemarks?.generalRemarks || '—'}</strong>
                    </div>
                    {student.mentorRemarks?.updatedByName && (
                      <div className="col-12 text-muted fst-italic mt-2" style={{ fontSize: '0.72rem' }}>
                        Last updated by {student.mentorRemarks.updatedByName} on{' '}
                        {new Date(student.mentorRemarks.updatedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer bg-white">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Close Profile</button>
          </div>
        </div>
      </div>
    </div>
  );
}
