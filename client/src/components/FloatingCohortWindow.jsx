import React, { useState } from 'react';

export default function FloatingCohortWindow({
  isOpen = true,
  onClose,
  onOpen,
  filteredStudents = [],
  studentData = [],
  cohortData = [],
  activeFiltersSummary = '',
  onViewStudent,
  onSelectStudent,
}) {
  // Modes: 'normal' (floating bottom-right box), 'maximized' (full-screen modal overlay), 'minimized' (dock pill)
  const [windowMode, setWindowMode] = useState('normal');
  const [searchTerm, setSearchTerm] = useState('');

  // Normalize student dataset from filteredStudents, studentData, or cohortData
  const rawStudents = (Array.isArray(filteredStudents) && filteredStudents.length > 0)
    ? filteredStudents
    : (Array.isArray(studentData) && studentData.length > 0)
    ? studentData
    : (Array.isArray(cohortData) && cohortData.length > 0)
    ? cohortData
    : (Array.isArray(filteredStudents) ? filteredStudents : []);

  const isActuallyOpen = isOpen !== false;

  if (!isActuallyOpen) {
    return (
      <button
        type="button"
        className="btn btn-primary shadow-lg rounded-pill px-3 py-2 position-fixed d-flex align-items-center gap-2"
        style={{
          bottom: '24px',
          right: '24px',
          zIndex: 1040,
          border: '2px solid rgba(255, 255, 255, 0.4)',
          boxShadow: '0 8px 24px rgba(37, 99, 235, 0.35)',
        }}
        onClick={onOpen}
        title="Open Student Records Floating Window"
      >
        <i className="bi bi-people-fill fs-6"></i>
        <span className="fw-bold small">Student Records</span>
        <span className="badge bg-white text-primary rounded-pill fw-bold">
          {rawStudents.length}
        </span>
      </button>
    );
  }

  // MINIMIZED MODE: Docked bottom-right pill
  if (windowMode === 'minimized') {
    return (
      <div
        className="position-fixed bg-white border border-primary shadow-lg rounded-pill px-3 py-2 d-flex align-items-center gap-3"
        style={{
          bottom: '24px',
          right: '24px',
          zIndex: 1050,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
        }}
      >
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-primary rounded-circle p-2">
            <i className="bi bi-people-fill text-white"></i>
          </span>
          <div>
            <strong className="text-dark small d-block">Student Records</strong>
            <small className="text-muted" style={{ fontSize: '11px' }}>
              {rawStudents.length} students matched
            </small>
          </div>
        </div>

        <div className="d-flex gap-1">
          <button
            type="button"
            className="btn btn-sm btn-outline-primary rounded-circle p-1"
            style={{ width: '28px', height: '28px', lineHeight: '1' }}
            onClick={() => setWindowMode('normal')}
            title="Restore Window"
          >
            <i className="bi bi-arrows-angle-expand"></i>
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary rounded-circle p-1"
            style={{ width: '28px', height: '28px', lineHeight: '1' }}
            onClick={onClose}
            title="Close Window"
          >
            <i className="bi bi-x"></i>
          </button>
        </div>
      </div>
    );
  }

  // Requirement 2: Sort students by roll number by default, no matter what filter is applied
  const sortedStudents = [...rawStudents].sort((a, b) => {
    const rA = (a?.rollNumber || '').toString();
    const rB = (b?.rollNumber || '').toString();
    return rA.localeCompare(rB, undefined, { numeric: true, sensitivity: 'base' });
  });

  // Filter local search inside table
  const displayedStudents = sortedStudents.filter((st) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const mentorName = typeof st?.mentor === 'object' ? st?.mentor?.name : st?.mentor;
    return (
      st?.name?.toLowerCase().includes(term) ||
      st?.rollNumber?.toLowerCase().includes(term) ||
      st?.email?.toLowerCase().includes(term) ||
      st?.technicalProfile?.domainInterest?.toLowerCase().includes(term) ||
      mentorName?.toLowerCase().includes(term)
    );
  });

  const handleStudentView = (st) => {
    if (typeof onViewStudent === 'function') {
      onViewStudent(st.fullProfile || st);
    }
    if (typeof onSelectStudent === 'function') {
      onSelectStudent(st._id || st.id || st);
    }
  };

  const isMaximized = windowMode === 'maximized';

  // Container styling depending on normal vs maximized
  const containerStyle = isMaximized
    ? {
        position: 'fixed',
        top: '20px',
        left: '20px',
        right: '20px',
        bottom: '20px',
        zIndex: 1060,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
      }
    : {
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: '840px',
        maxWidth: '92vw',
        height: '520px',
        maxHeight: '85vh',
        zIndex: 1050,
        boxShadow: '0 20px 40px rgba(15, 23, 42, 0.25)',
      };

  return (
    <>
      {/* Backdrop for maximized view */}
      {isMaximized && (
        <div
          className="position-fixed top-0 start-0 w-100 h-100"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(3px)', zIndex: 1055 }}
          onClick={() => setWindowMode('normal')}
        />
      )}

      <div
        className="card border-0 rounded-3 d-flex flex-column bg-white overflow-hidden animate__animated animate__fadeInUp"
        style={containerStyle}
      >
        {/* Floating Header */}
        <div className="card-header bg-primary text-white py-2 px-3 d-flex justify-content-between align-items-center shadow-sm">
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-people-fill fs-5"></i>
            <div>
              <span className="fw-bold small d-block">
                Student Records
              </span>
              <small className="opacity-75" style={{ fontSize: '11px' }}>
                Reflecting Analytical Filters • Sorted by Roll Number • {rawStudents.length} Students
              </small>
            </div>
          </div>

          {/* Window Control Buttons */}
          <div className="d-flex align-items-center gap-2">
            {/* Minimize */}
            <button
              type="button"
              className="btn btn-sm btn-link text-white p-1 text-decoration-none"
              onClick={() => setWindowMode('minimized')}
              title="Minimize to dock pill"
            >
              <i className="bi bi-dash-lg"></i>
            </button>

            {/* Maximize / Restore */}
            <button
              type="button"
              className="btn btn-sm btn-link text-white p-1 text-decoration-none"
              onClick={() => setWindowMode(isMaximized ? 'normal' : 'maximized')}
              title={isMaximized ? 'Restore to small floating window' : 'Maximize window'}
            >
              <i className={`bi ${isMaximized ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'}`}></i>
            </button>

            {/* Close */}
            <button
              type="button"
              className="btn btn-sm btn-link text-white p-1 text-decoration-none"
              onClick={onClose}
              title="Close floating window"
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        </div>

        {/* Toolbar Bar */}
        <div className="px-3 py-2 bg-light border-bottom d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="d-flex align-items-center gap-2 flex-grow-1" style={{ maxWidth: '350px' }}>
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-white border-end-0">
                <i className="bi bi-search text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search name, roll no, mentor, domain..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={() => setSearchTerm('')}
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="d-flex align-items-center gap-2">
            <span className="badge bg-white text-dark border px-2 py-1 small">
              Showing {displayedStudents.length} of {rawStudents.length} records
            </span>
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle px-2 py-1 small">
              <i className="bi bi-arrow-repeat me-1"></i> Live Filter Synced
            </span>
          </div>
        </div>

        {/* Table Body (Scrollable) */}
        <div className="card-body p-0 flex-grow-1 overflow-auto">
          {displayedStudents.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <i className="bi bi-filter-circle fs-1 text-secondary d-block mb-2"></i>
              <p className="mb-1 fw-semibold">No students found matching current filters.</p>
              <small>Try adjusting the filters in the Analytical Intelligence toolbar above.</small>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0 small">
                <thead className="table-light text-muted small text-uppercase sticky-top" style={{ top: 0, zIndex: 1 }}>
                  <tr>
                    <th>Roll Number</th>
                    <th>Student Name</th>
                    <th>Sec / Cat</th>
                    <th>CGPA</th>
                    <th>Arrears</th>
                    <th>Placement Status</th>
                    <th>Career Goal</th>
                    <th>Domain</th>
                    <th>Assigned Mentor</th>
                    <th className="text-end">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStudents.map((st) => (
                    <tr key={st._id}>
                      <td className="fw-bold font-monospace text-primary">{st.rollNumber}</td>
                      <td>
                        <div className="fw-bold text-dark">{st.name}</div>
                        <div className="text-muted" style={{ fontSize: '11px' }}>{st.email}</div>
                      </td>
                      <td>
                        <span className="badge bg-light text-dark border me-1">Sec {st.section || 'A'}</span>
                        <span className="badge bg-secondary-subtle text-secondary">{st.studentCategory || 'Day Scholar'}</span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            st.currentCGPA >= 8.5
                              ? 'bg-success'
                              : st.currentCGPA >= 7.0
                              ? 'bg-primary'
                              : st.currentCGPA >= 6.0
                              ? 'bg-warning text-dark'
                              : 'bg-danger'
                          }`}
                        >
                          {st.currentCGPA}
                        </span>
                      </td>
                      <td>
                        <div className="d-flex flex-column gap-1">
                          {st.standingArrearsCount > 0 ? (
                            <span className="badge bg-danger" title="Standing / Pending Arrears">{st.standingArrearsCount} Standing</span>
                          ) : (
                            <span className="badge bg-success-subtle text-success border border-success">0 Standing</span>
                          )}
                          <span className="badge bg-light text-muted border" style={{ fontSize: '10px' }} title="Total Arrears in Academic History">
                            History: {st.historyArrearsCount ?? (st.standingArrearsCount || 0)}
                          </span>
                        </div>
                      </td>
                      <td>
                        {st.careerGoal?.primaryGoal === 'Placement' ? (
                          st.placementStatus?.isPlaced ? (
                            <div>
                              <span className="badge bg-success">{st.placementStatus.placementType || 'Placed'}</span>
                              <div className="fw-semibold text-dark mt-1" style={{ fontSize: '11px' }}>
                                {st.placementStatus.companyName} ({st.placementStatus.packageCTC} LPA)
                              </div>
                            </div>
                          ) : (
                            <span className="badge bg-light text-muted border">Unplaced</span>
                          )
                        ) : (
                          <span className="badge bg-light text-secondary border">Nil</span>
                        )}
                      </td>
                      <td>
                        <span className="badge bg-info-subtle text-info-emphasis border border-info">
                          {st.careerGoal?.primaryGoal || 'Undecided'}
                        </span>
                        {st.careerGoal?.primaryGoal === 'Higher Studies' && (
                          <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                            {st.careerGoal?.higherStudies?.studyLocation || 'India'} ({st.careerGoal?.higherStudies?.targetExam || 'GRE/GATE'})
                          </div>
                        )}
                        {st.careerGoal?.primaryGoal === 'Entrepreneurship' && (
                          <div className="text-muted mt-1" style={{ fontSize: '11px' }}>
                            {st.careerGoal?.entrepreneurship?.currentStage || 'Idea Stage'}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="text-secondary fw-semibold">
                          {st.technicalProfile?.domainInterest || 'General'}
                        </span>
                      </td>
                      <td>
                        {st.mentor ? (
                          <span className="text-primary fw-semibold">
                            {typeof st.mentor === 'object' ? st.mentor.name : st.mentor}
                          </span>
                        ) : (
                          <span className="badge bg-warning text-dark">Unassigned</span>
                        )}
                      </td>
                      <td className="text-end">
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => handleStudentView(st)}
                          title="Open full student academic and career profile"
                        >
                          <i className="bi bi-eye-fill me-1"></i> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="card-footer bg-light py-2 px-3 border-top d-flex justify-content-between align-items-center">
          <small className="text-muted">
            <i className="bi bi-info-circle me-1"></i> Click <strong>View</strong> to open a student's full semester progression, arrears, and preferences.
          </small>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={() => setWindowMode(isMaximized ? 'normal' : 'maximized')}
            >
              <i className={`bi ${isMaximized ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'} me-1`}></i>
              {isMaximized ? 'Small Window' : 'Full Screen'}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
