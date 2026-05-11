import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Card, Tab, TabGroup, TabList, TabPanel, TabPanels, Badge,
  Flex, Text, Metric, Grid, Title,
} from '@tremor/react';
import { Users, DollarSign, TrendingUp, Video, Gamepad2 } from 'lucide-react';

import RevenueTracker from '@/components/admin/RevenueTracker';
import PayoutQueueManager from '@/components/admin/PayoutQueueManager';
import TreasuryPanel from '@/components/admin/TreasuryPanel';
import BurnQueuePanel from '@/components/admin/BurnQueuePanel';
import StaffManagement from '@/components/admin/StaffManagement';
import AuditLogViewer from '@/components/admin/AuditLogViewer';
import TreasuryAuditView from '@/components/admin/TreasuryAuditView';
import MilestoneQueue from '@/components/admin/MilestoneQueue';
import MilestoneRecap from '@/components/admin/MilestoneRecap';
import SystemHealthMonitor from '@/components/admin/SystemHealthMonitor';
import JFTNEscrowTab from '@/components/admin/JFTNEscrowTab';
import RewardsEscrowTab from '@/components/admin/RewardsEscrowTab';

import OverviewTab from '@/components/admin/tabs/OverviewTab';
import UsersTab from '@/components/admin/tabs/UsersTab';
import FinancialsTab from '@/components/admin/tabs/FinancialsTab';
import ActivityTab from '@/components/admin/tabs/ActivityTab';
import StreamersTab from '@/components/admin/tabs/StreamersTab';
import PayoutsTab from '@/components/admin/tabs/PayoutsTab';
import AnnouncementsTab from '@/components/admin/tabs/AnnouncementsTab';
import BetaFeedbackTab from '@/components/admin/tabs/BetaFeedbackTab';
import SmartStackOpsTab from '@/components/admin/tabs/SmartStackOpsTab';

import SystemStressMeter from '@/components/admin/SystemStressMeter';
import ActivityPulseCard from '@/components/admin/ActivityPulseCard';
import ProductionSmokeTestCard from '@/components/admin/ProductionSmokeTestCard';
import BetaCohortReportCard from '@/components/admin/BetaCohortReportCard';
import EconomicEngineCard from '@/components/economic_engine/EconomicEngineCard';
import AgeVerificationQueueCard from '@/components/admin/AgeVerificationQueueCard';
import EmergencyOverride from '@/components/admin/EmergencyOverride';
import ApexEvolutionControls from '@/components/admin/ApexEvolutionControls';
import ChairHolderVoting from '@/components/admin/ChairHolderVoting';
import SponsorAdminPanel from '@/components/admin/SponsorAdminPanel';
import SovereignOpsPanel from '@/components/admin/SovereignOpsPanel';
import AdminSeatGrid from '@/components/admin/AdminSeatGrid';
import SolanaNetworkPanel from '@/components/admin/SolanaNetworkPanel';
import FounderNotificationToggle from '@/components/admin/FounderNotificationToggle';
import GameLockStatusWidget from '@/components/admin/GameLockStatusWidget';
import TreasuryPulseWidget from '@/components/admin/TreasuryPulseWidget';

import { fetchWithAuth, BACKEND_URL } from '@/utils/adminAPI';

const STATS_REFRESH_INTERVAL_MS = 30000;

const StatsSummary = ({ stats }) => (
  <Grid numItemsSm={2} numItemsLg={4} className="gap-6 mb-8" data-testid="godmode-stats-summary">
    <Card decoration="top" decorationColor="cyan">
      <Flex alignItems="start">
        <div>
          <Text>Active Players</Text>
          <Metric>{stats?.active_players || 0}</Metric>
        </div>
        <Users className="text-cyan-500" />
      </Flex>
    </Card>
    <Card decoration="top" decorationColor="purple">
      <Flex alignItems="start">
        <div>
          <Text>Vibez Coin Purchases (7d)</Text>
          <Metric>₵{stats?.token_purchases_7d || 0}</Metric>
        </div>
        <TrendingUp className="text-purple-500" />
      </Flex>
    </Card>
    <Card decoration="top" decorationColor="green">
      <Flex alignItems="start">
        <div>
          <Text>Platform Revenue</Text>
          <Metric>${stats?.platform_revenue || 0}</Metric>
        </div>
        <DollarSign className="text-green-500" />
      </Flex>
    </Card>
    <Card decoration="top" decorationColor="pink">
      <Flex alignItems="start">
        <div>
          <Text>Active Rooms</Text>
          <Metric>{stats?.active_premium_rooms || 0}</Metric>
        </div>
        <Video className="text-pink-500" />
      </Flex>
    </Card>
  </Grid>
);

