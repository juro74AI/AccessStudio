'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { Shield, Users, UserCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

export function LoginPage() {
  const { users, login, loading } = useAuth();

  const managers = users.filter(u => u.persona === 'manager');
  const owners = users.filter(u => u.persona === 'owner');

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] flex flex-col">
      {/* Header */}
      <div className="relative overflow-hidden bg-[hsl(var(--primary))]">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(217,75%,42%)] via-[hsl(217,75%,35%)] to-[hsl(220,70%,28%)]" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-full h-full" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.2) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 0%, transparent 50%)' }} />
        </div>
        <div className="relative max-w-4xl mx-auto px-6 py-6 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <Shield className="h-7 w-7 text-white" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Access Studio</h1>
          </div>
          <p className="text-sm text-white/80 max-w-xl mx-auto">
            Role-based access profile management. Assemble, validate, and activate access profiles for your teams.
          </p>
        </div>
      </div>
<br></br>
      <br></br>
      {/* Login cards */}
      <div className="max-w-4xl mx-auto px-6 -mt-4 w-full">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Managers */}
          <Card className="border shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <CardTitle className="text-base">Managers</CardTitle>
                  <CardDescription className="text-xs">Create and manage access profiles</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {managers.map((user) => (
                <Button
                  key={user.id}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 px-3 hover:bg-[hsl(var(--primary))]/5 hover:border-[hsl(var(--primary))]/30 transition-all"
                  onClick={() => login(user.id)}
                  disabled={loading}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-[hsl(var(--primary))] text-white text-xs font-semibold">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{user.email}</p>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>

          {/* Owners */}
          <Card className="border shadow-lg">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <CardTitle className="text-base">Role Owners</CardTitle>
                  <CardDescription className="text-xs">Validate role assignments in profiles</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {owners.map((user) => (
                <Button
                  key={user.id}
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 px-3 hover:bg-emerald-50 hover:border-emerald-200 transition-all"
                  onClick={() => login(user.id)}
                  disabled={loading}
                >
                  <Avatar className="h-9 w-9 shrink-0">
                    <AvatarFallback className="bg-emerald-600 text-white text-xs font-semibold">
                      {user.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-left">
                    <p className="text-sm font-medium">{user.name}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{user.email}</p>
                  </div>
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
