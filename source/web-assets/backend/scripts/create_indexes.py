"""
Database Indexes & Performance Optimization
Improves query performance across all collections
"""
from config import get_database
import asyncio

async def create_all_indexes():
    """
    Create indexes for optimal query performance.
    Run this once during deployment.
    """
    db = get_database()
    
    print("🔧 Creating database indexes for performance optimization...")
    
    # Users collection
    await db.users.create_index("user_id", unique=True)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("subscription_tier")
    await db.users.create_index("created_at")
    print("✅ Users indexes created")
    
    # Subscriptions
    await db.subscriptions.create_index([("user_id", 1), ("status", 1)])
    await db.subscriptions.create_index("next_billing_date")
    await db.subscriptions.create_index("tier")
    print("✅ Subscriptions indexes created")
    
    # Battle Pass
    await db.battle_pass.create_index([("user_id", 1), ("season_id", 1)], unique=True)
    await db.battle_pass.create_index([("season_id", 1), ("current_tier", -1)])
    await db.battle_pass.create_index([("season_id", 1), ("has_premium", 1)])
    print("✅ Battle Pass indexes created")
    
    # Tournaments
    await db.tournaments.create_index("tournament_id", unique=True)
    await db.tournaments.create_index([("status", 1), ("start_time", 1)])
    await db.tournaments.create_index("game_type")
    print("✅ Tournaments indexes created")
    
    # Friendships
    await db.friendships.create_index([("user1_id", 1), ("user2_id", 1)])
    await db.friend_requests.create_index([("from_user_id", 1), ("to_user_id", 1)])
    await db.friend_requests.create_index("status")
    print("✅ Social indexes created")
    
    # Guilds
    await db.guilds.create_index("guild_id", unique=True)
    await db.guilds.create_index([("xp", -1)])  # For leaderboard
    print("✅ Guilds indexes created")
    
    # Game Stats
    await db.game_stats.create_index([("user_id", 1), ("game_type", 1)])
    await db.game_stats.create_index([("game_type", 1), ("wins", -1)])  # For leaderboards
    await db.game_results.create_index("completed_at")
    await db.game_results.create_index("winner_id")
    print("✅ Game stats indexes created")
    
    # Referrals
    await db.referral_codes.create_index("code", unique=True)
    await db.referral_codes.create_index("user_id")
    await db.referral_signups.create_index("new_user_id", unique=True)
    await db.referral_signups.create_index("referrer_id")
    print("✅ Referral indexes created")
    
    # Crypto Payments
    await db.crypto_deposits.create_index("deposit_id", unique=True)
    await db.crypto_deposits.create_index([("user_id", 1), ("status", 1)])
    await db.crypto_withdrawals.create_index([("user_id", 1), ("status", 1)])
    print("✅ Crypto payment indexes created")
    
    # Chat Messages
    await db.chat_messages.create_index([("channel", 1), ("timestamp", -1)])
    await db.chat_messages.create_index("user_id")
    print("✅ Chat indexes created")
    
    # Achievements
    await db.user_achievements.create_index([("user_id", 1), ("achievement_id", 1)], unique=True)
    print("✅ Achievement indexes created")
    
    # Admin Dashboard
    await db.coin_transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.coin_transactions.create_index([("type", 1), ("created_at", -1)])
    await db.jftn_transactions.create_index("streamer_id")
    await db.jftn_transactions.create_index("timestamp")
    print("✅ Transaction indexes created")
    
    # MetaHuman
    await db.announcements.create_index([("active", 1), ("expires_at", 1)])
    print("✅ Announcement indexes created")
    
    print("\n✅ All database indexes created successfully!")
    print("🚀 Query performance optimized!")

if __name__ == "__main__":
    asyncio.run(create_all_indexes())
