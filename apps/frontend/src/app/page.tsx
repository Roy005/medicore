import Link from 'next/link';
import { Shield, Activity, QrCode, Bot, ArrowRight, Heart, Stethoscope, Lock, Zap, ChevronRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f8fafb', fontFamily: 'Inter, sans-serif' }}>
      {/* ─── Navigation ─── */}
      <nav className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-sm">M</span>
          </div>
          <span className="text-xl font-bold text-[#191c1d]">MediCore</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="px-4 py-2 text-sm font-medium text-[#005454] hover:underline">
            Sign In
          </Link>
          <Link href="/register" className="px-5 py-2.5 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all">
            Get Started
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="max-w-7xl mx-auto px-8 pt-16 pb-24">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-6" style={{ backgroundColor: 'rgba(0,84,84,0.08)', color: '#005454' }}>
            <Shield className="w-3.5 h-3.5" />
            HIPAA Compliant · SOC 2 Certified
          </div>
          <h1 className="text-5xl font-bold text-[#191c1d] leading-[1.15] mb-5" style={{ letterSpacing: '-0.02em' }}>
            The Precision Sanctuary<br />
            <span className="bg-gradient-to-r from-[#005454] to-[#0d6e6e] bg-clip-text text-transparent">
              for your health data.
            </span>
          </h1>
          <p className="text-lg text-[#3e4948] mb-8 max-w-xl leading-relaxed">
            Clinical-grade infrastructure for personal health records. Every data point is a lifeline — we give it the authority it deserves.
          </p>
          <div className="flex gap-3">
            <Link href="/register" className="px-6 py-3 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2">
              Start Free <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/login" className="px-6 py-3 text-sm font-semibold text-[#005454] rounded-lg hover:bg-[#005454]/5 transition-colors" style={{ border: '1.5px solid rgba(190,201,200,0.5)' }}>
              Sign In
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 mt-16 max-w-lg">
          {[
            { value: '240K+', label: 'Patients' },
            { value: '99.99%', label: 'Uptime' },
            { value: '<50ms', label: 'Latency' },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-bold text-[#005454] font-mono">{stat.value}</p>
              <p className="text-xs text-[#6e7979] mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Features Grid ─── */}
      <section className="max-w-7xl mx-auto px-8 pb-24">
        <p className="text-[10px] font-semibold text-[#6e7979] uppercase tracking-widest mb-2">Platform</p>
        <h2 className="text-3xl font-bold text-[#191c1d] mb-10" style={{ letterSpacing: '-0.02em' }}>
          Built for clinical excellence.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { icon: Activity, color: '#005454', title: 'Real-time Vitals', desc: 'Track heart rate, blood pressure, SpO₂, glucose, and more with live wearable integration.' },
            { icon: QrCode, color: '#E8533A', title: 'Emergency Medical ID', desc: 'One QR code gives first responders instant access to your critical data — no login required.' },
            { icon: Bot, color: '#4c5f7e', title: 'AI Health Advisor', desc: 'Powered by MediCore AI. Medication interaction checks, risk scoring, and clinical decision support.' },
            { icon: Shield, color: '#4CAF82', title: 'OTP Consent System', desc: 'Patients generate one-time codes for doctors. Full audit trail. Revoke access anytime.' },
            { icon: Stethoscope, color: '#005454', title: 'Doctor EHR Portal', desc: 'Authorized doctors view full EHR — vitals, medications, allergies, notes — all in one place.' },
            { icon: Lock, color: '#951604', title: '256-bit Encryption', desc: 'End-to-end encrypted storage. Your data never leaves your control.' },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <div key={feature.title} className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6 hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mb-4" style={{ backgroundColor: `${feature.color}10` }}>
                  <Icon className="w-5 h-5" style={{ color: feature.color }} />
                </div>
                <h3 className="text-base font-semibold text-[#191c1d] mb-2">{feature.title}</h3>
                <p className="text-sm text-[#3e4948] leading-relaxed">{feature.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="max-w-7xl mx-auto px-8 pb-24">
        <div className="bg-gradient-to-br from-[#005454] to-[#0d6e6e] rounded-2xl p-12 text-center relative overflow-hidden">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-white/5" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-white/5" />
          <div className="relative z-10">
            <h2 className="text-3xl font-bold text-white mb-3">Your health data, always with you.</h2>
            <p className="text-white/70 mb-8 max-w-md mx-auto">
              Join 240,000+ patients using MediCore to manage their health with clinical precision.
            </p>
            <Link href="/register" className="inline-flex items-center gap-2 px-8 py-3 bg-white text-[#005454] font-bold rounded-lg hover:shadow-xl transition-all">
              Create Free Account <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="max-w-7xl mx-auto px-8 py-8" style={{ borderTop: '1px solid #e6e8e9' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex items-center justify-center">
              <span className="text-white font-bold text-xs">M</span>
            </div>
            <span className="text-sm font-semibold text-[#191c1d]">MediCore</span>
          </div>
          <p className="text-xs text-[#bec9c8]">
            © {new Date().getFullYear()} MediCore Precision Health. HIPAA Compliant.
          </p>
        </div>
      </footer>
    </div>
  );
}
