import { Card, Title, Grid, Flex, Text } from '@tremor/react';
import { AlertTriangle, Car, Shield, LineChart, Activity, DollarSign, UserCheck, BadgeCheck } from 'lucide-react';

interface OverviewStats {
  pending_cashouts?: number;
  vr_dating_active?: number;
  pending_matches?: number;
  jftn_transactions_7d?: number;
}

interface OverviewTabProps {
  stats?: OverviewStats;
  setSelectedTab: (index: number) => void;
}

// External tool pages — kept outside the main tabbed view because they're
// full-screen specialist workflows rather than dashboard panels.
const QUICK_TOOLS = [
  { to: '/admin/sos', icon: AlertTriangle, label: 'SOS Alerts', accent: 'text-red-400' },
  { to: '/admin/drivers', icon: Car, label: 'Driver Verification', accent: 'text-yellow-400' },
  { to: '/admin/verification', icon: BadgeCheck, label: 'ID Verification', accent: 'text-blue-400' },
  { to: '/admin/moderation', icon: Shield, label: 'Content Moderation', accent: 'text-purple-400' },
  { to: '/admin/analytics', icon: LineChart, label: 'Deep Analytics', accent: 'text-cyan-400' },
  { to: '/admin/monitoring', icon: Activity, label: 'System Monitoring', accent: 'text-green-400' },
  { to: '/admin/transactions', icon: DollarSign, label: 'Transactions', accent: 'text-emerald-400' },
  { to: '/admin/pricing', icon: UserCheck, label: 'Dynamic Pricing', accent: 'text-pink-400' },
];

export const OverviewTab = ({ stats, setSelectedTab }: OverviewTabProps) => {
  return (
    <div className="space-y-6" data-testid="godmode-overview-tab">
      <Grid numItemsLg={2} className="gap-6">
        <Card>
          <Title>Platform Metrics</Title>
          <div className="mt-4 space-y-3">
            <Flex>
              <Text>Pending Cashouts</Text>
              <Text className="font-bold">{stats?.pending_cashouts || 0}</Text>
            </Flex>
            <Flex>
              <Text>VR Dating Active</Text>
              <Text className="font-bold">{stats?.vr_dating_active || 0}</Text>
            </Flex>
            <Flex>
              <Text>Pending Matches</Text>
              <Text className="font-bold">{stats?.pending_matches || 0}</Text>
            </Flex>
            <Flex>
              <Text>JFTN Transactions (7d)</Text>
              <Text className="font-bold">{stats?.jftn_transactions_7d || 0}</Text>
            </Flex>
          </div>
        </Card>

        <Card>
          <Title>Quick Actions</Title>
          <div className="mt-4 space-y-2">
            <button
              data-testid="quick-action-announcement"
              onClick={() => setSelectedTab(6)}
              className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors"
            >
              Create Announcement
            </button>
            <button
              data-testid="quick-action-payouts"
              onClick={() => setSelectedTab(5)}
              className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg transition-colors"
            >
              Review Payouts
            </button>
            <button
              data-testid="quick-action-users"
              onClick={() => setSelectedTab(1)}
              className="w-full px-4 py-3 bg-orange-600 hover:bg-orange-500 text-white font-bold rounded-lg transition-colors"
            >
              Manage Users
            </button>
          </div>
        </Card>
      </Grid>

      <Card>
        <Title>Quick Tools</Title>
        <Text className="mt-1">Specialist admin workflows — each opens in a focused full-screen view.</Text>
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
          {QUICK_TOOLS.map((tool) => (
            <a
              key={tool.to}
              href={tool.to}
              data-testid={`quick-tool-${tool.to.replace(/\//g, '-').replace(/^-/, '')}`}
              className="flex flex-col items-start gap-2 p-4 rounded-lg border border-white/10 bg-black/40 hover:bg-white/5 hover:border-cyan-500/50 transition-colors"
            >
              <tool.icon className={`w-5 h-5 ${tool.accent}`} />
              <span className="text-sm font-semibold text-white">{tool.label}</span>
              <span className="text-xs text-gray-400">{tool.to}</span>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default OverviewTab;
