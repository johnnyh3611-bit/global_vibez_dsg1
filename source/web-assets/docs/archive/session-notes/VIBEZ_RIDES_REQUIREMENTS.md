# 🚗 VIBEZ RIDES - Safe Dating Transportation Platform

## Overview
Vibez Rides is Global Vibez DSG's integrated ride-sharing service designed specifically for safe dating transportation. Think "Uber for dates" with enhanced safety features, dual platforms (driver & rider), real-time tracking, and integrated dating app features.

---

## 🎯 Core Requirements

### 1. **DUAL PLATFORM SYSTEM**

#### A. **Driver Platform** 
**Purpose:** Allow verified drivers to accept ride requests and earn money

**Key Features Needed:**
- [ ] Driver registration & onboarding flow
- [ ] Driver verification system:
  - [ ] ID verification (government-issued)
  - [ ] Driver's license verification
  - [ ] Insurance verification (auto insurance required)
  - [ ] Background check integration
  - [ ] Vehicle registration verification
- [ ] Driver dashboard:
  - [ ] Real-time ride requests
  - [ ] Accept/decline ride interface
  - [ ] Navigation to pickup location
  - [ ] Navigation to drop-off location
  - [ ] Earnings tracker (daily/weekly/monthly)
  - [ ] Rating history
  - [ ] Trip history
- [ ] Driver status toggle (online/offline/busy)
- [ ] In-app navigation integration
- [ ] Driver-rider chat/call system (masked numbers)
- [ ] Safety features:
  - [ ] Emergency button (alerts authorities)
  - [ ] Share trip with emergency contact
  - [ ] 24/7 safety hotline access

#### B. **Rider/User Platform**
**Purpose:** Allow Global Vibez users to request safe rides to/from dates

**Key Features Needed:**
- [ ] Ride request interface:
  - [ ] Pickup location input (with map pin)
  - [ ] Destination input (with map pin)
  - [ ] Date/time scheduling (immediate or scheduled)
  - [ ] Vehicle type selection (standard, premium, XL)
  - [ ] Special instructions field
- [ ] Fare estimation before booking
- [ ] Real-time driver tracking:
  - [ ] See driver location on map
  - [ ] ETA to pickup
  - [ ] ETA to destination
  - [ ] Driver photo & vehicle info
  - [ ] Driver rating display
- [ ] In-ride features:
  - [ ] Live trip tracking (share with date/friends)
  - [ ] Chat with driver (in-app)
  - [ ] Call driver (masked number)
  - [ ] Route deviation alerts
  - [ ] Emergency SOS button
- [ ] Trip completion:
  - [ ] Automatic payment processing
  - [ ] Digital receipt
  - [ ] Rate driver experience
  - [ ] Tip driver option
- [ ] Ride history & receipts
- [ ] Saved locations (home, work, favorite date spots)

---

### 2. **MAPPING & NAVIGATION SYSTEM**

**Integration Options:**
1. **Google Maps API** (Recommended)
   - Turn-by-turn navigation
   - Real-time traffic updates
   - ETA calculations
   - Route optimization
   - Geocoding (address → coordinates)
   - Reverse geocoding (coordinates → address)

2. **Mapbox** (Alternative)
   - Custom styling for brand consistency
   - Real-time location tracking
   - Route matching
   - Navigation SDK

**Key Mapping Features Needed:**
- [ ] Interactive map display (pickup/dropoff pins)
- [ ] Real-time driver location updates (WebSocket)
- [ ] Route drawing on map (pickup → destination)
- [ ] Geofencing for service area limits
- [ ] Distance calculation for fare pricing
- [ ] Address autocomplete/search
- [ ] Save favorite locations
- [ ] Route replay (for trip history)

---

### 3. **PRICING SYSTEM**

#### A. **Fare Calculation Algorithm**
```
Base Fare = Fixed starting fee (e.g., $2.50)
+ Distance Fee = Cost per mile/km (e.g., $1.50/mile)
+ Time Fee = Cost per minute (e.g., $0.25/min)
+ Surge Pricing = Multiplier during high demand (e.g., 1.5x)
+ Service Fee = Platform commission (e.g., 15%)
+ Taxes & Fees = Local taxes & airport fees

Total Fare = Base + (Distance × Distance Fee) + (Time × Time Fee) × Surge Multiplier + Service Fee + Taxes
```

**Variables to Configure:**
- [ ] Base fare (per city/region)
- [ ] Per-mile/km rate
- [ ] Per-minute rate
- [ ] Minimum fare (e.g., $5)
- [ ] Cancellation fees
- [ ] Surge pricing rules:
  - [ ] Demand threshold triggers
  - [ ] Maximum surge multiplier (e.g., 3x)
  - [ ] Time-based surge (Friday nights, holidays)
