import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { authFetch } from '@/utils/secureAuth';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, [page]);

  const fetchTransactions = async () => {
    setErrorMessage('');
    try {
      const response = await authFetch(`${API}/admin/transactions?page=${page}&limit=20`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setErrorMessage(
          response.status === 403
            ? 'Admin access required.'
            : data.detail || `Request failed (${response.status})`
        );
        return;
      }
      const data = await response.json();
      setTransactions(data.transactions || []);
      setTotalPages(data.pages || 1);
    } catch (error) {
      setErrorMessage('Network error — could not reach the transactions API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">💰 Transactions</h1>
        <p className="text-gray-400">Platform transaction history</p>
      </div>

      {errorMessage && (
        <Card className="bg-red-900/30 border-2 border-red-500/40 p-4 mb-6" data-testid="admin-transactions-error">
          <p className="text-red-200 text-sm">{errorMessage}</p>
        </Card>
      )}

      <Card className="bg-black/60 backdrop-blur-xl border-2 border-cyan-500/30 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-cyan-600/20 border-b border-cyan-500/30">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">Transaction ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">User</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">Type</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">Amount</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-white">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-500/10">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading...</td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No transactions found</td></tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.transaction_id || Math.random()} className="hover:bg-white/5">
                    <td className="px-6 py-4">
                      <span className="text-cyan-400 font-mono text-sm">{tx.transaction_id?.substring(0, 16)}...</span>
                    </td>
                    <td className="px-6 py-4 text-white">{tx.user_id}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {tx.type === 'purchase' ? (
                          <ArrowDownCircle className="w-4 h-4 text-green-400" />
                        ) : (
                          <ArrowUpCircle className="w-4 h-4 text-red-400" />
                        )}
                        <span className="text-white">{tx.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-bold ${tx.type === 'purchase' ? 'text-green-400' : 'text-red-400'}`}>
                        {tx.type === 'purchase' ? '+' : '-'}{tx.amount || 0} coins
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-cyan-500/30 flex justify-between">
            <p className="text-gray-400 text-sm">Page {page} of {totalPages}</p>
            <div className="flex gap-2">
              <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} size="sm">Previous</Button>
              <Button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} size="sm">Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
