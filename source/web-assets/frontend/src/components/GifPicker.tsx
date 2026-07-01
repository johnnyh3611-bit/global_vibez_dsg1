import { useState, useEffect } from 'react';
import { Search, X, Loader } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Note: In production, get API key from env and use official Giphy SDK
const GIPHY_API_KEY = process.env.REACT_APP_GIPHY_API_KEY || 'dc6zaTOxFJmzC'; // Fallback to public beta key

export default function GifPicker({ onSelect, onCancel }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [gifs, setGifs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedGif, setSelectedGif] = useState(null);

  useEffect(() => {
    // Load trending GIFs on mount
    loadTrendingGifs();
  }, []);

  const loadTrendingGifs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      // console.error('Error loading trending GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const searchGifs = async (query) => {
    if (!query.trim()) {
      loadTrendingGifs();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=20&rating=g`
      );
      const data = await response.json();
      setGifs(data.data || []);
    } catch (error) {
      // console.error('Error searching GIFs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    searchGifs(searchQuery);
  };

  const handleGifClick = (gif) => {
    setSelectedGif(gif);
  };

  const handleSend = () => {
    if (!selectedGif) return;
    
    // Send GIF URL (use downsized version for faster loading)
    const gifUrl = selectedGif.images.downsized_medium?.url || selectedGif.images.original.url;
    onSelect(gifUrl);
  };

  return (
    <div className="bg-black/60 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4 w-full max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold">🎉 Choose a GIF</h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-white">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search GIFs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white/10 backdrop-blur-xl border-cyan-500/30 text-white placeholder:text-gray-400"
          />
        </div>
      </form>

      {/* GIF Grid */}
      <div className="mb-4" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {gifs.map((gif) => (
              <div
                key={gif.id}
                onClick={() => handleGifClick(gif)}
                className={`relative rounded-lg overflow-hidden cursor-pointer hover:opacity-75 transition-opacity ${
                  selectedGif?.id === gif.id ? 'ring-2 ring-cyan-500' : ''
                }`}
              >
                <img
                  src={gif.images.fixed_height.url}
                  alt={gif.title}
                  className="w-full h-auto"
                />
                {selectedGif?.id === gif.id && (
                  <div className="absolute inset-0 bg-cyan-500/20 flex items-center justify-center">
                    <div className="w-8 h-8 bg-cyan-500 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && gifs.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-400">No GIFs found</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">Powered by GIPHY</p>
        <div className="flex gap-2">
          <Button
            onClick={onCancel}
            variant="outline"
            className="border-gray-600 text-white hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={!selectedGif}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white disabled:opacity-50"
          >
            Send GIF
          </Button>
        </div>
      </div>
    </div>
  );
}
