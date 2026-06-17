import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin, Loader2, Check } from 'lucide-react';

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;

export default function LocationPicker({ label, onLocationSelected, selectedLocation, placeholder }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);

  const handleSearch = async (query) => {
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await fetch(
          `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&access_token=${MAPBOX_TOKEN}&limit=5`
        );
        const data = await response.json();

        const results = data.features?.map((feature) => ({
          id: feature.id,
          address: feature.properties.full_address || feature.properties.place_formatted,
          city: feature.properties.context?.place?.name || feature.properties.place_name?.split(',')[0],
          state: feature.properties.context?.region?.name || feature.properties.context?.region?.region_code,
          lat: feature.geometry.coordinates[1],
          lng: feature.geometry.coordinates[0],
          longitude: feature.geometry.coordinates[0],
          latitude: feature.geometry.coordinates[1]
        })) || [];

        setSuggestions(results);
      } catch (error) {
        // console.error('Search error:', error);
        setSuggestions([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  const handleSelectSuggestion = (suggestion) => {
    onLocationSelected(suggestion);
    setSearchQuery('');
    setSuggestions([]);
  };

  return (
    <div className="flex flex-col gap-2">
      {label && <label className="text-sm font-semibold text-white">{label}</label>}
      
      <div className="relative">
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={placeholder || 'Search for a location...'}
            className="pl-10 pr-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-gray-400"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cyan-400 animate-spin" />
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-lg shadow-2xl z-50 max-h-64 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                onClick={() => handleSelectSuggestion(suggestion)}
                className="px-4 py-3 hover:bg-slate-700 cursor-pointer border-b border-slate-700 last:border-b-0 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-cyan-400 mt-1 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium truncate">{suggestion.city || 'Location'}</div>
                    <div className="text-xs text-gray-400 truncate">{suggestion.address}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedLocation && (
        <div className="flex items-center gap-2 p-3 bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-700/50 rounded-lg">
          <Check className="w-5 h-5 text-green-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm text-white font-medium truncate">{selectedLocation.city || 'Selected'}</div>
            <div className="text-xs text-gray-300 truncate">{selectedLocation.address}</div>
          </div>
        </div>
      )}
    </div>
  );
}