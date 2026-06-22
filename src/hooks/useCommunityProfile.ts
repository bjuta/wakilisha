import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { CommunityProfile } from '@/services/community';
import { getUserProfile, createProfile, updateProfile } from '@/services/community';

export function useCommunityProfile(userId?: string) {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const ensureProfile = useCallback(async (preferredUsername?: string, displayName?: string) => {
    if (!userId) return null;
    try {
      const existing = await getUserProfile(userId);
      if (existing) {
        setProfile(existing);
        return existing;
      }
      const fresh = await createProfile(
        userId,
        preferredUsername || 'user_' + userId.slice(0, 8),
        displayName || preferredUsername
      );
      setProfile(fresh);
      return fresh;
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to ensure profile'));
      return null;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    getUserProfile(userId)
      .then((p) => {
        setProfile(p);
        setLoading(false);
      })
      .catch((e) => {
        setError(e);
        setLoading(false);
      });
  }, [userId]);

  return { profile, loading, error, ensureProfile };
}

export function useRequireCommunityProfile(userId?: string) {
  const { profile, loading, error, ensureProfile } = useCommunityProfile(userId);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    if (!loading && !profile && userId) {
      setNeedsSetup(true);
    } else {
      setNeedsSetup(false);
    }
  }, [loading, profile, userId]);

  const createProfileWithUsername = useCallback(async (username: string, displayName?: string) => {
    const result = await ensureProfile(username, displayName);
    if (result) setNeedsSetup(false);
    return result;
  }, [ensureProfile]);

  return {
    profile,
    loading,
    error,
    needsSetup,
    createProfileWithUsername,
  };
}

export function useCurrentUserProfile() {
  const [userId, setUserId] = useState<string | undefined>();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) setUserId(session.user.id);
      else setUserId(undefined);
    });
    return () => { listener?.subscription.unsubscribe(); };
  }, []);

  return useCommunityProfile(userId);
}