- [ ] Premium vehicle pricing (luxury/XL rates)

#### B. **Driver Earnings Breakdown**
```
Driver Earnings = Total Fare - Platform Commission - Processing Fee
Platform Commission = 15-25% (industry standard)
Processing Fee = Payment processor fee (e.g., 2.9% + $0.30)
Tips = 100% to driver (no commission)
```

**Driver Payout System:**
- [ ] Weekly automatic payouts
- [ ] Instant cash-out option (small fee)
- [ ] Earnings dashboard with breakdowns
- [ ] Tax reporting (1099 forms for contractors)

#### C. **Payment Processing**
- [ ] Credit/debit card support
- [ ] Apple Pay / Google Pay
- [ ] Stored payment methods
- [ ] Split payment option (split ride cost with date)
- [ ] Ride credits & promo codes
- [ ] Refund system for issues

---

### 4. **SAFETY & VERIFICATION**

**Rider Safety Features:**
- [ ] Share trip with friends/family
- [ ] Trusted contacts (auto-notify on ride start)
- [ ] In-app emergency button (calls 911 + alerts Vibez safety team)
- [ ] Real-time trip monitoring by safety team
- [ ] Photo verification (ensure driver matches profile)
- [ ] License plate verification
- [ ] Two-way rating system
- [ ] Report incidents feature

**Driver Safety Features:**
- [ ] Rider verification (profile photo check)
- [ ] Report unsafe riders
- [ ] Insurance coverage during rides
- [ ] 24/7 driver support hotline

**Platform-Level Safety:**
- [ ] Background checks (Checkr integration)
- [ ] Continuous motor vehicle record monitoring
- [ ] Insurance verification (annual renewal required)
- [ ] Incident response team (24/7)
- [ ] Data encryption (rider/driver info)
- [ ] Ride recording option (driver consent)

---

### 5. **TECHNICAL ARCHITECTURE**

**Backend Services Needed:**
- [ ] `/api/rides/request` - Create ride request
- [ ] `/api/rides/{ride_id}` - Get ride details
- [ ] `/api/rides/{ride_id}/accept` - Driver accepts ride
- [ ] `/api/rides/{ride_id}/start` - Start ride
- [ ] `/api/rides/{ride_id}/complete` - Complete ride
- [ ] `/api/rides/{ride_id}/cancel` - Cancel ride
- [ ] `/api/rides/{ride_id}/location` - Update driver location
- [ ] `/api/rides/{ride_id}/rate` - Rate driver/rider
- [ ] `/api/drivers/register` - Driver registration
- [ ] `/api/drivers/verify` - Driver verification status
- [ ] `/api/drivers/earnings` - Driver earnings dashboard
- [ ] `/ws/rides/{ride_id}` - WebSocket for real-time updates

**Database Schema (MongoDB):**
```javascript
rides {
  ride_id: string,
  rider_id: string,
  driver_id: string (null until accepted),
  pickup_location: { lat, lng, address },
  dropoff_location: { lat, lng, address },
  status: 'requested' | 'accepted' | 'arriving' | 'in_progress' | 'completed' | 'cancelled',
  fare: { base, distance_fee, time_fee, surge, total, driver_earnings },
  vehicle_type: 'standard' | 'premium' | 'xl',
  scheduled_time: datetime (null for immediate),
  requested_at: datetime,
  accepted_at: datetime,
  started_at: datetime,
  completed_at: datetime,
  route: { distance_miles, estimated_duration_mins, actual_duration_mins },
  payment: { method, transaction_id, status },
  ratings: { rider_rating, driver_rating, comments }
}

drivers {
  driver_id: string,
  user_id: string,
  verification_status: 'pending' | 'verified' | 'rejected',
  license: { number, expiry, state, verified },
  insurance: { policy_number, expiry, company, verified },
  vehicle: { make, model, year, color, license_plate },
  background_check: { status, completed_at, provider },
  earnings: { total_lifetime, current_week, available_balance },
  rating: { average, total_trips, five_star_count },
  status: 'offline' | 'online' | 'busy',
  current_location: { lat, lng, updated_at }
}
```

**Real-Time Updates:**
- [ ] WebSocket connection for live driver location
- [ ] Push notifications (ride requests, driver arrived, etc.)
- [ ] SMS notifications (critical alerts)

---

### 6. **INTEGRATION WITH DATING APP**

