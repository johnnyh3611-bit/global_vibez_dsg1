import React, { useState, useEffect } from 'react';
import { Shield, Users, Trophy, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import BackButton from '@/components/BackButton';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function GuildsClans() {
  const navigate = useNavigate();
  const [guilds, setGuilds] = useState([]);
  const [myGuild, setMyGuild] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGuilds();
  }, []);

  const fetchGuilds = async () => {
    try {
      const response = await fetch(`${API_URL}/api/social/guilds/list`);
      const data = await response.json();
      setGuilds(data.guilds || []);
    } catch (error) {
      // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const createGuild = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/social/guilds/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: formData.get('name'),
          description: formData.get('description')
        })
      });
      const data = await response.json();
      if (data.success) {
        alert('✅ Guild created!');
        setShowCreate(false);
        fetchGuilds();
      }
    } catch (error) {
      alert('Failed to create guild');
    }
  };

  const joinGuild = async (guildId) => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/social/guilds/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ guild_id: guildId })
      });
      if (response.ok) {
        alert('✅ Joined guild!');
        fetchGuilds();
      }
    } catch (error) {
      alert('Failed to join guild');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" />
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-5xl font-black bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent mb-2">
              🛡️ Guilds & Clans
            </h1>
            <p className="text-gray-300">Join a community and compete together</p>
          </div>
          <Button onClick={() => setShowCreate(!showCreate)} className="bg-purple-500 hover:bg-purple-600">
            <Plus className="w-5 h-5 mr-2" />
            Create Guild
          </Button>
        </div>

        {showCreate && (
          <Card className="bg-gray-800/50 border-gray-600 p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-4">Create New Guild</h2>
            <form onSubmit={createGuild} className="space-y-4">
              <Input name="name" placeholder="Guild Name" required className="bg-gray-700 border-gray-600 text-white" />
              <Input name="description" placeholder="Description" required className="bg-gray-700 border-gray-600 text-white" />
              <Button type="submit" className="bg-green-500 hover:bg-green-600">Create</Button>
            </form>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {guilds.map((guild) => (
            <Card key={guild.guild_id} className="bg-gray-800/50 border-gray-600 p-6">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-10 h-10 text-purple-400" />
                <div>
                  <h3 className="text-xl font-bold text-white">{guild.name}</h3>
                  <p className="text-gray-400 text-sm">{guild.level ? `Level ${guild.level}` : 'New Guild'}</p>
                </div>
              </div>
              <p className="text-gray-300 text-sm mb-4">{guild.description}</p>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span className="text-white text-sm">{guild.member_count || 0} members</span>
                </div>
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                  <span className="text-white text-sm">{guild.points || 0} pts</span>
                </div>
              </div>
              <Button onClick={() => joinGuild(guild.guild_id)} className="w-full bg-purple-500 hover:bg-purple-600">
                Join Guild
              </Button>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
