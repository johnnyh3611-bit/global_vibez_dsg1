/**
 * Audit Log Viewer
 * 
 * Displays staff action history for accountability.
 * Manager+ access required.
 */

import React, { useState, useEffect } from 'react';
import { ManagerOrAbove } from './PermissionGuard';
import './AuditLog.css';

const AuditLogViewer = () => {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    actionType: '',
    employeeId: '',
    limit: 100
  });

  useEffect(() => {
    fetchLogs();
    fetchStats();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchLogs, 60000);
    return () => clearInterval(interval);
  }, [filter]);

  const fetchLogs = async () => {
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      
      const params = new URLSearchParams({
        limit: filter.limit.toString(),
        ...(filter.actionType && { action_type: filter.actionType }),
        ...(filter.employeeId && { employee_id: filter.employeeId })
      });
      
      const res = await fetch(`${apiUrl}/api/v1/admin/audit-logs?${params}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setLogs(data?.logs || []);
      }
      
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      
      const res = await fetch(`${apiUrl}/api/v1/admin/audit-stats`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch audit stats:', err);
    }
  };

  const getActionIcon = (actionType) => {
    const icons = {
      'PAYOUT_APPROVE': '✅',
      'PAYOUT_REJECT': '❌',
      'PAYOUT_COMPLETE': '💰',
      'STAFF_INVITE': '📧',
      'STAFF_ROLE_CHANGE': '🔄',
      'STAFF_REVOKE': '🗑️',
      'USER_BAN': '🚫',
      'USER_UNBAN': '✔️',
      'COIN_ADJUST': '💸',
      'GAME_RESET': '🔃',
      'CONFIG_CHANGE': '⚙️'
    };
    return icons[actionType] || '📝';
  };

  const getActionColor = (actionType) => {
    if (actionType.includes('APPROVE') || actionType.includes('UNBAN')) return 'green';
    if (actionType.includes('REJECT') || actionType.includes('BAN') || actionType.includes('REVOKE')) return 'red';
    if (actionType.includes('CHANGE') || actionType.includes('ADJUST')) return 'yellow';
    return 'blue';
  };

  if (loading) {
    return (
      <div className="audit-log-widget loading">
        <div className="loader-spinner"></div>
        <p>Loading audit logs...</p>
      </div>
    );
  }

  return (
    <ManagerOrAbove fallback={
      <div className="access-denied">
        <h2>🔒 Manager Access Required</h2>
        <p>Audit logs are only available to Managers and above.</p>
      </div>
    }>
      <div className="audit-log-widget">
        <div className="widget-header">
          <h2>📋 Staff Action History</h2>
          <button onClick={fetchLogs} className="refresh-btn">🔄</button>
        </div>
        
        {/* Stats Overview */}
        {stats && (
          <div className="audit-stats">
            <div className="stat-pill">
              <span className="stat-label">Total Actions:</span>
              <span className="stat-value">{stats.total_logs?.toLocaleString()}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Staff Members:</span>
              <span className="stat-value">{stats.by_employee?.length || 0}</span>
            </div>
            <div className="stat-pill">
              <span className="stat-label">Action Types:</span>
              <span className="stat-value">{stats.by_action_type?.length || 0}</span>
            </div>
          </div>
        )}
        
        {/* Filters */}
        <div className="audit-filters">
          <select 
            value={filter.actionType}
            onChange={(e) => setFilter({...filter, actionType: e.target.value})}
            className="filter-select"
          >
            <option value="">All Actions</option>
            <option value="PAYOUT_APPROVE">Payout Approved</option>
            <option value="PAYOUT_REJECT">Payout Rejected</option>
            <option value="STAFF_ROLE_CHANGE">Role Changed</option>
            <option value="USER_BAN">User Banned</option>
            <option value="COIN_ADJUST">Coins Adjusted</option>
          </select>
          
          <select 
            value={filter.limit}
            onChange={(e) => setFilter({...filter, limit: Number(e.target.value)})}
            className="filter-select"
          >
            <option value={50}>Last 50</option>
            <option value={100}>Last 100</option>
            <option value={500}>Last 500</option>
            <option value={1000}>Last 1000</option>
          </select>
        </div>
        
        {/* Audit Log Table */}
        {logs.length === 0 ? (
          <div className="empty-state">
            <p>✨ No audit logs found</p>
          </div>
        ) : (
          <div className="audit-table-container">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Employee</th>
                  <th>Action</th>
                  <th>Details</th>
                  <th>Target</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, idx) => (
                  <tr key={`log-${log.timestamp}-${log.employee_id}-${idx}`} className={`action-${getActionColor(log.action_type)}`}>
                    <td className="time-cell">
                      {new Date(log.timestamp).toLocaleDateString()}
                      <br />
                      <small>{new Date(log.timestamp).toLocaleTimeString()}</small>
                    </td>
                    <td className="employee-cell">
                      <strong>{log.employee_name}</strong>
                      <br />
                      <small>{log.employee_id?.slice(0, 8)}...</small>
                    </td>
                    <td>
                      <span className={`action-badge ${getActionColor(log.action_type)}`}>
                        {getActionIcon(log.action_type)} {log.action_label}
                      </span>
                    </td>
                    <td className="detail-cell">
                      {log.action_detail}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <details className="metadata-details">
                          <summary>View Details</summary>
                          <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                        </details>
                      )}
                    </td>
                    <td className="target-cell">
                      {log.target_type && log.target_id ? (
                        <>
                          <span className="target-type">{log.target_type}</span>
                          <br />
                          <small>{log.target_id}</small>
                        </>
                      ) : (
                        <span className="no-target">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </ManagerOrAbove>
  );
};

export default AuditLogViewer;
