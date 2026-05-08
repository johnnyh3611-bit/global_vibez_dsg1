import { useState, useEffect, useCallback } from 'react';
import {
  Card, Title, Badge, Table, TableHead, TableRow, TableHeaderCell,
  TableBody, TableCell, Grid, Text, Metric,
} from '@tremor/react';
import { Search, Download } from 'lucide-react';
import { fetchWithAuth, exportToCSV, BACKEND_URL } from '@/utils/adminAPI';

const UserDetailModal = ({ selectedUser, userDetail, onClose }) => {
  if (!selectedUser || !userDetail) return null;
  return (
    <div
      data-testid="user-detail-modal"
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
      onClick={onClose}
    >
      <Card
        className="max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <Title>User Details: {selectedUser.username || selectedUser.user_id?.slice(0, 12)}</Title>
          <button
            data-testid="user-detail-close"
            onClick={onClose}
            className="text-red-500 font-bold text-2xl"
          >
            &times;
          </button>
        </div>

        <Grid numItemsLg={3} className="gap-4 mb-6">
          <Card decoration="top" decorationColor="green">
            <Text>Lifetime Spent</Text>
            <Metric>${userDetail.stats?.lifetime_spent || 0}</Metric>
          </Card>
          <Card decoration="top" decorationColor="purple">
            <Text>Lifetime Earned</Text>
            <Metric>${userDetail.stats?.lifetime_earned || 0}</Metric>
          </Card>
          <Card decoration="top" decorationColor="blue">
            <Text>Total Matches</Text>
            <Metric>{userDetail.stats?.total_matches || 0}</Metric>
          </Card>
        </Grid>

        <div className="space-y-6">
          <div>
            <Title>Recent Transactions ({userDetail.transactions?.length || 0})</Title>
            <Table className="mt-2">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Type</TableHeaderCell>
                  <TableHeaderCell>Amount</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {userDetail.transactions?.slice(0, 5).map((tx, i) => (
                  <TableRow key={`tx-${i}-${tx?.id || tx?.transaction_id || i}`}>
                    <TableCell><Badge>{tx.type}</Badge></TableCell>
                    <TableCell className="text-green-400">${tx.amount}</TableCell>
                    <TableCell className="text-sm">{new Date(tx.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <Title>Streaming Revenue ({userDetail.streaming_revenue?.length || 0})</Title>
            <Table className="mt-2">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Room</TableHeaderCell>
                  <TableHeaderCell>Earned</TableHeaderCell>
                  <TableHeaderCell>Date</TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {userDetail.streaming_revenue?.slice(0, 5).map((rev, i) => (
                  <TableRow key={`rev-${i}-${rev?.id || rev?.room_id || i}`}>
                    <TableCell className="font-mono text-sm">{rev.room_id?.slice(0, 8)}...</TableCell>
                    <TableCell className="text-purple-400">${rev.streamer_share}</TableCell>
                    <TableCell className="text-sm">{new Date(rev.timestamp).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);

  const fetchUsers = useCallback(async (page, search) => {
    try {
      const res = await fetchWithAuth(
        `${BACKEND_URL}/api/admin/all-users?page=${page}&limit=20&search=${search}`
      );
      const data = await res.json();
      setUsers(data.users || []);
      setTotalUsers(data.total || 0);
    } catch (error) {
      // silent
    }
  }, []);

  const fetchUserDetail = useCallback(async (userId) => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/admin/user-detail/${userId}`);
      const data = await res.json();
      setUserDetail(data);
    } catch (error) {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchUsers(userPage, userSearch);
  }, [userPage, fetchUsers]); // re-fetch on page; search triggered manually

  const handleBanUser = async (userId) => {
    const reason = prompt('Reason for ban:');
    if (!reason) return;
    const durationStr = prompt('Ban duration in hours (leave empty for permanent):');
    const duration = durationStr ? parseInt(durationStr) : null;
    try {
      await fetchWithAuth(`${BACKEND_URL}/api/admin/ban-user-action`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, reason, duration_hours: duration }),
      });
      alert('User banned successfully!');
      fetchUsers(userPage, userSearch);
    } catch (error) {
      alert('Failed to ban user');
    }
  };

  const handleUnbanUser = async (userId) => {
    if (!confirm('Unban this user?')) return;
    try {
      await fetchWithAuth(`${BACKEND_URL}/api/admin/unban-user-action/${userId}`, {
        method: 'POST',
      });
      alert('User unbanned successfully!');
      fetchUsers(userPage, userSearch);
    } catch (error) {
      alert('Failed to unban user');
    }
  };

  return (
    <div data-testid="godmode-users-tab">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <Title>All Users ({totalUsers})</Title>
          <div className="flex gap-2">
            <input
              data-testid="user-search-input"
              type="text"
              placeholder="Search users..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && fetchUsers(1, userSearch)}
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white"
            />
            <button
              data-testid="user-search-btn"
              onClick={() => fetchUsers(1, userSearch)}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors"
            >
              <Search className="w-5 h-5" />
            </button>
            <button
              data-testid="user-export-btn"
              onClick={() => exportToCSV(users, 'users')}
              className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
            >
              <Download className="w-5 h-5" /> Export
            </button>
          </div>
        </div>

        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>User</TableHeaderCell>
              <TableHeaderCell>Email</TableHeaderCell>
              <TableHeaderCell>Balance</TableHeaderCell>
              <TableHeaderCell>Total Spent</TableHeaderCell>
              <TableHeaderCell>Total Earned</TableHeaderCell>
              <TableHeaderCell>Matches</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Actions</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => (
              <TableRow
                key={`user-${user.user_id || user.id}`}
                className="hover:bg-slate-800 cursor-pointer"
              >
                <TableCell
                  onClick={() => {
                    setSelectedUser(user);
                    fetchUserDetail(user.user_id);
                  }}
                  className="font-mono text-sm text-cyan-400"
                >
                  {user.username || user.user_id?.slice(0, 8)}
                </TableCell>
                <TableCell>{user.email || 'N/A'}</TableCell>
                <TableCell className="text-green-400">${user.balance || 0}</TableCell>
                <TableCell className="text-red-400">${user.total_spent || 0}</TableCell>
                <TableCell className="text-purple-400">${user.total_earned || 0}</TableCell>
                <TableCell>{user.matches || 0}</TableCell>
                <TableCell>
                  <Badge color={user.banned ? 'red' : 'green'}>
                    {user.banned ? 'Banned' : 'Active'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {user.banned ? (
                    <button
                      data-testid={`user-unban-btn-${user.user_id}`}
                      onClick={() => handleUnbanUser(user.user_id)}
                      className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors"
                    >
                      Unban
                    </button>
                  ) : (
                    <button
                      data-testid={`user-ban-btn-${user.user_id}`}
                      onClick={() => handleBanUser(user.user_id)}
                      className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors"
                    >
                      Ban
                    </button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex justify-between items-center mt-4">
          <button
            data-testid="user-prev-page"
            disabled={userPage === 1}
            onClick={() => setUserPage(userPage - 1)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold rounded-lg transition-colors"
          >
            Previous
          </button>
          <Text>Page {userPage}</Text>
          <button
            data-testid="user-next-page"
            onClick={() => setUserPage(userPage + 1)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
          >
            Next
          </button>
        </div>
      </Card>

      <UserDetailModal
        selectedUser={selectedUser}
        userDetail={userDetail}
        onClose={() => {
          setSelectedUser(null);
          setUserDetail(null);
        }}
      />
    </div>
  );
};

export default UsersTab;
