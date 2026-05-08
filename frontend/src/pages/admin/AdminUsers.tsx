import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Ban, Trash2, CheckCircle, User } from 'lucide-react';
import { authFetch } from '@/utils/secureAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [page, search]);

  const fetchUsers = async () => {
    setErrorMessage('');
    try {
      const response = await authFetch(
        `${API}/admin/users?page=${page}&limit=20${search ? `&search=${search}` : ''}`
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 403) {
          setErrorMessage(
            'Admin access required. Your account is not in the admin whitelist — ask the platform owner to add your email to the ADMIN_EMAILS env var.'
          );
        } else {
          setErrorMessage(data.detail || `Request failed (${response.status})`);
        }
        setUsers([]);
        return;
      }
      const data = await response.json();
      setUsers(data.users || []);
      setTotalPages(data.pages || 1);
    } catch (error) {
      setErrorMessage('Network error — could not reach the admin API.');
    } finally {
      setLoading(false);
    }
  };

  const handleBan = async (userId) => {
    if (!window.confirm('Are you sure you want to ban this user?')) return;
    
    const reason = prompt('Ban reason:');
    if (!reason) return;

    try {
      const response = await authFetch(`${API}/admin/users/${userId}/ban?reason=${encodeURIComponent(reason)}`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('User banned successfully');
        fetchUsers();
      }
    } catch (error) {
      // // console.error('Error banning user:', error);
    }
  };

  const handleUnban = async (userId) => {
    try {
      const response = await authFetch(`${API}/admin/users/${userId}/unban`, {
        method: 'POST',
      });
      if (response.ok) {
        alert('User unbanned successfully');
        fetchUsers();
      }
    } catch (error) {
      // // console.error('Error unbanning user:', error);
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('⚠️ PERMANENT ACTION: Delete this user and all their data?')) return;
    if (!window.confirm('This cannot be undone. Are you absolutely sure?')) return;

    try {
      const response = await authFetch(`${API}/admin/users/${userId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        alert('User deleted successfully');
        fetchUsers();
      }
    } catch (error) {
      // // console.error('Error deleting user:', error);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
        <p className="text-gray-400">Manage all platform users</p>
      </div>

      {/* Inline error banner — surfaces 403/network errors instead of
          silently rendering an "empty" table. */}
      {errorMessage && (
        <Card
          className="bg-red-900/30 border-2 border-red-500/40 p-4 mb-6"
          data-testid="admin-users-error"
        >
          <p className="text-red-200 text-sm">{errorMessage}</p>
        </Card>
      )}

      {/* Search */}
      <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 p-4 mb-6">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, email, or ID..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-10 bg-white/10 border-cyan-500/30 text-white"
            />
          </div>
        </div>
      </Card>

      {/* Users Table */}
      <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cyan-600/20 border-b border-cyan-500/30">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">Email</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">Tier</th>
                <th className="px-6 py-4 text-right text-sm font-semibold text-white">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-500/10">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No users found</td></tr>
              ) : (
                users.map((user) => (
                  <tr key={user.user_id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 flex items-center justify-center text-white font-bold">
                          {user.name?.charAt(0) || 'U'}
                        </div>
                        <div>
                          <p className="text-white font-medium">{user.name || 'No name'}</p>
                          <p className="text-xs text-gray-400">{user.user_id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-300">{user.email || 'No email'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        user.account_status === 'banned'
                          ? 'bg-red-600/20 text-red-400 border border-red-500/50'
                          : 'bg-green-600/20 text-green-400 border border-green-500/50'
                      }`}>
                        {user.account_status || 'active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-cyan-400 font-medium">{user.subscription_tier || 'free'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {user.account_status === 'banned' ? (
                          <Button
                            onClick={() => handleUnban(user.user_id)}
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Unban
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleBan(user.user_id)}
                            size="sm"
                            className="bg-orange-600 hover:bg-orange-700 text-white"
                          >
                            <Ban className="w-4 h-4 mr-1" />
                            Ban
                          </Button>
                        )}
                        <Button
                          onClick={() => handleDelete(user.user_id)}
                          size="sm"
                          variant="destructive"
                          className="bg-red-600 hover:bg-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-cyan-500/30 flex items-center justify-between">
            <p className="text-gray-400 text-sm">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
              >
                Previous
              </Button>
              <Button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
