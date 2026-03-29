'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { getMyPatientId } from '@/lib/patient';
import { QrCode, Download, Printer, RefreshCw, Shield, Clock, Globe, AlertTriangle } from 'lucide-react';

export default function MedicalIdPage() {
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [emergencyToken, setEmergencyToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProfileId() {
      if (!user) return;
      try {
        const pid = await getMyPatientId();
        setProfileId(pid);
      } catch {
        setError('Unable to load your patient profile.');
        setLoading(false);
      }
    }
    fetchProfileId();
  }, [user]);

  useEffect(() => {
    if (!profileId) return;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const refreshRes = await api.post(`/patients/${profileId}/emergency/refresh`);
        setEmergencyToken(refreshRes.data.token);
        const qrRes = await api.get(`/patients/${profileId}/emergency/qr`, { responseType: 'blob' });
        setQrUrl(URL.createObjectURL(qrRes.data));
      } catch {
        setError('Failed to load Medical ID. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [profileId]);

  const handleRefresh = async () => {
    if (!profileId || refreshing) return;
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await api.post(`/patients/${profileId}/emergency/refresh`);
      setEmergencyToken(res.data.token);
      const qrRes = await api.get(`/patients/${profileId}/emergency/qr`, { responseType: 'blob' });
      if (qrUrl) URL.revokeObjectURL(qrUrl);
      setQrUrl(URL.createObjectURL(qrRes.data));
      setRefreshMessage(`Data refreshed at ${new Date(res.data.generatedAt).toLocaleString()}`);
    } catch {
      setRefreshMessage('Failed to refresh. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDownloadQR = async () => {
    if (!profileId) return;
    try {
      const res = await api.get(`/patients/${profileId}/emergency/qr`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = 'medicore-emergency-qr.png';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch { alert('Failed to download QR code.'); }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Please allow popups to print your Medical ID card.'); return; }
    printWindow.document.write(`<!DOCTYPE html><html><head><title>MediCore Medical ID Card</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Inter,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f8fafb}.card{width:340px;background:#fff;border:2px solid #005454;border-radius:12px;padding:24px;text-align:center;box-shadow:0 12px 32px rgba(25,28,29,.04)}.card-header{border-bottom:1px solid #e6e8e9;padding-bottom:12px;margin-bottom:16px}.card-header h1{font-size:20px;color:#005454;font-weight:800}.card-header p{font-size:12px;color:#6e7979;margin-top:4px}.qr-container{display:flex;justify-content:center;margin:16px 0}.qr-container img{width:200px;height:200px;border-radius:8px}.card-name{font-size:18px;font-weight:700;color:#191c1d;margin-bottom:4px}.card-role{font-size:11px;color:#6e7979;text-transform:uppercase;letter-spacing:1px}.emergency-label{background:#E8533A;color:#fff;font-size:11px;font-weight:700;padding:4px 12px;border-radius:99px;display:inline-block;margin-top:12px}.card-instruction{margin-top:16px;padding-top:12px;border-top:1px solid #e6e8e9;font-size:11px;color:#bec9c8}@media print{body{background:transparent}.card{box-shadow:none}}</style></head><body><div class="card"><div class="card-header"><h1>⚕ MediCore</h1><p>Emergency Medical ID Card</p></div><div class="qr-container"><img src="${qrUrl}" alt="Emergency QR Code"/></div><div class="card-name">${user?.email?.split('@')[0] || 'Patient'}</div><div class="card-role">Patient</div><div class="emergency-label">🚨 SCAN FOR EMERGENCY DATA</div><div class="card-instruction">In case of emergency, scan this QR code to access<br/>critical medical information for this patient.</div></div></body></html>`);
    printWindow.document.close();
    printWindow.onload = () => { printWindow.print(); };
  };

  const emergencyUrl = emergencyToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/emergency/${emergencyToken}`
    : null;

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#191c1d]">Medical ID</h1>
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-[#E8533A] mb-4" />
          <p className="text-[#ba1a1a] font-semibold">{error}</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[#191c1d]">Medical ID</h1>
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-12 text-center">
          <div className="w-10 h-10 border-3 border-[#005454] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-[#6e7979]">Loading your Medical ID...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#191c1d]">Medical ID</h1>
        <p className="text-sm text-[#3e4948] mt-1">
          Your emergency QR code contains critical medical information accessible without login.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* QR Code Card */}
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-8 text-center">
          <div className="inline-flex items-center gap-2 bg-[#005454]/10 text-[#005454] text-xs font-semibold px-3 py-1.5 rounded-full mb-5">
            <QrCode className="w-3.5 h-3.5" />
            Emergency QR Code
          </div>

          {qrUrl ? (
            <div className="flex justify-center mb-5">
              <Image src={qrUrl} alt="Emergency QR Code" width={200} height={200} className="rounded-lg shadow-sm" unoptimized />
            </div>
          ) : (
            <div className="w-[200px] h-[200px] mx-auto mb-5 bg-[#f2f4f5] rounded-lg flex items-center justify-center">
              <QrCode className="w-16 h-16 text-[#bec9c8]" />
            </div>
          )}

          <p className="text-xs text-[#6e7979] mb-5">Scan to access emergency medical data</p>

          {emergencyUrl && (
            <div className="bg-[#f2f4f5] rounded-lg p-3 mb-5 break-all text-left">
              <p className="text-[10px] text-[#6e7979] mb-1 uppercase font-semibold tracking-wider">Emergency URL</p>
              <a href={emergencyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#005454] hover:underline font-mono">
                {emergencyUrl.length > 55 ? `${emergencyUrl.substring(0, 55)}...` : emergencyUrl}
              </a>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <button onClick={handleDownloadQR} className="flex items-center justify-center gap-2 w-full py-2.5 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all">
              <Download className="w-4 h-4" /> Download QR Code
            </button>
            <button onClick={handlePrint} className="flex items-center justify-center gap-2 w-full py-2.5 text-sm font-semibold text-[#005454] rounded-lg hover:bg-[#005454]/5 transition-colors" style={{ border: '1.5px solid rgba(190,201,200,0.4)' }}>
              <Printer className="w-4 h-4" /> Print Medical ID Card
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#4CAF82] text-white text-sm font-semibold rounded-lg hover:bg-[#3d9e72] transition-colors disabled:opacity-60">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh Emergency Data'}
            </button>
          </div>
          {refreshMessage && <p className="text-xs text-[#4CAF82] mt-3 font-medium">{refreshMessage}</p>}
        </div>

        {/* Info Panel */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-5 h-5 text-[#005454]" />
              <h3 className="text-base font-semibold text-[#191c1d]">How It Works</h3>
            </div>
            <ul className="space-y-3">
              {[
                { emoji: '🩸', text: 'Your blood type, allergies, and medications are stored in a static snapshot.' },
                { emoji: '📱', text: 'Anyone scanning the QR code sees your emergency data — no login needed.' },
                { emoji: '🔄', text: 'Click "Refresh" after updating your medical records to sync the snapshot.' },
                { emoji: '🔒', text: 'Each scan is logged. You can see who accessed your data and when.' },
              ].map((item, i) => (
                <li key={i} className="flex gap-3 items-start">
                  <span className="text-lg">{item.emoji}</span>
                  <span className="text-sm text-[#3e4948]">{item.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6 flex-1">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-[#4c5f7e]" />
              <h3 className="text-base font-semibold text-[#191c1d]">Recent Emergency Accesses</h3>
            </div>
            <div className="text-center py-8">
              <Globe className="w-10 h-10 mx-auto text-[#bec9c8] mb-3" />
              <p className="text-sm text-[#6e7979]">No recent access data available.</p>
              <p className="text-xs text-[#bec9c8] mt-1">When someone scans your QR code, access logs will appear here.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
