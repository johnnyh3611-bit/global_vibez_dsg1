/**
 * Revenue Tracker Widget
 * 
 * Displays platform revenue analytics:
 * - Total fees collected (5% platform fee)
 * - Active coin circulation
 * - Pending payouts
 */

import React, { useState, useEffect } from 'react';
import './RevenueDashboard.css';

const RevenueTracker = () => {
  const [stats, setStats] = useState({
    totalFees: 0,
    pendingUSD: 0,
    totalCoins: 0,
    totalCoinsUSD: 0,
    totalUsers: 0
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRevenue();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchRevenue, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchRevenue = async () => {
    try {
      const apiUrl = process.env.REACT_APP_BACKEND_URL;
      
      const res = await fetch(`${apiUrl}/api/v1/admin/revenue-summary`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        throw new Error('Failed to fetch revenue data');
      }
      
      const data = await res.json();
      
      // THE DOUBLE-TAKE: Default to 0 if data is missing
      setStats({
        totalFees: data?.total_fees_usd || 0,
        pendingUSD: data?.pending_payouts_usd || 0,
        totalCoins: data?.active_circulation_coins || 0,
        totalCoinsUSD: data?.active_circulation_usd || 0,
        totalUsers: data?.total_users || 0
      });
      
      setLoading(false);
      setError(null);
    } catch (err) {
      console.error("Revenue Sync Failed: Maintaining baseline.", err);
      setError(err.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="revenue-widget loading">
        <div className="loader-spinner"></div>
        <p>Loading revenue data...</p>
      </div>
    );
  }

  return (
    <div className="revenue-widget">
      <div className="widget-header">
        <h2>💰 Global Vibez Treasury</h2>
        <button onClick={fetchRevenue} className="refresh-btn" title="Refresh">
          🔄
        </button>
      </div>
      
      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}
      
      <div className="stat-grid">
        {/* Platform Profit */}
        <div className="stat-card profit">
          <div className="stat-icon">📈</div>
          <div className="stat-content">
            <span className="stat-label">Platform Profit (Fees)</span>
            <p className="stat-value profit-text">₵{(stats.totalFees * 2000).toLocaleString()}</p>
            <span className="stat-subtitle">5% from all cashouts</span>
          </div>
        </div>
        
        {/* Pending Payouts */}
        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <span className="stat-label">Pending Payouts</span>
            <p className="stat-value pending-text">₵{(stats.pendingUSD * 2000).toLocaleString()}</p>
            <span className="stat-subtitle">In 72-hour hold</span>
          </div>
        </div>
        
        {/* Coin Circulation */}
        <div className="stat-card circulation">
          <div className="stat-icon">🪙</div>
          <div className="stat-content">
            <span className="stat-label">Active Circulation</span>
            <p className="stat-value coins-text">₵{stats.totalCoins.toLocaleString()}</p>
            <span className="stat-subtitle">All in Vibez Coins</span>
          </div>
        </div>
        
        {/* Total Users */}
        <div className="stat-card users">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <span className="stat-label">Total Users</span>
            <p className="stat-value users-text">{stats.totalUsers.toLocaleString()}</p>
            <span className="stat-subtitle">Active accounts</span>
          </div>
        </div>
      </div>
      
      {/* Exchange Rate Info */}
      <div className="fee-info">
        <div className="info-row">
          <span className="info-label">Exchange Rate:</span>
          <span className="info-value">₵1,000 = $1.00 USD</span>
        </div>
        <div className="info-row">
          <span className="info-label">Platform Fee:</span>
          <span className="info-value">5% on cashouts</span>
        </div>
      </div>
    </div>
  );
};

export default RevenueTracker;
