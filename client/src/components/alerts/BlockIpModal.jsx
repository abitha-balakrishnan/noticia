import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Lock } from 'lucide-react';
import { actionsApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const BlockIpModal = ({ alert, onClose, onSuccess }) => {
  const { isAdmin } = useAuth();
  const [reason, setReason] = useState(
    alert ? `Malicious brute-force attack / anomaly activity flagged by Noticia (Score: ${alert.anomalyScore})` : ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!alert) return null;

  const handleConfirm = async () => {
    if (!isAdmin) return;
    setSubmitting(true);
    setError(null);

    try {
      await actionsApi.blockIp({
        ip: alert.ip,
        alertId: alert._id,
        reason
      });
      if (onSuccess) onSuccess(alert.ip);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to execute IP block');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-base text-slate-100">Mitigation Approval Request</h3>
            <p className="text-xs text-slate-400">Human-in-the-loop action verification</p>
          </div>
        </div>

        <div className="p-4 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Block IP Address {alert.ip}?</span>
          </div>
          <p className="text-xs text-slate-300">
            This will immediately prevent all future network requests from address <span className="font-mono font-bold text-white">{alert.ip}</span> across the enterprise firewall.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-300">Mitigation Reason / Audit Log Note:</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-rose-500 font-mono"
            placeholder="Reason for blocking IP..."
          />
        </div>

        {!isAdmin && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
            <Lock className="w-4 h-4 shrink-0" />
            <span>Admin approval required. Analysts cannot execute firewall blocks directly.</span>
          </div>
        )}

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isAdmin || submitting}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition ${
              isAdmin && !submitting
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/30'
                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            {submitting ? 'Executing Block...' : 'Confirm Block'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BlockIpModal;