export const GodModeDashboard = () => {
  const navigate = useNavigate();
  const [selectedTab, setSelectedTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetchWithAuth(`${BACKEND_URL}/api/admin/master-stats`);
      const data = await res.json();
      setStats(data.stats);
      setLoading(false);
    } catch (error) {
      // silent; 401 redirects via fetchWithAuth
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const interval = setInterval(fetchOverview, STATS_REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchOverview]);

  const handleLogout = async () => {
    try {
      await fetchWithAuth(`${BACKEND_URL}/api/admin/vault-logout`, { method: 'POST' });
    } catch (error) {
      // Logout anyway
    }
    navigate('/vibe-vault-admin');
  };

  if (loading) {
    return (
      <div
        className="min-h-screen bg-slate-950 flex items-center justify-center"
        data-testid="godmode-loading"
      >
        <Text className="text-cyan-400 text-xl">Loading God Mode...</Text>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07030F] p-6" data-testid="godmode-dashboard">
      {/* Header */}
      <div className="flex justify-between items-center mb-8 flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 shadow-[0_0_22px_rgba(217,70,239,0.55)]">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black">
              <span className="text-white">GLOBAL VIBEZ</span>{' '}
              <span className="text-transparent bg-gradient-to-r from-fuchsia-500 to-purple-500 bg-clip-text">
                DSG
              </span>
            </h1>
            <p className="text-fuchsia-400/80 text-xs uppercase tracking-[0.3em]">
              God Mode · Complete Platform Control
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/vibe-vault-admin/streamflow"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/20"
            data-testid="godmode-streamflow-link"
          >
            Crew Payouts
          </Link>
          <Link
            to="/vibe-vault-admin/beta-waitlist"
            className="inline-flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-500/20"
            data-testid="godmode-beta-waitlist-link"
          >
            Beta Waitlist
          </Link>
          <Link
            to="/vibe-vault-admin/disputes"
            className="inline-flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/20"
            data-testid="godmode-disputes-link"
          >
            Disputes
          </Link>
          <button
            data-testid="godmode-logout-btn"
            onClick={handleLogout}
            className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
          >
            Exit Vault
          </button>
        </div>
      </div>

      <StatsSummary stats={stats} />

      {/* Economy Control Center — auto-pilot health + emergency lock */}
      <EmergencyOverride />
      <div className="mb-6">
        <SystemStressMeter />
      </div>

      {/* 2026-05-12 founder enhancement: live business pulse card */}
      <ActivityPulseCard />

      {/* 2026-05-12 backlog: Beta Cohort Report — first 50-500 user
          metrics so v1.1 planning has hard data instead of vibes. */}
      <BetaCohortReportCard />

      {/* 2026-05-12 backlog #3: one-click production smoke test —
          14 read-only probes against the live URL. Catches regressions
          in 30 seconds right after each redeploy. */}
      <ProductionSmokeTestCard />

      {/* 2026-05-13 — DSG Economic Engine live state per the
          Global_Vibez_DSG_Economic_Engine.pdf spec. Single source of
          truth for Vibez Coin supply, dynamic burn, liquidity fund. */}
      <EconomicEngineCard />

      {/* 2026-05-13 — 21+ Age Verification queue (Restricted Goods
          Delivery Standard 2026). Pending submissions + approve/reject. */}
      <AgeVerificationQueueCard />

      <TabGroup index={selectedTab} onIndexChange={setSelectedTab}>
        <TabList className="mb-6">
          <Tab data-testid="vault-tab-overview">Overview</Tab>
          <Tab data-testid="vault-tab-users">All Users</Tab>
          <Tab data-testid="vault-tab-financials">Financials</Tab>
          <Tab data-testid="vault-tab-activity">Activity</Tab>
          <Tab data-testid="vault-tab-streamers">Streamers</Tab>
          <Tab data-testid="vault-tab-payouts">Payouts</Tab>
          <Tab data-testid="vault-tab-announcements">Announcements</Tab>
          <Tab data-testid="vault-tab-treasury"><Badge>NEW</Badge> Treasury</Tab>
          <Tab data-testid="vault-tab-staff"><Badge>NEW</Badge> Staff</Tab>
          <Tab data-testid="vault-tab-founder-controls"><Badge color="amber">FOUNDER</Badge> Founder Controls</Tab>
          <Tab data-testid="vault-tab-audit"><Badge>NEW</Badge> Audit Logs</Tab>
          <Tab data-testid="vault-tab-system-health"><Badge color="green">LIVE</Badge> System Health</Tab>
          <Tab data-testid="vault-tab-jftn-escrow"><Badge color="cyan">SOL</Badge> JFTN Escrow</Tab>
          <Tab data-testid="vault-tab-unity-rewards"><Badge color="fuchsia">UNITY</Badge> Rewards Escrow</Tab>
          <Tab data-testid="vault-tab-beta-feedback"><Badge color="amber">BETA</Badge> Feedback</Tab>
          <Tab data-testid="vault-tab-smartstack-ops"><Badge color="cyan">OPS</Badge> SmartStack</Tab>
          <Tab data-testid="vault-tab-game-locks"><Badge color="emerald">LOCKS</Badge> Game Locks</Tab>
          <Tab data-testid="vault-tab-treasury-pulse"><Badge color="cyan">v7</Badge> Treasury Pulse</Tab>
        </TabList>

        <TabPanels>
          <TabPanel>
            <OverviewTab stats={stats} setSelectedTab={setSelectedTab} />
          </TabPanel>

          <TabPanel>{selectedTab === 1 && <UsersTab />}</TabPanel>
          <TabPanel>{selectedTab === 2 && <FinancialsTab />}</TabPanel>
          <TabPanel>{selectedTab === 3 && <ActivityTab />}</TabPanel>
          <TabPanel>{selectedTab === 4 && <StreamersTab />}</TabPanel>
          <TabPanel>{selectedTab === 5 && <PayoutsTab />}</TabPanel>
          <TabPanel>{selectedTab === 6 && <AnnouncementsTab />}</TabPanel>

          {/* TREASURY TAB (NEW) */}
          <TabPanel>
            {selectedTab === 7 && (
              <div className="space-y-6">
                <Card>
                  <Title>Treasury & Revenue Management</Title>
                  <Text className="mt-2">
                    Monitor platform revenue, payout queues, and Vibez Coins economy
                  </Text>
                </Card>
                <RevenueTracker />
                <PayoutQueueManager />
                <Card>
                  <Title>Vibez Treasury (40-30-30)</Title>
                  <Text className="mt-2 text-sm text-slate-300">
                    Authoritative split ledger. Every Stripe / chair / Solana
                    payment is allocated 30% Team (13% Founder + 17% Core) ·
                    40% Operations · 30% Reserve. Founder draw auto-caps at
                    $20k/month once monthly revenue exceeds $1M.
                  </Text>
                  <div className="mt-4">
                    <TreasuryPanel />
                  </div>
                </Card>
                <BurnQueuePanel />
              </div>
            )}
          </TabPanel>

          {/* STAFF MANAGEMENT TAB (NEW) */}
          <TabPanel>
            {selectedTab === 8 && (
              <div className="space-y-6">
                <Card>
                  <Title>Staff & Permissions Management</Title>
                  <Text className="mt-2">Manage staff roles, permissions, and access levels</Text>
                </Card>
                <StaffManagement />
              </div>
            )}
          </TabPanel>

          {/* FOUNDER CONTROLS TAB — Escape Velocity + Chair-Holder Voting */}
          <TabPanel>
            {selectedTab === 9 && (
              <div className="space-y-6">
                <Card>
                  <Title>Founder Controls</Title>
                  <Text className="mt-2 text-sm text-slate-300">
                    Two switches you'll only ever pull a handful of times,
                    but every chair holder on the platform feels each one.
                    Be deliberate.
                  </Text>
                </Card>

                <Card>
                  <Title>Escape Velocity Control</Title>
                  <Text className="mt-2 text-sm text-slate-300">
                    The moment the platform hits its user milestone, pull
                    this switch to unlock the Reserve Vault chairs and pump
                    every holder's earn-rate +1× (Genius 3× → 4×, Genesis
                    2× → 3×, and so on). Auto-fires at the configured
                    timestamp; manual override below for when you call
                    the moment yourself. Irreversible — you only hit
                    escape velocity once.
                  </Text>
                  <div className="mt-4">
                    <ApexEvolutionControls />
                  </div>
                </Card>

                <Card>
                  <Title>Chair-Holder Broadcast · Voting</Title>
                  <Text className="mt-2 text-sm text-slate-300">
                    Pose a yes/no question to every chair holder. Only
                    chair holders see it on their dashboard. Tally
                    streams live here; flip on "Weighted" so Genius 3×
                    and Genesis 2× voices carry proportional pull.
                  </Text>
                  <div className="mt-4">
                    <ChairHolderVoting />
                  </div>
                </Card>

                {/* Sponsor Admin (verify pending → verified, no curl) */}
                <SponsorAdminPanel />

                {/* v11/v12 Sovereign Ops: Bridge Queue + Inactivity Reap + Burn-Slide */}
                <Card>
                  <Title>Sovereign Ops · v11/v12 Constitution</Title>
                  <Text className="mt-2 text-sm text-slate-300">
                    Three autonomous-economy levers. Every on-chain action is
                    dry-run by default; live mode is blocked server-side
                    until the safe phrase is pulled.
                  </Text>
                  <div className="mt-4">
                    <SovereignOpsPanel />
                  </div>
                </Card>
              </div>
            )}
          </TabPanel>

          {/* AUDIT LOGS TAB (NEW) */}
          <TabPanel>
            {selectedTab === 10 && (
              <div className="space-y-6">
                <Card>
                  <Title>Treasury · Audit Feed</Title>
                  <Text className="mt-2">
                    Live ledger of every chair purchase, payout, fee
                    adjustment, escrow release, and admin action. Treasury
                    snapshot up top, full audit feed below.
                  </Text>
                </Card>
                <TreasuryAuditView />

                <Card>
                  <Title>Phase Milestone Posts</Title>
                  <div className="flex items-center justify-between mt-2 gap-3 flex-wrap">
                    <Text className="text-sm text-slate-300 max-w-xl">
                    Auto-rendered social cards every time a chair phase
                    crosses 25%, 50%, 75%, or 100%. One-click "Post on X"
                    intent — your X account, our copy + image.
                    </Text>
                    <FounderNotificationToggle />
                  </div>
                  <div className="mt-4">
                    <MilestoneQueue />
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/5">
                    <MilestoneRecap />
                  </div>
                </Card>

                <Card>
                  <Title>Live Seats</Title>
                  <Text className="mt-2 text-sm text-slate-300">
                    Real-time grid of every founder currently sitting in an
                    active card-game table. Click "Spectate Table" on any
                    card to drop into the live game as an observer.
                  </Text>
                  <div className="mt-4">
                    <AdminSeatGrid />
                  </div>
                </Card>

                <Card>
                  <Title>Solana Network</Title>
                  <Text className="mt-2 text-sm text-slate-300">
                    Live RPC stats — priority-fee bands and recent TPS
                    samples. Today the platform is on Devnet (flat data by
                    design). The widget auto-flips to mainnet the moment
                    VIBEZ_SOLANA_RPC env points at one.
                  </Text>
                  <div className="mt-4">
                    <SolanaNetworkPanel />
                  </div>
                </Card>

                <Card>
                  <Title className="text-sm">Staff Action History (legacy)</Title>
                  <Text className="text-xs text-slate-400 mt-1">
                    Historical staff-only actions. Only populates if staff
                    accounts are active.
                  </Text>
                  <div className="mt-3">
                    <AuditLogViewer />
                  </div>
                </Card>
              </div>
            )}
          </TabPanel>

          {/* SYSTEM HEALTH MONITOR TAB */}
          <TabPanel>{selectedTab === 11 && <SystemHealthMonitor />}</TabPanel>

          {/* JFTN SOLANA ESCROW TAB */}
          <TabPanel>{selectedTab === 12 && <JFTNEscrowTab />}</TabPanel>

          {/* UNITY REWARDS ESCROW TAB */}
          <TabPanel>{selectedTab === 13 && <RewardsEscrowTab />}</TabPanel>

          {/* BETA FEEDBACK TAB — read submitted bug reports / suggestions. */}
          <TabPanel>{selectedTab === 14 && <BetaFeedbackTab />}</TabPanel>

          {/* SMARTSTACK OPS TAB — live dispatch panel for the founder. */}
          <TabPanel>{selectedTab === 15 && <SmartStackOpsTab />}</TabPanel>

          {/* GAME LOCKS TAB — per-room health for every shipped game. */}
          <TabPanel>{selectedTab === 16 && <GameLockStatusWidget />}</TabPanel>

          {/* TREASURY PULSE TAB — closed-loop infra wallet (v7 OMNI Blueprint) */}
          <TabPanel>{selectedTab === 17 && <TreasuryPulseWidget />}</TabPanel>
        </TabPanels>
      </TabGroup>
    </div>
  );
};

export default GodModeDashboard;
