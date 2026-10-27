import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Shield, KeyRound, Users, Check, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../services/api';

const SettingsPage = () => {
  const { user, isAdmin } = useAuth();

  // Role Management State
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [roleMap, setRoleMap] = useState({});
  const [saveStatus, setSaveStatus] = useState({});

  useEffect(() => {
    if (isAdmin) {
      setLoadingUsers(true);
      usersApi.getUsers()
        .then((res) => {
          if (res.data) {
            setUsersList(res.data);
            const initialMap = {};
            res.data.forEach((u) => {
              initialMap[u._id] = u.role;
            });
            setRoleMap(initialMap);
          }
        })
        .catch((err) => console.error('Failed to load users:', err))
        .finally(() => setLoadingUsers(false));
    }
  }, [isAdmin]);

  const handleRoleChange = (userId, newRole) => {
    setRoleMap((prev) => ({ ...prev, [userId]: newRole }));
  };

  const handleSaveRole = async (userId) => {
    const newRole = roleMap[userId];
    setSaveStatus((prev) => ({ ...prev, [userId]: 'saving' }));
    try {
      await usersApi.updateRole(userId, newRole);
      setSaveStatus((prev) => ({ ...prev, [userId]: 'saved' }));
      setTimeout(() => {
        setSaveStatus((prev) => ({ ...prev, [userId]: null }));
      }, 2500);
    } catch (err) {
      alert(`Failed to update role: ${err.message}`);
      setSaveStatus((prev) => ({ ...prev, [userId]: null }));
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">System & Account Settings</h2>
        <p className="text-xs text-slate-400">
          Manage user profiles, RBAC security roles, and platform parameters
        </p>
      </div>

      {/* Account Info Profile Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-100">
          <KeyRound className="w-4 h-4 text-sky-400" />
          <span>Active Analyst Profile</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400">Analyst Name</span>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-medium">
              {user?.name}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400">Email Address</span>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-white font-mono">
              {user?.email}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400">Assigned RBAC Role</span>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-sky-400 font-mono uppercase font-bold">
              {user?.role}
            </div>
          </div>
          <div className="space-y-1">
            <span className="text-slate-400">Security Clearance</span>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-emerald-400 font-mono">
              {isAdmin ? 'Full Administrative Access (SOC Lead)' : 'Analyst Read / Write (Incident Responder)'}
            </div>
          </div>
        </div>
      </div>

      {/* RBAC Role Management (Admin only) */}
      {isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm font-semibold text-slate-100">
              <Users className="w-4 h-4 text-purple-400" />
              <span>Role-Based Access Control (RBAC) Management</span>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 uppercase font-bold">
              Admin Only
            </span>
          </div>

          <p className="text-xs text-slate-400">
            Promote team members to administrators to grant action mitigation approval rights (e.g., blocking malicious IPs).
          </p>

          <div className="border border-slate-800 rounded-lg overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-950/80 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Assigned Role</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loadingUsers ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Loading users...
                    </td>
                  </tr>
                ) : (
                  usersList.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-white font-sans">{u.name}</td>
                      <td className="py-3 px-4 text-slate-300">{u.email}</td>
                      <td className="py-3 px-4">
                        <select
                          value={roleMap[u._id] || u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-purple-500"
                        >
                          <option value="analyst">analyst</option>
                          <option value="admin">admin</option>
                          <option value="viewer">viewer</option>
                        </select>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleSaveRole(u._id)}
                          disabled={saveStatus[u._id] === 'saving'}
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold transition ${
                            saveStatus[u._id] === 'saved'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                              : 'bg-purple-600 hover:bg-purple-500 text-white'
                          }`}
                        >
                          {saveStatus[u._id] === 'saved' ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Saved</span>
                            </>
                          ) : (
                            <span>{saveStatus[u._id] === 'saving' ? 'Saving...' : 'Save'}</span>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
