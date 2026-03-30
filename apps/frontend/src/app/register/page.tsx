'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { User, Mail, Lock, ArrowRight, Shield, CreditCard } from 'lucide-react';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/register', { 
        email, password, role: 'patient', firstName, lastName 
      });
      router.push(`/login?email=${encodeURIComponent(email.trim())}`);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string | string[] } } };
      let errorMsg = 'Registration failed. Please try again.';
      if (errorObj.response?.data?.message) {
        errorMsg = Array.isArray(errorObj.response.data.message) 
          ? errorObj.response.data.message.join(', ') 
          : errorObj.response.data.message;
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--surface)' }}>
      {/* Left branded panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-12 -translate-y-1/2 w-64 h-64 rounded-full bg-white/[0.03]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-lg">M</span>
            </div>
            <span className="text-white text-xl font-bold">MediCore</span>
          </div>
          
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Your health record,<br />always with you.
          </h1>
          <p className="text-white/70 text-lg max-w-sm mb-10">
            Secure clinical-grade infrastructure for your personal health data.
          </p>

          {/* Mock Global ID Card */}
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 max-w-xs border border-white/20">
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-5 h-5 text-white/60" />
              <span className="text-xs text-white/60 uppercase tracking-wider font-semibold">Global ID</span>
            </div>
            <p className="text-2xl font-bold tracking-[0.2em] text-white font-mono mb-3">
              4829 • 1029 • 3844
            </p>
            <p className="text-xs text-white/50">Join 240,000+ patients worldwide</p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-white/50 text-sm">
          <Shield className="w-4 h-4" />
          <span>HIPAA compliant · End-to-end encrypted</span>
        </div>
      </div>

      {/* Right registration form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-bold text-[#191c1d]">MediCore</span>
          </div>

          <h2 className="text-2xl font-bold text-[#191c1d] mb-1">Create your account</h2>
          <p className="text-sm text-[#6e7979] mb-8">
            Secure clinical-grade infrastructure for your personal health data.
          </p>

          <form onSubmit={handleRegister} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#3e4948]">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7979]" />
                  <input
                    id="register-first-name"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="John"
                    className="w-full pl-10 pr-4 py-3 rounded-lg text-sm text-[#191c1d] placeholder:text-[#bec9c8] focus:outline-none focus:ring-2 focus:ring-[#005454] transition-all"
                    style={{ backgroundColor: '#e1e3e4' }}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[#3e4948]">Last Name</label>
                <input
                  id="register-last-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  placeholder="Doe"
                  className="w-full px-4 py-3 rounded-lg text-sm text-[#191c1d] placeholder:text-[#bec9c8] focus:outline-none focus:ring-2 focus:ring-[#005454] transition-all"
                  style={{ backgroundColor: '#e1e3e4' }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#3e4948]">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7979]" />
                <input
                  id="register-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-sm text-[#191c1d] placeholder:text-[#bec9c8] focus:outline-none focus:ring-2 focus:ring-[#005454] transition-all"
                  style={{ backgroundColor: '#e1e3e4' }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#3e4948]">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7979]" />
                <input
                  id="register-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min. 8 characters"
                  className="w-full pl-10 pr-4 py-3 rounded-lg text-sm text-[#191c1d] placeholder:text-[#bec9c8] focus:outline-none focus:ring-2 focus:ring-[#005454] transition-all"
                  style={{ backgroundColor: '#e1e3e4' }}
                />
              </div>
            </div>

            {error && (
              <div className="px-4 py-2.5 rounded-lg bg-[#ffdad6] text-[#ba1a1a] text-sm font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white font-semibold rounded-lg hover:shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading ? 'Creating account...' : (
                <>Create Account <ArrowRight className="w-4 h-4" /></>
              )}
            </button>

            <p className="text-[11px] text-[#6e7979] text-center">
              By registering you agree to our{' '}
              <span className="text-[#005454] font-medium">Terms of Service</span> and{' '}
              <span className="text-[#005454] font-medium">Privacy Policy</span>
            </p>
          </form>

          <p className="text-sm text-[#6e7979] mt-6 text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-[#005454] font-semibold hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
