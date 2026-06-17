import { useState, useEffect } from 'react';
import {
  Card, Title, Badge, Table, TableHead, TableRow,
  TableHeaderCell, TableBody, TableCell,
} from '@tremor/react';
import { Download } from 'lucide-react';
import { fetchWithAuth, exportToCSV, BACKEND_URL } from '@/utils/adminAPI';

export const ActivityTab = () => {
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    const fetchActivityFeed = async () => {
      try {
        const res = await fetchWithAuth(`${BACKEND_URL}/api/admin/activity-feed?limit=50`);
        const data = await res.json();
        setActivities(data.activities || []);
      } catch (error) {
        // silent
      }
    };
    fetchActivityFeed();
  }, []);

  const badgeColorFor = (type) => {
    if (type === 'purchase') return 'green';
    if (type === 'streaming_revenue') return 'purple';
    return 'blue';
  };

  return (
    <Card data-testid="godmode-activity-tab">
      <div className="flex justify-between items-center mb-4">
        <Title>Live Activity Feed</Title>
        <button
          data-testid="activity-export-btn"
          onClick={() => exportToCSV(activities, 'activity_feed')}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
        >
          <Download className="w-5 h-5" /> Export
        </button>
      </div>
      <Table className="mt-4">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Type</TableHeaderCell>
            <TableHeaderCell>User</TableHeaderCell>
            <TableHeaderCell>Details</TableHeaderCell>
            <TableHeaderCell>Amount</TableHeaderCell>
            <TableHeaderCell>Time</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {activities.map((activity, idx) => (
            <TableRow key={`activity-${activity?.id || activity?._id || idx}`}>
              <TableCell>
                <Badge color={badgeColorFor(activity.type)}>{activity.type}</Badge>
              </TableCell>
              <TableCell className="font-mono text-sm">
                {activity.user_id?.slice(0, 12)}...
              </TableCell>
              <TableCell>{activity.details}</TableCell>
              <TableCell className="text-green-400">${activity.amount || 0}</TableCell>
              <TableCell className="text-slate-400 text-sm">
                {new Date(activity.timestamp).toLocaleString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default ActivityTab;
