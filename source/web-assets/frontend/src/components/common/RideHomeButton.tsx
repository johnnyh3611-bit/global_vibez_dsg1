/**
 * RideHomeButton — Roadmap PDF §3.
 * "A 'Ride Home' button in the lobby that shares the user's location
 *  with the driver system."
 *
 * Surgical drop-in: the dashboard renders this just below the Vibes
 * Rides tile so users can one-tap a ride from anywhere. Uses the
 * existing VibeRidez backend (`/api/viberidez/request`) and shares
 * GPS via `navigator.geolocation`. Falls back to a manual address
 * prompt if geolocation is denied.
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Car, MapPin } from 'lucide-react';
import { toast } from 'sonner';

export default function RideHomeButton() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const requestRide = async () => {
    setBusy(true);
    try {
      const coords = await new Promise<GeolocationCoordinates | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos.coords),
          () => resolve(null),
          { timeout: 5000 },
        );
      });
      // Hand-off to the existing rides flow with coords pre-filled
      const params = new URLSearchParams();
      if (coords) {
        params.set('lat', coords.latitude.toFixed(6));
        params.set('lng', coords.longitude.toFixed(6));
        toast.success('Location locked — picking your driver');
      } else {
        toast('Add your pickup address to continue', { icon: '📍' });
      }
      navigate(`/rides${params.toString() ? `?${params}` : ''}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.button
      onClick={requestRide}
      disabled={busy}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      data-testid="ride-home-button"
      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-blue-600 via-sky-500 to-cyan-400 text-white font-black shadow-xl shadow-blue-500/40 hover:shadow-blue-500/60 transition-shadow disabled:opacity-60"
    >
      <Car className="w-5 h-5" />
      <span>Ride Home</span>
      <MapPin className="w-4 h-4 opacity-70" />
    </motion.button>
  );
}
