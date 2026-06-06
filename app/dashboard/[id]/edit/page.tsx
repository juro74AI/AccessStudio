'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/components/login-page';
import { supabase } from '@/lib/supabase';
import { Role, Profile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Save,
  Search,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function EditProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  const fetchData = useCallback(async () => {
    const [profileRes, rolesRes, profileRolesRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', profileId).single(),
      supabase.from('roles').select('*, owner:users!roles_owner_id_fkey(*)').eq('active', true).order('name'),
      supabase.from('profile_roles').select('role_id').eq('profile_id', profileId),
    ]);

    if (profileRes.data) {
      setName(profileRes.data.name);
      setDescription(profileRes.data.description || '');
      if (profileRes.data.status !== 'draft') {
        toast.error('Only draft profiles can be edited');
        router.replace('/dashboard');
        return;
      }
    }

    if (rolesRes.data) setRoles(rolesRes.data as Role[]);
    if (profileRolesRes.data) {
      setSelectedRoleIds(new Set(profileRolesRes.data.map((pr: any) => pr.role_id)));
    }

    setLoadingData(false);
  }, [profileId, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Profile name is required');
      return;
    }
    if (selectedRoleIds.size === 0) {
      toast.error('Select at least one role');
      return;
    }

    setSaving(true);

    await supabase
      .from('profiles')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    // Remove existing profile_roles and re-insert
    await supabase.from('profile_roles').delete().eq('profile_id', profileId);

    const profileRoles = Array.from(selectedRoleIds).map(roleId => ({
      profile_id: profileId,
      role_id: roleId,
    }));

    await supabase.from('profile_roles').insert(profileRoles);

    toast.success('Profile updated');
    router.push('/dashboard');
  };

  if (authLoading) return null;
  if (!user || user.persona !== 'manager') return <LoginPage />;

  if (loadingData) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/${profileId}`}>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit Profile</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-0.5">
              Modify roles and profile information
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
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
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
                      </label>
                    );
                  })}
                </div>
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
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No roles selected</p>
                )}
                <Separator />
                <Button className="w-full gap-2" onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
