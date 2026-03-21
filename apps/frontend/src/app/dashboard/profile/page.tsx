'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function ProfilePage() {
  const [profile, setProfile] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchProfile = async () => {
    try {
      const response = await api.get('/patient/profile');
      setProfile(response.data);
    } catch (err: unknown) {
      const errorObj = err as { response?: { status?: number } };
      if (errorObj.response?.status === 404) {
        // Handle case where profile hasn't been instantiated yet but user registered
        setProfile({
          firstName: '', lastName: '', dateOfBirth: '', gender: '', 
          bloodType: '', phoneNumber: '', address: '', city: '', 
          state: '', zipCode: '', country: '', emergencyContactName: '', 
          emergencyContactPhone: '', insuranceProvider: '', insurancePolicyNumber: ''
        });
      } else {
        setError('Failed to load profile data.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setProfile({ ...profile, [e.target.name]: e.target.value });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Typically backends have PUT/PATCH to update profile
      // Depending on NestJS backend setup, it could be a simple endpoint
      await api.put('/patient/profile', profile);
      setSuccess('Profile updated successfully.');
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { message?: string } } };
      setError(errorObj.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div>Loading profile...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-purple-700">
          My Profile
        </h1>
        <p className="text-muted-foreground mt-2">Manage your personal and medical information here.</p>
      </div>

      <Card className="max-w-4xl">
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your contact details and basic medical info.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-4 text-sm font-medium text-destructive">{error}</div>}
          {success && <div className="mb-4 text-sm font-medium text-green-600">{success}</div>}
          
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input id="firstName" name="firstName" value={profile?.firstName || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input id="lastName" name="lastName" value={profile?.lastName || ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input id="dateOfBirth" name="dateOfBirth" type="date" value={profile?.dateOfBirth ? profile.dateOfBirth.split('T')[0] : ''} onChange={handleChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <Input id="gender" name="gender" value={profile?.gender || ''} onChange={handleChange} placeholder="e.g., MALE, FEMALE, OTHER" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bloodType">Blood Type</Label>
                <Input id="bloodType" name="bloodType" value={profile?.bloodType || ''} onChange={handleChange} placeholder="e.g., O_PLUS" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number</Label>
                <Input id="phoneNumber" name="phoneNumber" value={profile?.phoneNumber || ''} onChange={handleChange} />
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <h3 className="font-semibold text-lg">Address</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="address">Street Address</Label>
                  <Input id="address" name="address" value={profile?.address || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" name="city" value={profile?.city || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input id="state" name="state" value={profile?.state || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input id="zipCode" name="zipCode" value={profile?.zipCode || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" name="country" value={profile?.country || ''} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4">
              <h3 className="font-semibold text-lg">Emergency Contact</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactName">Name</Label>
                  <Input id="emergencyContactName" name="emergencyContactName" value={profile?.emergencyContactName || ''} onChange={handleChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="emergencyContactPhone">Phone Number</Label>
                  <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" value={profile?.emergencyContactPhone || ''} onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button type="submit" variant="glass" disabled={saving}>
                {saving ? 'Saving Changes...' : 'Save Profile Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
