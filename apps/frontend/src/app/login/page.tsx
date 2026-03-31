'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Lock, Mail, ArrowRight, Shield } from 'lucide-react';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const prefilledEmail = searchParams.get('email');
    if (prefilledEmail) {
      setEmail(prefilledEmail);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { accessToken, refreshToken } = response.data;
      await login(accessToken, refreshToken);
      router.push('/dashboard');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--surface)' }}>
      {/* Left branded panel */}
      <div className="hidden lg:flex lg:w-[45%] bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex-col justify-between p-12 relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-white/5" />
        
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
          <p className="text-white/70 text-lg max-w-sm">
            Secure clinical-grade infrastructure for your personal health data. HIPAA compliant.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 text-white/50 text-sm">
          <Shield className="w-4 h-4" />
          <span>256-bit encrypted · SOC 2 compliant</span>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex items-center justify-center">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <span className="text-lg font-bold text-[#191c1d]">MediCore</span>
          </div>

          <h2 className="text-2xl font-bold text-[#191c1d] mb-1">Sign in</h2>
          <p className="text-sm text-[#6e7979] mb-8">
            Enter your credentials to access your clinical portal.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[#3e4948]">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6e7979]" />
                <input
                  id="login-email"
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
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
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
              {loading ? 'Signing in...' : (
                <>Sign In <ArrowRight className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <p className="text-sm text-[#6e7979] mt-8 text-center">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="text-[#005454] font-semibold hover:underline">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
