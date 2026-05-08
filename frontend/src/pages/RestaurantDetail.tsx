import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, MapPin, Phone, Globe, Clock, Star, DollarSign, Calendar, Heart, ExternalLink, Crown, Coins, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import TopUpVibezCoinsModal from '@/components/wallet/TopUpVibezCoinsModal';

const API = process.env.REACT_APP_BACKEND_URL;

export default function RestaurantDetail() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  // ₵-vs-card toggle for menu-item orders. Default to ₵ — that's the
  // unified-market UX where every coin spent burns supply for the 3B cap.
  const [orderMethod, setOrderMethod] = useState<'coins' | 'card'>('coins');
  const [orderingId, setOrderingId] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [topUpRecommended, setTopUpRecommended] = useState<string>('popular');
  const [topUpContext, setTopUpContext] = useState<string>('');

  useEffect(() => {
    fetchRestaurantDetail();
  }, [restaurantId]);

  const fetchRestaurantDetail = async () => {
    try {
      const response = await fetch(`${API}/api/restaurants/${restaurantId}`);
      if (!response.ok) throw new Error('Restaurant not found');

      const data = await response.json();
      setRestaurant(data);
    } catch (err) {
      // console.error('Error fetching restaurant:', err);
      alert('Restaurant not found');
      navigate('/restaurants');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!restaurant) return null;

  const upgradeToPartner = async () => {
    try {
      const r = await fetch(
        `${API}/api/vibe-venues/restaurants/${restaurantId}/checkout`,
        { method: "POST" },
      );
      const data = await r.json();
      if (!r.ok || !data.checkout_url) throw new Error(data.detail || 'Stripe checkout failed');
      window.location.href = data.checkout_url;
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const orderMenuItem = async (item: any) => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      navigate('/login');
      return;
    }
    setOrderingId(item.item_id);
    try {
      const lat = restaurant?.lat || 41.88;
      const lng = restaurant?.lng || -87.65;
      const res = await fetch(`${API}/api/hungryvibes/orders/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          merchant_id: restaurant?.restaurant_id || restaurantId,
          pickup_at: { lat, lng },
          deliver_to: { lat, lng },   // placeholder — real flow uses user's address
          food_payout_usd: parseFloat(item.price),
          note: `Order: ${item.name}`,
          payment_method: orderMethod,
        }),
      });
      const data = await res.json();
      if (res.status === 402 || /insufficient/i.test(data.detail || '')) {
        const m = /need\s*₵?(\d+).*have\s*₵?(\d+)/i.exec(data.detail || '');
        const need = m ? parseInt(m[1], 10) : 0;
        const have = m ? parseInt(m[2], 10) : 0;
        const gap = Math.max(0, need - have);
        setTopUpRecommended(gap <= 10000 ? 'starter' : gap <= 20000 ? 'popular' : gap <= 50000 ? 'pro' : 'vip');
        setTopUpContext(`This order costs ₵${need.toLocaleString()} — your wallet has ₵${have.toLocaleString()}.`);
        setTopUpOpen(true);
        return;
      }
      if (!res.ok) {
        toast.error(data.detail || 'Order failed');
        return;
      }
      toast.success(orderMethod === 'coins'
        ? `🎉 Order placed! ₵${(parseFloat(item.price) * 2000).toLocaleString()} debited.`
        : `🎉 Order placed!`);
    } catch (e: any) {
      toast.error(e?.message || 'Network error');
    } finally {
      setOrderingId(null);
    }
  };

  const menuCategories: string[] = Array.from(new Set(restaurant.menu_items?.map((item: any) => item.category) || []));
  const filteredMenu = selectedCategory === 'all' 
    ? restaurant.menu_items 
    : restaurant.menu_items?.filter(item => item.category === selectedCategory);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-pink-50 to-red-50 pb-20">
      {!restaurant.subscription_active && (
        <div className="bg-gradient-to-r from-fuchsia-600 to-purple-700 text-white px-4 py-3 text-center" data-testid="restaurant-upgrade-banner">
          <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-center gap-3">
            <Crown className="w-5 h-5 inline" />
            <span className="font-bold text-sm md:text-base">
              Own this venue? Unlock the Neon Purple Vibe-Ring + priority placement for $30/mo
            </span>
            <button
              onClick={upgradeToPartner}
              className="bg-white text-fuchsia-700 px-4 py-1.5 rounded-full text-sm font-black hover:bg-fuchsia-50 transition-colors"
              data-testid="restaurant-stripe-upgrade-btn"
            >
              Become a Partner →
            </button>
          </div>
        </div>
      )}
      {/* Hero Image */}
      {restaurant.cover_photo && (
        <div className="relative h-96 overflow-hidden">
          <img
            src={restaurant.cover_photo}
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
          <Button
            onClick={() => navigate('/restaurants')}
            variant="ghost"
            className="absolute top-4 left-4 text-white bg-black/30 hover:bg-black/50"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">{restaurant.name}</h1>
              <div className="flex items-center gap-4 text-gray-600">
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  <span>{restaurant.address}, {restaurant.city}</span>
                </div>
                <span className="text-2xl font-bold text-orange-600">{restaurant.price_range}</span>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/planner?restaurant=${restaurantId}`)}
              className="bg-gradient-to-r from-pink-500 to-red-500 hover:from-pink-600 hover:to-red-600 text-white font-bold px-8 py-6 text-lg"
            >
              <Heart className="w-5 h-5 mr-2" />
              Plan a Date Here
            </Button>
          </div>

          {/* Rating & Reviews */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="flex">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-6 h-6 ${
                      star <= Math.round(restaurant.average_rating)
                        ? 'text-yellow-500 fill-yellow-500'
                        : 'text-gray-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xl font-bold">{restaurant.average_rating || 'New'}</span>
              <span className="text-gray-600">({restaurant.review_count} reviews)</span>
            </div>
            {restaurant.review_count > 0 && (
              <Button
                onClick={() => navigate(`/restaurants/${restaurantId}/review`)}
                variant="outline"
                className="border-orange-500 text-orange-600 hover:bg-orange-50"
              >
                Leave a Review
              </Button>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2">
            {/* Description */}
            {restaurant.description && (
              <Card className="p-6 mb-6">
                <h2 className="text-2xl font-bold mb-4">About</h2>
                <p className="text-gray-700">{restaurant.description}</p>
              </Card>
            )}

            {/* Menu */}
            {restaurant.menu_items && restaurant.menu_items.length > 0 && (
              <Card className="p-6 mb-6">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h2 className="text-2xl font-bold">Menu</h2>
                  {/* Pay-method toggle for the whole menu */}
                  <div className="flex gap-1 p-1 rounded-lg bg-slate-900/60 border border-slate-700/60" data-testid="restaurant-pay-toggle">
                    <button
                      onClick={() => setOrderMethod('coins')}
                      data-testid="pay-method-coins"
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 ${orderMethod === 'coins' ? 'bg-yellow-500 text-slate-950' : 'text-slate-300'}`}
                    >
                      <Coins className="w-3 h-3" /> Pay ₵
                    </button>
                    <button
                      onClick={() => setOrderMethod('card')}
                      data-testid="pay-method-card"
                      className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1 ${orderMethod === 'card' ? 'bg-purple-500 text-white' : 'text-slate-300'}`}
                    >
                      <CreditCard className="w-3 h-3" /> Card
                    </button>
                  </div>
                </div>

                {/* Category Filters */}
                <div className="flex flex-wrap gap-2 mb-6">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={`px-4 py-2 rounded-full transition-all ${
                      selectedCategory === 'all'
                        ? 'bg-orange-500 text-white'
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    All Items
                  </button>
                  {menuCategories.map(category => (
                    <button
                      key={category}
                      onClick={() => setSelectedCategory(category)}
                      className={`px-4 py-2 rounded-full transition-all capitalize ${
                        selectedCategory === category
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 hover:bg-gray-200'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>

                {/* Menu Items */}
                <div className="space-y-4">
                  {filteredMenu?.map(item => (
                    <div key={item.item_id} className="flex justify-between items-start pb-4 border-b last:border-0">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg">{item.name}</h3>
                        {item.description && (
                          <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                        )}
                        {item.dietary_tags && item.dietary_tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {item.dietary_tags.map((tag, i) => (
                              <span key={`dietary_tags-${i}`} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex flex-col items-end gap-2">
                        <span className="text-lg font-bold text-orange-600">
                          ${item.price.toFixed(2)}
                        </span>
                        {orderMethod === 'coins' && (
                          <span className="text-xs text-yellow-600">
                            ₵{(item.price * 2000).toLocaleString()}
                          </span>
                        )}
                        <Button
                          size="sm"
                          onClick={() => orderMenuItem(item)}
                          disabled={orderingId === item.item_id}
                          className={orderMethod === 'coins'
                            ? 'bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-semibold'
                            : 'bg-purple-600 hover:bg-purple-500 text-white font-semibold'}
                          data-testid={`order-btn-${item.item_id}`}
                        >
                          {orderingId === item.item_id ? 'Ordering…'
                            : orderMethod === 'coins'
                              ? <><Coins className="w-3 h-3 mr-1" /> Order</>
                              : <><CreditCard className="w-3 h-3 mr-1" /> Order</>}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Reviews */}
            {restaurant.reviews && restaurant.reviews.length > 0 && (
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4">Reviews ({restaurant.review_count})</h2>
                <div className="space-y-6">
                  {restaurant.reviews.map(review => (
                    <div key={review.review_id} className="pb-6 border-b last:border-0">
                      <div className="flex items-start gap-4">
                        <img
                          src={review.user_picture || '/default-avatar.png'}
                          alt={review.user_name}
                          className="w-12 h-12 rounded-full"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-bold">{review.user_name}</p>
                              <div className="flex items-center gap-2">
                                <div className="flex">
                                  {[1, 2, 3, 4, 5].map(star => (
                                    <Star
                                      key={star}
                                      className={`w-4 h-4 ${
                                        star <= review.rating
                                          ? 'text-yellow-500 fill-yellow-500'
                                          : 'text-gray-300'
                                      }`}
                                    />
                                  ))}
                                </div>
                                {review.verified_visit && (
                                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                    ✓ Verified Visit
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className="text-sm text-gray-500">
                              {new Date(review.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          {review.review_text && (
                            <p className="text-gray-700 mb-3">{review.review_text}</p>
                          )}
                          {review.tags && review.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {review.tags.map((tag, i) => (
                                <span key={`tags-${i}`} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div>
            {/* Info Card */}
            <Card className="p-6 mb-6 sticky top-4">
              <h3 className="font-bold text-lg mb-4">Restaurant Info</h3>
              <div className="space-y-4 text-sm">
                {restaurant.phone && (
                  <div className="flex items-start gap-3">
                    <Phone className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Phone</p>
                      <p className="text-gray-600">{restaurant.phone}</p>
                    </div>
                  </div>
                )}

                {restaurant.website && (
                  <div className="flex items-start gap-3">
                    <Globe className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Website</p>
                      <a
                        href={restaurant.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1"
                      >
                        Visit Site <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}

                {restaurant.hours_of_operation && (
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Hours</p>
                      <p className="text-gray-600 whitespace-pre-line">{restaurant.hours_of_operation}</p>
                    </div>
                  </div>
                )}

                {restaurant.average_meal_cost && (
                  <div className="flex items-start gap-3">
                    <DollarSign className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Average Cost</p>
                      <p className="text-gray-600">${restaurant.average_meal_cost} per person</p>
                    </div>
                  </div>
                )}

                {restaurant.reservation_link && (
                  <Button
                    onClick={() => window.open(restaurant.reservation_link, '_blank')}
                    className="w-full bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Make Reservation
                  </Button>
                )}
              </div>
            </Card>

            {/* Tags */}
            <Card className="p-6">
              <h3 className="font-bold text-lg mb-4">Details</h3>
              
              {restaurant.cuisine_type && restaurant.cuisine_type.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Cuisine</p>
                  <div className="flex flex-wrap gap-2">
                    {restaurant.cuisine_type.map((cuisine, i) => (
                      <span key={`cuisine_type-${i}`} className="text-xs bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
                        {cuisine}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {restaurant.ambiance && restaurant.ambiance.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Ambiance</p>
                  <div className="flex flex-wrap gap-2">
                    {restaurant.ambiance.map((amb, i) => (
                      <span key={`item-${i}`} className="text-xs bg-pink-100 text-pink-700 px-3 py-1 rounded-full">
                        {amb}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {restaurant.features && restaurant.features.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Features</p>
                  <div className="flex flex-wrap gap-2">
                    {restaurant.features.map((feature, i) => (
                      <span key={`item-${i}`} className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {restaurant.special_offers && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-semibold text-green-900 mb-1">Special Offer</p>
                  <p className="text-sm text-green-700">{restaurant.special_offers}</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <TopUpVibezCoinsModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        recommendedPackId={topUpRecommended}
        contextMessage={topUpContext}
      />
    </div>
  );
}
