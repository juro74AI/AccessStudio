'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/components/login-page';
import { supabase } from '@/lib/supabase';
import { Profile, Role, Validation, ProfileStatus } from '@/lib/types';
import { computeProfileStatus, STATUS_LABELS, STATUS_COLORS, STATUS_DOT_COLORS } from '@/lib/status-engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Send,
  Search,
  FolderOpen,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { format } from 'date-fns';

interface ProfileWithDetails {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
  profile_roles: { role_id: string }[];
  validations: { status: string }[];
}

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState<ProfileWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select(`
        *,
        profile_roles(role_id),
        validations(status)
      `)
      .eq('creator_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load profiles');
    } else {
      setProfiles((data || []) as ProfileWithDetails[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from('profiles').delete().eq('id', deleteId);
    if (error) {
      toast.error('Failed to delete profile');
    } else {
      toast.success('Profile deleted');
      setProfiles(prev => prev.filter(p => p.id !== deleteId));
    }
    setDeleteId(null);
  };

  const handleSubmitForApproval = async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    if (!profile.profile_roles || profile.profile_roles.length === 0) {
      toast.error('Add at least one role before submitting');
      return;
    }

    // Get roles with owner info
    const roleIds = profile.profile_roles.map(pr => pr.role_id);
    const { data: roles } = await supabase
      .from('roles')
      .select('id, owner_id')
      .in('id', roleIds);

    if (!roles || roles.length === 0) {
      toast.error('No valid roles found');
      return;
    }

    // Create validation entries
    const validations = roles.map(role => ({
      profile_id: profileId,
      role_id: role.id,
      owner_id: role.owner_id,
      status: 'pending',
    }));

    const { error: valError } = await supabase.from('validations').insert(validations);
    if (valError) {
      toast.error('Failed to create validations');
      return;
    }

    // Update profile status
    const { error: profError } = await supabase
      .from('profiles')
      .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
      .eq('id', profileId);

    if (profError) {
      toast.error('Failed to update profile');
    } else {
      toast.success('Profile submitted for approval');
      fetchProfiles();
    }
  };

  const filteredProfiles = profiles.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: profiles.length,
    drafts: profiles.filter(p => p.status === 'draft').length,
    pending: profiles.filter(p => p.status === 'pending_approval').length,
    approved: profiles.filter(p => p.status === 'approved').length,
  };

  if (authLoading) return null;
  if (!user) return <LoginPage />;
  if (user.persona !== 'manager') return <LoginPage />;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Access Profiles</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
              Manage and track your team&apos;s access profiles
            </p>
          </div>
          <Link href="/dashboard/create">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Profile
            </Button>
          </Link>
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
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Total Profiles</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.drafts}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Drafts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Pending</p>
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
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">All Profiles</CardTitle>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <Input
                  placeholder="Search profiles..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-6 w-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
                <FolderOpen className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">No profiles found</p>
                <Link href="/dashboard/create">
                  <Button variant="link" className="mt-2">Create your first profile</Button>
                </Link>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProfiles.map((profile) => (
                    <TableRow key={profile.id} className="group">
                      <TableCell>
                        <Link href={`/dashboard/${profile.id}`} className="hover:underline">
                          <p className="font-medium text-sm">{profile.name}</p>
                          {profile.description && (
                            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">{profile.description}</p>
                          )}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {profile.profile_roles?.length || 0} roles
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`status-badge ${STATUS_COLORS[profile.status]}`}>
                          <span className={`status-dot ${STATUS_DOT_COLORS[profile.status]}`} />
                          {STATUS_LABELS[profile.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                        {format(new Date(profile.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/dashboard/${profile.id}`}>
                                <Eye className="h-4 w-4 mr-2" /> View Details
                              </Link>
                            </DropdownMenuItem>
                            {profile.status === 'draft' && (
                              <>
                                <DropdownMenuItem asChild>
                                  <Link href={`/dashboard/${profile.id}/edit`}>
                                    <Pencil className="h-4 w-4 mr-2" /> Edit
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleSubmitForApproval(profile.id)}>
                                  <Send className="h-4 w-4 mr-2" /> Submit for Approval
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => setDeleteId(profile.id)}
                              className="text-red-600 focus:text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Profile</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this profile? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
