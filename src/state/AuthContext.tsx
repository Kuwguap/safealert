import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../api/supabase';

// Real authentication via Supabase Auth: passwords are hashed server-side,
// sessions persist and refresh across devices, and password reset works.
// Profiles (name / role / emergency contacts) live in public.profiles.

export type Role = 'user' | 'admin';

export interface EmergencyContact {
  name: string;
  phone: string;
  email: string; // if they're also a SafeAlert user, they get in-app alerts
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  contacts: EmergencyContact[];
  phone: string; // user's own number — receives Extreme AMBER SMS blasts
}

interface AuthState {
  ready: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (
    name: string,
    email: string,
    password: string,
    role: Role,
    contacts: EmergencyContact[],
    phone: string
  ) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  signOut: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}

// Load the profile row for a signed-in user, retrying once in case the
// server-side profile trigger hasn't committed yet.
async function loadUser(id: string, email: string): Promise<User> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data } = await supabase.from('profiles').select('name, role, contacts, phone').eq('id', id).maybeSingle();
    if (data) {
      return {
        id,
        email,
        name: data.name ?? '',
        role: (data.role as Role) ?? 'user',
        contacts: Array.isArray(data.contacts) ? (data.contacts as EmergencyContact[]) : [],
        phone: data.phone ?? '',
      };
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  return { id, email, name: email.split('@')[0], role: 'user', contacts: [], phone: '' };
}

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already registered') || m.includes('already been registered')) return 'An account with this email already exists.';
  if (m.includes('invalid login')) return 'Wrong email or password.';
  if (m.includes('email not confirmed')) return 'Account not confirmed yet — try again in a moment.';
  if (m.includes('password')) return 'Password needs at least 6 characters.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Too many attempts — wait a minute and try again.';
  if (m.includes('network') || m.includes('fetch')) return 'Network error — check your connection.';
  return message;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    // restore an existing session on launch
    supabase.auth.getSession().then(async ({ data }) => {
      const s = data.session;
      if (s?.user && active.current) setUser(await loadUser(s.user.id, s.user.email ?? ''));
      if (active.current) setReady(true);
    });
    // react to sign-in / sign-out / token refresh
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!active.current) return;
      if (session?.user) setUser(await loadUser(session.user.id, session.user.email ?? ''));
      else setUser(null);
    });
    return () => {
      active.current = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthState = {
    ready,
    user,
    signUp: async (name, email, password, role, contacts, phone) => {
      const cleanEmail = email.trim().toLowerCase();
      if (!name.trim()) return 'Enter your name.';
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return 'Enter a valid email address.';
      if (password.length < 6) return 'Password needs at least 6 characters.';
      if (contacts.length === 0) return 'Add at least one emergency contact — SOS alerts go to them.';
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: { data: { name: name.trim(), role, contacts, phone: phone.trim() } },
      });
      if (error) return friendly(error.message);
      // Signups are auto-confirmed server-side; get a session immediately.
      if (!data.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (signInErr) return friendly(signInErr.message);
      }
      return null;
    },
    signIn: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      return error ? friendly(error.message) : null;
    },
    resetPassword: async (email) => {
      const cleanEmail = email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return 'Enter your email above first.';
      const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : undefined;
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, { redirectTo });
      return error ? friendly(error.message) : null;
    },
    signOut: () => {
      supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
