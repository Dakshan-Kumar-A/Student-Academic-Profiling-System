import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import TicketSupportCenter from '../components/TicketSupportCenter';

export default function RoleDashboardPlaceholder({ roleTitle, roleName, user }) {
  const [activeTab, setActiveTab] = useState('tickets'); // 'overview' | 'tickets'

  return (
    <div className="min-vh-100 bg-light">
      <Navbar user={user} activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Sub-navbar */}
      <div className="bg-white border-bottom shadow-sm px-3 py-2 sticky-top">
        <div className="container-fluid d-flex flex-wrap justify-content-between align-items-center gap-2">
          <div className="btn-group btn-group-sm">
            <button
              className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('overview')}
            >
              <i className="bi bi-person-badge-fill me-1"></i> Student Portal Overview
            </button>
            <button
              className={`btn ${activeTab === 'tickets' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('tickets')}
            >
              <i className="bi bi-ticket-perforated-fill me-1"></i> Support & Issue Tickets
            </button>
          </div>
          <span className="small text-muted">
            Logged in as: <strong>{user?.name}</strong> ({user?.role})
          </span>
        </div>
      </div>

      <div className="container-fluid py-4 px-md-4">
        {activeTab === 'overview' && (
          <div className="card shadow-sm border-0 p-5 text-center bg-white rounded-3">
            <div className="mb-3">
              <i className="bi bi-mortarboard-fill text-primary" style={{ fontSize: '3.5rem' }}></i>
            </div>
            <h2 className="fw-bold mb-2">{roleTitle || 'Student Portal'}</h2>
            <p className="text-muted">
              Welcome, <strong>{user?.name}</strong> ({user?.email}) - Department: <strong>{user?.department || 'General'}</strong>
            </p>
            <div className="alert alert-info d-inline-block mx-auto py-2 px-4 mt-3">
              <i className="bi bi-info-circle me-2"></i>
              You are authenticated into the Student Academic & Career Profiling System.
            </div>
            <div className="mt-4">
              <button
                className="btn btn-primary px-4 py-2"
                onClick={() => setActiveTab('tickets')}
              >
                <i className="bi bi-ticket-detailed-fill me-2"></i> Open Support & Issue Desk
              </button>
            </div>
          </div>
        )}

        {activeTab === 'tickets' && (
          <TicketSupportCenter user={user} />
        )}
      </div>
    </div>
  );
}
