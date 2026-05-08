import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, Ban } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function ModerationDashboard() {
  const [reports, setReports] = useState([]);
  const [stats, setStats] = useState({ pending: 0, resolved: 0, banned: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const token = sessionStorage.getItem('admin_token') || localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/moderation/reports/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setReports(data.reports || []);
      setStats(data.stats || stats);
    } catch (error) {
      // // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const moderateReport = async (reportId, action) => {
    try {
      const token = sessionStorage.getItem('admin_token') || localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/moderation/moderate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ report_id: reportId, action })
      });
      if (response.ok) {
        alert(`✅ Action: ${action}`);
        fetchReports();
      }
    } catch (error) {
      alert('Moderation action failed');
    }
  };

  const getSeverityColor = (severity) => {
    if (severity === 'high') return 'text-red-400';
    if (severity === 'medium') return 'text-yellow-400';
    return 'text-gray-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-red-900 to-black py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-black bg-gradient-to-r from-red-400 to-orange-500 bg-clip-text text-transparent mb-8">
          🛡️ AI Moderation Dashboard
        </h1>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Pending Reports</span>
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
            <p className="text-3xl font-black text-yellow-400">{stats.pending}</p>
          </Card>
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Resolved</span>
              <CheckCircle className="w-5 h-5 text-green-400" />
            </div>
            <p className="text-3xl font-black text-green-400">{stats.resolved}</p>
          </Card>
          <Card className="bg-gray-800/50 border-gray-600 p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Users Banned</span>
              <Ban className="w-5 h-5 text-red-400" />
            </div>
            <p className="text-3xl font-black text-red-400">{stats.banned}</p>
          </Card>
        </div>

        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.report_id} className="bg-gray-800/50 border-gray-600 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Shield className="w-6 h-6 text-cyan-400" />
                    <h3 className="text-xl font-bold text-white">{report.type}</h3>
                    <span className={`text-sm font-bold ${getSeverityColor(report.severity)}`}>
                      {report.severity?.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-300 mb-2">{report.description}</p>
                  <div className="text-gray-400 text-sm">
                    <p>Reported by: {report.reporter_name}</p>
                    <p>Target: {report.target_user_name}</p>
                    <p>Date: {new Date(report.created_at).toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button 
                    onClick={() => moderateReport(report.report_id, 'warn')}
                    className="bg-yellow-500 hover:bg-yellow-600"
                  >
                    Warn
                  </Button>
                  <Button 
                    onClick={() => moderateReport(report.report_id, 'ban')}
                    className="bg-red-500 hover:bg-red-600"
                  >
                    Ban
                  </Button>
                  <Button 
                    onClick={() => moderateReport(report.report_id, 'dismiss')}
                    variant="outline"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
