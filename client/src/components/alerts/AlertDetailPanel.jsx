import React, { useEffect, useState } from 'react';
import { X, Clock, ShieldAlert, Terminal, Activity } from 'lucide-react';
import { alertsApi, logsApi } from '../../services/api';

const AlertDetailPanel = ({ alertId, onClose, onSuggestAction }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!alertId) return;

    let isMounted = true;
    setLoading(true);

    alertsApi.getAlertById(alertId)
      .then((res) => {
        if (isMounted) {
          setDetails(res.data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load alert details:', err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [alertId]);

  if (!alertId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end transition-opacity">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-sky-400" />
            <h3 className="font-bold text-sm text-slate-100">Incident Details & Forensics</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-3">
              <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
              <span className="font-mono text-slate-400 text-xs">Retrieving audit logs from database...</span>
            </div>
          ) : !details ? (
            <div className="p-4 text-center text-rose-400">Failed to load alert details.</div>
          ) : (
            <>
              {/* Alert Meta Overview */}
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-base font-bold text-white">{details.alert.ip}</span>
                  <span className={`px-2.5 py-0.5 rounded text-[11px] font-mono font-bold uppercase border ${
                    details.alert.severity === 'high'
                      ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      : details.alert.severity === 'medium'
                        ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        : 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
                  }`}>
                    {details.alert.severity} Severity
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-300 font-mono">
                  <div>Anomaly Score: <span className="text-sky-400 font-bold">{details.alert.anomalyScore}</span></div>
                  <div>Status: <span className="uppercase text-slate-200">{details.alert.status}</span></div>
                  <div>User: <span className="text-slate-200">{details.alert.username || 'anonymous'}</span></div>
                  <div>IP Blocked: <span className={details.isBlocked ? 'text-rose-400 font-bold' : 'text-slate-400'}>{details.isBlocked ? 'YES' : 'NO'}</span></div>
                </div>

                <p className="text-slate-400 text-[11px] pt-1 border-t border-slate-800">
                  {details.alert.details?.reason}
                </p>
              </div>

              {/* Raw Log Event */}
              {details.rawLog && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-300 font-semibold">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    <span>Triggering Raw Log Record</span>
                  </div>
                  <pre className="p-3.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-emerald-400 overflow-x-auto">
                    {JSON.stringify(details.rawLog, null, 2)}
                  </pre>
                </div>
              )}

              {/* Mini Timeline / Related Logs */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-slate-300 font-semibold">
                  <Activity className="w-4 h-4 text-sky-400" />
                  <span>Related Activity from IP ({details.relatedLogs?.length || 0} events)</span>
                </div>

                <div className="space-y-2 border-l border-slate-800 pl-3">
                  {details.relatedLogs?.map((log, idx) => (
                    <div key={log._id || idx} className="relative pl-3 text-[11px] font-mono space-y-0.5">
                      <div className="absolute -left-[17px] top-1.5 w-2 h-2 rounded-full bg-slate-600 border border-slate-900" />
                      <div className="flex items-center justify-between text-slate-400">
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase ${
                          log.status === 'success' ? 'text-emerald-400' : 'text-rose-400'
                        }`}>
                          {log.status} ({log.statusCode})
                        </span>
                      </div>
                      <div className="text-slate-200">
                        <span className="text-sky-400 font-bold">{log.method}</span> {log.endpoint}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {details?.alert && (
          <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
            >
              Close
            </button>
            {details.alert.status !== 'actioned' && (
              <button
                onClick={() => {
                  onClose();
                  onSuggestAction(details.alert);
                }}
                className="px-4 py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-medium transition"
              >
                Mitigate / Block IP
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlertDetailPanel;
