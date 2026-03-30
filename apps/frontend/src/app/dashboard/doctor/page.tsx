'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Search, Key, ArrowRight, Users, Shield } from 'lucide-react';

export default function DoctorPatientsPage() {
  const { user } = useAuth();
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [clinicalToken, setClinicalToken] = useState<string | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [redeemResult, setRedeemResult] = useState<any>(null);
  const [myPatients, setMyPatients] = useState<any[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);

  const fetchMyPatients = async () => {
    try {
      const res = await api.get('/doctors/my-patients');
      setMyPatients(res.data || []);
    } catch (err) {
      console.error('Failed to fetch patients', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  useEffect(() => {
    if (user?.role === 'doctor') {
      fetchMyPatients();
    }
  }, [user]);

  const handleRedeemOtp = async () => {
    if (!otp || otp.length !== 6) {
      setOtpError('Please enter a 6-digit consent code');
      return;
    }
    setOtpLoading(true);
    setOtpError('');
    try {
      const res = await api.post('/consent/redeem', { otp });
      setClinicalToken(res.data.clinicalToken);
      setPatientId(res.data.patientId);
      setRedeemResult(res.data);
      if (typeof window !== 'undefined') {
        localStorage.setItem('clinicalToken', res.data.clinicalToken);
        localStorage.setItem('clinicalPatientId', res.data.patientId);
      }
    } catch (err: any) {
      setOtpError(err.response?.data?.message || 'Invalid or expired consent code');
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-[#191c1d] tracking-tight">
          Doctor Portal
        </h1>
        <p className="text-[#3e4948] mt-1">
          Enter a patient&apos;s consent code to access their clinical records.
        </p>
      </div>

      {/* OTP Redemption Card */}
      <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#005454]/10 flex items-center justify-center">
            <Key className="w-5 h-5 text-[#005454]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#191c1d]">Redeem Consent Code</h2>
            <p className="text-sm text-[#3e4948]">Enter the 6-digit OTP from your patient</p>
          </div>
        </div>

        <div className="flex gap-3">
          <input
            type="text"
            maxLength={6}
            value={otp}
            onChange={(e) => {
              setOtp(e.target.value.replace(/\D/g, ''));
              setOtpError('');
            }}
            placeholder="Enter 6-digit code"
            className="flex-1 px-4 py-3 bg-[#e1e3e4] rounded-lg text-[#191c1d] font-mono text-xl tracking-[0.3em] text-center focus:outline-none focus:ring-2 focus:ring-[#005454] placeholder:text-[#6e7979] placeholder:tracking-normal placeholder:text-base placeholder:font-sans"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          />
          <button
            onClick={handleRedeemOtp}
            disabled={otpLoading || otp.length !== 6}
            className="px-6 py-3 bg-[#E8533A] text-white font-semibold rounded-lg hover:bg-[#d04832] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {otpLoading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Redeem
              </>
            )}
          </button>
        </div>

        {otpError && (
          <p className="mt-3 text-sm text-[#ba1a1a] bg-[#ffdad6] px-3 py-2 rounded-lg">
            {otpError}
          </p>
        )}
      </div>

      {/* Success — Patient access granted */}
      {redeemResult && (
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-8 border-l-4 border-[#4CAF82]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[#191c1d] flex items-center gap-2">
                <span className="text-[#4CAF82]">✓</span> Access Granted
              </h3>
              <p className="text-sm text-[#3e4948] mt-1">
                Patient ID: <span className="font-mono text-[#005454]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{redeemResult.patientId}</span>
              </p>
              <p className="text-sm text-[#3e4948]">
                Access: <span className="font-semibold capitalize">{redeemResult.accessType?.replace('_', ' ')}</span>
                {' · '}Expires: <span className="font-mono" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{new Date(redeemResult.expiresAt).toLocaleDateString()}</span>
              </p>
            </div>
            <a
              href={`/dashboard/doctor/patients/${redeemResult.patientId}`}
              className="px-5 py-2.5 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2"
            >
              View EHR
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-[#f2f4f5] rounded-lg p-6">
        <h3 className="font-semibold text-[#191c1d] mb-3 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#4c5f7e]" />
          How it works
        </h3>
        <ol className="space-y-2 text-sm text-[#3e4948]">
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#005454] mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>1.</span>
            Patient generates a one-time consent code from their dashboard.
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#005454] mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>2.</span>
            Enter the 6-digit code above to receive clinical access.
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#005454] mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>3.</span>
            Access patient&apos;s full EHR — notes, vitals, medications, and more.
          </li>
          <li className="flex items-start gap-2">
            <span className="font-mono font-bold text-[#005454] mt-0.5" style={{ fontFamily: 'JetBrains Mono, monospace' }}>4.</span>
            Patient can revoke access at any time. All actions are audited.
          </li>
        </ol>
      </div>

      {/* Internal "Patients Under Treatment" section */}
      <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#191c1d] flex items-center gap-2">
            <Users className="w-5 h-5 text-[#005454]" /> Patients Under Treatment
          </h2>
          <button onClick={fetchMyPatients} className="text-sm font-semibold text-[#005454] hover:underline">
            Refresh List
          </button>
        </div>

        {loadingPatients ? (
          <div className="animate-pulse space-y-4">
            <div className="h-12 bg-[#f2f4f5] rounded" />
            <div className="h-12 bg-[#f2f4f5] rounded" />
          </div>
        ) : myPatients.length === 0 ? (
          <div className="text-center py-8 text-[#6e7979]">
            No active patients found. Redeem a consent code to get started.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-[#6e7979] uppercase bg-[#f2f4f5]">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Patient Name</th>
                  <th className="px-4 py-3">Access Level</th>
                  <th className="px-4 py-3">Access Granted</th>
                  <th className="px-4 py-3 rounded-tr-lg text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {myPatients.map((p, i) => (
                  <tr key={p.id} className={i !== myPatients.length - 1 ? 'border-b border-[#f2f4f5]' : ''}>
                    <td className="px-4 py-4 font-semibold text-[#191c1d]">
                      {p.firstName} {p.lastName}
                    </td>
                    <td className="px-4 py-4 capitalize text-[#3e4948]">
                      {p.accessType?.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-[#6e7979]">
                      {new Date(p.lastAccessGrantedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link 
                        href={`/dashboard/doctor/patients/${p.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#005454]/10 text-[#005454] font-semibold rounded-md hover:bg-[#005454]/20 transition-colors"
                      >
                        Open EHR <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
