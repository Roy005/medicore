'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft, Heart, TrendingUp, Activity, Droplets, ThermometerSun,
  Weight, Pill, AlertTriangle, FileText, Clock, User, Calendar,
  Shield, Sparkles, ChevronRight, Plus, X, Download, Eye, Loader2
} from 'lucide-react';

// --- Prescription Modal Component ---
function PrescriptionModal({ isOpen, onClose, patientId, onRefresh }: { 
  isOpen: boolean, 
  onClose: () => void, 
  patientId: string, 
  onRefresh: () => void 
}) {
  const [activeTab, setActiveTab] = useState<'med' | 'test'>('med');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Med form
  const [medData, setMedData] = useState({ drug_name: '', dosage: '', frequency: '' });
  // Test form
  const [testName, setTestName] = useState('');
  // Common notes
  const [additionalNotes, setAdditionalNotes] = useState('');

  const clinicalToken = typeof window !== 'undefined' ? localStorage.getItem('clinicalToken') : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (clinicalToken) headers['X-Clinical-Token'] = clinicalToken;

    try {
      if (activeTab === 'med') {
        const payload = {
          ...medData,
          source: additionalNotes ? `Notes: ${additionalNotes}` : 'Provider Prescription'
        };
        await api.post(`/patients/${patientId}/medications`, payload, { headers });
      } else {
        // Plan field of SOAP note for test orders
        await api.post(`/patients/${patientId}/notes`, {
          plan: `Ordered Lab Test: ${testName}`,
          additionalNotes: additionalNotes,
          visitDate: new Date().toISOString().split('T')[0]
        }, { headers });
      }
      onRefresh();
      onClose();
      // Reset
      setMedData({ drug_name: '', dosage: '', frequency: '' });
      setTestName('');
      setAdditionalNotes('');
    } catch (err: any) {
      console.error('Prescription error:', err);
      setError(err.response?.data?.message || err.message || 'Failed to submit prescription');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden ring-1 ring-black/5">
        <div className="px-6 py-4 flex items-center justify-between border-b border-[#f2f4f5]">
          <h3 className="text-lg font-bold text-[#191c1d]">Prescribe</h3>
          <button onClick={onClose} className="p-1 hover:bg-[#f2f4f5] rounded-full transition-colors">
            <X className="w-5 h-5 text-[#6e7979]" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex p-1 bg-[#f2f4f5] rounded-lg mb-6">
            <button
              onClick={() => setActiveTab('med')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'med' ? 'bg-white text-[#005454] shadow-sm' : 'text-[#6e7979]'}`}
            >
              Medicine
            </button>
            <button
              onClick={() => setActiveTab('test')}
              className={`flex-1 py-2 text-sm font-semibold rounded-md transition-all ${activeTab === 'test' ? 'bg-white text-[#005454] shadow-sm' : 'text-[#6e7979]'}`}
            >
              Lab Test / Lab Service
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'med' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-[#6e7979] uppercase tracking-wider mb-1">Drug Name</label>
                  <input
                    required
                    type="text"
                    value={medData.drug_name}
                    onChange={(e) => setMedData({ ...medData, drug_name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-[#f2f4f5] border-none rounded-lg focus:ring-2 focus:ring-[#005454] text-sm"
                    placeholder="e.g. Amoxicillin 500mg"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#6e7979] uppercase tracking-wider mb-1">Dosage</label>
                    <input
                      required
                      type="text"
                      value={medData.dosage}
                      onChange={(e) => setMedData({ ...medData, dosage: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#f2f4f5] border-none rounded-lg focus:ring-2 focus:ring-[#005454] text-sm"
                      placeholder="e.g. 1 Tablet"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#6e7979] uppercase tracking-wider mb-1">Frequency</label>
                    <input
                      required
                      type="text"
                      value={medData.frequency}
                      onChange={(e) => setMedData({ ...medData, frequency: e.target.value })}
                      className="w-full px-4 py-2.5 bg-[#f2f4f5] border-none rounded-lg focus:ring-2 focus:ring-[#005454] text-sm"
                      placeholder="e.g. Twice Daily"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-bold text-[#6e7979] uppercase tracking-wider mb-1">Test Name</label>
                <input
                  required
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#f2f4f5] border-none rounded-lg focus:ring-2 focus:ring-[#005454] text-sm"
                  placeholder="e.g. Complete Blood Count (CBC)"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#6e7979] uppercase tracking-wider mb-1">Additional Instructions / Notes</label>
              <textarea
                value={additionalNotes}
                onChange={(e) => setAdditionalNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2.5 bg-[#f2f4f5] border-none rounded-lg focus:ring-2 focus:ring-[#005454] text-sm resize-none"
                placeholder="e.g. Take with food, or symptoms reported..."
              />
            </div>

            {error && <p className="text-xs text-[#ba1a1a] bg-[#ffdad6] p-2 rounded">{error}</p>}

            <button
              disabled={loading}
              type="submit"
              className="w-full py-3 bg-[#005454] text-white font-bold rounded-xl hover:bg-[#004040] transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Prescription'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function PatientEHRPage() {
  const { user } = useAuth();
  const params = useParams();
  const patientId = params.id as string;
  const [patientData, setPatientData] = useState<any>(null);
  const [vitals, setVitals] = useState<Record<string, any>>({});
  const [recentVitals, setRecentVitals] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPrescribeOpen, setIsPrescribeOpen] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<string | null>(null);

  const clinicalToken = typeof window !== 'undefined' ? localStorage.getItem('clinicalToken') : null;

  const fetchEHR = useCallback(async () => {
    const headers: Record<string, string> = {};
    if (clinicalToken) headers['X-Clinical-Token'] = clinicalToken;

    try {
      const [profileRes, vitalsRes, recentRes, medsRes, docsRes, timelineRes] = await Promise.all([
        api.get(`/patients/${patientId}/profile`, { headers }).catch(() => ({ data: null })),
        api.get(`/patients/${patientId}/vitals/latest`, { headers }).catch(() => ({ data: {} })),
        api.get(`/patients/${patientId}/vitals?limit=10`, { headers }).catch(() => ({ data: [] })),
        api.get(`/patients/${patientId}/medications`, { headers }).catch(() => ({ data: [] })),
        api.get(`/patients/${patientId}/documents`, { headers }).catch(() => ({ data: [] })),
        api.get(`/patients/${patientId}/timeline`, { headers }).catch(() => ({ data: [] })),
      ]);
      setPatientData(profileRes.data);
      setVitals(vitalsRes.data || {});
      setRecentVitals(Array.isArray(recentRes.data) ? recentRes.data : []);
      setMedications(Array.isArray(medsRes.data) ? medsRes.data : []);
      setDocuments(Array.isArray(docsRes.data) ? docsRes.data : []);
      setTimeline(Array.isArray(timelineRes.data) ? timelineRes.data : []);
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
        <button
          onClick={() => setIsPrescribeOpen(true)}
          className="px-4 py-2 bg-[#E8533A] text-white font-bold rounded-lg hover:shadow-lg transition-all flex items-center gap-2 text-sm ml-2"
        >
          <Plus className="w-4 h-4" />
          Prescribe
        </button>
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
              {documents.slice(0, 8).map((doc: any) => {
                const handleView = async () => {
                  setViewingDoc(doc.id);
                  try {
                    const headers: Record<string, string> = {};
                    if (clinicalToken) headers['X-Clinical-Token'] = clinicalToken;
                    const response = await api.get(`/patients/${patientId}/documents/${doc.id}`, { 
                      headers,
                      responseType: 'blob' 
                    });
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', doc.original_name || doc.originalName || 'document');
                    document.body.appendChild(link);
                    link.click();
                    link.parentNode?.removeChild(link);
                  } catch (err) {
                    console.error('Download failed', err);
                  } finally {
                    setViewingDoc(null);
                  }
                };

                return (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-3 rounded-lg group hover:bg-[#f2f4f5] transition-colors" style={{ backgroundColor: 'var(--surface-container-low)' }}>
                    <FileText className="w-4 h-4 text-[#4c5f7e]" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#191c1d] truncate" title={doc.original_name || doc.originalName || doc.fileName}>
                        {doc.original_name || doc.originalName || doc.fileName}
                      </p>
                      <p className="text-[11px] text-[#6e7979] font-mono">{new Date(doc.uploadedAt || doc.upload_date).toLocaleDateString()}</p>
                    </div>
                    <button 
                      onClick={handleView}
                      disabled={viewingDoc === doc.id}
                      className="p-2 text-[#005454] hover:bg-white rounded-md transition-all opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    >
                      {viewingDoc === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                );
              })}
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

      {/* Interactive Clinical Timeline */}
      <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
        <h3 className="text-base font-semibold text-[#191c1d] mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-[#E8533A]" />
          Interactive Clinical Timeline
        </h3>
        
        {timeline.length === 0 ? (
          <p className="text-sm text-[#6e7979] text-center py-6">No historical timeline events found.</p>
        ) : (
          <div className="relative border-l-2 border-[#e6e8e9] ml-4 space-y-8 pb-4">
            {timeline.map((event: any, i: number) => {
              const date = new Date(event.timestamp || event.recordedAt || event.createdAt);
              
              let Icon = FileText;
              let iconColor = 'text-[#4c5f7e]';
              let bgColor = 'bg-[#4c5f7e]/10';
              let title = 'Clinical Event';
              let content = '';

              if (event.type === 'note' || event.clinical_note) {
                Icon = FileText;
                iconColor = 'text-[#005454]';
                bgColor = 'bg-[#005454]/10';
                title = 'Clinical Note Added';
                content = event.note || event.clinical_note || 'A new note was added to the record.';
              } else if (event.type === 'diagnosis' || event.icd10_code) {
                Icon = AlertTriangle;
                iconColor = 'text-[#E8533A]';
                bgColor = 'bg-[#E8533A]/10';
                title = `Diagnosis: ${event.condition_name || event.diagnosis}`;
                content = `${event.status || 'Active'} - ${event.clinical_notes || 'No extensive notes.'}`;
              } else if (event.type === 'vital' || event.metric_type) {
                Icon = Activity;
                iconColor = 'text-[#4CAF82]';
                bgColor = 'bg-[#4CAF82]/10';
                title = `Vitals Logged: ${event.metric_type?.replace('_', ' ')}`;
                content = `Value: ${event.value} ${event.unit}`;
              } else if (event.type === 'document' || event.fileUrl) {
                Icon = FileText;
                iconColor = 'text-[#6e7979]';
                bgColor = 'bg-[#e6e8e9]';
                title = 'Document Uploaded';
                content = event.fileName || 'A document was added to the EHR.';
              }

              return (
                <div key={i} className="relative pl-8">
                  <div className={`absolute -left-[21px] top-1 w-10 h-10 rounded-full border-4 border-white ${bgColor} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                  </div>
                  <div className="bg-[#f8fafb] border border-[#e6e8e9] rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                       <h4 className="text-sm font-bold text-[#191c1d]">{title}</h4>
                       <span className="text-[11px] font-mono text-[#6e7979] bg-white px-2 py-1 rounded border border-[#e6e8e9]">
                         {date.toLocaleString()}
                       </span>
                    </div>
                    <p className="text-sm text-[#3e4948] leading-relaxed">
                      {content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

      <PrescriptionModal 
        isOpen={isPrescribeOpen} 
        onClose={() => setIsPrescribeOpen(false)} 
        patientId={patientId}
        onRefresh={fetchEHR}
      />
    </div>
  );
}
