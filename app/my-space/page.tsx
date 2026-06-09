'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/components/login-page';
import { supabase } from '@/lib/supabase';
import { Profile, Role, RoleRequest } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FolderOpen,
  Shield,
  Search,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  UserCircle,
  MessageSquare,
  ChevronRight,
  Inbox,
  ListChecks,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ProfileWithRoles {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  status: Profile['status'];
  created_at: string;
  updated_at: string;
  profile_roles: { role: Role }[];
}

interface RoleRequestWithDetails {
  id: string;
  user_id: string;
  role_id: string;
  profile_id: string | null;
  status: RoleRequest['status'];
  manager_comment: string | null;
  manager_decided_at: string | null;
  owner_comment: string | null;
  owner_decided_at: string | null;
  created_at: string;
  updated_at: string;
  role: Role;
  profile: Profile | null;
}

export default function MySpacePage() {
  const { user, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<ProfileWithRoles[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [requests, setRequests] = useState<RoleRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRequestDialog, setShowRequestDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [requestReason, setRequestReason] = useState('');
  const [roleSearch, setRoleSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [profilesRes, rolesRes, requestsRes] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('*, profile:profiles(*, profile_roles(role:roles(*, owner:users!roles_owner_id_fkey(*))))')
        .eq('user_id', user.id),
      supabase
        .from('roles')
        .select('*, owner:users!roles_owner_id_fkey(*)')
        .eq('active', true)
        .order('name'),
      supabase
        .from('role_requests')
        .select('*, role:roles(*, owner:users!roles_owner_id_fkey(*)), profile:profiles(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]);

    if (profilesRes.data) {
      setProfiles(
        profilesRes.data.map((up: any) => ({
          ...up.profile,
          profile_roles: up.profile?.profile_roles || [],
        }))
      );
    }

    if (rolesRes.data) {
      setRoles(rolesRes.data as Role[]);
    }

    if (requestsRes.data) {
      setRequests(requestsRes.data as RoleRequestWithDetails[]);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRequestRole = async () => {
    if (!selectedRole || !user) {
      toast.error('Please select a role');
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('role_requests').insert({
      user_id: user.id,
      role_id: selectedRole.id,
      profile_id: selectedProfile?.id || null,
      status: 'pending_manager',
    });

    if (error) {
      toast.error('Failed to request role');
      setSubmitting(false);
      return;
    }

    toast.success('Role request submitted');
    setShowRequestDialog(false);
    setSelectedRole(null);
    setSelectedProfile(null);
    setRequestReason('');
    setRoleSearch('');
    fetchData();
    setSubmitting(false);
  };

  const requestStats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending_manager').length,
    managerApproved: requests.filter(r => r.status === 'manager_approved').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const filteredRoles = roles.filter(r =>
    r.name.toLowerCase().includes(roleSearch.toLowerCase()) ||
    (r.description || '').toLowerCase().includes(roleSearch.toLowerCase())
  );

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case 'pending_manager':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="h-3 w-3" />
            Pending Manager
          </span>
        );
      case 'manager_approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-sky-50 text-sky-700 border-sky-200">
            <CheckCircle2 className="h-3 w-3" />
            Manager Approved
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3" />
            Rejected
          </span>
        );
      default:
        return null;
    }
  };

  if (authLoading) return null;
  if (!user || user.persona !== 'user') return <LoginPage />;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Space</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              View your profiles and request new roles from the catalog
            </p>
          </div>
          <Button className="gap-2" onClick={() => setShowRequestDialog(true)}>
            <Plus className="h-4 w-4" />
            Request a Role
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{profiles.length}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">My Profiles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{requestStats.pending}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-sky-50 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-sky-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{requestStats.managerApproved}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Manager Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{requestStats.approved}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Profiles */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              My Profiles
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : profiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
                <UserCircle className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">You are not assigned to any profile yet</p>
              </div>
            ) : (
              <div className="divide-y">
                {profiles.map((profile) => (
                  <div key={profile.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center shrink-0">
                          <FolderOpen className="h-5 w-5 text-[hsl(var(--primary))]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">{profile.name}</p>
                          {profile.description && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">{profile.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="font-normal">
                          {(profile.profile_roles || []).length} roles
                        </Badge>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      </div>
                    </div>
                    {(profile.profile_roles || []).length > 0 && (
                      <div className="mt-3 ml-13 flex flex-wrap gap-2">
                        {(profile.profile_roles || []).map((pr: any) => (
                          <div key={pr.role.id} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[hsl(var(--muted))] text-xs">
                            <Shield className="h-3 w-3 text-[hsl(var(--muted-foreground))]" />
                            <span className="font-medium">{pr.role.name}</span>
                            {pr.role.owner && (
                              <span className="text-[hsl(var(--muted-foreground))]">&middot; {pr.role.owner.name}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Requests */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListChecks className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              My Role Requests
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : requests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
                <Inbox className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">No role requests yet</p>
                <p className="text-xs mt-1">Click "Request a Role" to get started</p>
              </div>
            ) : (
              <div className="divide-y">
                {requests.map((req) => (
                  <div key={req.id} className="px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center shrink-0">
                          <Shield className="h-5 w-5 text-[hsl(var(--primary))]" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{req.role.name}</p>
                            {getRequestStatusBadge(req.status)}
                          </div>
                          {req.profile && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                              For profile: {req.profile.name}
                            </p>
                          )}
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                            Requested {format(new Date(req.created_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                        {req.role.owner && (
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[8px] bg-[hsl(var(--muted))]">
                                {req.role.owner.name.split(' ').map((n: string) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span>{req.role.owner.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {(req.manager_comment || req.owner_comment) && (
                      <div className="mt-3 ml-13 space-y-2">
                        {req.manager_comment && (
                          <div className="flex items-start gap-2 p-2.5 rounded-md bg-[hsl(var(--muted))] text-xs">
                            <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                            <div>
                              <span className="font-medium">Manager:</span> {req.manager_comment}
                            </div>
                          </div>
                        )}
                        {req.owner_comment && (
                          <div className="flex items-start gap-2 p-2.5 rounded-md bg-[hsl(var(--muted))] text-xs">
                            <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                            <div>
                              <span className="font-medium">Owner:</span> {req.owner_comment}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Request Role Dialog */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Request a Role</DialogTitle>
            <DialogDescription>
              Select a role from the catalog. Your manager will review it first, then the role owner.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Profile selector (optional) */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign to a profile (optional)</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedProfile(null)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    selectedProfile === null
                      ? 'bg-[hsl(var(--primary))] text-white'
                      : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted-foreground))]/10'
                  }`}
                >
                  No profile
                </button>
                {profiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfile(p)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      selectedProfile?.id === p.id
                        ? 'bg-[hsl(var(--primary))] text-white'
                        : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted-foreground))]/10'
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Role selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Select a role</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  placeholder="Search roles..."
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  className="pl-8 h-9 text-sm"
                />
              </div>
              <div className="max-h-60 overflow-y-auto border rounded-md divide-y">
                {filteredRoles.length === 0 ? (
                  <div className="p-3 text-sm text-[hsl(var(--muted-foreground))] text-center">No roles found</div>
                ) : (
                  filteredRoles.map(role => (
                    <button
                      key={role.id}
                      onClick={() => setSelectedRole(role)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                        selectedRole?.id === role.id ? 'bg-[hsl(var(--primary))]/5' : 'hover:bg-[hsl(var(--muted))]/50'
                      }`}
                    >
                      <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedRole?.id === role.id ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]' : 'border-[hsl(var(--border))]'
                      }`}>
                        {selectedRole?.id === role.id && (
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                          <span className="text-sm font-medium">{role.name}</span>
                        </div>
                        {role.description && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{role.description}</p>
                        )}
                      </div>
                      {role.owner && (
                        <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[8px] bg-[hsl(var(--muted))]">
                              {role.owner.name.split(' ').map((n: string) => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="hidden sm:inline">{role.owner.name}</span>
                        </div>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>

            {selectedRole && (
              <div className="p-3 rounded-md bg-[hsl(var(--muted))] text-sm">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <span className="font-medium">Selected role:</span>
                  <span>{selectedRole.name}</span>
                </div>
                {selectedProfile && (
                  <div className="flex items-center gap-2 mt-1">
                    <FolderOpen className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                    <span className="font-medium">Profile:</span>
                    <span>{selectedProfile.name}</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowRequestDialog(false);
              setSelectedRole(null);
              setSelectedProfile(null);
              setRoleSearch('');
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleRequestRole}
              disabled={!selectedRole || submitting}
              className="gap-2"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
