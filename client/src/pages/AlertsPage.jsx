import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filter, Search, Calendar, ShieldCheck, RefreshCw } from 'lucide-react';
import { alertsApi } from '../services/api';
import AlertCard from '../components/alerts/AlertCard';
import AlertDetailPanel from '../components/alerts/AlertDetailPanel';
import BlockIpModal from '../components/alerts/BlockIpModal';
import { useSocket } from '../context/SocketContext';

const AlertsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { liveAlerts } = useSocket();

  // Filters
  const [severity, setSeverity] = useState('All');
  const [ip, setIp] = useState(searchParams.get('ip') || '');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // State
  const [alerts, setAlerts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Modals / Panels
  const [selectedAlertId, setSelectedAlertId] = useState(searchParams.get('alertId') || null);
  const [blockTargetAlert, setBlockTargetAlert] = useState(null);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const params = {};
      if (severity && severity !== 'All') params.severity = severity.toLowerCase();
      if (ip.trim()) params.ip = ip.trim();
      if (fromDate) params.from = fromDate;
      if (toDate) params.to = toDate;

      const res = await alertsApi.getAlerts(params);
      if (res.data) {
        setAlerts(res.data);
        setTotal(res.total || res.data.length);
      }
    } catch (err) {
      console.error('Failed to load alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  // Listen to Socket.IO live alerts and prepend
  useEffect(() => {
    if (liveAlerts.length > 0) {
      const latest = liveAlerts[0];
      setAlerts((prev) => [latest, ...prev.filter(a => a._id !== latest._id)]);
      setTotal((prev) => prev + 1);
    }
  }, [liveAlerts]);

  // Handle URL params
  useEffect(() => {
    const alertIdParam = searchParams.get('alertId');
    if (alertIdParam) {
      setSelectedAlertId(alertIdParam);
    }
    const ipParam = searchParams.get('ip');
    if (ipParam) {
      setIp(ipParam);
    }
  }, [searchParams]);

  const handleApplyFilters = (e) => {
    e?.preventDefault();
    fetchAlerts();
  };

  const handleBlockSuccess = (blockedIp) => {
    // Optimistically update alert status
    setAlerts((prev) =>
      prev.map((a) => (a.ip === blockedIp ? { ...a, status: 'actioned' } : a))
    );
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Threat Detection & Alert Feed</h2>
          <p className="text-xs text-slate-400">
            Machine learning anomaly detections categorized by risk profile ({total} total alerts)
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition"
        >
          <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filter Bar */}
      <form
        onSubmit={handleApplyFilters}
        className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center gap-4 text-xs"
      >
        {/* Severity Dropdown */}
        <div className="flex items-center gap-2">
          <label className="text-slate-400 font-medium">Severity:</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
          >
            <option value="All">All Severities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
        </div>

        {/* IP Search Input */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="Filter by IP address..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
          />
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
          />
          <span className="text-slate-500">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 font-mono text-[11px]"
          />
        </div>

        {/* Apply Filters Button */}
        <button
          type="submit"
          className="ml-auto px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-xs transition shadow-sm"
        >
          Apply Filters
        </button>
      </form>

      {/* Alert Cards Feed */}
      <div className="space-y-3">
        {loading ? (
          <div className="h-64 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            <span className="font-mono text-xs text-slate-400">Querying alert repository...</span>
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-2">
            <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
            <h4 className="text-sm font-semibold text-slate-200">No Threat Alerts Found</h4>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No anomaly patterns match your current filter criteria. Try broadening your filters or generate new events with the log simulator.
            </p>
          </div>
        ) : (
          alerts.map((alert) => (
            <AlertCard
              key={alert._id}
              alert={alert}
              onViewDetails={(a) => setSelectedAlertId(a._id)}
              onSuggestAction={(a) => setBlockTargetAlert(a)}
            />
          ))
        )}
      </div>

      {/* Slide-In Details Panel */}
      {selectedAlertId && (
        <AlertDetailPanel
          alertId={selectedAlertId}
          onClose={() => {
            setSelectedAlertId(null);
            setSearchParams({});
          }}
          onSuggestAction={(a) => setBlockTargetAlert(a)}
        />
      )}

      {/* Block IP Confirmation Modal */}
      {blockTargetAlert && (
        <BlockIpModal
          alert={blockTargetAlert}
          onClose={() => setBlockTargetAlert(null)}
          onSuccess={handleBlockSuccess}
        />
      )}
    </div>
  );
};

export default AlertsPage;
