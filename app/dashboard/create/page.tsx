'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/components/login-page';
import { supabase } from '@/lib/supabase';
import { Role } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Save,
  Search,
  Shield,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function CreateProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingRoles, setLoadingRoles] = useState(true);

  useEffect(() => {
    async function fetchRoles() {
      const { data } = await supabase
        .from('roles')
        .select('*, owner:users!roles_owner_id_fkey(*)')
        .eq('active', true)
        .order('name');
      if (data) setRoles(data as Role[]);
      setLoadingRoles(false);
    }
    fetchRoles();
  }, []);

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const selectedRoles = roles.filter(r => selectedRoleIds.has(r.id));

  const handleSave = async (asDraft: boolean) => {
    if (!name.trim()) {
      toast.error('Profile name is required');
      return;
    }
    if (selectedRoleIds.size === 0) {
      toast.error('Select at least one role');
      return;
    }

    setSaving(true);
    const { data: profile, error } = await supabase
      .from('profiles')
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        creator_id: user!.id,
        status: 'draft',
      })
      .select()
      .single();

    if (error || !profile) {
      toast.error('Failed to create profile');
      setSaving(false);
      return;
    }

    const profileRoles = Array.from(selectedRoleIds).map(roleId => ({
      profile_id: profile.id,
      role_id: roleId,
    }));

    const { error: prError } = await supabase.from('profile_roles').insert(profileRoles);

    if (prError) {
      toast.error('Failed to add roles');
      await supabase.from('profiles').delete().eq('id', profile.id);
      setSaving(false);
      return;
    }

    toast.success('Profile created');
    router.push('/dashboard');
  };

  if (authLoading) return null;
  if (!user || user.persona !== 'manager') return <LoginPage />;

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Create Access Profile</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              Define a new profile by assembling roles from the catalog
            </p>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Form */}
          <div className="md:col-span-2 space-y-6">
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Profile Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="e.g., DevOps Engineer, Junior Developer"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    placeholder="Describe the purpose and scope of this profile..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Role Catalog</CardTitle>
                  <div className="relative w-56">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                    <Input
                      placeholder="Search roles..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-8 h-8 text-sm"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingRoles ? (
                  <div className="flex justify-center py-8">
                    <div className="h-6 w-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : filteredRoles.length === 0 ? (
                  <div className="text-center py-8 text-[hsl(var(--muted-foreground))] text-sm">No roles found</div>
                ) : (
                  <div className="divide-y">
                    {filteredRoles.map(role => {
                      const isSelected = selectedRoleIds.has(role.id);
                      return (
                        <label
                          key={role.id}
                          className={`flex items-center gap-3 px-6 py-3.5 cursor-pointer transition-colors ${
                            isSelected ? 'bg-[hsl(var(--primary))]/5' : 'hover:bg-[hsl(var(--muted))]/50'
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleRole(role.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Shield className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                              <p className="text-sm font-medium">{role.name}</p>
                            </div>
                            {role.description && (
                              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 ml-5.5">{role.description}</p>
                            )}
                          </div>
                          {role.owner && (
                            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[8px] bg-[hsl(var(--muted))]">
                                  {role.owner.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              {role.owner.name}
                            </div>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Summary */}
          <div className="space-y-4">
            <Card className="shadow-sm sticky top-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm">
                  <p className="text-[hsl(var(--muted-foreground))]">Selected Roles</p>
                  <p className="text-2xl font-bold mt-1">{selectedRoleIds.size}</p>
                </div>
                <Separator />
                {selectedRoles.length > 0 ? (
                  <div className="space-y-2">
                    {selectedRoles.map(role => (
                      <div key={role.id} className="flex items-center justify-between text-sm">
                        <span className="truncate">{role.name}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-[hsl(var(--muted-foreground))] hover:text-red-600 shrink-0"
                          onClick={() => toggleRole(role.id)}
                        >
                          <span className="text-xs">&times;</span>
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No roles selected yet</p>
                )}
                <Separator />
                <div className="space-y-2">
                  <Button
                    className="w-full gap-2"
                    onClick={() => handleSave(true)}
                    disabled={saving}
                  >
                    <Save className="h-4 w-4" />
                    Save as Draft
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
