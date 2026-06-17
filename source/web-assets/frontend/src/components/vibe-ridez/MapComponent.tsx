import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

export default function MapComponent({
  onLocationSelected,
  pickupLocation,
  dropoffLocation,
  routeCoordinates,
  markers = [],
  center,
  zoom = 12,
  height = '500px'
}: {
  onLocationSelected?: any;
  pickupLocation?: any;
  dropoffLocation?: any;
  routeCoordinates?: any;
  markers?: any[];
  center?: any;
  zoom?: number;
  height?: string;
}) {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const pickupMarkerRef = useRef(null);
  const dropoffMarkerRef = useRef(null);
  const allMarkersRef = useRef([]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;
    if (map.current) return; // Initialize only once

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: center || [-98.5795, 39.8283], // Center of USA as default
      zoom: zoom
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
    
    // Add geolocation control
    map.current.addControl(
      new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: true,
        showUserHeading: true
      }),
      'top-right'
    );

    map.current.on('load', () => {
      setMapLoaded(true);
    });

    // Handle map click for location selection
    if (onLocationSelected) {
      map.current.on('click', async (e) => {
        const { lng, lat } = e.lngLat;
        
        try {
          const response = await fetch(
            `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${MAPBOX_TOKEN}`
          );
          const data = await response.json();
          const address = data.features[0]?.properties?.full_address || 'Selected Location';
          const city = data.features[0]?.properties?.place_name?.split(',')[0] || '';
          const state = data.features[0]?.properties?.context?.region?.name || '';
          
          onLocationSelected({ lat, lng, address, city, state });
        } catch (error) {
          // console.error('Geocoding error:', error);
          onLocationSelected({ lat, lng, address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`, city: '', state: '' });
        }
      });
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Update pickup marker
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.remove();
    }

    if (pickupLocation) {
      const el = document.createElement('div');
      el.className = 'marker-pickup';
      el.style.cssText = `
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #4CAF50, #81C784);
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      
      const inner = document.createElement('div');
      inner.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(45deg);
        font-size: 20px;
      `;
      inner.textContent = '📍';
      el.appendChild(inner);

      pickupMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat([pickupLocation.lng || pickupLocation.longitude, pickupLocation.lat || pickupLocation.latitude])
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>Pickup</strong><br>${pickupLocation.address}`))
        .addTo(map.current);
      
      map.current.flyTo({
        center: [pickupLocation.lng || pickupLocation.longitude, pickupLocation.lat || pickupLocation.latitude],
        zoom: 13
      });
    }
  }, [pickupLocation, mapLoaded]);

  // Update dropoff marker
  useEffect(() => {
    if (!map.current || !mapLoaded) return;

    if (dropoffMarkerRef.current) {
      dropoffMarkerRef.current.remove();
    }

    if (dropoffLocation) {
      const el = document.createElement('div');
      el.className = 'marker-dropoff';
      el.style.cssText = `
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, #FF5252, #FF8A80);
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        border: 3px solid white;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        cursor: pointer;
      `;
      
      const inner = document.createElement('div');
      inner.style.cssText = `
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(45deg);
        font-size: 20px;
      `;
      inner.textContent = '🎯';
      el.appendChild(inner);

      dropoffMarkerRef.current = new mapboxgl.Marker(el)
        .setLngLat([dropoffLocation.lng || dropoffLocation.longitude, dropoffLocation.lat || dropoffLocation.latitude])
        .setPopup(new mapboxgl.Popup().setHTML(`<strong>Dropoff</strong><br>${dropoffLocation.address}`))
        .addTo(map.current);
    }
  }, [dropoffLocation, mapLoaded]);

  // Update multiple markers (for ride listings)
  useEffect(() => {
    if (!map.current || !mapLoaded || !markers.length) return;

    // Clear existing markers
    allMarkersRef.current.forEach(m => m.remove());
    allMarkersRef.current = [];

    markers.forEach((markerData, index) => {
      const el = document.createElement('div');
      el.className = 'marker-ride';
      el.style.cssText = `
        width: 35px;
        height: 35px;
        background: linear-gradient(135deg, #2196F3, #64B5F6);
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.25);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
      `;
      el.textContent = '🚗';

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<div style="min-width: 200px;">
          <strong>${markerData.driver_username}</strong><br>
          <div style="margin: 8px 0;">
            From: ${markerData.pickup_location?.city || 'N/A'}<br>
            To: ${markerData.dropoff_location?.city || 'N/A'}
          </div>
          <div style="color: #4CAF50; font-weight: bold;">
            $${markerData.price_per_seat}/seat
          </div>
          <div style="font-size: 12px; color: #666;">
            ${markerData.available_seats} seats available
          </div>
        </div>`
      );

      const marker = new mapboxgl.Marker(el)
        .setLngLat([markerData.pickup_location?.longitude, markerData.pickup_location?.latitude])
        .setPopup(popup)
        .addTo(map.current);

      el.addEventListener('click', () => {
        if (markerData.onClick) markerData.onClick(markerData);
      });

      allMarkersRef.current.push(marker);
    });
  }, [markers, mapLoaded]);

  // Draw route
  useEffect(() => {
    if (!map.current || !mapLoaded || !routeCoordinates) return;

    // Remove existing route
    if (map.current.getLayer('route')) {
      map.current.removeLayer('route');
    }
    if (map.current.getSource('route')) {
      map.current.removeSource('route');
    }

    // Add new route
    map.current.addSource('route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: routeCoordinates
        },
        properties: {}
      }
    });

    map.current.addLayer({
      id: 'route',
      type: 'line',
      source: 'route',
      layout: {
        'line-join': 'round',
        'line-cap': 'round'
      },
      paint: {
        'line-color': '#2196F3',
        'line-width': 5,
        'line-opacity': 0.8
      }
    });

    // Fit bounds to route
    const bounds = new mapboxgl.LngLatBounds();
    routeCoordinates.forEach(coord => bounds.extend(coord));
    map.current.fitBounds(bounds, { padding: 80 });
  }, [routeCoordinates, mapLoaded]);

  return (
    <div 
      ref={mapContainer} 
      style={{ 
        width: '100%', 
        height: height,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }} 
    />
  );
}