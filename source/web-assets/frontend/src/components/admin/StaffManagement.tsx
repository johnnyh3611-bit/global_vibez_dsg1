/**
 * Staff Management Component
 * 
 * God-Mode only interface for:
 * - Inviting new staff members
 * - Setting role levels
 * - Managing staff accounts
 */

import React, { useState, useEffect } from 'react';
import { GodModeOnly } from './PermissionGuard';
import './StaffManagement.css';

const StaffManagement = () => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState(1); // Default to Floor Staff
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);

  const roleOptions = [
    { value: 1, label: 'Level 1: Floor Staff', description: 'Chat support, basic player help' },
    { value: 2, label: 'Level 2: Manager', description: 'Game management, user moderation' },
    { value: 3, label: 'Level 3: God-Mode', description: 'Full access (use with caution!)' }
  ];

  useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      
      const res = await fetch(`${apiUrl}/api/v1/admin/staff-list`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setStaffList(data?.staff || []);
      }
    } catch (err) {
      console.error('Failed to fetch staff:', err);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail || !inviteEmail.includes('@')) {
      alert('Please enter a valid email address');
      return;
    }
    
    setLoading(true);
    
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      
      const res = await fetch(`${apiUrl}/api/v1/admin/invite-staff`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: inviteEmail,
          role_level: selectedRole
        })
      });
      
      if (res.ok) {
        alert('✅ Invite sent! They can now set up their account.');
        setInviteEmail('');
        fetchStaff();
      } else {
        const error = await res.json();
        alert(`❌ Error: ${error.detail || 'Failed to send invite'}`);
      }
    } catch (err) {
      alert(`❌ Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const changeStaffRole = async (staffId, newRole) => {
    if (!window.confirm(`Change this staff member's role to Level ${newRole}?`)) {
      return;
    }
    
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      
      const res = await fetch(`${apiUrl}/api/v1/admin/staff/${staffId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ role_level: newRole })
      });
      
      if (res.ok) {
        alert('✅ Role updated successfully');
        fetchStaff();
      } else {
        alert('❌ Failed to update role');
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  const revokeStaffAccess = async (staffId) => {
    if (!window.confirm('Remove this staff member\'s access? They will become a regular user.')) {
      return;
    }
    
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      
      const res = await fetch(`${apiUrl}/api/v1/admin/staff/${staffId}/revoke`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        alert('✅ Staff access revoked');
        fetchStaff();
      } else {
        alert('❌ Failed to revoke access');
      }
    } catch (err) {
      alert(`❌ Error: ${err.message}`);
    }
  };

  return (
    <GodModeOnly fallback={
      <div className="access-denied">
        <h2>🔒 God-Mode Access Required</h2>
        <p>Only the Founder can manage staff members.</p>
      </div>
    }>
      <div className="staff-management-panel">
        <h2>👥 Staff Control Center</h2>
        <p className="panel-subtitle">Manage team access and permissions</p>
        
        {/* Invite New Staff */}
        <div className="invite-section">
          <h3>Invite New Staff Member</h3>
          
          <div className="invite-form">
            <input 
              type="email" 
              placeholder="employee@example.com" 
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="email-input"
            />
            
            <select 
              value={selectedRole}
              onChange={(e) => setSelectedRole(Number(e.target.value))}
              className="role-select"
            >
              {roleOptions.map(role => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
            
            <button 
              onClick={sendInvite}
              disabled={loading}
              className="invite-btn"
            >
              {loading ? '⏳ Sending...' : '📧 Generate Invite Link'}
            </button>
          </div>
          
          <div className="role-descriptions">
            {roleOptions.map(role => (
              <div key={role.value} className="role-desc">
                <strong>{role.label}:</strong> {role.description}
              </div>
            ))}
          </div>
        </div>
        
        {/* Current Staff List */}
        <div className="staff-list-section">
          <h3>Current Staff ({staffList.length})</h3>
          
          {staffList.length === 0 ? (
            <p className="empty-message">No staff members yet. Invite your first team member above!</p>
          ) : (
            <table className="staff-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map(staff => (
                  <tr key={staff.id}>
                    <td><strong>{staff.username || 'Pending'}</strong></td>
                    <td>{staff.email}</td>
                    <td>
                      <span className={`role-badge level-${staff.role_level}`}>
                        Level {staff.role_level}: {staff.role_name}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${staff.status}`}>
                        {staff.status === 'active' ? '✅ Active' : '⏳ Pending Setup'}
                      </span>
                    </td>
                    <td>{new Date(staff.created_at).toLocaleDateString()}</td>
                    <td>
                      <div className="action-btns">
                        <select 
                          onChange={(e) => changeStaffRole(staff.id, Number(e.target.value))}
                          defaultValue={staff.role_level}
                          className="role-change-select"
                        >
                          <option value={1}>Level 1</option>
                          <option value={2}>Level 2</option>
                          <option value={3}>Level 3</option>
                        </select>
                        <button 
                          onClick={() => revokeStaffAccess(staff.id)}
                          className="revoke-btn"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </GodModeOnly>
  );
};

export default StaffManagement;
