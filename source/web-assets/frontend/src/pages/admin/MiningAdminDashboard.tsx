import { useEffect, useState } from 'react';
import { Card, Metric, Text, AreaChart, BadgeDelta, Grid, Badge } from '@tremor/react';
import { ShieldAlert, Zap, Coins, TrendingUp } from 'lucide-react';
import { authFetch } from '@/utils/secureAuth';
import { Button } from '@/components/ui/button';
import { toast } from 'react-hot-toast';

const API = process.env.REACT_APP_BACKEND_URL;

type FlaggedUser = {
  user_id: string;
  username?: string;
  shadow_ban_reason?: string;
  shadow_ban_stddev?: number;
  shadow_ban_at?: number;
};

type MiningStats = {
  total_pending: number;
  total_available: number;
  total_lifetime_mined: number;
  last_24h_mined: number;
  last_24h_events: number;
  global_boost: number;
  flagged_user_count: number;
  flagged_users: FlaggedUser[];
};

const BotAlertCard = ({ user }: { user: FlaggedUser }) => {
  // Generate visual "jitter graph" from stddev (bots = flat line, humans = spiky)
  const stddev = user.shadow_ban_stddev ?? 0.001;
  const bars = Array.from({ length: 20 }, (_, i) => {
    // Low stddev → all bars similar height (robotic)
    return stddev < 0.01
      ? 3 + Math.random() * 1
      : 3 + Math.random() * 10;
  });
  const variancePct = (stddev * 100).toFixed(4);

  return (
    <Card
      data-testid={`bot-alert-${user.user_id}`}
      className="bg-black border-red-900 shadow-[0_0_20px_rgba(220,38,38,0.2)]"
    >
      <div className="flex justify-between items-start">
        <div>
          <Text color="red" className="font-black">
            BOT ALERT: {user.username || user.user_id}
          </Text>
          <Text className="text-xs opacity-50 mt-1">
            Reason: {user.shadow_ban_reason || 'bot_timing_variance'}
          </Text>
        </div>
        <Badge color="red">SHADOW-BANNED</Badge>
      </div>
      <div className="mt-4 h-2 bg-neutral-900 rounded-full overflow-hidden flex gap-px">
        {bars.map((h, i) => (
          <div
            key={i}
            style={{
              height: `${h * 8}px`,
              flex: 1,
              backgroundColor: stddev < 0.01 ? '#ef4444' : '#22c55e',
            }}
          />
        ))}
      </div>
      <Text className="mt-2 text-[10px] uppercase text-red-500">
        Pattern Variance: {variancePct}% (Robotic Threshold: 1%)
      </Text>
    </Card>
  );
};

