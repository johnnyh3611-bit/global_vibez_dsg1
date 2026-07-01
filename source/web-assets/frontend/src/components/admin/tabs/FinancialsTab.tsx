import { useState, useEffect } from 'react';
import {
  Card, Title, Grid, Text, Metric, Table, TableHead, TableRow,
  TableHeaderCell, TableBody, TableCell,
} from '@tremor/react';
import { Download } from 'lucide-react';
import { fetchWithAuth, exportToCSV, BACKEND_URL } from '@/utils/adminAPI';

export const FinancialsTab = () => {
  const [financialData, setFinancialData] = useState(null);

  useEffect(() => {
    const fetchFinancialData = async () => {
      try {
        const res = await fetchWithAuth(`${BACKEND_URL}/api/admin/financial-overview?days=30`);
        const data = await res.json();
        setFinancialData(data);
      } catch (error) {
        // silent
      }
    };
    fetchFinancialData();
  }, []);

  if (!financialData) return null;

  return (
    <div className="space-y-6" data-testid="godmode-financials-tab">
      <div className="flex justify-end">
        <button
          data-testid="financials-export-btn"
          onClick={() => exportToCSV([financialData.revenue], 'financial_overview')}
          className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition-colors flex items-center gap-2"
        >
          <Download className="w-5 h-5" /> Export
        </button>
      </div>

      <Grid numItemsLg={4} className="gap-6">
        <Card decoration="top" decorationColor="green">
          <Text>Platform Revenue (30d)</Text>
          <Metric>${financialData.revenue?.platform_revenue || 0}</Metric>
        </Card>
        <Card decoration="top" decorationColor="blue">
          <Text>Total Purchases (30d)</Text>
          <Metric>${financialData.revenue?.total_purchases || 0}</Metric>
        </Card>
        <Card decoration="top" decorationColor="red">
          <Text>Total Payouts (30d)</Text>
          <Metric>${financialData.revenue?.total_payouts || 0}</Metric>
        </Card>
        <Card decoration="top" decorationColor="purple">
          <Text>Net Revenue (30d)</Text>
          <Metric>${financialData.revenue?.net_revenue || 0}</Metric>
        </Card>
      </Grid>

      <Grid numItemsLg={2} className="gap-6">
        <Card>
          <Title>Top Spenders (30d)</Title>
          <Table className="mt-4">
            <TableHead>
              <TableRow>
                <TableHeaderCell>User ID</TableHeaderCell>
                <TableHeaderCell>Amount</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {financialData.top_spenders?.map((spender) => (
                <TableRow key={`spender-${spender._id || spender.user_id}`}>
                  <TableCell className="font-mono text-sm">
                    {spender._id?.slice(0, 12)}...
                  </TableCell>
                  <TableCell className="text-green-400 font-bold">${spender.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        <Card>
          <Title>Top Streamers (30d)</Title>
          <Table className="mt-4">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Streamer ID</TableHeaderCell>
                <TableHeaderCell>Earned</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {financialData.top_streamers?.map((streamer) => (
                <TableRow key={`streamer-${streamer._id || streamer.user_id}`}>
                  <TableCell className="font-mono text-sm">
                    {streamer._id?.slice(0, 12)}...
                  </TableCell>
                  <TableCell className="text-purple-400 font-bold">${streamer.total}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </Grid>
    </div>
  );
};

export default FinancialsTab;
