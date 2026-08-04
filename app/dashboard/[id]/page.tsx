'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/components/login-page';
import { supabase } from '@/lib/supabase';
import { Profile, Role, Validation, User as UserType, AccessAudit, AccessRequest } from '@/lib/types';
import { computeProfileStatus, STATUS_LABELS, STATUS_COLORS, STATUS_DOT_COLORS, VALIDATION_LABELS, VALIDATION_COLORS, VALIDATION_DOT_COLORS } from '@/lib/status-engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
// Progress component causes SSR build issues, using inline version
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Calendar,
  Send,
  Pencil,
  Shield,
  User,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Folder,
  FileText,
  History,
  Plus,
} from 'lucide-react';
import { AddAccessDialog } from '@/components/add-access-dialog';
import { toast } from 'sonner';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';

interface ProfileDetail extends Profile {
  creator: UserType;
}

export default function ProfileDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const profileId = params.id as string;
  const [profile, setProfile] = useState<ProfileDetail | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [validations, setValidations] = useState<Validation[]>([]);
  const [accessAudits, setAccessAudits] = useState<AccessAudit[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDialogOpen, setAccessDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const [profileRes, rolesRes, validationsRes, auditsRes, reqsRes] = await Promise.all([
      supabase.from('profiles').select('*, creator:users!profiles_creator_id_fkey(*)').eq('id', profileId).single(),
      supabase.from('profile_roles').select('*, role:roles(*, owner:users!roles_owner_id_fkey(*))').eq('profile_id', profileId),
      supabase.from('validations').select('*, role:roles(*), owner:users!validations_owner_id_fkey(*)').eq('profile_id', profileId).order('created_at'),
      supabase.from('access_audit').select('*, requester:users!access_audit_requester_id_fkey(*), approver:users!access_audit_approver_id_fkey(*), resource:fga_resources(*)').eq('profile_id', profileId).order('created_at', { ascending: false }),
      supabase.from('access_requests').select('*, resource:fga_resources(*), requester:users!access_requests_requested_by_fkey(*), owner:users!access_requests_owner_id_fkey(*)').eq('profile_id', profileId).order('created_at', { ascending: false }),
    ]);

    if (profileRes.data) setProfile(profileRes.data as ProfileDetail);
    if (rolesRes.data) setRoles(rolesRes.data.map((pr: any) => pr.role));
    if (validationsRes.data) setValidations(validationsRes.data as Validation[]);
    if (auditsRes.data) setAccessAudits(auditsRes.data as AccessAudit[]);
    if (reqsRes.data) setAccessRequests(reqsRes.data as AccessRequest[]);
    setLoading(false);
  }, [profileId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmitForApproval = async () => {
    if (roles.length === 0) {
      toast.error('Add at least one role before submitting');
      return;
    }

    const validationEntries = roles.map(role => ({
      profile_id: profileId,
      role_id: role.id,
      owner_id: role.owner_id,
      status: 'pending',
    }));

    const { error: valError } = await supabase.from('validations').insert(validationEntries);
    if (valError) {
      toast.error('Failed to create validations');
      return;
    }

    await supabase
      .from('profiles')
      .update({ status: 'pending_approval', updated_at: new Date().toISOString() })
      .eq('id', profileId);

    toast.success('Profile submitted for approval');
    fetchData();
  };

  const approvedCount = validations.filter(v => v.status === 'approved').length;
  const totalCount = validations.length;
  const progressPct = totalCount > 0 ? (approvedCount / totalCount) * 100 : 0;

  if (authLoading) return null;
  if (!user || user.persona !== 'manager') return <LoginPage />;

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="text-center py-20 text-[hsl(var(--muted-foreground))]">Profile not found</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{profile.name}</h1>
              {profile.description && (
                <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">{profile.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`status-badge ${STATUS_COLORS[profile.status]}`}>
              <span className={`status-dot ${STATUS_DOT_COLORS[profile.status]}`} />
              {STATUS_LABELS[profile.status]}
            </span>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAccessDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Access
            </Button>
            {profile.status === 'draft' && (
              <>
                <Link href={`/dashboard/${profile.id}/edit`}>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                </Link>
                <Button size="sm" className="gap-1.5" onClick={handleSubmitForApproval}>
                  <Send className="h-3.5 w-3.5" /> Submit for Approval
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Meta info */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                <Calendar className="h-4 w-4" />
                Created {format(new Date(profile.created_at), 'MMM d, yyyy')}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                <Shield className="h-4 w-4" />
                {roles.length} role{roles.length !== 1 ? 's' : ''}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
                <User className="h-4 w-4" />
                Created by {profile.creator?.name}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Approval Progress */}
        {validations.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Approval Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>{approvedCount} of {totalCount} approved</span>
                <span className="text-[hsl(var(--muted-foreground))]">{Math.round(progressPct)}%</span>
              </div>
              <div className="relative h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--secondary))]">
                <div
                  className="h-full bg-[hsl(var(--primary))] transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Roles and Validation Status */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Roles & Validation Status</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {roles.length === 0 ? (
              <div className="text-center py-8 text-[hsl(var(--muted-foreground))] text-sm">
                No roles assigned to this profile
              </div>
            ) : (
              <div className="divide-y">
                {roles.map(role => {
                  const validation = validations.find(v => v.role_id === role.id);
                  return (
                    <div key={role.id} className="flex items-center gap-4 px-6 py-4">
                      <div className="h-9 w-9 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center shrink-0">
                        <Shield className="h-4 w-4 text-[hsl(var(--primary))]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{role.name}</p>
                        {role.description && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">{role.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {role.owner && (
                          <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[8px] bg-[hsl(var(--muted))]">
                                {role.owner.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span className="hidden sm:inline">{role.owner.name}</span>
                          </div>
                        )}
                        {validation ? (
                          <span className={`status-badge ${VALIDATION_COLORS[validation.status]}`}>
                            <span className={`status-dot ${VALIDATION_DOT_COLORS[validation.status]}`} />
                            {VALIDATION_LABELS[validation.status]}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-xs text-[hsl(var(--muted-foreground))]">
                            Not submitted
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resource Access Audit Trail */}
        {(accessAudits.length > 0 || accessRequests.length > 0) && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[hsl(var(--primary))]" />
                <CardTitle className="text-base">Access Audit Trail</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {/* Pending access requests */}
                {accessRequests.filter(r => r.status === 'pending').map(req => (
                  <div key={`req-${req.id}`} className="flex items-start gap-4 px-6 py-4">
                    <div className="mt-0.5">
                      <Clock className="h-5 w-5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{req.resource?.name || req.resource_type}</p>
                        <Badge variant="secondary" className="text-xs">{req.relation_label}</Badge>
                        <span className="status-badge text-xs status-pending">Pending approval</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        <span>Requested by {req.requester?.name}</span>
                        <span>&middot;</span>
                        <span>{format(new Date(req.created_at), 'MMM d, yyyy HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {/* Written tuples (audit log) */}
                {accessAudits.map(audit => (
                  <div key={`audit-${audit.id}`} className="flex items-start gap-4 px-6 py-4">
                    <div className="mt-0.5">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{audit.resource?.name || audit.tuple_object}</p>
                        <Badge variant="secondary" className="text-xs capitalize">{audit.tuple_relation}</Badge>
                        <span className="status-badge text-xs status-approved">Written</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        <span>Requested by {audit.requester?.name}</span>
                        {audit.approver && (
                          <>
                            <span>&middot;</span>
                            <span>Approved by {audit.approver?.name}</span>
                          </>
                        )}
                        <span>&middot;</span>
                        <span>{format(new Date(audit.created_at), 'MMM d, yyyy HH:mm')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Validation History */}
        {validations.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Validation History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {validations.map(v => (
                  <div key={v.id} className="flex items-start gap-4 px-6 py-4">
                    <div className="mt-0.5">
                      {v.status === 'approved' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : v.status === 'rejected' ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-amber-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{v.role?.name}</p>
                        <span className={`status-badge text-[10px] py-0 px-1.5 ${VALIDATION_COLORS[v.status]}`}>
                          {VALIDATION_LABELS[v.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                        <span>By {v.owner?.name}</span>
                        <span>&middot;</span>
                        <span>{format(new Date(v.updated_at), 'MMM d, yyyy HH:mm')}</span>
                      </div>
                      {v.comment && (
                        <div className="flex items-start gap-2 mt-2 p-2.5 rounded-md bg-[hsl(var(--muted))] text-xs">
                          <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[hsl(var(--muted-foreground))]" />
                          <span>{v.comment}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AddAccessDialog
        open={accessDialogOpen}
        onOpenChange={setAccessDialogOpen}
        profile={profile}
        onAccessGranted={fetchData}
      />
    </AppShell>
  );
}
