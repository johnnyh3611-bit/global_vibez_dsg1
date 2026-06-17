/**
 * Admin Treasury Dashboard
 * 
 * Main admin page for managing Vibez Coins treasury:
 * - Revenue analytics
 * - Payout queue management
 * - God-Mode only access
 */

import React from 'react';
import RevenueTracker from '../components/admin/RevenueTracker';
import PayoutQueueManager from '../components/admin/PayoutQueueManager';
import './AdminTreasury.css';

const AdminTreasury = () => {
  return (
    <div className="admin-treasury-page">
      <div className="page-header">
        <h1>🏦 Treasury Management</h1>
        <p className="page-subtitle">Vibez Coins Platform Administration</p>
      </div>
      
      <div className="treasury-content">
        {/* Revenue Stats */}
        <RevenueTracker />
        
        {/* Payout Queue */}
        <PayoutQueueManager />
      </div>
    </div>
  );
};

export default AdminTreasury;
