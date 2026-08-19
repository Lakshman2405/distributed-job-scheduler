import React, { useState } from 'react';
import { api } from '../services/api';
import { Lock, User, Key, Check, ShieldCheck, X, LogOut } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: any;
  onLoginSuccess: (user: any, token: string) => void;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onLoginSuccess,
  onLogout
}) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('admin@apex.local');
  const [password, setPassword] = useState('password123');
  const [orgName, setOrgName] = useState('Apex Enterprise');
  const [copiedKey, setCopiedKey] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      if (isRegistering) {
        // Register new user
        const res = await fetch('/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, orgName })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error?.message || 'Registration failed');
        localStorage.setItem('apex_token', data.token);
        onLoginSuccess(data.user, data.token);
        onClose();
      } else {
        // Login existing user
        const data = await api.login(email, password);
        onLoginSuccess(data.user, data.token);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText('apex_live_key_99887766');
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="glass-panel w-full max-w-md rounded-xl p-6 border border-slate-700 space-y-6 shadow-2xl relative">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Authentication & RBAC Control</h3>
              <p className="text-xs text-slate-400">JWT Token & Project API Key Management</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Current Active Account Card */}
        {currentUser && (
          <div className="p-4 rounded-lg bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-slate-400 uppercase">Authenticated User</span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {currentUser.role || 'SUPER_ADMIN'}
              </span>
            </div>
            <div className="font-bold text-sm text-white flex items-center space-x-2">
              <User className="w-4 h-4 text-cyan-400" />
              <span>{currentUser.email || 'admin@apex.local'}</span>
            </div>

            {/* API Key Box */}
            <div className="pt-2 border-t border-slate-800 space-y-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase block">Project API Key:</span>
              <div className="flex items-center justify-between p-2 rounded bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300">
                <span>apex_live_key_99887766</span>
                <button
                  onClick={handleCopyApiKey}
                  className="flex items-center space-x-1 text-[11px] text-slate-400 hover:text-white transition"
                >
                  {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Key className="w-3.5 h-3.5" />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full mt-2 flex items-center justify-center space-x-1.5 py-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out Account</span>
            </button>
          </div>
        )}

        {/* Switch to Login / Register Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-slate-800 pb-2">
            <span>{isRegistering ? 'Create New User Account' : 'Sign In with Credentials'}</span>
            <button
              type="button"
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-cyan-400 hover:underline"
            >
              {isRegistering ? 'Already have account? Login' : 'Need account? Register'}
            </button>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
              {errorMessage}
            </div>
          )}

          {isRegistering && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Organization Name</label>
              <input
                type="text"
                required
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme Corp Infrastructure"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@apex.local"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 transition disabled:opacity-50"
            >
              {isLoading ? 'Authenticating...' : isRegistering ? 'Register Account' : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
