"""
Marketplace Demo Seeder (May 2026)
─────────────────────────────────────────────────────────────────
Seeds 4 demo restaurants + 3 demo rides + 2 demo drivers so beta
testers see content the first time they hit the customer pages,
not empty grids.

Idempotent via stable `seed_id` markers — re-running heals (refreshes
content) but never duplicates. Safe on every backend boot.

Sister to:
  • beta_tester_seeder.py        (seeds beta accounts)
  • jftn_demo_room_seeder.py     (seeds JFTN late-night rooms)
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# ─────────────────────────────  Restaurants  ─────────────────────────────
DEMO_RESTAURANTS = [
    {
        "seed_id": "demo_restaurant_marios_pizza",
        "name": "Mario's Wood-Fired Pizza",
        "owner_name": "Mario Rossi",
        "venue_type": "restaurant",
        "cuisine_type": ["italian"],
        "address": "234 Halsted St",
        "city": "Chicago",
        "state": "IL",
        "zip_code": "60607",
        "lat": 41.8819,
        "lng": -87.6478,
        "phone": "773-555-0150",
        "description": "Family wood-fired pizza & handmade pasta. Sicilian recipes since 1987.",
        "price_range": "$$",
        "ambiance": ["casual"],
        "hours": "Mon–Sun 11am–10pm",
        "photo_url": "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?auto=format&fit=crop&w=900&q=70",
        "menu_items": [
            {"name": "Margherita Pizza",      "price": 14.50, "category": "pizza", "description": "San Marzano · fresh mozz · basil"},
            {"name": "Pepperoni Slice",       "price":  4.50, "category": "pizza", "description": "Big NY-style slice"},
            {"name": "Linguine Carbonara",    "price": 16.00, "category": "pasta", "description": "Pancetta · pecorino · cracked pepper"},
            {"name": "Tiramisu",              "price":  7.00, "category": "dessert"},
        ],
    },
    {
        "seed_id": "demo_restaurant_jaes_soulfood",
        "name": "Jae's Soul Kitchen",
        "owner_name": "Jaylen Carter",
        "venue_type": "restaurant",
        "cuisine_type": ["soul"],
        "address": "1809 E 71st St",
        "city": "Chicago",
        "state": "IL",
        "zip_code": "60649",
        "lat": 41.7641,
        "lng": -87.5829,
        "phone": "773-555-0212",
        "description": "Sunday-dinner soul food every day. Mac, ribs, greens, peach cobbler.",
        "price_range": "$$",
        "ambiance": ["homestyle", "family-friendly"],
        "hours": "Tue–Sun 11am–9pm",
        "photo_url": "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=900&q=70",
        "menu_items": [
            {"name": "Smothered Pork Chops",  "price": 17.00, "category": "entree", "description": "Brown gravy · onions · mash"},
            {"name": "Honey Hot Wings (8pc)", "price": 12.50, "category": "appetizer"},
            {"name": "Mac & Cheese (large)",  "price":  9.00, "category": "side"},
            {"name": "Peach Cobbler",         "price":  6.50, "category": "dessert"},
        ],
    },
    {
        "seed_id": "demo_restaurant_lucky_taco",
        "name": "Lucky Taco Truck",
        "owner_name": "Rosa Hernández",
        "venue_type": "restaurant",
        "cuisine_type": ["mexican"],
        "address": "Pilsen · 18th & Loomis",
        "city": "Chicago",
        "state": "IL",
        "zip_code": "60608",
        "lat": 41.8576,
        "lng": -87.6622,
        "phone": "773-555-0322",
        "description": "Late-night street tacos · al pastor on the trompo · agua frescas.",
        "price_range": "$",
        "ambiance": ["street", "casual"],
        "hours": "Wed–Sat 5pm–2am",
        "photo_url": "https://images.unsplash.com/photo-1565299507177-b0ac66763828?auto=format&fit=crop&w=900&q=70",
        "menu_items": [
            {"name": "Al Pastor Taco",        "price":  3.50, "category": "taco"},
            {"name": "Birria Quesadilla",     "price":  9.00, "category": "entree", "description": "With consomé dip"},
            {"name": "Elote en Vaso",         "price":  5.00, "category": "side"},
            {"name": "Horchata",              "price":  3.50, "category": "drink"},
        ],
    },
    {
        "seed_id": "demo_restaurant_pho_phenom",
        "name": "Pho Phenom",
        "owner_name": "Linh Nguyen",
        "venue_type": "restaurant",
        "cuisine_type": ["vietnamese"],
        "address": "1112 W Argyle St",
        "city": "Chicago",
        "state": "IL",
        "zip_code": "60640",
        "lat": 41.9737,
        "lng": -87.6603,
        "phone": "773-555-0440",
        "description": "Hand-pulled rice noodles · 12-hour bone broth · banh mi & vermicelli bowls.",
        "price_range": "$$",
        "ambiance": ["cozy"],
        "hours": "Mon–Sun 10am–9pm",
        "photo_url": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=900&q=70",
        "menu_items": [
            {"name": "Pho Tai (rare beef)",   "price": 12.00, "category": "entree"},
            {"name": "Banh Mi Combo",         "price":  8.50, "category": "sandwich"},
            {"name": "Bun Bo Hue (spicy)",    "price": 13.50, "category": "entree"},
            {"name": "Vietnamese Iced Coffee","price":  4.50, "category": "drink"},
        ],
    },
]

# ─────────────────────────────  VibeRidez drivers + rides  ─────────────────────────────
DEMO_DRIVERS = [
    {
        "seed_id": "demo_driver_keisha",
        "user_id": "demo_driver_keisha",
        "username": "KeishaDrives",
        "name": "Keisha Williams",
        "profile_photo": None,
        "rating": 4.9,
        "license_verified": True,
        "vehicle": {"year": 2021, "make": "Honda", "model": "Accord",  "color": "Pearl White", "plate": "VBZ-501"},
    },
    {
        "seed_id": "demo_driver_diego",
        "user_id": "demo_driver_diego",
        "username": "DiegoOnTheMove",
        "name": "Diego Reyes",
        "profile_photo": None,
        "rating": 4.8,
        "license_verified": True,
        "vehicle": {"year": 2023, "make": "Toyota", "model": "Sienna", "color": "Charcoal",   "plate": "VBZ-870"},
    },
]

DEMO_RIDES = [
    # (seed_id, driver_seed, pickup, dropoff, depart_offset_hours, seats, $/seat, notes)
    ("demo_ride_loop_to_ohare",       "demo_driver_keisha",
     {"city": "Chicago",   "address": "Loop · Millennium Park",     "zip_code": "60601", "lat": 41.8826, "lng": -87.6233},
     {"city": "Chicago",   "address": "ORD Airport · Terminal 3",   "zip_code": "60666", "lat": 41.9789, "lng": -87.9047},
     2,  3, 18.00, "Round-the-clock airport runs · trunk fits 2 large bags."),
    ("demo_ride_pilsen_to_southside", "demo_driver_diego",
     {"city": "Chicago",   "address": "Pilsen · 18th & Halsted",    "zip_code": "60608", "lat": 41.8576, "lng": -87.6477},
     {"city": "Chicago",   "address": "Hyde Park · 53rd & Lake",    "zip_code": "60615", "lat": 41.7993, "lng": -87.5915},
     1,  3, 12.00, "Late-night pickups Fri/Sat after the bars close."),
    ("demo_ride_chicago_to_milwaukee","demo_driver_keisha",
     {"city": "Chicago",   "address": "Wicker Park · Damen Stop",   "zip_code": "60622", "lat": 41.9093, "lng": -87.6776},
     {"city": "Milwaukee", "address": "Downtown · Public Market",   "zip_code": "53202", "lat": 43.0349, "lng": -87.9145},
     6,  4, 38.00, "Long-haul carpool · split a tank · phone charger included."),
]


# ─────────────────────────────  Seeder  ─────────────────────────────
async def run_seeder() -> dict:
    """Idempotent seed of restaurants + drivers + rides. Returns counts."""
    from utils.database import get_database

    db = get_database()
    now = datetime.now(timezone.utc)

    # ───── Restaurants ─────
    rest_created = rest_healed = rest_skipped = 0
    for spec in DEMO_RESTAURANTS:
        seed_id = spec["seed_id"]
        existing = await db.restaurants.find_one({"seed_id": seed_id}, {"_id": 0})
        doc_core = {
            "seed_id":       seed_id,
            "name":          spec["name"],
            "owner_name":    spec["owner_name"],
            "venue_type":    spec["venue_type"],
            "cuisine_type":  spec["cuisine_type"],
            "address":       spec["address"],
            "city":          spec["city"],
            "state":         spec["state"],
            "zip_code":      spec["zip_code"],
            "lat":           spec["lat"],
            "lng":           spec["lng"],
            "phone":         spec["phone"],
            "description":   spec["description"],
            "price_range":   spec["price_range"],
            "ambiance":      spec["ambiance"],
            "hours":         spec["hours"],
            "photo_url":     spec["photo_url"],
            "listing_status": "approved",   # pre-approved demo
            "is_demo":        True,
            "menu_items":     [
                {"item_id": f"menu_{seed_id[-8:]}_{i}", **m, "available": True}
                for i, m in enumerate(spec["menu_items"])
            ],
            "updated_at":     now.isoformat(),
        }
        if not existing:
            doc_core["restaurant_id"] = f"rest_demo_{seed_id.split('_')[-2]}"
            doc_core["created_at"] = now.isoformat()
            await db.restaurants.insert_one(doc_core)
            rest_created += 1
        else:
            await db.restaurants.update_one({"seed_id": seed_id}, {"$set": doc_core})
            rest_healed += 1

    # ───── Drivers ─────
    drv_created = drv_healed = 0
    for d in DEMO_DRIVERS:
        existing = await db.vibe_ridez_drivers.find_one({"seed_id": d["seed_id"]}, {"_id": 0})
        doc = {
            "seed_id":          d["seed_id"],
            "driver_id":        f"drv_{d['seed_id'].split('_')[-1]}",
            "user_id":          d["user_id"],
            "username":         d["username"],
            "name":             d["name"],
            "profile_photo":    d.get("profile_photo"),
            "rating":           d["rating"],
            "license_verified": d["license_verified"],
            "is_active":        True,
            "is_demo":          True,
            "vehicle":          d["vehicle"],
            "updated_at":       now.isoformat(),
        }
        if not existing:
            doc["created_at"] = now.isoformat()
            await db.vibe_ridez_drivers.insert_one(doc)
            drv_created += 1
        else:
            await db.vibe_ridez_drivers.update_one({"seed_id": d["seed_id"]}, {"$set": doc})
            drv_healed += 1

    # Build a (seed→driver) lookup so rides can join.
    drivers_by_seed: dict[str, dict] = {}
    async for d in db.vibe_ridez_drivers.find({"is_demo": True}, {"_id": 0}):
        drivers_by_seed[d["seed_id"]] = d

    # ───── Rides ─────
    ride_created = ride_healed = 0
    for seed_id, driver_seed, pickup, dropoff, depart_offset, seats, price, notes in DEMO_RIDES:
        driver = drivers_by_seed.get(driver_seed)
        if not driver:
            continue
        existing = await db.vibe_ridez_rides.find_one({"seed_id": seed_id}, {"_id": 0})
        v = driver["vehicle"]
        ride_doc = {
            "seed_id":             seed_id,
            "driver_id":           driver["driver_id"],
            "driver_user_id":      driver["user_id"],
            "driver_username":     driver["username"],
            "driver_photo":        driver.get("profile_photo"),
            "driver_rating":       driver.get("rating", 5.0),
            "vehicle_info":        f"{v['year']} {v['make']} {v['model']} - {v['color']}",
            "pickup_location":     pickup,
            "dropoff_location":    dropoff,
            "departure_time":      now + timedelta(hours=depart_offset),
            "available_seats":     seats,
            "price_per_seat":      price,
            "total_distance_miles": None,
            "estimated_duration_mins": None,
            "passenger_ids":       [],
            "passenger_usernames": [],
            "max_passengers":      seats,
            "status":              "scheduled",
            "notes":               notes,
            "is_demo":             True,
            "updated_at":          now.isoformat(),
        }
        if not existing:
            ride_doc["ride_id"]    = f"ride_demo_{uuid.uuid4().hex[:10]}"
            ride_doc["created_at"] = now
            await db.vibe_ridez_rides.insert_one(ride_doc)
            ride_created += 1
        else:
            await db.vibe_ridez_rides.update_one({"seed_id": seed_id}, {"$set": ride_doc})
            ride_healed += 1

    logger.info(
        "marketplace seeder · restaurants(c=%d h=%d) drivers(c=%d h=%d) rides(c=%d h=%d)",
        rest_created, rest_healed, drv_created, drv_healed, ride_created, ride_healed,
    )
    return {
        "restaurants_created": rest_created, "restaurants_healed": rest_healed,
        "drivers_created":     drv_created,  "drivers_healed":     drv_healed,
        "rides_created":       ride_created, "rides_healed":       ride_healed,
    }
