import React, { useState } from 'react';
import Swal from 'sweetalert2';
import { coordinatorAPI } from '../services/api';

export default function CustomExcelExportModal({ filters, totalMatchingCount, onClose, customExportFn }) {
  const allFieldGroups = [
    {
      group: '1. Basic & Personal Details',
      fields: [
        { key: 'rollNumber', label: 'Roll Number' },
        { key: 'name', label: 'Student Name' },
        { key: 'email', label: 'Institutional Email' },
        { key: 'personalEmail', label: 'Personal Email' },
        { key: 'mobileNumber', label: 'Mobile Number' },
        { key: 'department', label: 'Department' },
        { key: 'section', label: 'Section' },
        { key: 'batch', label: 'Batch' },
        { key: 'gender', label: 'Gender' },
        { key: 'studentCategory', label: 'Category (Day Scholar / Hosteller)' },
        { key: 'hostelName', label: 'Hostel Name' },
        { key: 'distanceFromCollege', label: 'Distance from College' },
      ],
    },
    {
      group: '2. Academic Progression',
      fields: [
        { key: 'currentCGPA', label: 'Current CGPA' },
        { key: 'standingArrearsCount', label: 'Standing Arrears Count' },
        { key: 'semestersCount', label: 'Semesters Completed' },
      ],
    },
    {
      group: '3. Placement & Offers',
      fields: [
        { key: 'isPlaced', label: 'Placement Status (Placed / Unplaced)' },
        { key: 'placementType', label: 'Placement Mode (On / Off Campus)' },
        { key: 'companyName', label: 'Placed Company Name' },
        { key: 'packageCTC', label: 'Package (LPA)' },
        { key: 'jobRole', label: 'Placed Job Role' },
      ],
    },
    {
      group: '4. Career Goals & Higher Studies',
      fields: [
        { key: 'primaryGoal', label: 'Primary Career Goal' },
        { key: 'studyLocation', label: 'Higher Studies Destination (India / Abroad)' },
        { key: 'preferredProgramme', label: 'Target Programme' },
        { key: 'targetInstitutions', label: 'Target Institutions' },
        { key: 'startupIdea', label: 'Startup Idea' },
        { key: 'startupStage', label: 'Startup Stage' },
      ],
    },
    {
      group: '5. Technical Skills & Mentorship',
      fields: [
        { key: 'domainInterest', label: 'Technical Domain' },
        { key: 'programmingLanguages', label: 'Programming Languages' },
        { key: 'certifications', label: 'Completed Certifications' },
        { key: 'mentorName', label: 'Assigned Faculty Mentor' },
      ],
    },
  ];

  // Default selected fields
  const [selectedFields, setSelectedFields] = useState([
    'rollNumber', 'name', 'email', 'department', 'section', 'studentCategory',
    'currentCGPA', 'standingArrearsCount', 'isPlaced', 'placementType',
    'companyName', 'packageCTC', 'primaryGoal', 'domainInterest', 'mentorName'
  ]);

  const [downloading, setDownloading] = useState(false);

  const toggleField = (key) => {
    if (selectedFields.includes(key)) {
      setSelectedFields(selectedFields.filter((k) => k !== key));
    } else {
      setSelectedFields([...selectedFields, key]);
    }
  };

  const handleSelectAll = () => {
    const allKeys = allFieldGroups.flatMap((g) => g.fields.map((f) => f.key));
    setSelectedFields(allKeys);
  };

  const handleClearAll = () => {
    setSelectedFields([]);
  };

  const applyPreset = (presetName) => {
    if (presetName === 'placement') {
      setSelectedFields(['rollNumber', 'name', 'email', 'department', 'currentCGPA', 'standingArrearsCount', 'isPlaced', 'placementType', 'companyName', 'packageCTC', 'domainInterest', 'programmingLanguages']);
    } else if (presetName === 'academic') {
      setSelectedFields(['rollNumber', 'name', 'department', 'section', 'studentCategory', 'currentCGPA', 'standingArrearsCount', 'semestersCount', 'mentorName']);
    } else if (presetName === 'contact') {
      setSelectedFields(['rollNumber', 'name', 'email', 'personalEmail', 'mobileNumber', 'department', 'section', 'studentCategory', 'hostelName']);
    }
  };

  const handleDownload = async () => {
    if (selectedFields.length === 0) {
      Swal.fire('No Fields Selected', 'Please select at least one column for the Excel file.', 'warning');
      return;
    }

    setDownloading(true);
    try {
      const response = customExportFn
        ? await customExportFn({ filters, fields: selectedFields, chosenFields: selectedFields })
        : await coordinatorAPI.exportCustomExcel({ filters, fields: selectedFields });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Custom_Students_Export_${Date.now()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      onClose();
      Swal.fire({
        icon: 'success',
        title: 'Excel Download Complete',
        text: `Exported ${totalMatchingCount || 'filtered'} students with ${selectedFields.length} selected fields.`,
        timer: 2000,
        showConfirmButton: false,
      });
    } catch (err) {
      Swal.fire('Download Failed', err.response?.data?.message || 'Failed to generate Excel file.', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(15, 23, 42, 0.75)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content shadow border-0 rounded-3">
          <div className="modal-header bg-success text-white py-3 px-4">
            <div>
              <h5 className="modal-title fw-bold mb-0">
                <i className="bi bi-file-earmark-excel-fill me-2"></i> Custom Excel Export Builder
              </h5>
              <span className="small opacity-75">
                Choose exactly which fields and columns you want in your Excel download.
              </span>
            </div>
            <button type="button" className="btn-close btn-close-white" onClick={onClose}></button>
          </div>

          <div className="modal-body p-4 bg-light">
            {/* Quick Action Presets */}
            <div className="d-flex flex-wrap justify-content-between align-items-center p-3 bg-white border rounded mb-3 gap-2">
              <div className="d-flex align-items-center gap-1">
                <span className="small fw-bold text-muted me-2">Quick Presets:</span>
                <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => applyPreset('placement')}>
                  Placement Drive
                </button>
                <button type="button" className="btn btn-sm btn-outline-info" onClick={() => applyPreset('academic')}>
                  Academic Audit
                </button>
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => applyPreset('contact')}>
                  Contact Directory
                </button>
              </div>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-sm btn-outline-success" onClick={handleSelectAll}>
                  Select All
                </button>
                <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleClearAll}>
                  Clear All
                </button>
              </div>
            </div>

            <div className="d-flex justify-content-between align-items-center mb-3">
              <span className="small text-muted">
                Fields Selected: <strong className="text-primary">{selectedFields.length} columns</strong>
              </span>
              <span className="badge bg-primary px-3 py-1">
                Target: {totalMatchingCount !== undefined ? `${totalMatchingCount} Students Matching Active Filters` : 'All Filtered Students'}
              </span>
            </div>

            {/* Field Category Checkbox Groups */}
            {allFieldGroups.map((groupObj, gIdx) => (
              <div key={gIdx} className="card border shadow-none mb-3 rounded-3">
                <div className="card-header bg-white py-2 px-3 fw-bold small text-secondary">
                  {groupObj.group}
                </div>
                <div className="card-body p-3">
                  <div className="row g-2">
                    {groupObj.fields.map((f) => (
                      <div key={f.key} className="col-12 col-md-6 col-lg-4">
                        <div className="form-check small">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`chk_${f.key}`}
                            checked={selectedFields.includes(f.key)}
                            onChange={() => toggleField(f.key)}
                          />
                          <label className="form-check-label text-dark" htmlFor={`chk_${f.key}`}>
                            {f.label}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            <div className="alert alert-secondary py-2 small mb-0">
              <i className="bi bi-shield-lock-fill me-1 text-success"></i>
              <strong>Privacy Protection:</strong> Sensitive private details (parent contact numbers, exact household income, and password hashes) are strictly excluded from all exports.
            </div>
          </div>

          <div className="modal-footer bg-white py-3">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={downloading}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success btn-sm px-4 fw-semibold"
              onClick={handleDownload}
              disabled={downloading || selectedFields.length === 0}
            >
              {downloading ? (
                <span><span className="spinner-border spinner-border-sm me-2"></span>Generating File...</span>
              ) : (
                <span><i className="bi bi-download me-2"></i>Download Custom Excel ({selectedFields.length} Columns)</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
