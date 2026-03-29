'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Heart, TrendingUp, Activity, Droplets, ThermometerSun,
  Weight, Pill, AlertTriangle, FileText, Clock, User, Calendar,
  Shield, Sparkles, ChevronRight
} from 'lucide-react';

export default function PatientEHRPage() {
  const { user } = useAuth();
  const params = useParams();
  const patientId = params.id as string;
  const [patientData, setPatientData] = useState<any>(null);
  const [vitals, setVitals] = useState<Record<string, any>>({});
  const [recentVitals, setRecentVitals] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const clinicalToken = typeof window !== 'undefined' ? localStorage.getItem('clinicalToken') : null;

  const fetchEHR = useCallback(async () => {
    const headers: Record<string, string> = {};
    if (clinicalToken) headers['X-Clinical-Token'] = clinicalToken;

    try {
      const [profileRes, vitalsRes, recentRes, medsRes, docsRes] = await Promise.all([
        api.get(`/patients/${patientId}/profile`, { headers }).catch(() => ({ data: null })),
        api.get(`/patients/${patientId}/vitals/latest`, { headers }).catch(() => ({ data: {} })),
        api.get(`/patients/${patientId}/vitals?limit=10`, { headers }).catch(() => ({ data: [] })),
        api.get(`/patients/${patientId}/medications`, { headers }).catch(() => ({ data: [] })),
        api.get(`/patients/${patientId}/documents`, { headers }).catch(() => ({ data: [] })),
      ]);
      setPatientData(profileRes.data);
      setVitals(vitalsRes.data || {});
      setRecentVitals(Array.isArray(recentRes.data) ? recentRes.data : []);
      setMedications(Array.isArray(medsRes.data) ? medsRes.data : []);
      setDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
    } catch {}
    setLoading(false);
  }, [patientId, clinicalToken]);

  useEffect(() => { fetchEHR(); }, [fetchEHR]);

  const METRICS = [
    { key: 'heart_rate', label: 'Heart Rate', icon: Heart, unit: 'bpm', color: '#E8533A' },
    { key: 'bp_systolic', label: 'BP Systolic', icon: TrendingUp, unit: 'mmHg', color: '#005454' },
    { key: 'bp_diastolic', label: 'BP Diastolic', icon: TrendingUp, unit: 'mmHg', color: '#0d6e6e' },
    { key: 'spo2', label: 'SpO₂', icon: Droplets, unit: '%', color: '#4c5f7e' },
    { key: 'glucose', label: 'Glucose', icon: Activity, unit: 'mg/dL', color: '#4CAF82' },
    { key: 'temperature', label: 'Temp', icon: ThermometerSun, unit: '°F', color: '#E8533A' },
    { key: 'weight', label: 'Weight', icon: Weight, unit: 'kg', color: '#6e7979' },
  ];

  const patientName = patientData
    ? [patientData.firstName, patientData.lastName].filter(Boolean).join(' ') || 'Unknown Patient'
    : 'Loading...';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/doctor" className="w-9 h-9 rounded-lg bg-[#f2f4f5] flex items-center justify-center hover:bg-[#e6e8e9] transition-colors">
          <ArrowLeft className="w-4 h-4 text-[#3e4948]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#191c1d]">Patient EHR</h1>
          <p className="text-xs text-[#6e7979]">Authorized clinical access</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#4CAF82]/10 text-[#4CAF82] text-xs font-semibold">
          <Shield className="w-3.5 h-3.5" /> Access Granted
        </div>
      </div>

      {/* Patient Info */}
      <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex items-center justify-center text-white text-xl font-bold">
            {patientName[0]?.toUpperCase() || 'P'}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-[#191c1d]">{patientName}</h2>
            <div className="flex items-center gap-4 mt-1 text-xs text-[#6e7979]">
              {patientData?.gender && <span className="flex items-center gap-1"><User className="w-3 h-3" /> {patientData.gender}</span>}
              {patientData?.dateOfBirth && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {new Date(patientData.dateOfBirth).toLocaleDateString()}</span>}
              {patientData?.bloodType && <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {patientData.bloodType.replace('_', '+')}</span>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#6e7979] uppercase tracking-wider font-semibold">Patient ID</p>
            <p className="text-xs text-[#005454] font-mono font-bold">{patientId.slice(0, 12)}...</p>
          </div>
        </div>
      </div>

      {/* Vitals */}
      <div>
        <h2 className="text-base font-semibold text-[#191c1d] mb-3">Latest Vitals</h2>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[...Array(7)].map((_, i) => <div key={i} className="h-28 bg-[#f2f4f5] rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {METRICS.map((m) => {
              const Icon = m.icon;
              const val = vitals[m.key];
              return (
                <div key={m.key} className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: `${m.color}15` }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                    </div>
                    <span className="text-[10px] font-semibold text-[#6e7979] uppercase tracking-wider">{m.label}</span>
                  </div>
                  {val ? (
                    <p className="text-2xl font-bold text-[#191c1d] font-mono">
                      {val.value}<span className="text-xs text-[#6e7979] ml-1 font-sans">{m.unit}</span>
                    </p>
                  ) : (
                    <p className="text-sm text-[#bec9c8]">—</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Medications */}
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Pill className="w-5 h-5 text-[#E8533A]" />
            <h3 className="text-base font-semibold text-[#191c1d]">Current Medications</h3>
          </div>
          {medications.length === 0 ? (
            <p className="text-sm text-[#6e7979] text-center py-6">No medications on record.</p>
          ) : (
            <div className="space-y-2">
              {medications.map((med: any, i: number) => (
                <div key={i} className="px-4 py-3 rounded-lg" style={{ backgroundColor: 'var(--surface-container-low)' }}>
                  <p className="text-sm font-semibold text-[#191c1d]">{med.name || med.medication}</p>
                  <p className="text-xs text-[#6e7979]">{med.dosage} · {med.frequency}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Documents */}
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-[#4c5f7e]" />
            <h3 className="text-base font-semibold text-[#191c1d]">Documents</h3>
          </div>
          {documents.length === 0 ? (
            <p className="text-sm text-[#6e7979] text-center py-6">No documents available.</p>
          ) : (
            <div className="space-y-2">
              {documents.slice(0, 5).map((doc: any) => (
                <div key={doc.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: 'var(--surface-container-low)' }}>
                  <FileText className="w-4 h-4 text-[#4c5f7e]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#191c1d] truncate">{doc.fileName}</p>
                    <p className="text-[11px] text-[#6e7979] font-mono">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Vitals History */}
      {recentVitals.length > 0 && (
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
          <h3 className="text-base font-semibold text-[#191c1d] mb-4">Vital History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#e6e8e9]">
                  <th className="text-left py-3 px-2 text-[10px] font-semibold text-[#6e7979] uppercase">Metric</th>
                  <th className="text-left py-3 px-2 text-[10px] font-semibold text-[#6e7979] uppercase">Value</th>
                  <th className="text-left py-3 px-2 text-[10px] font-semibold text-[#6e7979] uppercase">Source</th>
                  <th className="text-left py-3 px-2 text-[10px] font-semibold text-[#6e7979] uppercase">Recorded</th>
                </tr>
              </thead>
              <tbody>
                {recentVitals.map((v: any) => (
                  <tr key={v.id} className="border-b border-[#f2f4f5] hover:bg-[#f8fafb]">
                    <td className="py-3 px-2 capitalize text-[#191c1d]">{v.metric_type?.replace('_', ' ')}</td>
                    <td className="py-3 px-2 font-mono font-bold text-[#005454]">{v.value} <span className="text-xs text-[#6e7979] font-normal">{v.unit}</span></td>
                    <td className="py-3 px-2 text-[#6e7979]">{v.source_device || 'Manual'}</td>
                    <td className="py-3 px-2 text-xs text-[#6e7979] font-mono">{v.recorded_at ? new Date(v.recorded_at).toLocaleString() : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Link */}
      <Link href="/dashboard/ai-advisor" className="block">
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-5 flex items-center gap-4 hover:shadow-md transition-shadow group">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[#191c1d]">AI Health Advisor</h3>
            <p className="text-xs text-[#6e7979]">Get AI-powered clinical insights for this patient.</p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#bec9c8] group-hover:text-[#005454] transition-colors" />
        </div>
      </Link>
    </div>
  );
}
