'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Key, Copy, Check, X, Clock, Shield, RefreshCw } from 'lucide-react';

export default function ConsentPage() {
  const { user } = useAuth();
  const [patientId, setPatientId] = useState<string | null>(null);
  const [consents, setConsents] = useState<any[]>([]);
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const fetchConsents = useCallback(async (pid: string) => {
    try {
      const res = await api.get(`/patients/${pid}/consent/list`);
      setConsents(Array.isArray(res.data) ? res.data : []);
    } catch { setConsents([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile().then((pid) => {
      if (pid) fetchConsents(pid);
      else setLoading(false);
    });
  }, [fetchProfile, fetchConsents]);

  const handleGenerate = async () => {
    if (!patientId) return;
    setGenerating(true);
    try {
      const res = await api.post(`/patients/${patientId}/consent/generate`, {
        accessType: 'clinical_read',
      });
      setGeneratedOtp(res.data.otp);
      if (patientId) fetchConsents(patientId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate consent code');
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    try {
      await api.delete(`/consent/${tokenId}`);
      if (patientId) fetchConsents(patientId);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to revoke');
    }
  };

  const copyOtp = () => {
    if (generatedOtp) {
      navigator.clipboard.writeText(generatedOtp);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-[#191c1d] tracking-tight">Access Consent</h1>
        <p className="text-[#3e4948] mt-1">Generate one-time codes for doctors to access your records.</p>
      </div>

      {/* Generate Card */}
      <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#005454]/10 flex items-center justify-center">
            <Key className="w-5 h-5 text-[#005454]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#191c1d]">Generate Consent Code</h2>
            <p className="text-sm text-[#3e4948]">Share this 6-digit code with your doctor for clinical access</p>
          </div>
        </div>

        {generatedOtp ? (
          <div className="text-center py-6">
            <p className="text-6xl font-bold tracking-[0.4em] text-[#005454] font-mono mb-4" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              {generatedOtp}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={copyOtp}
                className="px-4 py-2 bg-[#f2f4f5] rounded-lg text-sm font-medium text-[#191c1d] hover:bg-[#e6e8e9] transition-colors flex items-center gap-2"
              >
                {copied ? <Check className="w-4 h-4 text-[#4CAF82]" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
              <button
                onClick={() => { setGeneratedOtp(null); }}
                className="px-4 py-2 text-sm text-[#6e7979] hover:text-[#191c1d] transition-colors"
              >
                Dismiss
              </button>
            </div>
            <p className="text-xs text-[#bec9c8] mt-4">
              This code is shown once. Share it verbally or securely with your doctor.
            </p>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={generating || !patientId}
            className="w-full py-4 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white font-semibold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-lg"
          >
            {generating ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Shield className="w-5 h-5" />
            )}
            {generating ? 'Generating...' : 'Generate Consent Code'}
          </button>
        )}
      </div>

      {/* Active Consents List */}
      <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
        <h2 className="text-lg font-semibold text-[#191c1d] mb-4">Active Consent Tokens</h2>
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => <div key={i} className="bg-[#f2f4f5] h-16 rounded-lg" />)}
          </div>
        ) : consents.length === 0 ? (
          <p className="text-[#6e7979] text-center py-6">No active consent tokens.</p>
        ) : (
          <div className="space-y-3">
            {consents.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between bg-[#f8fafb] rounded-lg p-4">
                <div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    c.accessType?.includes('write') ? 'bg-[#E8533A]/10 text-[#E8533A]' : 'bg-[#005454]/10 text-[#005454]'
                  }`}>
                    {c.accessType?.replace('_', ' ')?.toUpperCase() || 'READ'}
                  </span>
                  <p className="text-xs text-[#6e7979] mt-1 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Granted: {new Date(c.grantedAt).toLocaleDateString()}
                    {' · '}
                    Expires: <span className="font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{new Date(c.expiresAt).toLocaleDateString()}</span>
                  </p>
                  {c.grantedTo && (
                    <p className="text-xs text-[#3e4948] mt-0.5">
                      Used by: <span className="font-medium">{c.grantedTo.email}</span>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRevoke(c.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#ba1a1a] bg-[#ffdad6] rounded-lg hover:bg-[#ba1a1a] hover:text-white transition-colors flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
