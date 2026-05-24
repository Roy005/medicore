'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import {
  User, Building2, Phone, Mail, GraduationCap, BadgeCheck,
  Stethoscope, Save, Loader2, CheckCircle2, AlertCircle
} from 'lucide-react';

interface DoctorProfileData {
  id: string;
  user_id: string;
  specialty: string;
  registration_number: string;
  hospital_affiliation: string | null;
  verification_status: string;
  full_name: string | null;
  qualifications: string | null;
  phone: string | null;
  hospital_address: string | null;
  hospital_phone: string | null;
  hospital_email: string | null;
}

export default function DoctorProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<DoctorProfileData | null>(null);

  // Form state
  const [form, setForm] = useState({
    fullName: '',
    qualifications: '',
    phone: '',
    specialty: '',
    registrationNumber: '',
    hospitalAffiliation: '',
    hospitalAddress: '',
    hospitalPhone: '',
    hospitalEmail: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('/doctors/me/profile');
        const p = res.data as DoctorProfileData;
        setProfile(p);
        setForm({
          fullName: p.full_name || '',
          qualifications: p.qualifications || '',
          phone: p.phone || '',
          specialty: p.specialty || '',
          registrationNumber: p.registration_number || '',
          hospitalAffiliation: p.hospital_affiliation || '',
          hospitalAddress: p.hospital_address || '',
          hospitalPhone: p.hospital_phone || '',
          hospitalEmail: p.hospital_email || '',
        });
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await api.patch('/doctors/me/profile', form);
      setProfile(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-[#005454]" />
      </div>
    );
  }

  const inputClasses = "w-full px-4 py-3 bg-[#f2f4f5] border-none rounded-lg focus:ring-2 focus:ring-[#005454] text-sm text-[#191c1d] placeholder:text-[#bec9c8] transition-all";
  const labelClasses = "block text-xs font-bold text-[#6e7979] uppercase tracking-wider mb-1.5";

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#191c1d] tracking-tight">Doctor Profile</h1>
        <p className="text-sm text-[#6e7979] mt-1">
          Manage your professional details. This information appears on prescriptions you generate.
        </p>
      </div>

      {/* Verification Badge */}
      {profile && (
        <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold ${
          profile.verification_status === 'verified' 
            ? 'bg-[#4CAF82]/10 text-[#4CAF82]' 
            : 'bg-[#E8533A]/10 text-[#E8533A]'
        }`}>
          <BadgeCheck className="w-4 h-4" />
          {profile.verification_status === 'verified' ? 'Verified Doctor' : 'Verification Pending'}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* Personal Information */}
        <div className="bg-white rounded-xl shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#005454]/10 flex items-center justify-center">
              <User className="w-4 h-4 text-[#005454]" />
            </div>
            <h2 className="text-base font-semibold text-[#191c1d]">Personal Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className={labelClasses}>Full Name (with title)</label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => handleChange('fullName', e.target.value)}
                className={inputClasses}
                placeholder="e.g. Dr. Aarav Sharma"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClasses}>Qualifications</label>
              <input
                type="text"
                value={form.qualifications}
                onChange={(e) => handleChange('qualifications', e.target.value)}
                className={inputClasses}
                placeholder="e.g. MBBS, MD (General Medicine)"
              />
            </div>
            <div>
              <label className={labelClasses}>Phone Number</label>
              <input
                type="text"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                className={inputClasses}
                placeholder="e.g. +91-98765-43210"
              />
            </div>
            <div>
              <label className={labelClasses}>Email</label>
              <div className="px-4 py-3 bg-[#e6e8e9] rounded-lg text-sm text-[#6e7979] cursor-not-allowed">
                {user?.email || 'N/A'}
              </div>
              <p className="text-[10px] text-[#bec9c8] mt-1">Email cannot be changed here</p>
            </div>
          </div>
        </div>

        {/* Medical Credentials */}
        <div className="bg-white rounded-xl shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#E8533A]/10 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-[#E8533A]" />
            </div>
            <h2 className="text-base font-semibold text-[#191c1d]">Medical Credentials</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelClasses}>Specialty</label>
              <input
                type="text"
                value={form.specialty}
                onChange={(e) => handleChange('specialty', e.target.value)}
                className={inputClasses}
                placeholder="e.g. Internal Medicine"
              />
            </div>
            <div>
              <label className={labelClasses}>Registration Number</label>
              <input
                type="text"
                value={form.registrationNumber}
                onChange={(e) => handleChange('registrationNumber', e.target.value)}
                className={inputClasses}
                placeholder="e.g. MCI-78432"
              />
            </div>
          </div>
        </div>

        {/* Hospital Information */}
        <div className="bg-white rounded-xl shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#4c5f7e]/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-[#4c5f7e]" />
            </div>
            <h2 className="text-base font-semibold text-[#191c1d]">Hospital / Clinic Information</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className={labelClasses}>Hospital / Clinic Name</label>
              <input
                type="text"
                value={form.hospitalAffiliation}
                onChange={(e) => handleChange('hospitalAffiliation', e.target.value)}
                className={inputClasses}
                placeholder="e.g. City General Hospital"
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelClasses}>Address</label>
              <input
                type="text"
                value={form.hospitalAddress}
                onChange={(e) => handleChange('hospitalAddress', e.target.value)}
                className={inputClasses}
                placeholder="e.g. 42 Alipore Road, Kolkata - 700 027"
              />
            </div>
            <div>
              <label className={labelClasses}>Hospital Phone</label>
              <input
                type="text"
                value={form.hospitalPhone}
                onChange={(e) => handleChange('hospitalPhone', e.target.value)}
                className={inputClasses}
                placeholder="e.g. +91-33-2222-9900"
              />
            </div>
            <div>
              <label className={labelClasses}>Hospital Email</label>
              <input
                type="email"
                value={form.hospitalEmail}
                onChange={(e) => handleChange('hospitalEmail', e.target.value)}
                className={inputClasses}
                placeholder="e.g. info@hospital.in"
              />
            </div>
          </div>
        </div>

        {/* Error / Success messages */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-[#ba1a1a] bg-[#ffdad6] px-4 py-3 rounded-lg">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 text-sm text-[#4CAF82] bg-[#4CAF82]/10 px-4 py-3 rounded-lg">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            Profile saved successfully!
          </div>
        )}

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-8 py-3 bg-[#005454] text-white font-bold rounded-xl hover:bg-[#004040] transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
