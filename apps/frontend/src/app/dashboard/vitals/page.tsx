'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Activity, TrendingUp, Heart, Droplets, ThermometerSun, Weight, Plus, AlertTriangle } from 'lucide-react';

const METRICS = [
  { key: 'heart_rate', label: 'Heart Rate', icon: Heart, unit: 'bpm', color: '#E8533A' },
  { key: 'bp_systolic', label: 'BP Systolic', icon: TrendingUp, unit: 'mmHg', color: '#005454' },
  { key: 'bp_diastolic', label: 'BP Diastolic', icon: TrendingUp, unit: 'mmHg', color: '#0d6e6e' },
  { key: 'spo2', label: 'SpO₂', icon: Droplets, unit: '%', color: '#4c5f7e' },
  { key: 'glucose', label: 'Glucose', icon: Activity, unit: 'mg/dL', color: '#4CAF82' },
  { key: 'temperature', label: 'Temperature', icon: ThermometerSun, unit: '°F', color: '#E8533A' },
  { key: 'weight', label: 'Weight', icon: Weight, unit: 'kg', color: '#6e7979' },
];

export default function VitalsPage() {
  const { user } = useAuth();
  const [latestVitals, setLatestVitals] = useState<Record<string, any>>({});
  const [recentVitals, setRecentVitals] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await api.get('/auth/me');
      const profileRes = await api.get(`/patients/${res.data.id}/profile`).catch(() => null);
      if (profileRes?.data?.id) {
        setPatientId(profileRes.data.id);
        return profileRes.data.id;
      }
    } catch { }
    return null;
  }, []);

  const fetchVitals = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      const [latestRes, recentRes, alertsRes] = await Promise.all([
        api.get(`/patients/${pid}/vitals/latest`).catch(() => ({ data: {} })),
        api.get(`/patients/${pid}/vitals?limit=20`).catch(() => ({ data: [] })),
        api.get(`/patients/${pid}/alerts?status=active`).catch(() => ({ data: [] })),
      ]);
      setLatestVitals(latestRes.data || {});
      setRecentVitals(Array.isArray(recentRes.data) ? recentRes.data : []);
      setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
    } catch { }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile().then((pid) => {
      if (pid) fetchVitals(pid);
      else setLoading(false);
    });
  }, [fetchProfile, fetchVitals]);

  const handleAddVital = async (readings: any[]) => {
    if (!patientId) return;
    try {
      await api.post(`/patients/${patientId}/vitals`, { readings });
      await fetchVitals(patientId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record vitals');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#191c1d] tracking-tight">Vitals</h1>
          <p className="text-[#3e4948] mt-1">Track your health metrics and view trends.</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Record Vitals
        </button>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert: any) => (
            <div
              key={alert.id}
              className={`rounded-lg px-4 py-3 flex items-center gap-3 border-l-4 ${
                alert.tier === 'emergency' ? 'bg-red-50 border-[#ba1a1a]' :
                alert.tier === 'urgent' ? 'bg-orange-50 border-orange-500' :
                alert.tier === 'soft' ? 'bg-yellow-50 border-yellow-500' :
                'bg-blue-50 border-blue-400'
              }`}
            >
              <AlertTriangle className={`w-4 h-4 ${
                alert.tier === 'emergency' ? 'text-[#ba1a1a]' :
                alert.tier === 'urgent' ? 'text-orange-600' :
                alert.tier === 'soft' ? 'text-yellow-600' : 'text-blue-500'
              }`} />
              <div className="flex-1">
                <span className="text-xs font-bold uppercase tracking-wide">{alert.tier}</span>
                <p className="text-sm text-[#191c1d]">{alert.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Latest Vitals Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="animate-pulse bg-[#f2f4f5] h-32 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {METRICS.map((m) => {
            const val = latestVitals[m.key];
            const Icon = m.icon;
            return (
              <div key={m.key} className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-5 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `${m.color}15` }}>
                    <Icon className="w-4 h-4" style={{ color: m.color }} />
                  </div>
                  <span className="text-xs font-medium text-[#6e7979] uppercase tracking-wider">{m.label}</span>
                </div>
                {val ? (
                  <>
                    <p className="text-3xl font-bold text-[#191c1d] font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {val.value}
                      <span className="text-sm text-[#6e7979] ml-1 font-sans">{m.unit}</span>
                    </p>
                    <p className="text-xs text-[#bec9c8] mt-1 font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {val.recordedAt ? new Date(val.recordedAt).toLocaleDateString() : ''}
                    </p>
                  </>
                ) : (
                  <p className="text-lg text-[#bec9c8]">No data</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recent Readings Table */}
      {recentVitals.length > 0 && (
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
          <h2 className="text-lg font-semibold text-[#191c1d] mb-4">Recent Readings</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6e8e9]">
                  <th className="text-left py-3 px-2 text-[#6e7979] text-xs font-medium uppercase">Metric</th>
                  <th className="text-left py-3 px-2 text-[#6e7979] text-xs font-medium uppercase">Value</th>
                  <th className="text-left py-3 px-2 text-[#6e7979] text-xs font-medium uppercase">Source</th>
                  <th className="text-left py-3 px-2 text-[#6e7979] text-xs font-medium uppercase">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {recentVitals.map((v: any) => (
                  <tr key={v.id} className="border-b border-[#f2f4f5] hover:bg-[#f8fafb]">
                    <td className="py-3 px-2 capitalize text-[#191c1d]">{v.metric_type?.replace('_', ' ')}</td>
                    <td className="py-3 px-2 font-mono font-bold text-[#005454]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {v.value} <span className="text-xs text-[#6e7979] font-normal">{v.unit}</span>
                    </td>
                    <td className="py-3 px-2 text-[#6e7979]">{v.source_device || 'Manual'}</td>
                    <td className="py-3 px-2 text-xs text-[#6e7979] font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                      {v.recorded_at ? new Date(v.recorded_at).toLocaleString() : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Vitals Modal */}
      {showAddModal && (
        <AddVitalsModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddVital}
        />
      )}
    </div>
  );
}

function AddVitalsModal({ onClose, onSave }: { onClose: () => void; onSave: (readings: any[]) => Promise<void> }) {
  const [readings, setReadings] = useState<any[]>([{ metricType: 'heart_rate', value: '', unit: 'bpm' }]);
  const [saving, setSaving] = useState(false);

  const metricOptions = METRICS.map((m) => ({ value: m.key, label: m.label, unit: m.unit }));

  const addRow = () => setReadings([...readings, { metricType: 'heart_rate', value: '', unit: 'bpm' }]);
  const removeRow = (i: number) => setReadings(readings.filter((_, idx) => idx !== i));

  const updateRow = (i: number, field: string, val: any) => {
    const updated = [...readings];
    updated[i] = { ...updated[i], [field]: val };
    if (field === 'metricType') {
      const m = METRICS.find((m) => m.key === val);
      updated[i].unit = m?.unit || '';
    }
    setReadings(updated);
  };

  const handleSave = async () => {
    const valid = readings.filter((r) => r.value && !isNaN(parseFloat(r.value)));
    if (valid.length === 0) return;
    setSaving(true);
    await onSave(valid.map((r) => ({ ...r, value: parseFloat(r.value) })));
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg">
        <div className="p-6 border-b border-[#e6e8e9]">
          <h2 className="text-xl font-bold text-[#191c1d]">Record Vitals</h2>
        </div>
        <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
          {readings.map((r, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1">
                <select
                  value={r.metricType}
                  onChange={(e) => updateRow(i, 'metricType', e.target.value)}
                  className="w-full bg-[#e1e3e4] rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#005454]"
                >
                  {metricOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="w-24">
                <input
                  type="number"
                  value={r.value}
                  onChange={(e) => updateRow(i, 'value', e.target.value)}
                  className="w-full bg-[#e1e3e4] rounded-lg px-3 py-2.5 text-sm font-mono text-center focus:outline-none focus:ring-2 focus:ring-[#005454]"
                  placeholder="Value"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                />
              </div>
              <span className="text-xs text-[#6e7979] w-12">{r.unit}</span>
              {readings.length > 1 && (
                <button onClick={() => removeRow(i)} className="text-[#ba1a1a] text-sm">✕</button>
              )}
            </div>
          ))}
          <button onClick={addRow} className="text-sm text-[#005454] font-semibold flex items-center gap-1 mt-2">
            <Plus className="w-4 h-4" /> Add metric
          </button>
        </div>
        <div className="p-6 border-t border-[#e6e8e9] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#3e4948]">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-6 py-2 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white text-sm font-semibold rounded-lg disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Vitals'}
          </button>
        </div>
      </div>
    </div>
  );
}