export default function MiningAdminDashboard() {
  const [stats, setStats] = useState<MiningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [newBoost, setNewBoost] = useState('1.0');
  const [swept, setSwept] = useState<number | null>(null);

  const fetchStats = async () => {
    try {
      const res = await authFetch(`${API}/api/mining/admin/mining-stats`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setStats(data);
      setNewBoost(data.global_boost.toString());
    } catch (e: any) {
      toast.error(`Failed to load: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 30_000);
    return () => clearInterval(t);
  }, []);

  const updateBoost = async () => {
    try {
      const res = await authFetch(`${API}/api/mining/admin/global-boost`, {
        method: 'POST',
        body: JSON.stringify({ value: parseFloat(newBoost) }),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success(`Global boost set to ${newBoost}x`);
      fetchStats();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const sweep = async () => {
    try {
      const res = await authFetch(`${API}/api/mining/admin/sweep-vibe-check`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setSwept(data.swept);
      toast.success(`Swept ${data.swept} entries → available.`);
      fetchStats();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading || !stats) {
    return (
      <div className="min-h-screen bg-neutral-950 text-purple-300 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Loading mining telemetry...</p>
        </div>
      </div>
    );
  }

  // Fake historical series for demo: real data comes from ledger aggregations (P2 future).
  const chartData = [
    { Month: 'Mon', 'Mined $DSG': Math.round(stats.last_24h_mined * 0.7), Redemptions: Math.round(stats.last_24h_mined * 0.35) },
    { Month: 'Tue', 'Mined $DSG': Math.round(stats.last_24h_mined * 0.9), Redemptions: Math.round(stats.last_24h_mined * 0.40) },
    { Month: 'Wed', 'Mined $DSG': Math.round(stats.last_24h_mined * 1.1), Redemptions: Math.round(stats.last_24h_mined * 0.50) },
    { Month: 'Today', 'Mined $DSG': Math.round(stats.last_24h_mined), Redemptions: Math.round(stats.last_24h_mined * 0.45) },
  ];

  return (
    <div
      data-testid="mining-admin-dashboard"
      className="p-10 bg-neutral-950 min-h-screen text-white"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black italic tracking-tighter uppercase text-purple-400">
            $DSG Mining — Founder Console
          </h1>
          <p className="text-xs text-purple-300/60 mt-1">
            Global economy telemetry · Safety Gate · Gift redemption · 72h Vibe Check sweeper
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Zap className="w-4 h-4 text-amber-400" />
          <Text className="text-xs uppercase text-amber-300">Live · refreshes every 30s</Text>
        </div>
      </div>

      <Grid numItemsLg={4} className="gap-4 mb-6">
        <Card className="bg-black border-purple-900 shadow-purple-500/20 shadow-lg">
          <div className="flex items-start justify-between">
            <div>
              <Text color="purple">Total Pending (Vibe Check)</Text>
              <Metric color="slate">{stats.total_pending.toFixed(0)} $DSG</Metric>
            </div>
            <Coins className="w-6 h-6 text-purple-400" />
          </div>
          <BadgeDelta deltaType="moderateIncrease" className="mt-2">72h hold</BadgeDelta>
        </Card>

        <Card className="bg-black border-emerald-900">
          <div className="flex items-start justify-between">
            <div>
              <Text color="emerald">Available (Redeemable)</Text>
              <Metric color="slate">{stats.total_available.toFixed(0)} $DSG</Metric>
            </div>
            <TrendingUp className="w-6 h-6 text-emerald-400" />
          </div>
        </Card>

        <Card className="bg-black border-cyan-900">
          <div>
            <Text color="cyan">Last 24h Mined</Text>
            <Metric color="slate">{stats.last_24h_mined.toFixed(0)} $DSG</Metric>
            <Text className="text-xs opacity-60 mt-1">{stats.last_24h_events} events</Text>
          </div>
        </Card>

        <Card className="bg-black border-red-900">
          <div className="flex items-start justify-between">
            <div>
              <Text color="red">Safety Gate</Text>
              <Metric color="slate">{stats.flagged_user_count} bots flagged</Metric>
            </div>
            <ShieldAlert className="w-6 h-6 text-red-400" />
          </div>
        </Card>
      </Grid>

      {/* Admin controls */}
      <Grid numItemsLg={2} className="gap-4 mb-6">
        <Card className="bg-black border-amber-900" data-testid="global-boost-card">
          <Text color="amber">Global Mining Boost Multiplier</Text>
          <div className="flex items-center gap-2 mt-3">
            <input
              data-testid="global-boost-input"
              type="number"
              step="0.1"
              min="0"
              max="10"
              value={newBoost}
              onChange={(e) => setNewBoost(e.target.value)}
              className="bg-neutral-900 border border-amber-500/40 rounded px-3 py-2 text-white w-24"
            />
            <Button
              data-testid="global-boost-apply"
              onClick={updateBoost}
              className="bg-amber-600 hover:bg-amber-500 text-black font-bold"
            >
              Apply
            </Button>
            <Text className="text-xs opacity-60 ml-2">
              Current: {stats.global_boost}x · Event bump e.g. 1.5x during tournaments
            </Text>
          </div>
        </Card>

        <Card className="bg-black border-purple-900" data-testid="sweep-card">
          <Text color="purple">72h Vibe Check Sweeper</Text>
          <div className="flex items-center gap-2 mt-3">
            <Button
              data-testid="sweep-trigger"
              onClick={sweep}
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold"
            >
              Sweep Now
            </Button>
            {swept !== null && (
              <Text className="text-xs text-emerald-400">
                Last run: {swept} entries → available
              </Text>
            )}
          </div>
        </Card>
      </Grid>

      <Card className="bg-black border-purple-900 mb-6">
        <Text color="purple">Mining vs. Redemption Rate (Economy Stability)</Text>
        <AreaChart
          className="h-72 mt-4"
          data={chartData}
          index="Month"
          categories={['Mined $DSG', 'Redemptions']}
          colors={['purple', 'emerald']}
          showLegend
        />
      </Card>

      <div>
        <h2 className="text-xl font-black uppercase text-red-400 mb-3">Safety Gate — Flagged Accounts</h2>
        {stats.flagged_users.length === 0 ? (
          <Card className="bg-black border-neutral-800" data-testid="no-bots">
            <Text className="text-neutral-500">
              No bots detected. Behavioural variance thresholds all within human jitter.
            </Text>
          </Card>
        ) : (
          <Grid numItemsLg={2} className="gap-4">
            {stats.flagged_users.map((u) => (
              <BotAlertCard key={u.user_id} user={u} />
            ))}
          </Grid>
        )}
      </div>
    </div>
  );
}
