import React from 'react';
import { Eye, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const AlertCard = ({ alert, onViewDetails, onSuggestAction }) => {
  const { isAdmin } = useAuth();

  const getSeverityStyle = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return {
          borderStrip: 'border-l-rose-500',
          badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
          scoreBadge: 'text-rose-400 bg-rose-500/10'
        };
      case 'medium':
        return {
          borderStrip: 'border-l-amber-500',
          badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          scoreBadge: 'text-amber-400 bg-amber-500/10'
        };
      default:
        return {
          borderStrip: 'border-l-yellow-400',
          badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
          scoreBadge: 'text-yellow-300 bg-yellow-500/10'
        };
    }
  };

  const style = getSeverityStyle(alert.severity);

  return (
    <div className={`bg-slate-900/90 border border-slate-800 border-l-4 ${style.borderStrip} rounded-lg p-4 transition-all duration-150 hover:border-slate-700 hover:shadow-lg hover:shadow-black/20 flex flex-col md:flex-row md:items-center justify-between gap-4`}>
      {/* Left: Info */}
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase tracking-wider border ${style.badge}`}>
            {alert.severity}
          </span>
          <span className="font-mono text-sm font-semibold text-white">
            {alert.ip}
          </span>
          <span className="text-slate-400 text-xs">
            user: <span className="text-slate-200 font-mono">{alert.username || 'anonymous'}</span>
          </span>
          {alert.status === 'actioned' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30">
              <CheckCircle2 className="w-3 h-3" /> Blocked
            </span>
          )}
          {alert.status === 'resolved' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Resolved
            </span>
          )}
        </div>

        <p className="text-xs text-slate-300">
          {alert.details?.reason || `ML Anomaly pattern detected on endpoint: ${alert.details?.endpoint || 'authentication service'}`}
        </p>

        <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
          <span>Score: <strong className={style.scoreBadge}>{alert.anomalyScore}</strong></span>
          <span>Detected: {new Date(alert.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 self-end md:self-center shrink-0">
        <button
          onClick={() => onViewDetails(alert)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition"
        >
          <Eye className="w-3.5 h-3.5 text-sky-400" />
          <span>View Details</span>
        </button>

        <button
          onClick={() => onSuggestAction(alert)}
          disabled={!isAdmin && alert.status !== 'actioned'}
          title={!isAdmin ? 'Admin approval required to block IP' : 'Suggest mitigation action'}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition ${
            alert.status === 'actioned'
              ? 'bg-slate-800/40 text-slate-500 border-slate-800 cursor-not-allowed'
              : isAdmin
                ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/40'
                : 'bg-slate-800/60 text-slate-500 border-slate-700/50 cursor-not-allowed'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>{alert.status === 'actioned' ? 'Blocked' : 'Suggest Action'}</span>
        </button>
      </div>
    </div>
  );
};

export default AlertCard;
