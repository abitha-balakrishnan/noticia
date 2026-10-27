import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Bell, ShieldAlert, ArrowUpRight, ShieldCheck, RefreshCw } from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { dashboardApi, alertsApi } from '../services/api';
import { useSocket } from '../context/SocketContext';

const DashboardHome = () => {
  const navigate = useNavigate();
  const { liveAlerts } = useSocket();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    stats: {
      totalLogsToday: 0,
      activeAlerts: 0,
      blockedIpsCount: 0
    },
    severityDistribution: [
      { name: 'High', value: 0, color: '#ef4444' },
      { name: 'Medium', value: 0, color: '#f97316' },
      { name: 'Low', value: 0, color: '#eab308' }
    ],
    alertsOverTime: [],
    recentAlerts: []
  });

  const fetchSummary = async () => {
    try {
      const res = await dashboardApi.getSummary();
      if (res.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  // Real-time update when Socket.IO pushes a new alert
  useEffect(() => {
    if (liveAlerts.length > 0) {
      const latest = liveAlerts[0];
      setData((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          activeAlerts: prev.stats.activeAlerts + 1,
          totalLogsToday: prev.stats.totalLogsToday + 1
        },
        recentAlerts: [latest, ...prev.recentAlerts.slice(0, 4)]
      }));
    }
  }, [liveAlerts]);

  const triggerMlDetection = async () => {
    try {
      await alertsApi.triggerMl();
      await fetchSummary();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span className="font-mono text-xs text-slate-400">Loading SOC telemetry feed...</span>
      </div>
    );
  }

  const { stats, severityDistribution, alertsOverTime, recentAlerts } = data;

  return (
    <div className="space-y-6">
      {/* Page Title & Live Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Security Operations Center Overview</h2>
          <p className="text-xs text-slate-400">Real-time threat monitoring and ML telemetry status</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={triggerMlDetection}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
            <span>Run Threat Detection</span>
          </button>
        </div>
      </div>

      {/* Top Row: 3 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Stat Card 1: Total Logs Today */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Logs Today</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono font-bold text-white">
            {stats.totalLogsToday.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Ingested across security sensors & endpoints
          </div>
        </div>

        {/* Stat Card 2: Active Alerts */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Alerts</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono font-bold text-rose-400">
            {stats.activeAlerts.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            High & medium severity threats awaiting analyst review
          </div>
        </div>

        {/* Stat Card 3: Blocked IPs */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Blocked IPs</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-mono font-bold text-purple-300">
            {stats.blockedIpsCount.toLocaleString()}
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Enforced firewall perimeter mitigations
          </div>
        </div>
      </div>

      {/* Middle Row: Charts side-by-side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line Chart: Alerts Over Time (2 cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">Alerts Over Time (Last 24 Hours)</h3>
            <span className="text-[11px] font-mono text-sky-400">Hourly Telemetry</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={alertsOverTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis stroke="#64748b" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Line type="monotone" dataKey="total" name="Total Alerts" stroke="#38bdf8" strokeWidth={2} dot={{ r: 2 }} />
                <Line type="monotone" dataKey="high" name="High Severity" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Severity Distribution (1 col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-100">Severity Distribution</h3>
            <span className="text-[11px] font-mono text-slate-400">Classification Bands</span>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            {severityDistribution.reduce((acc, c) => acc + c.value, 0) === 0 ? (
              <div className="text-center text-xs text-slate-500 font-mono">No alert anomalies scored yet</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={severityDistribution}
                    cx="50%"
                    cy="45%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {severityDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    iconType="circle"
                    formatter={(val) => <span className="text-xs text-slate-300 font-mono">{val}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Section: Recent Alerts Table (Last 5) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Recent Threat Alerts</h3>
            <p className="text-xs text-slate-400">Click any row to view full forensic telemetry</p>
          </div>
          <button
            onClick={() => navigate('/alerts')}
            className="flex items-center gap-1 text-xs font-semibold text-sky-400 hover:text-sky-300 transition"
          >
            <span>View All Alerts</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Severity</th>
                <th className="py-3 px-4">Attacker IP</th>
                <th className="py-3 px-4">Target User</th>
                <th className="py-3 px-4">Anomaly Score</th>
                <th className="py-3 px-4">Detected At</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentAlerts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No threat alerts recorded yet. Run the log simulator to view live threat detection!
                  </td>
                </tr>
              ) : (
                recentAlerts.map((alert) => (
                  <tr
                    key={alert._id}
                    onClick={() => navigate(`/alerts?alertId=${alert._id}`)}
                    className="hover:bg-slate-800/50 cursor-pointer transition"
                  >
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                        alert.severity === 'high'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : alert.severity === 'medium'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                            : 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30'
                      }`}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-white">{alert.ip}</td>
                    <td className="py-3 px-4 text-slate-300">{alert.username || 'anonymous'}</td>
                    <td className="py-3 px-4 text-sky-400 font-semibold">{alert.anomalyScore}</td>
                    <td className="py-3 px-4 text-slate-400">
                      {new Date(alert.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className="uppercase text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {alert.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default DashboardHome;
