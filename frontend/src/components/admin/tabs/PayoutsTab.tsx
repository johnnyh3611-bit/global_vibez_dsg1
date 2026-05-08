import { useState, useEffect, useCallback } from 'react';
import {
  Card, Title, Text, Table, TableHead, TableRow,
  TableHeaderCell, TableBody, TableCell,
} from '@tremor/react';
import { CheckCircle, XCircle } from 'lucide-react';
import { fetchWithAuth, BACKEND_URL } from '@/utils/adminAPI';

export const PayoutsTab = () => {
  const [payouts, setPayouts] = useState([]);

  const fetchPayouts = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/admin/pending-payouts?limit=100`);
      const data = await res.json();
      setPayouts(data.payouts || []);
    } catch (error) {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handlePayoutAction = async (payoutId, action) => {
    if (!confirm(`Are you sure you want to ${action} this payout?`)) return;
    try {
      await fetchWithAuth(`${BACKEND_URL}/api/admin/payout-action`, {
        method: 'POST',
        body: JSON.stringify({ payout_id: payoutId, action }),
      });
      alert(`Payout ${action}d successfully!`);
      fetchPayouts();
    } catch (error) {
      alert('Failed to process payout');
    }
  };

  const totalPayouts = payouts.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2);

  return (
    <Card data-testid="godmode-payouts-tab">
      <Title>Pending Payouts ({payouts.length})</Title>
      <Text className="text-orange-400 font-bold mt-2">Total: ${totalPayouts}</Text>

      <Table className="mt-4">
        <TableHead>
          <TableRow>
            <TableHeaderCell>Payout ID</TableHeaderCell>
            <TableHeaderCell>User</TableHeaderCell>
            <TableHeaderCell>Amount</TableHeaderCell>
            <TableHeaderCell>Requested</TableHeaderCell>
            <TableHeaderCell>Actions</TableHeaderCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {payouts.map((payout) => (
            <TableRow key={`payout-${payout.payout_id || payout.id}`}>
              <TableCell className="font-mono text-sm">
                {payout.payout_id?.slice(0, 12)}...
              </TableCell>
              <TableCell>{payout.username || payout.user_id?.slice(0, 12)}</TableCell>
              <TableCell className="text-green-400 font-bold text-lg">
                ${payout.amount}
              </TableCell>
              <TableCell className="text-sm">
                {new Date(payout.created_at).toLocaleString()}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  <button
                    data-testid={`payout-approve-${payout.payout_id}`}
                    onClick={() => handlePayoutAction(payout.payout_id, 'approve')}
                    className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-sm rounded transition-colors flex items-center gap-1"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button
                    data-testid={`payout-reject-${payout.payout_id}`}
                    onClick={() => handlePayoutAction(payout.payout_id, 'reject')}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default PayoutsTab;
