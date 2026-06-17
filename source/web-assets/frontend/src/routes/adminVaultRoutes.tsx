import { Route } from 'react-router-dom';
import VaultLogin from '@/pages/admin/VaultLogin';
import GodModeDashboard from '@/pages/admin/GodModeDashboard';
import MiningAdminDashboard from '@/pages/admin/MiningAdminDashboard';
import TGEAdminDashboard from '@/pages/admin/TGEAdminDashboard';
import StreamflowAdmin from '@/pages/admin/StreamflowAdmin';
import BetaWaitlistAdmin from '@/pages/admin/BetaWaitlistAdmin';

export const adminVaultRoutes = () => (
  <>
    <Route path="/vibe-vault-admin" element={<VaultLogin />} />
    <Route path="/vibe-vault-admin/dashboard" element={<GodModeDashboard />} />
    <Route path="/vibe-vault-admin/mining" element={<MiningAdminDashboard />} />
    <Route path="/vibe-vault-admin/tge" element={<TGEAdminDashboard />} />
    <Route path="/vibe-vault-admin/streamflow" element={<StreamflowAdmin />} />
    <Route path="/vibe-vault-admin/beta-waitlist" element={<BetaWaitlistAdmin />} />
  </>
);
