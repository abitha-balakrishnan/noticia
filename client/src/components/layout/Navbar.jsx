import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, LogOut, UserCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/alerts?ip=${encodeURIComponent(searchTerm.trim())}`);
      setSearchTerm('');
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
      case 'analyst':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 fixed top-0 right-0 left-56 z-20 px-6 flex items-center justify-between">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="relative w-80 max-w-full">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search alerts by IP or username..."
          className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/40 font-mono transition"
        />
      </form>

      {/* User Info & Actions */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300">
            <UserCircle className="w-5 h-5 text-sky-400" />
          </div>
          <div className="text-right">
            <span className="block text-xs font-semibold text-slate-200 leading-tight">
              {user?.name || 'SOC Analyst'}
            </span>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span className={`px-2 py-0.2 rounded text-[10px] uppercase font-mono tracking-wider border font-bold ${getRoleBadgeColor(user?.role)}`}>
                {user?.role || 'analyst'}
              </span>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          title="Sign out of Noticia"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-500/20 hover:text-rose-400 text-slate-300 border border-slate-700/80 hover:border-rose-500/40 text-xs font-medium transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
};

export default Navbar;
