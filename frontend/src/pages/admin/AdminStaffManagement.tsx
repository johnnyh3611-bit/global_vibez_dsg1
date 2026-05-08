import React from 'react';
import StaffManagement from '@/components/admin/StaffManagement';

const AdminStaffManagement = () => {
  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-white mb-2">Staff Management</h1>
        <p className="text-gray-400">Manage staff roles and permissions</p>
      </div>
      <StaffManagement />
    </div>
  );
};

export default AdminStaffManagement;