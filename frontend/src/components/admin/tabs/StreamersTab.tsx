import { useState, useEffect } from 'react';
import {
  Card, Title, Table, TableHead, TableRow,
  TableHeaderCell, TableBody, TableCell,
} from '@tremor/react';
import { Download } from 'lucide-react';
import { fetchWithAuth, exportToCSV, BACKEND_URL } from '@/utils/adminAPI';

const rankBadge = (rank) => {
  if (rank === 1) return '#1';
  if (rank === 2) return '#2';
  if (rank === 3) return '#3';
  return rank;
};

export const StreamersTab = () => {
  const [streamers, setStreamers] = useState([]);

  useEffect(() => {
    const fetchStreamers = async () => {
      try {
        const res = await fetchWithAuth(
          `${BACKEND_URL}/api/admin/streamer-leaderboard?period=week&limit=20`
        );
        const data = await res.json();
        setStreamers(data.leaderboard || []);
      } catch (error) {
        // silent
      }
    };
    fetchStreamers();
  }, []);

  return (
    <Card data-testid="godmode-streamers-tab">
      <div className="flex justify-between items-center mb-4">
        <Title>Streamer Leaderboard (This Week)</Title>
        <button
          data-testid="streamers-export-btn"
          onClick={() => exportToCSV(streamers, 'streamer_leaderboard')}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
        >
          <Download className="w-5 h-5" /> Export
        </button>
      </div>
      <Table className="mt-4">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Rank</TableHeaderCell>
            <TableHeaderCell>Username</TableHeaderCell>
            <TableHeaderCell>Total Earned</TableHeaderCell>
            <TableHeaderCell>Sessions</TableHeaderCell>
            <TableHeaderCell>Avg/Session</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {streamers.map((streamer, idx) => (
            <TableRow key={`streamer-lb-${streamer?._id || streamer?.user_id || idx}`}>
              <TableCell className="font-bold text-xl">{rankBadge(idx + 1)}</TableCell>
              <TableCell>{streamer.username || streamer._id?.slice(0, 12)}</TableCell>
              <TableCell className="text-purple-400 font-bold text-lg">
                ${streamer.total_earned?.toFixed(2) || 0}
              </TableCell>
              <TableCell>{streamer.session_count || 0}</TableCell>
              <TableCell className="text-green-400">
                ${streamer.avg_per_session?.toFixed(2) || 0}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default StreamersTab;
