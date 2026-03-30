'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { getMyProfile } from '@/lib/patient';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Activity, Heart, TrendingUp, Shield, FileText, QrCode, 
  Clock, CheckCircle2, ArrowUpRight, Pill, ChevronRight, 
  Sparkles, AlertTriangle
} from 'lucide-react';

export default function DashboardOverviewPage() {
  const { user } = useAuth();
  const [latestVitals, setLatestVitals] = useState<Record<string, any>>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientId, setPatientId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (user?.role === 'doctor' || user?.role === 'hospital_admin') {
      router.push('/dashboard/doctor');
    }
  }, [user, router]);

  const fetchData = useCallback(async () => {
    try {
      const { profileId } = await getMyProfile();
      if (profileId) {
        setPatientId(profileId);
        const [vitalsRes, alertsRes] = await Promise.all([
          api.get(`/patients/${profileId}/vitals/latest`).catch(() => ({ data: {} })),
          api.get(`/patients/${profileId}/alerts?status=active`).catch(() => ({ data: [] })),
        ]);
        setLatestVitals(vitalsRes.data || {});
        setAlerts(Array.isArray(alertsRes.data) ? alertsRes.data : []);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const userName = user?.email?.split('@')[0] || 'there';

  // Profile completeness estimation
  const fieldsToCheck = ['heart_rate', 'bp_systolic', 'spo2', 'glucose'];
  const filledFields = fieldsToCheck.filter(f => latestVitals[f]);
  const completeness = Math.min(100, Math.round((filledFields.length / fieldsToCheck.length) * 70 + 30));

  const quickStats = [
    { label: 'Heart Rate', value: latestVitals.heart_rate?.value, unit: 'bpm', icon: Heart, color: '#E8533A' },
    { label: 'BP Systolic', value: latestVitals.bp_systolic?.value, unit: 'mmHg', icon: TrendingUp, color: '#005454' },
    { label: 'SpO₂', value: latestVitals.spo2?.value, unit: '%', icon: Activity, color: '#4c5f7e' },
    { label: 'Glucose', value: latestVitals.glucose?.value, unit: 'mg/dL', icon: Activity, color: '#4CAF82' },
  ];

  const recentActivity = [
    { time: 'Today', action: 'Profile viewed', icon: CheckCircle2, color: '#4CAF82' },
    { time: 'Recently', action: 'Vitals dashboard accessed', icon: Activity, color: '#005454' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#191c1d]">
            Welcome back, {userName}.
          </h1>
          <p className="text-sm text-[#3e4948] mt-1">Your data is up to date.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium" style={{ backgroundColor: completeness >= 75 ? 'rgba(76,175,130,0.1)' : 'rgba(232,83,58,0.1)', color: completeness >= 75 ? '#4CAF82' : '#E8533A' }}>
          <span className="font-mono font-bold">{completeness}%</span> profile complete
        </div>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.slice(0, 3).map((alert: any) => (
            <div key={alert.id} className={`rounded-lg px-4 py-3 flex items-center gap-3 border-l-4 ${
              alert.tier === 'emergency' ? 'bg-[#ffdad6]/50 border-[#ba1a1a]' :
              alert.tier === 'urgent' ? 'bg-orange-50 border-orange-500' :
              'bg-yellow-50 border-yellow-500'
            }`}>
              <AlertTriangle className="w-4 h-4 text-[#ba1a1a]" />
              <span className="text-sm text-[#191c1d]">{alert.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quick Vitals Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-5 hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                  <Icon className="w-4 h-4" style={{ color: stat.color }} />
                </div>
                <span className="text-[10px] font-semibold text-[#6e7979] uppercase tracking-wider">{stat.label}</span>
              </div>
              {loading ? (
                <div className="h-8 bg-[#f2f4f5] rounded animate-pulse" />
              ) : stat.value ? (
                <p className="text-2xl font-bold text-[#191c1d] font-mono">
                  {stat.value}
                  <span className="text-xs text-[#6e7979] ml-1 font-sans">{stat.unit}</span>
                </p>
              ) : (
                <p className="text-sm text-[#bec9c8]">No data</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Links */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-base font-semibold text-[#191c1d]">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: 'Record Vitals', desc: 'Log your latest health metrics', icon: Activity, href: '/dashboard/vitals', color: '#005454' },
              { title: 'Medical ID', desc: 'View your emergency QR code', icon: QrCode, href: '/dashboard/medical-id', color: '#E8533A' },
              { title: 'Documents', desc: 'Upload or view medical records', icon: FileText, href: '/dashboard/documents', color: '#4c5f7e' },
              { title: 'Consent', desc: 'Manage doctor access codes', icon: Shield, href: '/dashboard/consent', color: '#4CAF82' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className="group">
                  <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-4 flex items-center gap-4 hover:shadow-md transition-all">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${item.color}10` }}>
                      <Icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#191c1d]">{item.title}</p>
                      <p className="text-xs text-[#6e7979]">{item.desc}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-[#bec9c8] group-hover:text-[#005454] transition-colors" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-[#191c1d]">Recent Activity</h2>
          <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-5">
            {recentActivity.map((act, i) => {
              const Icon = act.icon;
              return (
                <div key={i} className="flex items-start gap-3 py-3" style={i < recentActivity.length - 1 ? { borderBottom: '1px solid var(--surface-container-high)' } : {}}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center mt-0.5" style={{ backgroundColor: `${act.color}15` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: act.color }} />
                  </div>
                  <div>
                    <p className="text-sm text-[#191c1d]">{act.action}</p>
                    <p className="text-[11px] text-[#6e7979] font-mono">{act.time}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* All Clear Banner */}
          {alerts.length === 0 && (
            <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-[#4CAF82]" />
                <h3 className="text-sm font-semibold text-[#191c1d]">All Clear</h3>
              </div>
              <p className="text-xs text-[#6e7979]">
                No active critical alerts or urgent tasks requiring your immediate attention.
              </p>
            </div>
          )}

          {/* AI Prompt */}
          <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-[#005454]" />
              <span className="text-xs font-semibold text-[#191c1d]">MediAI</span>
            </div>
            <p className="text-xs text-[#6e7979] mb-2">
              {filledFields.length > 0 ? `${filledFields.length} new insights available based on your recent vitals.` : 'Connect your vitals to get AI-powered insights.'}
            </p>
            <Link href="/dashboard/ai-advisor" className="text-xs font-semibold text-[#005454] hover:underline flex items-center gap-1">
              Open AI Advisor <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 text-[10px] text-[#bec9c8]" style={{ borderTop: '1px solid var(--surface-container-high)' }}>
        <span>© {new Date().getFullYear()} MediCore Precision Health. HIPAA Compliant.</span>
        <div className="flex gap-4">
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
          <span>Security</span>
        </div>
      </div>
    </div>
  );
}
