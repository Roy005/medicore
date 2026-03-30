'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Activity, FileText, UserCircle, QrCode, Stethoscope, LogOut, 
  Shield, Bot, LayoutDashboard, BarChart3, Settings, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[#005454] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#6e7979]">Loading...</span>
        </div>
      </div>
    );
  }

  const patientNavItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'My Profile', href: '/dashboard/profile', icon: UserCircle },
    { name: 'Medical ID', href: '/dashboard/medical-id', icon: QrCode },
    { name: 'Vitals', href: '/dashboard/vitals', icon: Activity },
    { name: 'Documents', href: '/dashboard/documents', icon: FileText },
    { name: 'Consent', href: '/dashboard/consent', icon: Shield },
  ];

  const doctorNavItems = [
    { name: 'Doctor Portal', href: '/dashboard/doctor', icon: Stethoscope },
    { name: 'AI Advisor', href: '/dashboard/ai-advisor', icon: Bot },
    { name: 'Risk Scores', href: '/dashboard/risk-scores', icon: BarChart3 },
  ];

  const isDoctorOrAdmin = user.role === 'doctor' || user.role === 'hospital_admin';

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar — Stitch: surface-container-low, NO glassmorphism */}
      <aside className="w-[260px] flex flex-col" style={{ backgroundColor: 'var(--surface-container-low)' }}>
        {/* Brand Header */}
        <div className="px-6 py-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">M</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#191c1d] leading-tight">
                MediCore
              </h2>
              <p className="text-[10px] font-medium text-[#6e7979] tracking-wider uppercase">
                Clinical Portal
              </p>
            </div>
          </Link>
        </div>
        
        {/* Patient Navigation */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto no-scrollbar">
          {!isDoctorOrAdmin && (
            <>
              <p className="px-3 pt-2 pb-2 text-[10px] font-semibold text-[#6e7979] uppercase tracking-widest">
                Patient
              </p>
              {patientNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.href === '/dashboard' 
                  ? pathname === '/dashboard' 
                  : pathname.startsWith(item.href) && item.href !== '/dashboard';
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 relative",
                      isActive 
                        ? "bg-[#005454]/10 text-[#005454] font-semibold" 
                        : "text-[#3e4948] hover:bg-[#e6e8e9] hover:text-[#191c1d]"
                    )}
                  >
                    {/* Active pill indicator */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#005454] rounded-r-full" />
                    )}
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </>
          )}

          {isDoctorOrAdmin && (
            <>
              <p className="px-3 pt-2 pb-2 text-[10px] font-semibold text-[#6e7979] uppercase tracking-widest">
                Clinical Portal
              </p>
              {doctorNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 relative",
                      isActive 
                        ? "bg-[#005454]/10 text-[#005454] font-semibold" 
                        : "text-[#3e4948] hover:bg-[#e6e8e9] hover:text-[#191c1d]"
                    )}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#005454] rounded-r-full" />
                    )}
                    <Icon className="w-[18px] h-[18px] flex-shrink-0" />
                    {item.name}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        {/* User Section */}
        <div className="px-3 py-4 mt-auto" style={{ borderTop: '1px solid var(--surface-container-high)' }}>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex items-center justify-center text-white text-sm font-bold shadow-sm flex-shrink-0">
              {user.email[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#191c1d] truncate">{user.email.split('@')[0]}</p>
              <p className="text-[11px] text-[#6e7979] capitalize">{user.role.replace('_', ' ')}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 w-full px-3 py-2 mt-1 rounded-lg text-sm text-[#ba1a1a] hover:bg-[#ffdad6] transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--surface)' }}>
        <div className="max-w-6xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
