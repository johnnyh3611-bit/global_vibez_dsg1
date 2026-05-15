import { Route } from 'react-router-dom';
import EntryFeePaywall from '@/pages/EntryFeePaywall';
import EntryFeeSuccess from '@/pages/EntryFeeSuccess';
import EntryFeeCancel from '@/pages/EntryFeeCancel';
import BattlePassDashboard from '@/pages/BattlePassDashboard';
import EliteSubscriptionPage from '@/pages/EliteSubscriptionPage';
import CosmeticsShop from '@/pages/CosmeticsShop';
import SubscriptionTiers from '@/pages/SubscriptionTiers';
import CryptoPayments from '@/pages/CryptoPayments';
import GiftShop from '@/pages/GiftShop';
import AchievementBadges from '@/pages/AchievementBadges';
import DailyChallenges from '@/pages/DailyChallenges';
import VIPRooms from '@/pages/VIPRooms';
import SeasonalEvents from '@/pages/SeasonalEvents';
import HighRollerCasino from '@/pages/HighRollerCasino';
import HighRollerBlackjack from '@/pages/HighRollerBlackjack';
import NFTMarketplace from '@/pages/NFTMarketplace';
import AffiliateProgram from '@/pages/AffiliateProgram';
import FoundersPass from '@/pages/FoundersPass';
import FoundersPassSuccess from '@/pages/FoundersPassSuccess';
import ChairVault from '@/pages/ChairVault';
import ChairWall from '@/pages/ChairWall';
import ChairHall from '@/pages/ChairHall';
import HowChairsWork from '@/pages/HowChairsWork';
import JoinByInvite from '@/pages/JoinByInvite';

import Referral from '@/pages/Referral';
import HungryVibez from '@/pages/HungryVibez';
import HungryVibezOrderTracking from '@/pages/HungryVibezOrderTracking';
import HungryVibesMerchant from '@/pages/HungryVibesMerchant';
import SmartStackDashboard from '@/pages/SmartStackDashboard';

export const monetizationRoutes = (ProtectedRoute) => (
  <>
    <Route 
      path="/entry-fee" 
      element={
        <ProtectedRoute>
          <EntryFeePaywall />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/entry-fee/success" 
      element={
        <ProtectedRoute>
          <EntryFeeSuccess />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/entry-fee/cancel" 
      element={
        <ProtectedRoute>
          <EntryFeeCancel />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/battle-pass" 
      element={
        <ProtectedRoute>
          <BattlePassDashboard />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/elite" 
      element={
        <ProtectedRoute>
          <EliteSubscriptionPage />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/cosmetics-shop" 
      element={
        <ProtectedRoute>
          <CosmeticsShop />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/subscriptions" 
      element={
        <ProtectedRoute>
          <SubscriptionTiers />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/gift-shop" 
      element={
        <ProtectedRoute>
          <GiftShop />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/achievements" 
      element={
        <ProtectedRoute>
          <AchievementBadges />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/daily-challenges" 
      element={
        <ProtectedRoute>
          <DailyChallenges />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/vip-rooms" 
      element={
        <ProtectedRoute>
          <VIPRooms />
        </ProtectedRoute>
      } 
    />
    {/* High Roller VIP Casino — 10,000-coin minimum tier with Stripe
        Checkout upgrade (Genius/Genesis/Apex). Lives at /casino/high-roller
        to keep it visually separate from the existing /vip-rooms suites. */}
    <Route
      path="/casino/high-roller"
      element={
        <ProtectedRoute>
          <HighRollerCasino />
        </ProtectedRoute>
      }
    />
    <Route
      path="/casino/high-roller/blackjack"
      element={
        <ProtectedRoute>
          <HighRollerBlackjack />
        </ProtectedRoute>
      }
    />
    <Route 
      path="/seasonal-events" 
      element={
        <ProtectedRoute>
          <SeasonalEvents />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/nft-marketplace" 
      element={
        <ProtectedRoute>
          <NFTMarketplace />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/affiliate" 
      element={
        <ProtectedRoute>
          <AffiliateProgram />
        </ProtectedRoute>
      } 
    />
    <Route path="/founders-pass" element={<FoundersPass />} />
    <Route path="/founders-pass/success" element={<FoundersPassSuccess />} />
    <Route path="/chair-vault" element={<ChairVault />} />
    <Route path="/chair-wall" element={<ChairWall />} />
    <Route path="/chair-hall" element={<ChairHall />} />
    <Route path="/chair-vault/success" element={<FoundersPassSuccess />} />
    <Route path="/how-chairs-work" element={<HowChairsWork />} />
    <Route path="/join/:code" element={<JoinByInvite />} />
    <Route 
      path="/crypto-payments" 
      element={
        <ProtectedRoute>
          <CryptoPayments />
        </ProtectedRoute>
      } 
    />
    <Route 
      path="/referrals" 
      element={
        <ProtectedRoute>
          <Referral />
        </ProtectedRoute>
      } 
    />
    {/* HungryVibes Consumer Page — beta-blocker fix (2026-02-09):
        FloatingFoodMenu, Landing accordions, and the dashboard tile
        all link to /hungryvibes. The page existed but was never
        registered — clicks bounced off App.js wildcard back to '/'.
        Mounted as PROTECTED so guest landing-page users still see the
        site CTA, while in-app FAB clicks resolve cleanly. */}
    <Route
      path="/hungryvibes"
      element={
        <ProtectedRoute>
          <HungryVibez />
        </ProtectedRoute>
      }
    />
    {/* Customer-side order tracking — live status timeline polling /my. */}
    <Route
      path="/hungryvibes/orders"
      element={
        <ProtectedRoute>
          <HungryVibezOrderTracking />
        </ProtectedRoute>
      }
    />
    {/* HungryVibes Merchant Dashboard — restaurant-owner self-serve
        portal (Feb 2026, GlobalVibez_HungryVibes_Merchant_Dashboard
        + GlobalVibez_Merchant_Promo_System PDFs). */}
    <Route
      path="/hungryvibes/merchant"
      element={
        <ProtectedRoute>
          <HungryVibesMerchant />
        </ProtectedRoute>
      }
    />
    {/* SmartStack Driver Dashboard — driver-revenue optimisation per
        GlobalVibez_Driver_SmartStack_Dashboard.pdf +
        GlobalVibez_Smart_Logistics_Stacking.pdf (Feb 2026). */}
    <Route
      path="/smartstack"
      element={
        <ProtectedRoute>
          <SmartStackDashboard />
        </ProtectedRoute>
      }
    />
  </>
);
