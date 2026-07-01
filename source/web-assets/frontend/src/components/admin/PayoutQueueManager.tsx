/**
 * Payout Queue Manager
 * 
 * Displays pending payouts in 72-hour security hold.
 * Allows God-Mode users to approve/reject payouts.
 */

import React, { useState, useEffect } from 'react';
import './RevenueDashboard.css';

const PayoutQueueManager = () => {
  const [payouts, setPayouts] = useState({
    ready: [],
    waiting: [],
    all: []
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'ready', 'waiting'

  useEffect(() => {
    fetchPayouts();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchPayouts, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchPayouts = async () => {
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      
      const res = await fetch(`${apiUrl}/api/v1/admin/pending-payouts`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch payout queue');
      }
      
      const data = await res.json();
      
      setPayouts({
        ready: data?.ready || [],
        waiting: data?.waiting || [],
        all: data?.all_pending || []
      });
      
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Payout Queue Sync Failed:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  const approvePayout = async (payoutId) => {
    if (!window.confirm('Approve this payout? Funds will be released to user.')) {
      return;
    }
    
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      
      const res = await fetch(`${apiUrl}/api/v1/admin/payout/approve/${payoutId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Failed to approve payout');
      }
      
      alert('Payout approved successfully!');
      fetchPayouts(); // Refresh list
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const rejectPayout = async (payoutId) => {
    const reason = window.prompt('Enter rejection reason:');
    if (!reason) return;
    
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      
      const res = await fetch(`${apiUrl}/api/v1/admin/payout/reject/${payoutId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
      });
      
      if (!res.ok) {
        throw new Error('Failed to reject payout');
      }
      
      alert('Payout rejected. Coins refunded to user.');
      fetchPayouts(); // Refresh list
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const getFilteredPayouts = () => {
    switch (filter) {
      case 'ready':
        return payouts.ready;
      case 'waiting':
        return payouts.waiting;
      default:
        return payouts.all;
    }
  };

  if (loading) {
    return (
      <div className="payout-queue-widget loading">
        <div className="loader-spinner"></div>
        <p>Loading payout queue...</p>
      </div>
    );
  }

  const filteredPayouts = getFilteredPayouts();

  return (
    <div className="payout-queue-widget">
      <div className="widget-header">
        <h2>⏳ Payout Queue (72-Hour Hold)</h2>
        <button onClick={fetchPayouts} className="refresh-btn" title="Refresh">
          🔄
        </button>
      </div>
      
      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}
      
      {/* Filter Tabs */}
      <div className="filter-tabs">
        <button 
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({payouts.all.length})
        </button>
        <button 
          className={`filter-tab ${filter === 'ready' ? 'active' : ''}`}
          onClick={() => setFilter('ready')}
        >
          ✅ Ready ({payouts.ready.length})
        </button>
        <button 
          className={`filter-tab ${filter === 'waiting' ? 'active' : ''}`}
          onClick={() => setFilter('waiting')}
        >
          ⏱️ Waiting ({payouts.waiting.length})
        </button>
      </div>
      
      {/* Payout Table */}
      {filteredPayouts.length === 0 ? (
        <div className="empty-state">
          <p>✨ No pending payouts in this category</p>
        </div>
      ) : (
        <div className="payout-table-container">
          <table className="payout-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Coins</th>
                <th>Gross USD</th>
                <th>Fee (5%)</th>
                <th>Net Payout</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayouts.map((payout) => (
                <tr key={payout.payout_id} className={payout.is_ready ? 'ready-row' : 'waiting-row'}>
                  <td>
                    <div className="user-cell">
                      <strong>{payout.username}</strong>
                      <small>{payout.user_id.slice(0, 8)}...</small>
                    </div>
                  </td>
                  <td className="coins-cell">
                    ₵{payout.coins_debited.toLocaleString()}
                  </td>
                  <td className="usd-cell">
                    ${payout.gross_usd.toFixed(2)}
                  </td>
                  <td className="fee-cell">
                    ${payout.platform_fee.toFixed(2)}
                  </td>
                  <td className="net-cell">
                    <strong>${payout.net_usd.toFixed(2)}</strong>
                  </td>
                  <td>
                    {payout.is_ready ? (
                      <span className="status-badge ready">✅ Ready</span>
                    ) : (
                      <span className="status-badge waiting">
                        ⏱️ {payout.hours_remaining.toFixed(1)}h left
                      </span>
                    )}
                  </td>
                  <td className="date-cell">
                    {new Date(payout.request_date).toLocaleDateString()}
                    <br />
                    <small>{new Date(payout.request_date).toLocaleTimeString()}</small>
                  </td>
                  <td className="actions-cell">
                    {payout.is_ready ? (
                      <div className="action-buttons">
                        <button 
                          className="approve-btn"
                          onClick={() => approvePayout(payout.payout_id)}
                        >
                          ✅ Approve
                        </button>
                        <button 
                          className="reject-btn"
                          onClick={() => rejectPayout(payout.payout_id)}
                        >
                          ❌ Reject
                        </button>
                      </div>
                    ) : (
                      <button 
                        className="reject-btn-small"
                        onClick={() => rejectPayout(payout.payout_id)}
                      >
                        ❌
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Summary Footer */}
      <div className="queue-summary">
        <div className="summary-item">
          <span>Total Pending:</span>
          <strong>{payouts.all.length}</strong>
        </div>
        <div className="summary-item">
          <span>Ready for Approval:</span>
          <strong className="ready-count">{payouts.ready.length}</strong>
        </div>
        <div className="summary-item">
          <span>Still in Hold:</span>
          <strong className="waiting-count">{payouts.waiting.length}</strong>
        </div>
      </div>
    </div>
  );
};

export default PayoutQueueManager;
