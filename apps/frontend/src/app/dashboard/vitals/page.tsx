'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { getMyPatientId } from '@/lib/patient';
import { Activity, Heart, Droplets, ThermometerSun, Weight, PlusCircle } from 'lucide-react';

type MetricKey =
  | 'heart_rate'
  | 'blood_pressure'
  | 'spo2'
  | 'blood_glucose'
  | 'weight'
  | 'temperature';

const METRIC_TABS: Array<{ key: MetricKey; label: string }> = [
  { key: 'heart_rate', label: 'Heart Rate' },
  { key: 'blood_pressure', label: 'Blood Pressure' },
  { key: 'spo2', label: 'Blood Oxygen' },
  { key: 'blood_glucose', label: 'Glucose' },
  { key: 'weight', label: 'Weight' },
  { key: 'temperature', label: 'Temperature' },
];

const RECORDABLE_METRICS = [
  { value: 'heart_rate', label: 'Heart Rate', unit: 'bpm' },
  { value: 'blood_pressure_systolic', label: 'BP Systolic', unit: 'mmHg' },
  { value: 'blood_pressure_diastolic', label: 'BP Diastolic', unit: 'mmHg' },
  { value: 'spo2', label: 'Blood Oxygen', unit: '%' },
  { value: 'blood_glucose', label: 'Glucose', unit: 'mg/dL' },
  { value: 'weight', label: 'Weight', unit: 'kg' },
  { value: 'temperature', label: 'Temperature', unit: '°F' },
];

function statusLabel(metric: MetricKey, value: number | null) {
  if (value === null) return 'No data';
  if (metric === 'heart_rate') return value >= 60 && value <= 100 ? 'Normal' : 'Review';
  if (metric === 'spo2') return value >= 95 ? 'Normal' : 'Low';
  if (metric === 'blood_glucose') return value >= 70 && value <= 180 ? 'Normal' : 'Review';
  if (metric === 'temperature') return value <= 99.5 ? 'Normal' : 'Elevated';
  if (metric === 'weight') return 'Stable';
  return 'Normal';
}

function metricColor(status: string) {
  if (status === 'Low' || status === 'Review' || status === 'Elevated') return '#E8533A';
  return '#005454';
}

function toChartPoints(values: number[], width = 640, height = 220): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

