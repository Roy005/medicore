'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { getMyProfile } from '@/lib/patient';
import { useAuth } from '@/contexts/AuthContext';
import { 
  User, Mail, Phone, Calendar, MapPin, Heart, Shield, Database, 
  AlertTriangle, ChevronRight, QrCode, Download, Trash2, 
  Clock, BadgeCheck, Lock, Fingerprint, Users
} from 'lucide-react';

interface ProfileData {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  bloodType: string;
  phoneNumber: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation?: string;
  insuranceProvider: string;
  insurancePolicyNumber: string;
  [key: string]: string | undefined;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editSection, setEditSection] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      const { profileId, profile: profileData } = await getMyProfile();
      setPatientId(profileId);
      if (profileData?.demographics) {
        const d = profileData.demographics;
        setProfile({
          firstName: d.firstName || '', lastName: d.lastName || '',
          dateOfBirth: d.dateOfBirth || '', gender: d.gender || '',
          bloodType: d.bloodType || '', phoneNumber: d.phoneNumber || '',
          address: d.address || '', city: d.city || '',
          state: d.state || '', zipCode: d.zipCode || '',
          country: d.country || '', emergencyContactName: d.emergencyContactName || '',
          emergencyContactPhone: d.emergencyContactPhone || '',
          emergencyContactRelation: d.emergencyContactRelation || '',
          insuranceProvider: d.insuranceProvider || '',
          insurancePolicyNumber: d.insurancePolicyNumber || ''
        });
      } else {
        setProfile({
          firstName: '', lastName: '', dateOfBirth: '', gender: '',
          bloodType: '', phoneNumber: '', address: '', city: '',
          state: '', zipCode: '', country: '', emergencyContactName: '',
          emergencyContactPhone: '', emergencyContactRelation: '',
          insuranceProvider: '', insurancePolicyNumber: ''
        });
      }
    } catch {
      setError('Failed to load profile data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (profile) {
      setProfile({ ...profile, [e.target.name]: e.target.value });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (!patientId) throw new Error('No patient ID');
      await api.patch(`/patients/${patientId}/profile`, { demographics: profile });
      setSuccess('Profile updated successfully.');
      setEditSection(null);
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const lastSync = new Date().toLocaleString('en-US', { 
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).toUpperCase();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-[#e6e8e9] rounded w-48" />
          <div className="h-40 bg-[#f2f4f5] rounded-lg" />
          <div className="h-60 bg-[#f2f4f5] rounded-lg" />
        </div>
      </div>
    );
  }

  const fullName = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') || user?.email?.split('@')[0] || 'Patient';

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Page Title */}
      <h1 className="text-2xl font-bold text-[#191c1d]">Patient Profile & Settings</h1>

      {/* Status Messages */}
      {error && (
        <div className="px-4 py-3 rounded-lg bg-[#ffdad6] text-[#ba1a1a] text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> {error}
        </div>
      )}
      {success && (
        <div className="px-4 py-3 rounded-lg bg-[#4CAF82]/10 text-[#4CAF82] text-sm font-medium flex items-center gap-2">
          <BadgeCheck className="w-4 h-4" /> {success}
        </div>
      )}

      {/* ─── Profile Header Card ─── */}
      <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#005454] to-[#0d6e6e] flex items-center justify-center text-white text-2xl font-bold shadow-md flex-shrink-0">
            {fullName[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-[#191c1d]">{fullName}</h2>
            <p className="text-sm text-[#3e4948]">{user?.email}</p>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <div className="text-right">
              <p className="text-[10px] font-semibold text-[#6e7979] uppercase tracking-wider">Patient ID</p>
              <p className="text-sm font-bold text-[#005454] font-mono">{user?.email?.slice(0, 8).toUpperCase() || 'MC-0001'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-[#6e7979] uppercase tracking-wider">Last Sync</p>
              <p className="text-xs text-[#3e4948] font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" /> {lastSync}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Personal Information ─── */}
      <SectionCard
        icon={<BadgeCheck className="w-5 h-5 text-[#005454]" />}
        title="Personal Information"
        isEditing={editSection === 'personal'}
        onEdit={() => setEditSection(editSection === 'personal' ? null : 'personal')}
        onSave={handleSave}
        saving={saving}
      >
        {editSection === 'personal' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="First Name" name="firstName" value={profile?.firstName} onChange={handleChange} />
            <InputField label="Last Name" name="lastName" value={profile?.lastName} onChange={handleChange} />
            <InputField label="Email" name="email" value={user?.email || ''} onChange={() => {}} disabled />
            <InputField label="Phone" name="phoneNumber" value={profile?.phoneNumber} onChange={handleChange} />
            <InputField label="Date of Birth" name="dateOfBirth" type="date" value={profile?.dateOfBirth?.split('T')[0]} onChange={handleChange} />
            <SelectField label="Gender" name="gender" value={profile?.gender} onChange={handleChange} 
              options={['', 'MALE', 'FEMALE', 'OTHER']} />
            <SelectField label="Blood Type" name="bloodType" value={profile?.bloodType} onChange={handleChange}
              options={['', 'A_PLUS', 'A_MINUS', 'B_PLUS', 'B_MINUS', 'AB_PLUS', 'AB_MINUS', 'O_PLUS', 'O_MINUS']} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            <InfoRow icon={<User className="w-4 h-4" />} label="Name" value={fullName} />
            <InfoRow icon={<Mail className="w-4 h-4" />} label="Email" value={user?.email || ''} />
            <InfoRow icon={<Phone className="w-4 h-4" />} label="Phone" value={profile?.phoneNumber || 'Not set'} />
            <InfoRow icon={<Calendar className="w-4 h-4" />} label="DOB" value={profile?.dateOfBirth ? new Date(profile.dateOfBirth).toLocaleDateString() : 'Not set'} />
            <InfoRow icon={<Heart className="w-4 h-4" />} label="Blood Type" value={profile?.bloodType?.replace('_', '+').replace('MINUS', '-') || 'Not set'} />
            <InfoRow icon={<User className="w-4 h-4" />} label="Gender" value={profile?.gender || 'Not set'} />
          </div>
        )}
      </SectionCard>

      {/* ─── Address ─── */}
      <SectionCard
        icon={<MapPin className="w-5 h-5 text-[#005454]" />}
        title="Address"
        isEditing={editSection === 'address'}
        onEdit={() => setEditSection(editSection === 'address' ? null : 'address')}
        onSave={handleSave}
        saving={saving}
      >
        {editSection === 'address' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <InputField label="Street Address" name="address" value={profile?.address} onChange={handleChange} />
            </div>
            <InputField label="City" name="city" value={profile?.city} onChange={handleChange} />
            <InputField label="State" name="state" value={profile?.state} onChange={handleChange} />
            <InputField label="Zip Code" name="zipCode" value={profile?.zipCode} onChange={handleChange} />
            <InputField label="Country" name="country" value={profile?.country} onChange={handleChange} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Street" value={profile?.address || 'Not set'} />
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="City" value={profile?.city || 'Not set'} />
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="State" value={profile?.state || 'Not set'} />
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Zip" value={profile?.zipCode || 'Not set'} />
            <InfoRow icon={<MapPin className="w-4 h-4" />} label="Country" value={profile?.country || 'Not set'} />
          </div>
        )}
      </SectionCard>

      {/* ─── Medical ID Quick Link ─── */}
      <Link href="/dashboard/medical-id" className="block">
        <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-5 flex items-center gap-4 hover:shadow-md transition-shadow group">
          <div className="w-10 h-10 rounded-lg bg-[#005454]/10 flex items-center justify-center">
            <QrCode className="w-5 h-5 text-[#005454]" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-[#191c1d]">Medical ID</h3>
            <p className="text-xs text-[#6e7979]">
              Allows first responders to view your medical information in an emergency.
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#bec9c8] group-hover:text-[#005454] transition-colors" />
        </div>
      </Link>

      {/* ─── Emergency Contacts ─── */}
      <SectionCard
        icon={<Phone className="w-5 h-5 text-[#E8533A]" />}
        title="Emergency Contacts"
        isEditing={editSection === 'emergency'}
        onEdit={() => setEditSection(editSection === 'emergency' ? null : 'emergency')}
        onSave={handleSave}
        saving={saving}
      >
        {editSection === 'emergency' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Contact Name" name="emergencyContactName" value={profile?.emergencyContactName} onChange={handleChange} />
            <InputField label="Relationship" name="emergencyContactRelation" value={profile?.emergencyContactRelation} onChange={handleChange} placeholder="e.g., Spouse, Parent" />
            <InputField label="Phone Number" name="emergencyContactPhone" value={profile?.emergencyContactPhone} onChange={handleChange} type="tel" />
          </div>
        ) : (
          <div className="space-y-3">
            {profile?.emergencyContactName ? (
              <div className="flex items-center gap-4 px-4 py-3 rounded-lg" style={{ backgroundColor: 'var(--surface-container-low)' }}>
                <div className="w-10 h-10 rounded-full bg-[#E8533A]/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-[#E8533A]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#191c1d]">{profile.emergencyContactName}</p>
                  <p className="text-xs text-[#6e7979]">{profile.emergencyContactRelation || 'Emergency Contact'}</p>
                </div>
                <p className="ml-auto text-sm text-[#3e4948] font-mono">{profile.emergencyContactPhone || '—'}</p>
              </div>
            ) : (
              <p className="text-sm text-[#6e7979] py-4 text-center">No emergency contacts added yet. Click edit to add one.</p>
            )}
          </div>
        )}
      </SectionCard>

      {/* ─── Insurance ─── */}
      <SectionCard
        icon={<Shield className="w-5 h-5 text-[#4c5f7e]" />}
        title="Insurance Information"
        isEditing={editSection === 'insurance'}
        onEdit={() => setEditSection(editSection === 'insurance' ? null : 'insurance')}
        onSave={handleSave}
        saving={saving}
      >
        {editSection === 'insurance' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField label="Insurance Provider" name="insuranceProvider" value={profile?.insuranceProvider} onChange={handleChange} />
            <InputField label="Policy Number" name="insurancePolicyNumber" value={profile?.insurancePolicyNumber} onChange={handleChange} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3">
            <InfoRow icon={<Shield className="w-4 h-4" />} label="Provider" value={profile?.insuranceProvider || 'Not set'} />
            <InfoRow icon={<Shield className="w-4 h-4" />} label="Policy #" value={profile?.insurancePolicyNumber || 'Not set'} mono />
          </div>
        )}
      </SectionCard>

      {/* ─── Security & Privacy ─── */}
      <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-[#005454]/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-[#005454]" />
          </div>
          <h3 className="text-base font-semibold text-[#191c1d]">Security & Privacy</h3>
        </div>
        <div className="space-y-4">
          <ToggleRow
            icon={<Lock className="w-4 h-4 text-[#005454]" />}
            title="Two-Factor Authentication"
            description="Requires a code sent to your mobile device."
            defaultChecked={false}
          />
          <ToggleRow
            icon={<Fingerprint className="w-4 h-4 text-[#005454]" />}
            title="Biometric Unlock"
            description="Enable FaceID or Fingerprint authentication."
            defaultChecked={false}
          />
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-[#005454]" />
              <div>
                <p className="text-sm font-medium text-[#191c1d]">Authorized Doctors</p>
                <p className="text-xs text-[#6e7979]">Manage which doctors have access to your records.</p>
              </div>
            </div>
            <Link href="/dashboard/consent" className="text-xs font-semibold text-[#005454] hover:underline">
              Manage →
            </Link>
          </div>
        </div>
      </div>

      {/* ─── Health Data Management ─── */}
      <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-[#4c5f7e]/10 flex items-center justify-center">
            <Database className="w-5 h-5 text-[#4c5f7e]" />
          </div>
          <h3 className="text-base font-semibold text-[#191c1d]">Health Data Management</h3>
        </div>
        <p className="text-sm text-[#3e4948] mb-4">
          Download a complete encrypted archive of your medical history, prescriptions, and lab results in PDF or FHIR format.
        </p>
        <div className="flex gap-3">
          <button className="px-4 py-2.5 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white text-sm font-semibold rounded-lg hover:shadow-lg transition-all flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export as PDF
          </button>
          <button className="px-4 py-2.5 text-sm font-semibold text-[#005454] rounded-lg hover:bg-[#005454]/5 transition-colors" style={{ border: '1.5px solid rgba(190,201,200,0.4)' }}>
            Export as FHIR
          </button>
        </div>
      </div>

      {/* ─── Danger Zone ─── */}
      <div className="rounded-lg p-6 border-l-4 border-[#ba1a1a]" style={{ backgroundColor: '#fef2f2' }}>
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle className="w-5 h-5 text-[#ba1a1a]" />
          <h3 className="text-base font-semibold text-[#ba1a1a]">Danger Zone</h3>
        </div>
        <p className="text-sm text-[#3e4948] mb-4">
          Permanently delete your clinical profile and all associated medical data. This action is irreversible.
        </p>
        <button className="px-4 py-2.5 bg-[#ba1a1a] text-white text-sm font-semibold rounded-lg hover:bg-[#93000a] transition-colors flex items-center gap-2">
          <Trash2 className="w-4 h-4" />
          Delete Account
        </button>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function SectionCard({ icon, title, children, isEditing, onEdit, onSave, saving }: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  return (
    <div className="bg-white rounded-lg shadow-[0px_12px_32px_rgba(25,28,29,0.04)] p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#005454]/10 flex items-center justify-center">
            {icon}
          </div>
          <h3 className="text-base font-semibold text-[#191c1d]">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              onClick={onSave}
              disabled={saving}
              className="px-4 py-1.5 bg-gradient-to-r from-[#005454] to-[#0d6e6e] text-white text-xs font-semibold rounded-lg disabled:opacity-50 hover:shadow-md transition-all"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
          <button
            onClick={onEdit}
            className="text-xs font-semibold text-[#005454] hover:underline"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}

function InfoRow({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-[#6e7979]">{icon}</span>
      <span className="text-xs text-[#6e7979] w-16">{label}</span>
      <span className={`text-sm text-[#191c1d] ${mono ? 'font-mono' : ''} ${!value || value === 'Not set' ? 'text-[#bec9c8]' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function InputField({ label, name, value, onChange, type, disabled, placeholder }: {
  label: string; name: string; value?: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; disabled?: boolean; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#3e4948]">{label}</label>
      <input
        name={name}
        type={type || 'text'}
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg text-sm text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#005454] disabled:opacity-50 transition-all"
        style={{ backgroundColor: 'var(--surface-container-highest)' }}
      />
    </div>
  );
}

function SelectField({ label, name, value, onChange, options }: {
  label: string; name: string; value?: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-[#3e4948]">{label}</label>
      <select
        name={name}
        value={value || ''}
        onChange={onChange}
        className="w-full px-3 py-2.5 rounded-lg text-sm text-[#191c1d] focus:outline-none focus:ring-2 focus:ring-[#005454] transition-all"
        style={{ backgroundColor: 'var(--surface-container-highest)' }}
      >
        {options.map(opt => (
          <option key={opt} value={opt}>{opt ? opt.replace('_', ' ') : 'Select...'}</option>
        ))}
      </select>
    </div>
  );
}

function ToggleRow({ icon, title, description, defaultChecked }: {
  icon: React.ReactNode; title: string; description: string; defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--surface-container-high)' }}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm font-medium text-[#191c1d]">{title}</p>
          <p className="text-xs text-[#6e7979]">{description}</p>
        </div>
      </div>
      <button
        onClick={() => setChecked(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-[#005454]' : 'bg-[#bec9c8]'}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
