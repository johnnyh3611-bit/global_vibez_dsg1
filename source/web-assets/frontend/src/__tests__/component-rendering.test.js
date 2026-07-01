/**
 * Rendered-component tests for pure presentational components.
 * Uses @testing-library/react.
 */
import { render, screen } from '@testing-library/react';
import OverviewTab from '@/components/admin/tabs/OverviewTab';
import ResultPanel from '@/components/practice_games/blackjack/ResultPanel';
import HUDPanel from '@/components/practice_games/blackjack/HUDPanel';
import DealerSpeechBubble from '@/components/casino/dealer/DealerSpeechBubble';
import DealerStatusIndicator from '@/components/casino/dealer/DealerStatusIndicator';

describe('OverviewTab', () => {
  const stats = {
    pending_cashouts: 7,
    vr_dating_active: 12,
    pending_matches: 3,
    jftn_transactions_7d: 45,
  };

  test('renders all stat values from the stats prop', () => {
    render(<OverviewTab stats={stats} setSelectedTab={() => {}} />);
    expect(screen.getByText('Pending Cashouts')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
  });

  test('quick-action buttons have stable testids', () => {
    render(<OverviewTab stats={stats} setSelectedTab={() => {}} />);
    expect(screen.getByTestId('quick-action-announcement')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-payouts')).toBeInTheDocument();
    expect(screen.getByTestId('quick-action-users')).toBeInTheDocument();
  });

  test('Quick-action buttons invoke setSelectedTab with correct indices', () => {
    const mockSet = jest.fn();
    render(<OverviewTab stats={stats} setSelectedTab={mockSet} />);
    screen.getByTestId('quick-action-announcement').click();
    screen.getByTestId('quick-action-payouts').click();
    screen.getByTestId('quick-action-users').click();
    expect(mockSet).toHaveBeenNthCalledWith(1, 6);
    expect(mockSet).toHaveBeenNthCalledWith(2, 5);
    expect(mockSet).toHaveBeenNthCalledWith(3, 1);
  });

  test('handles missing stats gracefully', () => {
    render(<OverviewTab stats={null} setSelectedTab={() => {}} />);
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(4);
  });
});

describe('ResultPanel', () => {
  test('shows YOU WIN for player result', () => {
    const { container } = render(
      <ResultPanel result="player" playerScore={19} dealerScore={17} onNewRound={() => {}} />
    );
    expect(screen.getByText('YOU WIN')).toBeInTheDocument();
    expect(container.textContent).toContain('Player: 19');
    expect(container.textContent).toContain('Dealer: 17');
  });

  test('shows DEALER WINS for dealer result', () => {
    render(<ResultPanel result="dealer" playerScore={17} dealerScore={20} onNewRound={() => {}} />);
    expect(screen.getByText('DEALER WINS')).toBeInTheDocument();
  });

  test('shows PUSH for tie', () => {
    render(<ResultPanel result="push" playerScore={20} dealerScore={20} onNewRound={() => {}} />);
    expect(screen.getByText('PUSH')).toBeInTheDocument();
  });

  test('invokes onNewRound when New Round is clicked', () => {
    const cb = jest.fn();
    render(<ResultPanel result="player" playerScore={21} dealerScore={18} onNewRound={cb} />);
    screen.getByTestId('new-round-btn').click();
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe('HUDPanel', () => {
  test('formats large currency values with thousands separators', () => {
    render(<HUDPanel credits={12345} currentBet={500} />);
    expect(screen.getByTestId('balance-display')).toHaveTextContent('$12,345');
    expect(screen.getByTestId('bet-display')).toHaveTextContent('$500');
  });

  test('handles zero values', () => {
    render(<HUDPanel credits={0} currentBet={0} />);
    expect(screen.getByTestId('balance-display')).toHaveTextContent('$0');
  });
});

describe('DealerSpeechBubble', () => {
  test('renders the given phrase', () => {
    render(<DealerSpeechBubble phrase="Place your bets" />);
    expect(screen.getByTestId('dealer-speech-bubble')).toHaveTextContent('Place your bets');
  });

  test('returns null when phrase is falsy', () => {
    const { container } = render(<DealerSpeechBubble phrase="" />);
    expect(container.firstChild).toBeNull();
  });
});

describe('DealerStatusIndicator', () => {
  test('shows "Dealing" status when isDealing=true', () => {
    render(
      <DealerStatusIndicator isCelebrating={false} isDealing isShuffling={false} />
    );
    expect(screen.getByTestId('dealer-status')).toHaveTextContent('Dealing');
  });

  test('shows "Celebrating" (takes priority over dealing)', () => {
    render(
      <DealerStatusIndicator isCelebrating isDealing={false} isShuffling={false} />
    );
    expect(screen.getByTestId('dealer-status')).toHaveTextContent('Celebrating');
  });

  test('defaults to "Ready" when no state flags are set', () => {
    render(
      <DealerStatusIndicator isCelebrating={false} isDealing={false} isShuffling={false} />
    );
    expect(screen.getByTestId('dealer-status')).toHaveTextContent('Ready');
  });
});
