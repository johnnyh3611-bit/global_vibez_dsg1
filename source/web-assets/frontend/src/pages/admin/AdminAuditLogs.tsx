import React from 'react';
import AuditLogViewer from '@/components/admin/AuditLogViewer';

const AdminAuditLogs = () => {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-white mb-2">Audit Logs</h1>
        <p className="text-gray-400">View system activity and admin actions</p>
      </div>
      <AuditLogViewer />
    </div>
  );
};

export default AdminAuditLogs;