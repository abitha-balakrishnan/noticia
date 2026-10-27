import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Bell, MessageSquare, ShieldAlert, Settings, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

const Sidebar = () => {
  const { user, isAdmin } = useAuth();
  const { connected, liveAlerts } = useSocket();

  const navItems = [
    { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
    { name: 'Alerts', to: '/alerts', icon: Bell, badge: liveAlerts.length > 0 ? liveAlerts.length : null },
    { name: 'Chat Assistant', to: '/chat', icon: MessageSquare },
    ...(isAdmin ? [{ name: 'Blocked IPs', to: '/blocked-ips', icon: ShieldAlert }] : []),
  ];

  return (
    <aside className="w-56 bg-slate-900/95 border-r border-slate-800 flex flex-col h-screen fixed left-0 top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-800/80 gap-3">
        <div className="w-9 h-9 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <span className="font-bold text-lg text-white tracking-wide">Noticia</span>
          <span className="block text-[10px] font-mono tracking-wider uppercase text-sky-400">AI SIEM Platform</span>
        </div>
      </div>

      {/* Connection Status Pill */}
      <div className="px-5 py-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-950/60 border border-slate-800 text-xs">
          <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-slate-400 font-mono text-[11px]">
            {connected ? 'Live Feed Connected' : 'Feed Disconnected'}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-sm shadow-sky-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4" />
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-rose-500 text-white animate-pulse">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Settings at Bottom */}
      <div className="p-3 border-t border-slate-800/80">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
              isActive
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`
          }
        >
          <Settings className="w-4 h-4" />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
