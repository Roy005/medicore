import api from './api';

/**
 * Resolves the current user's patient profile ID.
 * Uses GET /patients/me/profile which finds the profile by the authenticated user's ID.
 */
export async function getMyPatientId(): Promise<string> {
  const res = await api.get('/patients/me/profile');
  return res.data.id;
}

/**
 * Fetches the full patient profile for the current user.
 */
export async function getMyProfile(): Promise<{ profileId: string; profile: any }> {
  try {
    const res = await api.get('/patients/me/profile');
    return { profileId: res.data.id, profile: res.data };
  } catch {
    return { profileId: '', profile: null };
  }
}
