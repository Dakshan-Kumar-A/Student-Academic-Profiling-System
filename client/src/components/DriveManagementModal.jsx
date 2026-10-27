import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { coordinatorAPI } from '../services/api';

export default function DriveManagementModal({ drive, onClose, onRefresh }) {
  if (!drive) return null;

  const [activeSubTab, setActiveSubTab] = useState('overview'); // 'overview' | 'roles' | 'optins'
  const [editingRole, setEditingRole] = useState(null);
  const [showRoleForm, setShowRoleForm] = useState(false);

  // Role Form State
  const [roleForm, setRoleForm] = useState({
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
  });

  const now = new Date();
  const deadline = drive.optInDeadline ? new Date(drive.optInDeadline) : null;
  const isDeadlineExpired = deadline ? now > deadline : false;

  // ------------------------------------------
  // ROLE CRUD HANDLERS
  // ------------------------------------------
  const handleOpenAddRole = () => {
    setEditingRole(null);
    setRoleForm({
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
    });
    setShowRoleForm(true);
  };

  const handleOpenEditRole = (role) => {
    setEditingRole(role);
    setRoleForm({
      roleName: role.roleName || role.jobRole || '',
      ctc: role.ctc || role.salary || '',
      minCGPA: role.minCGPA || 0,
      standingArrearsAllowed: role.standingArrearsAllowed ?? role.arrearsAllowed === true ?? false,
      maxStandingArrears: role.maxStandingArrears ?? role.maxArrearsAllowed ?? 0,
      historyArrearsAllowed: role.historyArrearsAllowed ?? false,
      maxHistoryArrears: role.maxHistoryArrears ?? 0,
      arrearsAllowed: role.standingArrearsAllowed ?? role.arrearsAllowed === true ?? false,
      maxArrearsAllowed: role.maxStandingArrears ?? role.maxArrearsAllowed ?? 0,
      roleDescription: role.roleDescription || role.jobDescription || '',
      roleDuties: role.roleDuties || '',
      roleRequirements: role.roleRequirements || '',
      otherDetails: role.otherDetails || '',
      fileAttachment: role.fileAttachment || '',
    });
    setShowRoleForm(true);
  };

  const handleSaveRole = async (e) => {
    e.preventDefault();
    if (!roleForm.roleName.trim() || !roleForm.ctc.trim()) {
      Swal.fire('Required Fields', 'Please specify Role Name and CTC.', 'warning');
      return;
    }

    try {
      if (editingRole) {
        await coordinatorAPI.updateDriveRole(drive._id, editingRole._id, roleForm);
        Swal.fire('Updated', 'Job role updated successfully.', 'success');
      } else {
        await coordinatorAPI.addDriveRole(drive._id, roleForm);
        Swal.fire('Role Added', 'New job role added to drive.', 'success');
      }
      setShowRoleForm(false);
      onRefresh();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to save role.', 'error');
    }
  };

  const handleDeleteRole = (role) => {
    Swal.fire({
      title: 'Remove Job Role?',
      text: `Are you sure you want to remove role '${role.roleName || role.jobRole}' from this drive?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Yes, Remove',
    }).then(async (result) => {
      if (result.isConfirmed) {
        try {
          await coordinatorAPI.deleteDriveRole(drive._id, role._id);
          Swal.fire('Removed', 'Job role removed.', 'success');
          onRefresh();
        } catch (err) {
          Swal.fire('Error', err.response?.data?.message || 'Failed to remove role.', 'error');
        }
      }
    });
  };

  // ------------------------------------------
  // EXCEL DOWNLOAD HANDLER
  // ------------------------------------------
  const handleDownloadExcel = async () => {
    try {
      const res = await coordinatorAPI.downloadDriveExcel(drive._id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const safeComp = drive.companyName.replace(/[^a-zA-Z0-9_-]/g, '_');
      link.setAttribute('download', `${safeComp}_Drive_Details.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      Swal.fire('Success', 'Drive Excel workbook downloaded with Eligible & Opted-In sheets.', 'success');
    } catch (err) {
      Swal.fire('Error', 'Failed to download drive Excel sheet.', 'error');
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(3px)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg rounded-3">
          {/* Header */}
          <div className="modal-header bg-dark text-white py-3 px-4">
            <div className="d-flex align-items-center gap-3">
              <div className="bg-primary text-white rounded-circle p-2 fw-bold" style={{ width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="bi bi-building"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold mb-0">{drive.companyName}</h5>
                <small className="opacity-75">
                  <i className="bi bi-geo-alt me-1"></i>{drive.jobLocation || drive.location} • Dept: {drive.department}
                  <span className="badge bg-warning text-dark ms-2">Special Department Flag</span>
                </small>
              </div>
            </div>

            <div className="d-flex gap-2">
              <button className="btn btn-sm btn-success text-white fw-semibold" onClick={handleDownloadExcel}>
                <i className="bi bi-file-earmark-excel-fill me-1"></i> Download 2-Sheet Excel
              </button>
              <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
            </div>
          </div>

          {/* Sub-Nav Bar */}
          <div className="bg-light px-4 py-2 border-bottom d-flex justify-content-between align-items-center">
            <div className="btn-group btn-group-sm">
              <button className={`btn ${activeSubTab === 'overview' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setActiveSubTab('overview')}>
                <i className="bi bi-info-circle me-1"></i> Drive Overview & Form
              </button>
              <button className={`btn ${activeSubTab === 'roles' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setActiveSubTab('roles')}>
                <i className="bi bi-briefcase me-1"></i> Job Roles ({drive.roles?.length || 0})
              </button>
              <button className={`btn ${activeSubTab === 'optins' ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setActiveSubTab('optins')}>
                <i className="bi bi-person-check-fill me-1"></i> Opted-In Students ({drive.optIns?.filter(o => o.status === 'Opted-In').length || 0})
              </button>
            </div>

            <div>
              {isDeadlineExpired ? (
                <span className="badge bg-danger px-3 py-2">
                  <i className="bi bi-clock-history me-1"></i> Opt-In Closed (Deadline Passed)
                </span>
              ) : (
                <span className="badge bg-success px-3 py-2">
                  <i className="bi bi-clock me-1"></i> Opt-In Active until: {deadline ? deadline.toLocaleString() : 'N/A'}
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="modal-body p-4 bg-light">
            {/* SUB-TAB 1: OVERVIEW & CUSTOM FORM */}
            {activeSubTab === 'overview' && (
              <div>
                <div className="card shadow-sm border-0 rounded-3 mb-4 bg-white p-4">
                  <h6 className="fw-bold text-dark border-bottom pb-2">About the Company</h6>
                  <p className="text-muted mb-4">{drive.companyDescription || drive.aboutCompany || 'No description provided.'}</p>

                  <div className="row g-3">
                    <div className="col-12 col-md-4">
                      <div className="p-3 bg-light rounded border">
                        <span className="text-muted small d-block">Job Location</span>
                        <strong className="text-dark">{drive.jobLocation || drive.location}</strong>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="p-3 bg-light rounded border">
                        <span className="text-muted small d-block">Role Choice Limit Per Student</span>
                        <strong className="text-primary">{drive.maxRoleChoicesAllowed || 1} Role(s) Allowed</strong>
                      </div>
                    </div>
                    <div className="col-12 col-md-4">
                      <div className="p-3 bg-light rounded border">
                        <span className="text-muted small d-block">Opt-In Deadline</span>
                        <strong className={isDeadlineExpired ? 'text-danger' : 'text-success'}>
                          {deadline ? deadline.toLocaleString() : 'Not Set'}
                        </strong>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Details Form Defined by Coordinator */}
                <div className="card shadow-sm border-0 rounded-3 bg-white p-4">
                  <h6 className="fw-bold text-dark border-bottom pb-2">
                    <i className="bi bi-ui-radios-grid text-primary me-2"></i>
                    Extra Details Form for Opting-In Students
                  </h6>
                  {(!drive.customFormFields || drive.customFormFields.length === 0) ? (
                    <div className="text-muted small py-3">
                      No extra fields configured. Opting-in students will only select their desired job role(s).
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-hover align-middle mb-0 small">
                        <thead className="table-light">
                          <tr>
                            <th>Field Label</th>
                            <th>Field Type</th>
                            <th>Required?</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drive.customFormFields.map((cf, idx) => (
                            <tr key={idx}>
                              <td className="fw-semibold text-dark">{cf.fieldLabel}</td>
                              <td><span className="badge bg-light text-dark border text-uppercase">{cf.fieldType}</span></td>
                              <td>
                                {cf.isRequired ? (
                                  <span className="badge bg-danger">Mandatory</span>
                                ) : (
                                  <span className="badge bg-secondary">Optional</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SUB-TAB 2: ROLES CRUD */}
            {activeSubTab === 'roles' && (
              <div>
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold mb-0 text-dark">Job Roles in this Drive</h6>
                  <button className="btn btn-sm btn-primary" onClick={handleOpenAddRole}>
                    <i className="bi bi-plus-circle me-1"></i> Add Another Role
                  </button>
                </div>

                {showRoleForm && (
                  <div className="card shadow-sm border-primary mb-4 bg-white p-4">
                    <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                      <h6 className="fw-bold text-primary mb-0">{editingRole ? 'Edit Job Role' : 'Add New Job Role'}</h6>
                      <button className="btn-close" onClick={() => setShowRoleForm(false)}></button>
                    </div>

                    <form onSubmit={handleSaveRole}>
                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-semibold">Role Name *</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            required
                            placeholder="e.g. Full Stack Software Engineer"
                            value={roleForm.roleName}
                            onChange={(e) => setRoleForm({ ...roleForm, roleName: e.target.value })}
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-semibold">Package / CTC *</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            required
                            placeholder="e.g. 8.5 LPA or 6-9 LPA"
                            value={roleForm.ctc}
                            onChange={(e) => setRoleForm({ ...roleForm, ctc: e.target.value })}
                          />
                        </div>
                        <div className="col-12 col-md-3">
                          <label className="form-label small fw-semibold">Minimum CGPA *</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="10"
                            className="form-control form-control-sm"
                            required
                            value={roleForm.minCGPA}
                            onChange={(e) => setRoleForm({ ...roleForm, minCGPA: e.target.value })}
                          />
                        </div>

                        {/* Separate Entity: Standing Arrears */}
                        <div className="col-12 col-md-4">
                          <label className="form-label small fw-semibold">Standing Arrears Policy *</label>
                          <div className="d-flex align-items-center gap-2">
                            <select
                              className="form-select form-select-sm"
                              value={roleForm.standingArrearsAllowed ? 'true' : 'false'}
                              onChange={(e) => setRoleForm({ ...roleForm, standingArrearsAllowed: e.target.value === 'true', arrearsAllowed: e.target.value === 'true' })}
                            >
                              <option value="false">0 Standing (Clean Active)</option>
                              <option value="true">Standing Allowed</option>
                            </select>
                            {roleForm.standingArrearsAllowed && (
                              <input
                                type="number"
                                min="0"
                                max="10"
                                className="form-control form-control-sm"
                                placeholder="Max"
                                style={{ width: '75px' }}
                                value={roleForm.maxStandingArrears}
                                onChange={(e) => setRoleForm({ ...roleForm, maxStandingArrears: e.target.value, maxArrearsAllowed: e.target.value })}
                              />
                            )}
                          </div>
                        </div>

                        {/* Separate Entity: History of Arrears */}
                        <div className="col-12 col-md-5">
                          <label className="form-label small fw-semibold">History of Arrears Policy *</label>
                          <div className="d-flex align-items-center gap-2">
                            <select
                              className="form-select form-select-sm"
                              value={roleForm.historyArrearsAllowed ? 'true' : 'false'}
                              onChange={(e) => setRoleForm({ ...roleForm, historyArrearsAllowed: e.target.value === 'true' })}
                            >
                              <option value="false">No History (Never had arrears)</option>
                              <option value="true">History Allowed</option>
                            </select>
                            {roleForm.historyArrearsAllowed && (
                              <input
                                type="number"
                                min="0"
                                max="20"
                                className="form-control form-control-sm"
                                placeholder="Max all-time"
                                style={{ width: '90px' }}
                                value={roleForm.maxHistoryArrears}
                                onChange={(e) => setRoleForm({ ...roleForm, maxHistoryArrears: e.target.value })}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-12">
                          <label className="form-label small fw-semibold">Role Description</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows="2"
                            placeholder="Overview of the position..."
                            value={roleForm.roleDescription}
                            onChange={(e) => setRoleForm({ ...roleForm, roleDescription: e.target.value })}
                          ></textarea>
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-semibold">Role Duties</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows="2"
                            placeholder="Key duties and day-to-day responsibilities..."
                            value={roleForm.roleDuties}
                            onChange={(e) => setRoleForm({ ...roleForm, roleDuties: e.target.value })}
                          ></textarea>
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-semibold">Role Requirements / Tech Stack</label>
                          <textarea
                            className="form-control form-control-sm"
                            rows="2"
                            placeholder="Required tech skills, frameworks, degrees..."
                            value={roleForm.roleRequirements}
                            onChange={(e) => setRoleForm({ ...roleForm, roleRequirements: e.target.value })}
                          ></textarea>
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-semibold">Other Details / Perks</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="e.g. Free transport, health insurance, hybrid mode"
                            value={roleForm.otherDetails}
                            onChange={(e) => setRoleForm({ ...roleForm, otherDetails: e.target.value })}
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <label className="form-label small fw-semibold">File Attachment Link / Doc</label>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            placeholder="Link to JD PDF or document..."
                            value={roleForm.fileAttachment}
                            onChange={(e) => setRoleForm({ ...roleForm, fileAttachment: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="d-flex justify-content-end gap-2 mt-3 pt-2 border-top">
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setShowRoleForm(false)}>
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-sm btn-primary">
                          <i className="bi bi-check-lg me-1"></i> {editingRole ? 'Save Changes' : 'Add Role'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* Roles Listing Cards */}
                <div className="row g-3">
                  {(drive.roles || []).map((r, idx) => (
                    <div className="col-12 col-lg-6" key={r._id || idx}>
                      <div className="card shadow-sm border-0 h-100 bg-white p-3 rounded-3">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <div>
                            <h6 className="fw-bold text-primary mb-1">{r.roleName || r.jobRole}</h6>
                            <span className="badge bg-success-subtle text-success border border-success fw-bold me-2">
                              CTC: {r.ctc || r.salary}
                            </span>
                            <span className="badge bg-light text-dark border">
                              Min CGPA: {r.minCGPA || 0}
                            </span>
                          </div>
                          <div className="btn-group btn-group-sm">
                            <button className="btn btn-outline-secondary" onClick={() => handleOpenEditRole(r)} title="Edit role">
                              <i className="bi bi-pencil"></i>
                            </button>
                            <button className="btn btn-outline-danger" onClick={() => handleDeleteRole(r)} title="Remove role">
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>

                        <div className="d-flex flex-wrap gap-1 small mb-2">
                          {(r.standingArrearsAllowed || r.arrearsAllowed) ? (
                            <span className="badge bg-warning text-dark">
                              Standing Arrears ≤ {r.maxStandingArrears ?? r.maxArrearsAllowed ?? 0}
                            </span>
                          ) : (
                            <span className="badge bg-success-subtle text-success border border-success">
                              0 Standing Arrears
                            </span>
                          )}
                          {r.historyArrearsAllowed ? (
                            <span className="badge bg-info text-dark">
                              History Allowed (Max {r.maxHistoryArrears || 'Any'})
                            </span>
                          ) : (
                            <span className="badge bg-light text-muted border">
                              Clean History (No past arrears)
                            </span>
                          )}
                        </div>

                        {r.roleDescription && <p className="text-muted small mb-2">{r.roleDescription}</p>}

                        {r.roleDuties && (
                          <div className="small mb-1">
                            <strong className="text-dark">Duties:</strong> <span className="text-muted">{r.roleDuties}</span>
                          </div>
                        )}
                        {r.roleRequirements && (
                          <div className="small mb-1">
                            <strong className="text-dark">Requirements:</strong> <span className="text-muted">{r.roleRequirements}</span>
                          </div>
                        )}
                        {r.otherDetails && (
                          <div className="small mb-1">
                            <strong className="text-dark">Other Details:</strong> <span className="text-muted">{r.otherDetails}</span>
                          </div>
                        )}
                        {r.fileAttachment && (
                          <div className="small mt-2">
                            <a href={r.fileAttachment} target="_blank" rel="noreferrer" className="btn btn-sm btn-outline-primary py-0">
                              <i className="bi bi-paperclip me-1"></i> View Attachment
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SUB-TAB 3: OPTED-IN ROSTER */}
            {activeSubTab === 'optins' && (
              <div className="card shadow-sm border-0 rounded-3 bg-white p-3">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold text-dark mb-0">Student Opt-In Submissions</h6>
                  <button className="btn btn-sm btn-outline-success" onClick={handleDownloadExcel}>
                    <i className="bi bi-file-earmark-excel me-1"></i> Export 2-Sheet Excel
                  </button>
                </div>

                {(!drive.optIns || drive.optIns.length === 0) ? (
                  <div className="text-center py-5 text-muted">
                    <i className="bi bi-people fs-1 d-block mb-2"></i>
                    No student submissions recorded yet.
                  </div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover align-middle mb-0 small">
                      <thead className="table-light">
                        <tr>
                          <th>Roll Number</th>
                          <th>Student Name</th>
                          <th>CGPA</th>
                          <th>Arrears</th>
                          <th>Selected Role(s)</th>
                          <th>Status</th>
                          <th>Custom Form Responses</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drive.optIns.map((o, idx) => (
                          <tr key={idx}>
                            <td className="fw-bold font-monospace">{o.rollNumber}</td>
                            <td>
                              <div className="fw-bold text-dark">{o.studentName}</div>
                              <span className="text-muted" style={{ fontSize: '11px' }}>{o.email}</span>
                            </td>
                            <td><strong>{o.currentCGPA || 0}</strong></td>
                            <td>
                              {o.standingArrearsCount > 0 ? (
                                <span className="badge bg-danger">{o.standingArrearsCount}</span>
                              ) : (
                                <span className="badge bg-success">0</span>
                              )}
                            </td>
                            <td>
                              {(o.selectedRoles || []).map((r, rIdx) => (
                                <span key={rIdx} className="badge bg-primary me-1">{r}</span>
                              ))}
                            </td>
                            <td>
                              <span className={`badge ${o.status === 'Opted-In' ? 'bg-success' : 'bg-secondary'}`}>
                                {o.status}
                              </span>
                            </td>
                            <td>
                              {o.customFormResponses && Object.keys(o.customFormResponses).length > 0 ? (
                                <ul className="list-unstyled mb-0" style={{ fontSize: '11px' }}>
                                  {Object.entries(o.customFormResponses).map(([k, v], cIdx) => (
                                    <li key={cIdx}><strong>{k}:</strong> {v}</li>
                                  ))}
                                </ul>
                              ) : (
                                <span className="text-muted">None</span>
                              )}
                            </td>
                            <td className="text-muted" style={{ fontSize: '11px' }}>
                              {o.optedAt ? new Date(o.optedAt).toLocaleString() : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer bg-white py-2 px-4">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close Window
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
