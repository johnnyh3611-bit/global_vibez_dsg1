import { useState, useEffect, useCallback } from 'react';
import { Card, Title, Text, Badge } from '@tremor/react';
import { Megaphone } from 'lucide-react';
import { fetchWithAuth, BACKEND_URL } from '@/utils/adminAPI';

const announcementBorderClass = (type) => {
  if (type === 'success') return 'border-green-500 bg-green-500/10';
  if (type === 'warning') return 'border-orange-500 bg-orange-500/10';
  if (type === 'error') return 'border-red-500 bg-red-500/10';
  return 'border-cyan-500 bg-cyan-500/10';
};

const announcementBadgeColor = (type) => {
  if (type === 'success') return 'green';
  if (type === 'warning') return 'orange';
  if (type === 'error') return 'red';
  return 'blue';
};

export const AnnouncementsTab = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '', message: '', type: 'info',
  });

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetchWithAuth(
        `${BACKEND_URL}/api/admin/announcements?active_only=false`
      );
      const data = await res.json();
      setAnnouncements(data.announcements || []);
    } catch (error) {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleCreateAnnouncement = async () => {
    if (!newAnnouncement.title || !newAnnouncement.message) {
      alert('Please fill in title and message');
      return;
    }
    try {
      await fetchWithAuth(`${BACKEND_URL}/api/admin/create-announcement`, {
        method: 'POST',
        body: JSON.stringify(newAnnouncement),
      });
      alert('Announcement created!');
      setNewAnnouncement({ title: '', message: '', type: 'info' });
      fetchAnnouncements();
    } catch (error) {
      alert('Failed to create announcement');
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await fetchWithAuth(
        `${BACKEND_URL}/api/admin/delete-announcement/${announcementId}`,
        { method: 'DELETE' }
      );
      alert('Announcement deleted!');
      fetchAnnouncements();
    } catch (error) {
      alert('Failed to delete announcement');
    }
  };

  return (
    <div className="space-y-6" data-testid="godmode-announcements-tab">
      <Card>
        <Title>Create New Announcement</Title>
        <div className="mt-4 space-y-4">
          <div>
            <Text>Title</Text>
            <input
              data-testid="announcement-title-input"
              type="text"
              value={newAnnouncement.title}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white mt-2"
              placeholder="Announcement title..."
            />
          </div>
          <div>
            <Text>Message</Text>
            <textarea
              data-testid="announcement-message-input"
              value={newAnnouncement.message}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, message: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white mt-2"
              rows={4}
              placeholder="Announcement message..."
            />
          </div>
          <div>
            <Text>Type</Text>
            <select
              data-testid="announcement-type-select"
              value={newAnnouncement.type}
              onChange={(e) => setNewAnnouncement({ ...newAnnouncement, type: e.target.value })}
              className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white mt-2"
            >
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
            </select>
          </div>
          <button
            data-testid="announcement-create-btn"
            onClick={handleCreateAnnouncement}
            className="w-full px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Megaphone className="w-5 h-5" /> Create Announcement
          </button>
        </div>
      </Card>

      <Card>
        <Title>Active Announcements ({announcements.length})</Title>
        <div className="mt-4 space-y-3">
          {announcements.map((ann) => (
            <div
              key={`announcement-${ann.announcement_id || ann.id}`}
              className={`p-4 rounded-lg border-l-4 ${announcementBorderClass(ann.type)}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Text className="font-bold text-lg">{ann.title}</Text>
                    <Badge color={announcementBadgeColor(ann.type)}>{ann.type}</Badge>
                  </div>
                  <Text className="mt-2">{ann.message}</Text>
                  <Text className="text-sm text-slate-400 mt-2">
                    Created: {new Date(ann.created_at).toLocaleString()}
                  </Text>
                </div>
                <button
                  data-testid={`announcement-delete-${ann.announcement_id}`}
                  onClick={() => handleDeleteAnnouncement(ann.announcement_id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-sm rounded transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default AnnouncementsTab;
