import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Users } from 'lucide-react';
import BackButton from '@/components/BackButton';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function Messaging() {
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchConversations();
  }, []);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const userRes = await fetch(`${API_URL}/api/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const userData = await userRes.json();

      const response = await fetch(`${API_URL}/api/messaging/conversations/${userData.user_id}`);
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      // console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const response = await fetch(`${API_URL}/api/messaging/messages/${conversationId}`);
      const data = await response.json();
      setMessages(data.messages || []);
      setActiveChat(conversationId);
    } catch (error) {
      // console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_URL}/api/messaging/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          conversation_id: activeChat,
          message: newMessage
        })
      });
      if (response.ok) {
        setNewMessage('');
        loadMessages(activeChat);
      }
    } catch (error) {
      alert('Failed to send message');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-black py-8 px-4">
      <BackButton to="/dashboard" label="Back" />
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent mb-4">
            💬 Messages
          </h1>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Card className="bg-gray-800/50 border-gray-600 p-4">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Conversations
            </h2>
            <div className="space-y-2">
              {conversations.map((conv) => (
                <button
                  key={conv.conversation_id}
                  onClick={() => loadMessages(conv.conversation_id)}
                  className={`w-full text-left p-3 rounded-lg transition-all ${
                    activeChat === conv.conversation_id
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <p className="font-semibold">{conv.other_user_name}</p>
                  <p className="text-xs opacity-75">{conv.last_message}</p>
                </button>
              ))}
            </div>
          </Card>

          <Card className="md:col-span-2 bg-gray-800/50 border-gray-600 p-4 flex flex-col" style={{ height: '600px' }}>
            {activeChat ? (
              <>
                <div className="flex-1 overflow-y-auto mb-4 space-y-3">
                  {messages.map((msg) => (
                    <div
                      key={msg.message_id}
                      className={`flex ${
                        msg.is_mine ? 'justify-end' : 'justify-start'
                      }`}
                    >
                      <div
                        className={`max-w-[70%] p-3 rounded-lg ${
                          msg.is_mine
                            ? 'bg-cyan-500 text-white'
                            : 'bg-gray-700 text-gray-200'
                        }`}
                      >
                        <p>{msg.content}</p>
                        <p className="text-xs opacity-75 mt-1">
                          {new Date(msg.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                    placeholder="Type a message..."
                    className="bg-gray-700 border-gray-600 text-white"
                  />
                  <Button onClick={sendMessage} className="bg-cyan-500 hover:bg-cyan-600">
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Select a conversation to start messaging</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
