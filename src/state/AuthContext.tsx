import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';

// Local demo auth — accounts live in AsyncStorage on this device so the
// login → app → admin loop is fully testable offline. Production swaps
// this for Firebase Auth / Supabase per the proposal; do NOT reuse this
// hashing for anything real.

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
}

interface StoredUser extends User {
  hash: string;
}

const USERS_KEY = 'safealert.users';
const SESSION_KEY = 'safealert.session';

// demo-only hash (djb2 + salt) — placeholder for a real auth backend
function demoHash(password: string): string {
  const salted = `${password}::safealert-demo`;
  let h = 5381;
  for (let i = 0; i < salted.length; i++) h = ((h << 5) + h + salted.charCodeAt(i)) | 0;
  return h.toString(16);
}

interface AuthState {
  ready: boolean;
  user: User | null;
  signIn: (email: string, password: string) => Promise<string | null>; // error message or null
  signUp: (
    name: string,
    email: string,
    password: string,
    role: Role,
    contacts: EmergencyContact[]
  ) => Promise<string | null>;
  signOut: () => void;
}

const Ctx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<StoredUser[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [u, s] = await Promise.all([AsyncStorage.getItem(USERS_KEY), AsyncStorage.getItem(SESSION_KEY)]);
        const list: StoredUser[] = u ? JSON.parse(u) : [];
        setUsers(list);
        if (s) {
          const active = list.find((x) => x.id === s);
          if (active) {
            setUser({
              id: active.id,
              name: active.name,
              email: active.email,
              role: active.role,
              contacts: active.contacts ?? [],
            });
          }
        }
      } catch {
        // fresh install
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persistUsers = (next: StoredUser[]) => {
    setUsers(next);
    AsyncStorage.setItem(USERS_KEY, JSON.stringify(next)).catch(() => {});
  };

  const setSession = (u: User | null) => {
    setUser(u);
    if (u) AsyncStorage.setItem(SESSION_KEY, u.id).catch(() => {});
    else AsyncStorage.removeItem(SESSION_KEY).catch(() => {});
  };

  const value: AuthState = {
    ready,
    user,
    signUp: async (name, email, password, role, contacts) => {
      const cleanEmail = email.trim().toLowerCase();
      if (!name.trim()) return 'Enter your name.';
      if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) return 'Enter a valid email address.';
      if (password.length < 6) return 'Password needs at least 6 characters.';
      if (users.some((u) => u.email === cleanEmail)) return 'An account with this email already exists.';
      if (contacts.length === 0) return 'Add at least one emergency contact — SOS alerts go to them.';
      const stored: StoredUser = {
        id: `u-${Date.now()}`,
        name: name.trim(),
        email: cleanEmail,
        role,
        contacts,
        hash: demoHash(password),
      };
      persistUsers([...users, stored]);
      setSession({ id: stored.id, name: stored.name, email: stored.email, role: stored.role, contacts });
      return null;
    },
    signIn: async (email, password) => {
      const cleanEmail = email.trim().toLowerCase();
      const found = users.find((u) => u.email === cleanEmail);
      if (!found || found.hash !== demoHash(password)) return 'Wrong email or password.';
      setSession({
        id: found.id,
        name: found.name,
        email: found.email,
        role: found.role,
        contacts: found.contacts ?? [],
      });
      return null;
    },
    signOut: () => setSession(null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
