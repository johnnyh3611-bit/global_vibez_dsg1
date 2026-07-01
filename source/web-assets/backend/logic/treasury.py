"""
Vibez Coins Treasury System

Handles all coin-to-USD conversions, payout calculations, and exchange rates.
Exchange Rate: 2,000 Coins = $1.00 USD
Platform Fee: 5% on all cashouts
"""

from datetime import datetime, timedelta
from typing import Dict

# === CONSTANTS ===
EXCHANGE_RATE = 2000  # 2000 Vibez Coins = $1.00 USD
PLATFORM_FEE_PERCENT = 0.05  # 5% platform fee on cashouts
SECURITY_HOLD_HOURS = 72  # 72-hour verification period


def convert_coins_to_dollars(coin_amount: int) -> float:
    """
    Convert Vibez Coins to USD.
    
    Args:
        coin_amount: Number of Vibez Coins
        
    Returns:
        USD value rounded to 2 decimal places
        
    Example:
        >>> convert_coins_to_dollars(20000)
        10.0
        >>> convert_coins_to_dollars(100000)
        50.0
        >>> convert_coins_to_dollars(1000000)
        500.0
    """
    if coin_amount < 0:
        raise ValueError("Coin amount cannot be negative")
    
    dollars = coin_amount / EXCHANGE_RATE
    return round(dollars, 2)


def convert_dollars_to_coins(dollar_amount: float) -> int:
    """
    Convert USD to Vibez Coins.
    
    Args:
        dollar_amount: USD amount
        
    Returns:
        Number of Vibez Coins (integer)
        
    Example:
        >>> convert_dollars_to_coins(1.00)
        2000
        >>> convert_dollars_to_coins(5.00)
        10000
    """
    if dollar_amount < 0:
        raise ValueError("Dollar amount cannot be negative")
    
    coins = int(dollar_amount * EXCHANGE_RATE)
    return coins


def calculate_payout(coin_amount: int) -> Dict[str, float]:
    """
    Calculate payout with platform fee deduction.
    
    Args:
        coin_amount: Number of Vibez Coins to cash out
        
    Returns:
        Dictionary with:
        - gross: Gross USD value before fees
        - fee: Platform fee amount
        - net: Net payout after fees
        
    Example:
        >>> calculate_payout(20000)
        {'gross': 10.0, 'fee': 0.5, 'net': 9.5}
        >>> calculate_payout(100000)
        {'gross': 50.0, 'fee': 2.5, 'net': 47.5}
        >>> calculate_payout(1000000)
        {'gross': 500.0, 'fee': 25.0, 'net': 475.0}
    """
    if coin_amount < 0:
        raise ValueError("Coin amount cannot be negative")
    
    gross_usd = convert_coins_to_dollars(coin_amount)
    fee = gross_usd * PLATFORM_FEE_PERCENT
    net_payout = gross_usd - fee
    
    return {
        "gross": round(gross_usd, 2),
        "fee": round(fee, 2),
        "net": round(net_payout, 2)
    }


def calculate_security_release_date() -> datetime:
    """
    Calculate when a payout will be released from security hold.
    
    Returns:
        datetime object 72 hours from now
    """
    return datetime.utcnow() + timedelta(hours=SECURITY_HOLD_HOURS)


def format_coin_display(coin_amount: int) -> str:
    """
    Format coin amount for display (e.g., 1000 → "1K", 1000000 → "1M")
    
    Args:
        coin_amount: Number of Vibez Coins
        
    Returns:
        Formatted string with coin symbol
        
    Example:
        >>> format_coin_display(500)
        '₵500'
        >>> format_coin_display(1000)
        '₵1K'
        >>> format_coin_display(1000000)
        '₵1M'
    """
    if coin_amount >= 1_000_000:
        return f"₵{coin_amount / 1_000_000:.1f}M"
    elif coin_amount >= 1_000:
        return f"₵{coin_amount / 1_000:.1f}K"
    else:
        return f"₵{coin_amount}"


def validate_minimum_payout(coin_amount: int, minimum_coins: int = 20000) -> bool:
    """
    Check if coin amount meets minimum payout threshold.
    
    Args:
        coin_amount: Coins to cash out
        minimum_coins: Minimum required (default: 20,000 = $10)
        
    Returns:
        True if amount meets minimum, False otherwise
    """
    return coin_amount >= minimum_coins


# === PAYOUT CALCULATION TABLE ===
STANDARD_PAYOUTS = {
    20_000: {"usd": 10.00, "fee": 0.50, "net": 9.50},
    100_000: {"usd": 50.00, "fee": 2.50, "net": 47.50},
    1_000_000: {"usd": 500.00, "fee": 25.00, "net": 475.00},
}
