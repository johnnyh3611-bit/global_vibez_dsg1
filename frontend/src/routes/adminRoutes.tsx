import { Route, Navigate } from "react-router-dom";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminModeration from "@/pages/admin/AdminModeration";
import AdminSOS from "@/pages/admin/AdminSOS";
import AdminDrivers from "@/pages/admin/AdminDrivers";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminTransactions from "@/pages/admin/AdminTransactions";
import AdminVerification from "@/pages/AdminVerification";
import MonitoringDashboard from '@/pages/admin/MonitoringDashboard';
import DynamicPricingDashboard from '@/pages/admin/DynamicPricingDashboard';
import PayoutManagement from '@/pages/admin/PayoutManagement';
import ModerationDashboard from '@/pages/admin/ModerationDashboard';
import AdminTreasury from '@/pages/AdminTreasury';
import AdminStaffManagement from '@/pages/admin/AdminStaffManagement';
import AdminAuditLogs from '@/pages/admin/AdminAuditLogs';
import AdminTierPricing from '@/pages/admin/AdminTierPricing';
import AdminPaymentsAudit from '@/pages/admin/AdminPaymentsAudit';
import AdminRecirculation from '@/pages/admin/AdminRecirculation';
import AdminDSGLogistics from '@/pages/admin/AdminDSGLogistics';

/**
 * Admin routes — unified under the single God-Mode (Vibe Vault) board.
 *
 * The old competing `AdminLayout` + `AdminDashboard` were deleted on purpose:
 * the platform now has exactly ONE administration board at
 * `/vibe-vault-admin/dashboard`.
 *
 * `/admin` (and its index) redirect to God Mode. The specialised tool pages
 * (SOS, Drivers, Monitoring, etc.) remain reachable as standalone URLs so
 * links from God Mode's "Quick Tools" card keep working.
 */
export const adminRoutes = (ProtectedRoute) => (
  <>
    {/* Primary redirects — one board, one entry */}
    <Route path="/admin" element={<Navigate to="/vibe-vault-admin/dashboard" replace />} />
    <Route path="/admin/" element={<Navigate to="/vibe-vault-admin/dashboard" replace />} />

    {/* Specialised tool pages — linked from God-Mode "Quick Tools" */}
    <Route path="/admin/users" element={<ProtectedRoute><AdminUsers /></ProtectedRoute>} />
    <Route path="/admin/moderation" element={<ProtectedRoute><AdminModeration /></ProtectedRoute>} />
    <Route path="/admin/sos" element={<ProtectedRoute><AdminSOS /></ProtectedRoute>} />
    <Route path="/admin/drivers" element={<ProtectedRoute><AdminDrivers /></ProtectedRoute>} />
    <Route path="/admin/analytics" element={<ProtectedRoute><AdminAnalytics /></ProtectedRoute>} />
    <Route path="/admin/transactions" element={<ProtectedRoute><AdminTransactions /></ProtectedRoute>} />
    <Route path="/admin/treasury" element={<ProtectedRoute><AdminTreasury /></ProtectedRoute>} />
    <Route path="/admin/staff" element={<ProtectedRoute><AdminStaffManagement /></ProtectedRoute>} />
    <Route path="/admin/audit-logs" element={<ProtectedRoute><AdminAuditLogs /></ProtectedRoute>} />
    <Route path="/admin/dsg-logistics" element={<ProtectedRoute><AdminDSGLogistics /></ProtectedRoute>} />

    {/* Legacy / alias tool URLs */}
    <Route path="/admin/verification" element={<ProtectedRoute><AdminVerification /></ProtectedRoute>} />
    <Route path="/admin-verification" element={<ProtectedRoute><AdminVerification /></ProtectedRoute>} />
    <Route path="/admin/monitoring" element={<ProtectedRoute><MonitoringDashboard /></ProtectedRoute>} />
    <Route path="/admin/pricing" element={<ProtectedRoute><DynamicPricingDashboard /></ProtectedRoute>} />
    <Route path="/admin/tier-pricing" element={<ProtectedRoute><AdminTierPricing /></ProtectedRoute>} />
    <Route path="/admin/payments-audit" element={<ProtectedRoute><AdminPaymentsAudit /></ProtectedRoute>} />
    <Route path="/admin/recirculation" element={<ProtectedRoute><AdminRecirculation /></ProtectedRoute>} />
    <Route path="/admin/payouts" element={<ProtectedRoute><PayoutManagement /></ProtectedRoute>} />
    <Route path="/admin/moderation-dashboard" element={<ProtectedRoute><ModerationDashboard /></ProtectedRoute>} />
  </>
);
