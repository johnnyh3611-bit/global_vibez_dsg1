import React, { useState, useEffect } from 'react';
import { Hexagon, TrendingUp, ShoppingBag, Wallet } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function NFTMarketplace() {
  const [nfts, setNfts] = useState([]);
  const [myNFTs, setMyNFTs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNFTs();
  }, []);

  const fetchNFTs = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      const [marketRes, myNFTsRes] = await Promise.all([
        fetch(`${API_URL}/api/cosmetics-shop/nft-items`),
        fetch(`${API_URL}/api/cosmetics-shop/my-nfts/${userData.user_id}`)
      ]);

      const marketData = await marketRes.json();
      const myNFTsData = await myNFTsRes.json();

      setNfts(marketData.nfts || []);
      setMyNFTs(myNFTsData.nfts || []);
    } catch (error) {
      // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const mintNFT = async (nftId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/cosmetics-shop/mint-nft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nft_id: nftId })
      });
      const data = await response.json();
      if (data.success) {
        alert('✅ NFT minted successfully!');
        fetchNFTs();
      }
    } catch (error) {
      alert('Failed to mint NFT');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" />
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-500 bg-clip-text text-transparent mb-4">
            🔶 NFT Marketplace
          </h1>
          <p className="text-gray-300 text-lg">Collect exclusive digital assets</p>
        </div>

        {myNFTs.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <Wallet className="w-6 h-6 text-cyan-400" />
              My NFTs ({myNFTs.length})
            </h2>
            <div className="grid md:grid-cols-4 gap-4">
              {myNFTs.map((nft) => (
                <Card key={nft.token_id} className="bg-gradient-to-br from-purple-800 to-pink-900 border-purple-500 p-4">
                  <Hexagon className="w-full h-32 text-purple-300 mb-2" />
                  <p className="text-white font-bold text-sm">{nft.name}</p>
                  <p className="text-purple-200 text-xs">#{nft.token_id}</p>
                </Card>
              ))}
            </div>
          </div>
        )}

        <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-yellow-400" />
          Marketplace
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {nfts.map((nft) => (
            <Card key={nft.nft_id} className="bg-gray-800/50 border-indigo-600 p-6 hover:shadow-xl hover:shadow-indigo-500/30 transition-all">
              <Hexagon className="w-full h-40 text-indigo-400 mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">{nft.name}</h3>
              <p className="text-gray-400 text-sm mb-4">{nft.description}</p>
              
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-400 text-xs">Price</p>
                  <p className="text-2xl font-black text-yellow-400">₵{(nft.price || 0).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400 text-xs">Rarity</p>
                  <p className="text-purple-400 font-bold">{nft.rarity}</p>
                </div>
              </div>

              <Button onClick={() => mintNFT(nft.nft_id)} className="w-full bg-indigo-500 hover:bg-indigo-600">
                Mint NFT
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
