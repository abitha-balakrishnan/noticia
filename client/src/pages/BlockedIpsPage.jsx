import React, { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, Trash2, AlertTriangle, Lock } from 'lucide-react';
import { actionsApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

const BlockedIpsPage = () => {
  const { isAdmin } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [targetToUnblock, setTargetToUnblock] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchBlockedIps = async () => {
    setLoading(true);
    try {
      const res = await actionsApi.getBlockedIps();
      if (res.data) {
        setList(res.data);
      }
    } catch (err) {
      console.error('Failed to load blocked IPs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedIps();
  }, []);

  const handleConfirmUnblock = async () => {
    if (!targetToUnblock) return;
    setActionLoading(true);
    try {
      await actionsApi.unblockIp(targetToUnblock._id);
      setList((prev) => prev.filter((item) => item._id !== targetToUnblock._id));
      setTargetToUnblock(null);
    } catch (err) {
      alert(`Failed to unblock: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-3 max-w-lg mx-auto">
        <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
          <Lock className="w-5 h-5" />
        </div>
        <h3 className="text-base font-bold text-white">Access Restricted</h3>
        <p className="text-xs text-slate-400">
          The Blocked IPs management registry requires Administrator privileges. Please contact your Lead SOC Administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Blocked IP Registry</h2>
        <p className="text-xs text-slate-400">
          Active firewall perimeter blocks enforced across all ingestion gateways ({list.length} active blocks)
        </p>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Blocked IP Address</th>
                <th className="py-3 px-4">Reason / Threat Profile</th>
                <th className="py-3 px-4">Authorized By</th>
                <th className="py-3 px-4">Block Timestamp</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Loading blocked IP rules...
                  </td>
                </tr>
              ) : list.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    No IPs are currently blocked. High severity alerts can be blocked by clicking "Suggest Action" on the Alerts feed.
                  </td>
                </tr>
              ) : (
                list.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3.5 px-4 font-bold text-rose-400 flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{item.ip}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-300 font-sans max-w-xs truncate">
                      {item.reason}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {item.blockerName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {new Date(item.blockedAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => setTargetToUnblock(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                        <span>Unblock</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Unblock Confirmation Modal */}
      {targetToUnblock && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-base text-slate-100">Confirm Firewall Unblock</h3>
                <p className="text-xs text-slate-400">Restore perimeter connectivity</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to lift the block on <strong className="text-white font-mono">{targetToUnblock.ip}</strong>? Incoming traffic from this host will once again be accepted.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setTargetToUnblock(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnblock}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-sm transition"
              >
                {actionLoading ? 'Unblocking...' : 'Confirm Unblock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockedIpsPage;
