import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Gamepad2, Lock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const VaultLogin = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/vault-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, code: '000000' })
      });

      const data = await response.json();

      if (data.success) {
        navigate('/vibe-vault-admin/dashboard');
      } else {
        setError(data.detail || 'Authentication failed');
      }
    } catch (err) {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07030F] flex items-center justify-center font-mono p-4">
      {/* Background glow to match landing */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(168,85,247,0.18),transparent_60%)] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-96 p-8 border border-fuchsia-500/30 shadow-[0_0_36px_rgba(217,70,239,0.35)] bg-[#0F0720]/90 backdrop-blur-xl rounded-2xl"
        data-testid="vault-login-card"
      >
        {/* Brand mark — same gradient gamepad icon as the landing header */}
        <div className="flex flex-col items-center mb-6">
          <div className="flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-fuchsia-600 to-purple-700 shadow-[0_0_22px_rgba(217,70,239,0.55)] mb-3">
            <Gamepad2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-center font-black uppercase">
            <span className="text-white">GLOBAL VIBEZ</span>{' '}
            <span className="text-transparent bg-gradient-to-r from-fuchsia-500 to-purple-500 bg-clip-text">
              DSG
            </span>
          </h1>
          <p className="text-fuchsia-400/80 text-[10px] uppercase tracking-[0.3em] mt-1 flex items-center gap-1.5">
            <Lock className="w-3 h-3" />
            Vibe Vault Access
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-lg">
            {error}
          </div>
        )}

        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="ADMIN PASSWORD"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-[#1A0D2E] border border-fuchsia-500/30 p-3 text-fuchsia-200 placeholder:text-purple-400/60 focus:border-fuchsia-400 outline-none rounded-lg font-mono text-sm"
            autoFocus
            data-testid="vault-login-password"
          />
          <button
            type="submit"
            disabled={loading || password.length === 0}
            className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-700 hover:from-fuchsia-500 hover:to-purple-600 text-white font-bold p-3 transition-all rounded-lg uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_22px_rgba(217,70,239,0.45)]"
            data-testid="vault-login-submit"
          >
            {loading ? 'Verifying…' : 'Access Vault'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-fuchsia-500/15">
          <p className="text-purple-400/60 text-xs text-center">
            Unauthorized access is prohibited.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default VaultLogin;