"""
Cosmetics & Themes System - Backend
Store for purchasing skins, themes, and customization items
"""

from fastapi import APIRouter, HTTPException
from typing import Dict, Optional, Any
from datetime import datetime, timezone
from pydantic import BaseModel
from utils.database import get_database

router = APIRouter()

# Cosmetics Catalog
COSMETICS_CATALOG = {
    # Checkers Pieces
    'checkers_gold_pieces': {
        'id': 'checkers_gold_pieces',
        'name': 'Golden Pieces',
        'description': 'Luxurious gold and silver pieces',
        'type': 'checkers_skin',
        'price_xp': 500,
        'price_usd': 1.99,
        'rarity': 'rare',
        'preview_image': '/assets/cosmetics/checkers_gold.png'
    },
    'checkers_neon': {
        'id': 'checkers_neon',
        'name': 'Neon Glow',
        'description': 'Electric neon pieces with glow effects',
        'type': 'checkers_skin',
        'price_xp': 1000,
        'price_usd': 2.99,
        'rarity': 'epic',
        'preview_image': '/assets/cosmetics/checkers_neon.png'
    },
    
    # Board Themes
    'board_dark_mode': {
        'id': 'board_dark_mode',
        'name': 'Dark Mode',
        'description': 'Sleek dark theme for all boards',
        'type': 'board_theme',
        'price_xp': 300,
        'price_usd': 0.99,
        'rarity': 'common',
        'preview_image': '/assets/cosmetics/dark_mode.png'
    },
    'board_celestial': {
        'id': 'board_celestial',
        'name': 'Celestial Glass',
        'description': 'Translucent glass theme with stars',
        'type': 'board_theme',
        'price_xp': 1500,
        'price_usd': 4.99,
        'rarity': 'legendary',
        'preview_image': '/assets/cosmetics/celestial.png'
    },
    
    # Card Backs (Spades, UNO)
    'cards_royal': {
        'id': 'cards_royal',
        'name': 'Royal Deck',
        'description': 'Elegant royal-themed card backs',
        'type': 'card_back',
        'price_xp': 750,
        'price_usd': 2.49,
        'rarity': 'rare',
        'preview_image': '/assets/cosmetics/royal_cards.png'
    },
    'cards_cyberpunk': {
        'id': 'cards_cyberpunk',
        'name': 'Cyberpunk Deck',
        'description': 'Futuristic neon card design',
        'type': 'card_back',
        'price_xp': 2000,
        'price_usd': 5.99,
        'rarity': 'legendary',
        'preview_image': '/assets/cosmetics/cyberpunk_cards.png'
    },
    
    # Chat Themes
    'chat_vip': {
        'id': 'chat_vip',
        'name': 'VIP Chat Theme',
        'description': 'Exclusive gold chat bubble design',
        'type': 'chat_theme',
        'price_xp': 1000,
        'price_usd': 2.99,
        'rarity': 'epic',
        'preview_image': '/assets/cosmetics/vip_chat.png'
    }
}


class PurchaseRequest(BaseModel):
    user_id: str
    item_id: str
    currency: str  # 'xp' or 'usd'


@router.get("/cosmetics/catalog")
async def get_catalog(category: Optional[str] = None) -> Dict[str, Any]:
    """Get cosmetics catalog"""
    if category:
        filtered = {k: v for k, v in COSMETICS_CATALOG.items() if v['type'] == category}
        return {'items': filtered, 'count': len(filtered)}
    
    return {'items': COSMETICS_CATALOG, 'count': len(COSMETICS_CATALOG)}


@router.get("/cosmetics/inventory/{user_id}")
async def get_user_inventory(user_id: str) -> Dict[str, Any]:
    """Get user's owned cosmetics"""
    db = get_database()
    
    inventory = await db.user_cosmetics.find_one({'user_id': user_id}, {'_id': 0})
    
    if not inventory:
        return {
            'user_id': user_id,
            'owned_items': [],
            'equipped': {}
        }
    
    return inventory


