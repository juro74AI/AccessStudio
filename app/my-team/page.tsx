'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/components/login-page';
import { supabase } from '@/lib/supabase';
import { Profile, User as UserType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Users,
  Search,
  Briefcase,
  MapPin,
  Calendar,
  Building2,
  Shield,
  ChevronRight,
  CheckCircle2,
  UserCircle,
  Loader2,
  Plus,
  Link2,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface TeamMember {
  id: string;
  user_id: string;
  employee_id: string;
  department: string;
  job_title: string;
  hire_date: string;
  contract_type: string;
  manager_id: string | null;
  location: string | null;
  created_at: string;
  updated_at: string;
  user: UserType;
  manager?: UserType | null;
  user_profiles: { id: string; profile_id: string; profile: Profile }[];
}

interface AssignProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: TeamMember | null;
  profiles: Profile[];
  onAssign: (profileId: string) => Promise<void>;
}

function AssignProfileDialog({ open, onOpenChange, member, profiles, onAssign }: AssignProfileDialogProps) {
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const assignedProfileIds = new Set(member?.user_profiles?.map((up) => up.profile_id) || []);
  const availableProfiles = profiles.filter((p) => !assignedProfileIds.has(p.id));

  const handleAssign = async () => {
    if (!selectedProfile) return;
    setSubmitting(true);
    await onAssign(selectedProfile);
    setSubmitting(false);
    setSelectedProfile(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Associate a Profile</DialogTitle>
          <DialogDescription>
            Select a profile to assign to {member?.user?.name}. This grants the user all roles within that profile.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
          {availableProfiles.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))] text-center py-4">
              All profiles are already assigned to this person
            </p>
          ) : (
            availableProfiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => setSelectedProfile(profile.id)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedProfile === profile.id
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5'
                    : 'border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/50'
                }`}
              >
                <p className="text-sm font-medium">{profile.name}</p>
                {profile.description && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">{profile.description}</p>
                )}
              </button>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleAssign} disabled={!selectedProfile || submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Assign Profile
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function MyTeamPage() {
  const { user, loading: authLoading } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [assignDialog, setAssignDialog] = useState<{ member: TeamMember | null; open: boolean }>({ member: null, open: false });
  const [expandedMember, setExpandedMember] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [hrRes, profilesRes] = await Promise.all([
      supabase
        .from('hr_employees')
        .select('*, user:users!hr_employees_user_id_fkey(*), manager:users!hr_employees_manager_id_fkey(*), user_profiles(profile:profiles(*))')
        .eq('manager_id', user.id)
        .order('created_at'),
      supabase
        .from('profiles')
        .select('*')
        .order('name'),
    ]);

    if (hrRes.data) setMembers(hrRes.data as unknown as TeamMember[]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssignProfile = async (profileId: string) => {
    if (!assignDialog.member || !user) return;
    const { error } = await supabase.from('user_profiles').insert({
      user_id: assignDialog.member.user_id,
      profile_id: profileId,
      assigned_by: user.id,
    });
    if (error) {
      if (error.code === '23505') {
        toast.error('This profile is already assigned');
      } else {
        toast.error('Failed to assign profile');
      }
      return;
    }
    toast.success(`Profile assigned to ${assignDialog.member.user.name}`);
    fetchData();
  };

  const handleRemoveProfile = async (userProfileId: string, memberName: string, profileName: string) => {
    const { error } = await supabase.from('user_profiles').delete().eq('id', userProfileId);
    if (error) {
      toast.error('Failed to remove profile');
      return;
    }
    toast.success(`Profile "${profileName}" removed from ${memberName}`);
    fetchData();
  };

  const departments = Array.from(new Set(members.map((m) => m.department))).sort();
  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.user.name.toLowerCase().includes(search.toLowerCase()) ||
      m.job_title.toLowerCase().includes(search.toLowerCase()) ||
      m.employee_id.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'all' || m.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  const stats = {
    total: members.length,
    byDept: departments.reduce<Record<string, number>>((acc, d) => {
      acc[d] = members.filter((m) => m.department === d).length;
      return acc;
    }, {}),
    withProfiles: members.filter((m) => (m.user_profiles?.length || 0) > 0).length,
  };

  if (authLoading) return null;
  if (!user || user.persona !== 'manager') return <LoginPage />;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Team</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            View your team members and manage their profile assignments
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Team Members</p>
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
                  <p className="text-2xl font-bold">{stats.withProfiles}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">With Profiles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Building2 className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{departments.length}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Departments</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-sky-50 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-sky-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total - stats.withProfiles}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Unassigned</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
            <Input
              placeholder="Search by name, title, or employee ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-[hsl(var(--border))] bg-background text-sm"
          >
            <option value="all">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Team List */}
        <Card className="shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
                <UserCircle className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">No team members found</p>
              </div>
            ) : (
              <div className="divide-y">
                {filteredMembers.map((member) => {
                  const isExpanded = expandedMember === member.user_id;
                  const profileCount = member.user_profiles?.length || 0;
                  return (
                    <div key={member.user_id}>
                      {/* Member row */}
                      <button
                        onClick={() => setExpandedMember(isExpanded ? null : member.user_id)}
                        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-[hsl(var(--muted))]/30 transition-colors text-left"
                      >
                        <Avatar className="h-10 w-10 shrink-0">
                          <AvatarFallback className="text-sm font-semibold bg-[hsl(var(--primary))] text-white">
                            {member.user.name.split(' ').map((n) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{member.user.name}</p>
                            <Badge variant="secondary" className="text-xs">{member.employee_id}</Badge>
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-[hsl(var(--muted-foreground))] flex-wrap">
                            <span className="flex items-center gap-1">
                              <Briefcase className="h-3 w-3" />
                              {member.job_title}
                            </span>
                            <span className="flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {member.department}
                            </span>
                            {member.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {member.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {profileCount > 0 ? (
                            <Badge variant="outline" className="text-xs gap-1 border-emerald-200 text-emerald-700 bg-emerald-50">
                              <CheckCircle2 className="h-3 w-3" />
                              {profileCount} profile{profileCount > 1 ? 's' : ''}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-[hsl(var(--muted-foreground))]">
                              No profile
                            </Badge>
                          )}
                          <ChevronRight className={`h-4 w-4 text-[hsl(var(--muted-foreground))] transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </div>
                      </button>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-6 pb-5 bg-[hsl(var(--muted))]/20 border-t border-[hsl(var(--border))]">
                          <div className="grid md:grid-cols-3 gap-4 pt-4">
                            {/* HR Info */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">HR Information</p>
                              <div className="space-y-1.5 text-sm">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                                  <span className="text-[hsl(var(--muted-foreground))]">Hired:</span>
                                  <span>{format(new Date(member.hire_date), 'MMM d, yyyy')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Briefcase className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                                  <span className="text-[hsl(var(--muted-foreground))]">Contract:</span>
                                  <span>{member.contract_type}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                                  <span className="text-[hsl(var(--muted-foreground))]">Dept:</span>
                                  <span>{member.department}</span>
                                </div>
                                {member.location && (
                                  <div className="flex items-center gap-2">
                                    <MapPin className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                                    <span className="text-[hsl(var(--muted-foreground))]">Location:</span>
                                    <span>{member.location}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Contact */}
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Contact</p>
                              <div className="space-y-1.5 text-sm">
                                <p className="text-[hsl(var(--muted-foreground))]">{member.user.email}</p>
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">Employee ID: {member.employee_id}</p>
                              </div>
                            </div>

                            {/* Profile Assignment */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Assigned Profiles</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 text-xs gap-1 px-2"
                                  onClick={() => setAssignDialog({ member, open: true })}
                                >
                                  <Plus className="h-3 w-3" />
                                  Add
                                </Button>
                              </div>
                              {profileCount === 0 ? (
                                <p className="text-sm text-[hsl(var(--muted-foreground))]">No profiles assigned</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {member.user_profiles.map((up) => (
                                    <div key={up.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-white border border-[hsl(var(--border))]">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Shield className="h-3.5 w-3.5 text-[hsl(var(--primary))] shrink-0" />
                                        <span className="text-sm font-medium truncate">{up.profile.name}</span>
                                      </div>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-[hsl(var(--muted-foreground))] hover:text-red-600 shrink-0"
                                        onClick={() => handleRemoveProfile(up.id, member.user.name, up.profile.name)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AssignProfileDialog
        open={assignDialog.open}
        onOpenChange={(open) => setAssignDialog((prev) => ({ ...prev, open }))}
        member={assignDialog.member}
        profiles={profiles}
        onAssign={handleAssignProfile}
      />
    </AppShell>
  );
}