**Cross-Feature Integration:**
- [ ] "Request Ride to Date" button in match chat
- [ ] Auto-fill destination from date location
- [ ] Share ride status with date
- [ ] Post-date ride home suggestion
- [ ] Split fare with date option
- [ ] Date safety: Share ride details with date automatically
- [ ] Premium members: Discounted rides (10% off)
- [ ] First ride free promo for new users

---

### 7. **LEGAL & COMPLIANCE**

**Required Before Launch:**
- [ ] Terms of Service for drivers
- [ ] Terms of Service for riders
- [ ] Privacy policy (location data handling)
- [ ] Insurance policy for platform (commercial auto insurance)
- [ ] Business licenses (per city/state)
- [ ] Driver employment classification (independent contractors)
- [ ] ADA compliance (accessible vehicle options)
- [ ] Age verification (18+ for both drivers and riders)
- [ ] Payment processing compliance (PCI DSS)
- [ ] Data protection compliance (GDPR/CCPA)

---

### 8. **MVP vs FULL LAUNCH**

**MVP (Minimum Viable Product) - Launch v1:**
- ✅ Basic ride request & acceptance
- ✅ Real-time driver tracking
- ✅ Simple pricing (no surge)
- ✅ Driver & rider verification
- ✅ Google Maps integration
- ✅ Payment processing (Stripe)
- ✅ Basic safety features (SOS button, share trip)

**Full Launch - v2 Features:**
- [ ] Surge pricing algorithm
- [ ] Scheduled rides
- [ ] Multiple vehicle types
- [ ] In-app chat/call
- [ ] Ride splitting
- [ ] Driver referral bonuses
- [ ] Rider loyalty program
- [ ] Advanced route optimization
- [ ] Ride credits & gift cards

---

## 🚀 IMPLEMENTATION PRIORITY

### **Phase 1: Core Infrastructure** (Month 1)
1. Database schema design
2. Basic API endpoints (request, accept, complete)
3. Google Maps API integration
4. Simple fare calculation

### **Phase 2: Driver Platform** (Month 2)
1. Driver registration flow
2. Verification system integration
3. Driver dashboard
4. Earnings tracker

### **Phase 3: Rider Platform** (Month 3)
1. Ride request UI
2. Real-time tracking map
3. Payment integration (Stripe)
4. Trip history

### **Phase 4: Safety & Polish** (Month 4)
1. Emergency features
2. Background checks
3. Insurance verification
4. Testing & bug fixes

### **Phase 5: Launch** (Month 5)
1. Beta testing with select users
2. Marketing rollout
3. Driver recruitment
4. Public launch

---

## 📊 SUCCESS METRICS

**Key Performance Indicators (KPIs):**
- Driver sign-ups (target: 100+ in first month)
- Completed rides (target: 500+ in first month)
- Average driver earnings per week
- Rider satisfaction rating (target: 4.5+/5)
- Driver satisfaction rating (target: 4.5+/5)
- Platform commission revenue
- Ride acceptance rate (target: 90%+)
- Average wait time for pickup (target: <5 mins)

---

## 💡 COMPETITIVE ADVANTAGES

What makes Vibez Rides different from Uber/Lyft:
1. **Built for daters** - Integration with dating app features
2. **Enhanced safety** - Date-specific safety features
3. **Premium verification** - Higher driver/rider verification standards
4. **Date-friendly** - Split fares, share rides with dates
5. **Community focus** - Drivers are part of Global Vibez community
6. **Rewards integration** - Earn rewards for dates & rides

---

## 📝 NOTES & REMINDERS

- ⚠️ **LEGAL**: Must consult with lawyer before launch (liability, insurance, local regulations)
- ⚠️ **INSURANCE**: Need commercial ride-sharing insurance policy
- ⚠️ **CITY PERMITS**: Some cities require ride-share permits (NYC, SF, etc.)
- ⚠️ **DRIVER CLASSIFICATION**: Ensure drivers are properly classified as independent contractors
- ⚠️ **PAYMENT PROCESSING**: Stripe Connect recommended for marketplace (driver payouts)
- ⚠️ **BACKGROUND CHECKS**: Use Checkr or similar service (costs ~$30/driver)
- ⚠️ **MAPPING**: Google Maps API costs scale with usage (budget ~$0.005/request)

---

## 🔗 USEFUL RESOURCES

- Stripe Connect: https://stripe.com/connect
- Google Maps Platform: https://developers.google.com/maps
- Checkr Background Checks: https://checkr.com
- Twilio (SMS/Call masking): https://www.twilio.com
- Firebase (Push notifications): https://firebase.google.com

---

**STATUS:** 📋 Documentation Complete - Ready for Development

**NEXT STEP:** Begin Phase 1 implementation after game development is complete.
