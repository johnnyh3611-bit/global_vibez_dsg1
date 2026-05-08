"""
Casino Game Models
Pydantic models for casino games
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ==================== BACCARAT MODELS ====================

class BaccaratBet(BaseModel):
    """Baccarat bet request"""
    bet_type: str = Field(..., description="'player', 'banker', or 'tie'")
    bet_amount: int = Field(..., gt=0, description="Bet amount in credits")
    game_mode: str = Field(default='standard', description="'standard', 'speed', or 'vip'")


class BaccaratGameResponse(BaseModel):
    """Baccarat game result"""
    game_id: str
    player_hand: List[dict]
    banker_hand: List[dict]
    player_score: int
    banker_score: int
    winner: Optional[str] = None
    phase: str
    bet_type: str
    bet_amount: int
    payout: int = 0


# ==================== BID WHIST MODELS ====================

class BidWhistStartGame(BaseModel):
    """Start a Bid Whist game"""
    partner_id: str
    opponent1_id: str
    opponent2_id: str
    wager: int = Field(default=0, ge=0)
    winning_score: int = Field(default=7, description="7 or 11 points")


class BidWhistBid(BaseModel):
    """Place a bid in Bid Whist"""
    game_id: str
    amount: int = Field(..., ge=0, le=7, description="0=pass, 3-7=bid amount")
    bid_type: str = Field(..., description="'uptown', 'downtown', or 'no_trump'")


class BidWhistPlayCard(BaseModel):
    """Play a card in Bid Whist"""
    game_id: str
    card: dict = Field(..., description="Card object with value and suit")


# ==================== VIBE SUITES MODELS ====================

class CreateSuiteRequest(BaseModel):
    """Create a Private Vibe Suite"""
    name: str = Field(..., min_length=3, max_length=50)
    description: Optional[str] = Field(default="", max_length=200)
    access_level: str = Field(default='token_gated', description="public, token_gated, nft_gated, invite_only, whitelist")
    entry_requirement: int = Field(default=500, description="Tokens required or NFT ID")
    theme: str = Field(default='cyber_lounge')
    max_players: int = Field(default=8, ge=2, le=20)
    available_games: List[str] = Field(default=['blackjack', 'baccarat'])
    enable_voice_chat: bool = True
    enable_video_chat: bool = False
    is_permanent: bool = False


class JoinSuiteRequest(BaseModel):
    """Join a Vibe Suite"""
    suite_id: str


class InvitePlayerRequest(BaseModel):
    """Invite player to suite"""
    suite_id: str
    player_id: str


# ==================== ADMIN MODELS ====================

class BanUserRequest(BaseModel):
    """Ban a user"""
    user_id: str
    reason: str = Field(..., min_length=5)
    duration_hours: Optional[int] = Field(default=None, description="None = permanent ban")


class SuspendUserRequest(BaseModel):
    """Suspend a user temporarily"""
    user_id: str
    reason: str = Field(..., min_length=5)
    duration_hours: int = Field(default=24, ge=1, le=720)  # Max 30 days


# ==================== DICE GAME MODELS ====================

class DiceBet(BaseModel):
    """Vibez 654 Dice bet"""
    bet_amount: int = Field(..., gt=0)
    side_bets: List[dict] = Field(default_factory=list)
    game_mode: str = Field(default='standard')


# ==================== WALLET MODELS ====================

class WalletTopup(BaseModel):
    """Top up wallet credits"""
    amount: int = Field(..., gt=0)
    payment_method: str = Field(default='stripe')


class WalletWithdraw(BaseModel):
    """Withdraw credits"""
    amount: int = Field(..., gt=0)
    destination: str
