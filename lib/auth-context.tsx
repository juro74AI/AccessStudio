'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Persona } from './types';
import { supabase } from './supabase';

interface AuthContextType {
  user: User | null;
  users: User[];
  login: (userId: string) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  users: [],
  login: () => {},
  logout: () => {},
  loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      const { data } = await supabase.from('users').select('*').order('name');
      if (data) setUsers(data as User[]);
      setLoading(false);
    }
    fetchUsers();
  }, []);

  useEffect(() => {
    const savedUserId = typeof window !== 'undefined' ? localStorage.getItem('auth_user_id') : null;
    if (savedUserId && users.length > 0) {
      const found = users.find(u => u.id === savedUserId);
      if (found) setUser(found);
    }
  }, [users]);

  const login = useCallback((userId: string) => {
    const found = users.find(u => u.id === userId);
    if (found) {
      setUser(found);
      localStorage.setItem('auth_user_id', found.id);
    }
  }, [users]);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('auth_user_id');
  }, []);

  return (
    <AuthContext.Provider value={{ user, users, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