@router.post("/cosmetics/purchase")
async def purchase_cosmetic(request: PurchaseRequest) -> Dict[str, Any]:
    """Purchase a cosmetic item"""
    db = get_database()
    
    # Validate item exists
    if request.item_id not in COSMETICS_CATALOG:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item = COSMETICS_CATALOG[request.item_id]
    
    # Check if user already owns it
    inventory = await db.user_cosmetics.find_one({'user_id': request.user_id}, {'_id': 0})
    if inventory and request.item_id in inventory.get('owned_items', []):
        raise HTTPException(status_code=400, detail="Item already owned")
    
    # Handle XP purchase
    if request.currency == 'xp':
        price = item['price_xp']
        
        # Check user has enough XP
        user_prog = await db.user_progression.find_one({'user_id': request.user_id}, {'_id': 0})
        if not user_prog or user_prog.get('total_xp', 0) < price:
            raise HTTPException(status_code=400, detail="Insufficient XP")
        
        # Deduct XP (don't reduce level, just track spent XP)
        await db.user_progression.update_one(
            {'user_id': request.user_id},
            {'$inc': {'spent_xp': price}}
        )
        
        payment_method = 'xp'
        amount_paid = price
    
    # Handle USD purchase (Stripe integration)
    elif request.currency == 'usd':
        # For now, return payment intent
        # In production, integrate with Stripe
        return {
            'success': False,
            'requires_payment': True,
            'amount': item['price_usd'],
            'stripe_payment_intent': 'pi_placeholder',
            'message': 'Stripe integration required'
        }
    
    else:
        raise HTTPException(status_code=400, detail="Invalid currency")
    
    # Add item to inventory
    if not inventory:
        inventory = {
            'user_id': request.user_id,
            'owned_items': [],
            'equipped': {},
            'created_at': datetime.now(timezone.utc).isoformat()
        }
    
    inventory['owned_items'].append(request.item_id)
    inventory['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.user_cosmetics.update_one(
        {'user_id': request.user_id},
        {'$set': inventory},
        upsert=True
    )
    
    # Log purchase
    await db.cosmetic_purchases.insert_one({
        'user_id': request.user_id,
        'item_id': request.item_id,
        'item_name': item['name'],
        'payment_method': payment_method,
        'amount_paid': amount_paid,
        'currency': request.currency,
        'timestamp': datetime.now(timezone.utc).isoformat()
    })
    
    return {
        'success': True,
        'item': item,
        'payment_method': payment_method,
        'amount_paid': amount_paid
    }


@router.post("/cosmetics/equip")
async def equip_cosmetic(user_id: str, item_id: str, slot: str) -> Dict[str, Any]:
    """Equip a cosmetic item"""
    db = get_database()
    
    # Validate user owns the item
    inventory = await db.user_cosmetics.find_one({'user_id': user_id}, {'_id': 0})
    
    if not inventory or item_id not in inventory.get('owned_items', []):
        raise HTTPException(status_code=400, detail="Item not owned")
    
    # Equip item to slot (e.g., 'checkers_skin', 'board_theme', 'card_back')
    if 'equipped' not in inventory:
        inventory['equipped'] = {}
    
    inventory['equipped'][slot] = item_id
    
    await db.user_cosmetics.update_one(
        {'user_id': user_id},
        {'$set': {'equipped': inventory['equipped']}}
    )
    
    return {
        'success': True,
        'equipped': inventory['equipped']
    }


@router.get("/cosmetics/stats")
async def get_cosmetics_stats() -> Dict[str, Any]:
    """Get cosmetics statistics"""
    db = get_database()
    
    total_purchases = await db.cosmetic_purchases.count_documents({})
    total_revenue_xp = list(await db.cosmetic_purchases.aggregate([
        {'$match': {'currency': 'xp'}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount_paid'}}}
    ]).to_list(1))
    
    return {
        'total_purchases': total_purchases,
        'total_revenue_xp': total_revenue_xp[0]['total'] if total_revenue_xp else 0,
        'catalog_size': len(COSMETICS_CATALOG)
    }