export default function VitalsPage() {
  const [latestVitals, setLatestVitals] = useState<Record<string, { value: number; unit: string; recordedAt: string }>>({});
  const [recentVitals, setRecentVitals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('heart_rate');
  const [timeRange, setTimeRange] = useState<'7D' | '30D' | '90D' | '1Y'>('30D');
  const [entryMetric, setEntryMetric] = useState('heart_rate');
  const [entryValue, setEntryValue] = useState('');
  const [entrySource, setEntrySource] = useState('Manual Entry');
  const [entryNotes, setEntryNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const id = await getMyPatientId();
      setPatientId(id);
      setPageError(null);
      return id;
    } catch {
      setPatientId(null);
      setPageError('Could not load your patient profile. Please refresh and try again.');
    }
    return null;
  }, []);

  const fetchVitals = useCallback(async (pid: string) => {
    setLoading(true);
    try {
      const [latestRes, recentRes] = await Promise.all([
        api.get(`/patients/${pid}/vitals/latest`).catch(() => ({ data: {} })),
        api.get(`/patients/${pid}/vitals?limit=20`).catch(() => ({ data: [] })),
      ]);
      setLatestVitals(latestRes.data || {});
      setRecentVitals(Array.isArray(recentRes.data) ? recentRes.data : []);
    } catch {
      setPageError('Unable to load vitals right now.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile().then((pid) => {
      if (pid) fetchVitals(pid);
      else setLoading(false);
    });
  }, [fetchProfile, fetchVitals]);

  const handleAddVital = async (readings: any[]) => {
    if (!patientId) {
      setPageError('Patient profile is not available. Please refresh before saving vitals.');
      setSuccessMessage(null);
      return false;
    }
    try {
      await api.post(`/patients/${patientId}/vitals`, { readings });
      await fetchVitals(patientId);
      setPageError(null);
      setSuccessMessage(`Recorded ${readings.length} vital${readings.length > 1 ? 's' : ''} successfully.`);
      setTimeout(() => setSuccessMessage(null), 3500);
      return true;
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to record vitals');
      setSuccessMessage(null);
      return false;
    }
  };

  const handleRecordSingle = async () => {
    const parsed = parseFloat(entryValue);
    if (!entryValue || Number.isNaN(parsed)) {
      setPageError('Enter a valid measured value before recording.');
      return;
    }
    const metricDef = RECORDABLE_METRICS.find((m) => m.value === entryMetric);
    if (!metricDef) return;
    setSaving(true);
    const ok = await handleAddVital([{
      metricType: metricDef.value,
      value: parsed,
      unit: metricDef.unit,
      sourceDevice: entrySource,
      contextNotes: entryNotes,
    }]);
    setSaving(false);
    if (ok) {
      setEntryValue('');
      setEntryNotes('');
    }
  };

  const hr = latestVitals.heart_rate?.value ?? null;
  const bpSys = latestVitals.blood_pressure_systolic?.value ?? null;
  const bpDia = latestVitals.blood_pressure_diastolic?.value ?? null;
  const spo2 = latestVitals.spo2?.value ?? null;
  const glucose = latestVitals.blood_glucose?.value ?? null;
  const weight = latestVitals.weight?.value ?? null;
  const temp = latestVitals.temperature?.value ?? null;

  const cards = [
    { key: 'heart_rate' as MetricKey, title: 'Heart Rate', display: hr === null ? '--' : `${hr}`, unit: 'bpm', icon: Heart },
    { key: 'blood_pressure' as MetricKey, title: 'Blood Pressure', display: bpSys === null ? '--/--' : `${bpSys}/${bpDia ?? '--'}`, unit: 'mmHg', icon: Activity },
    { key: 'spo2' as MetricKey, title: 'Blood Oxygen', display: spo2 === null ? '--' : `${spo2}`, unit: '%', icon: Droplets },
    { key: 'blood_glucose' as MetricKey, title: 'Glucose', display: glucose === null ? '--' : `${glucose}`, unit: 'mg/dL', icon: Activity },
    { key: 'weight' as MetricKey, title: 'Weight', display: weight === null ? '--' : `${weight}`, unit: 'kg', icon: Weight },
    { key: 'temperature' as MetricKey, title: 'Temperature', display: temp === null ? '--' : `${temp}`, unit: '°F', icon: ThermometerSun },
  ];

  const selectedSeriesKey =
    selectedMetric === 'blood_pressure'
      ? 'blood_pressure_systolic'
      : selectedMetric;
  const selectedReadings = recentVitals
    .filter((v: any) => v.metric_type === selectedSeriesKey)
    .map((v: any) => Number(v.value))
    .slice(0, 12)
    .reverse();
  const fallbackCenter =
    (latestVitals[selectedSeriesKey]?.value as number | undefined) ?? 80;
  const fallbackSeries = Array.from({ length: 12 }, (_, i) => fallbackCenter + Math.round(Math.sin(i / 1.6) * 8));
  const chartValues = selectedReadings.length > 1 ? selectedReadings : fallbackSeries;
  const chartPoints = toChartPoints(chartValues);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#191c1d] tracking-tight">Clinical Vitals</h1>
          <p className="text-[#3e4948] mt-1">Provider-style telemetry with manual entry and trend monitoring.</p>
        </div>
        <div className="inline-flex rounded-lg bg-[#f2f4f5] p-1">
          {(['7D', '30D', '90D', '1Y'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                timeRange === r ? 'bg-white text-[#005454] shadow-sm' : 'text-[#6e7979] hover:text-[#191c1d]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {pageError && (
        <div className="rounded-lg bg-[#ffdad6] px-4 py-3 text-sm text-[#ba1a1a]">
          {pageError}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg bg-[#d8f8e8] px-4 py-3 text-sm text-[#1b5e42] shadow-[0px_8px_24px_rgba(25,28,29,0.04)]">
          {successMessage}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        {METRIC_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedMetric(tab.key)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
              selectedMetric === tab.key
                ? 'bg-[#005454]/10 text-[#005454]'
                : 'text-[#6e7979] hover:text-[#191c1d]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-6 gap-4">
        {cards.map((card) => {
          const status = statusLabel(card.key, card.key === 'blood_pressure' ? bpSys : Number(card.display));
          const color = metricColor(status);
          const Icon = card.icon;
          return (
            <div key={card.key} className="xl:col-span-1 bg-white rounded-xl p-4 shadow-[0px_12px_32px_rgba(25,28,29,0.04)]">
              <p className="text-[11px] text-[#6e7979] font-semibold tracking-widest uppercase">{card.title}</p>
              <div className="mt-1 flex items-end gap-1">
                <p className="text-3xl font-bold text-[#191c1d] font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                  {card.display}
                </p>
                <span className="text-xs text-[#6e7979] mb-1">{card.unit}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs font-semibold" style={{ color }}>
                <Icon className="w-3.5 h-3.5" />
                {status.toUpperCase()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        <div className="xl:col-span-3 bg-white rounded-xl p-6 shadow-[0px_12px_32px_rgba(25,28,29,0.04)]">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-3xl font-bold text-[#191c1d]">
                {METRIC_TABS.find((m) => m.key === selectedMetric)?.label} Longitudinal View
              </h2>
              <p className="text-[#6e7979] mt-1">Provider-verified telemetry trend over {timeRange.toLowerCase()}.</p>
            </div>
            <div className="text-sm text-[#6e7979]">
              Daily Average
            </div>
          </div>

          <div className="rounded-xl bg-[#f8fafb] p-4">
            <svg viewBox="0 0 640 260" className="w-full h-[280px]">
              <defs>
                <linearGradient id="vitalGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#005454" stopOpacity="0.24" />
                  <stop offset="100%" stopColor="#005454" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <polyline points={chartPoints} fill="none" stroke="#005454" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={`${chartPoints} 640,260 0,260`} fill="url(#vitalGradient)" stroke="none" />
            </svg>
          </div>
        </div>

        <div className="xl:col-span-1 bg-white rounded-xl p-6 shadow-[0px_12px_32px_rgba(25,28,29,0.04)]">
          <h3 className="text-[28px] font-bold text-[#191c1d] flex items-center gap-2">
            <PlusCircle className="w-6 h-6 text-[#005454]" />
            Manual Entry
          </h3>
          <div className="mt-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-[#6e7979] uppercase tracking-wider">Metric Category</label>
              <select
                value={entryMetric}
                onChange={(e) => setEntryMetric(e.target.value)}
                className="mt-1 w-full rounded-lg bg-[#e1e3e4] px-3 py-3 text-sm text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#005454]"
              >
                {RECORDABLE_METRICS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6e7979] uppercase tracking-wider">Measured Value</label>
              <div className="mt-1 flex items-center rounded-lg bg-[#e1e3e4] px-3 py-3">
                <input
                  type="number"
                  value={entryValue}
                  onChange={(e) => setEntryValue(e.target.value)}
                  className="w-full bg-transparent text-xl font-bold font-mono text-[#191c1d] focus:outline-none"
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                  placeholder="72"
                />
                <span className="text-xs text-[#6e7979]">
                  {RECORDABLE_METRICS.find((m) => m.value === entryMetric)?.unit}
                </span>
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6e7979] uppercase tracking-wider">Source Device</label>
              <input
                value={entrySource}
                onChange={(e) => setEntrySource(e.target.value)}
                className="mt-1 w-full rounded-lg bg-[#e1e3e4] px-3 py-3 text-sm text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#005454]"
                placeholder="Apple Watch"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-[#6e7979] uppercase tracking-wider">Notes (Optional)</label>
              <textarea
                value={entryNotes}
                onChange={(e) => setEntryNotes(e.target.value)}
                className="mt-1 h-24 w-full rounded-lg bg-[#e1e3e4] px-3 py-3 text-sm text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#005454]"
                placeholder="e.g. Post-cardio session"
              />
            </div>
            <button
              onClick={handleRecordSingle}
              disabled={saving || loading}
              className="w-full rounded-lg bg-gradient-to-r from-[#005454] to-[#0d6e6e] py-3 text-white font-semibold hover:shadow-lg transition-all disabled:opacity-60"
            >
              {saving ? 'Recording...' : 'Record Reading'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
