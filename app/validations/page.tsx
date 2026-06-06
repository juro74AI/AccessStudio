'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/components/login-page';
import { supabase } from '@/lib/supabase';
import { Validation, Profile, Role } from '@/lib/types';
import { VALIDATION_LABELS, VALIDATION_COLORS, VALIDATION_DOT_COLORS, STATUS_LABELS, STATUS_COLORS, STATUS_DOT_COLORS } from '@/lib/status-engine';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Search,
  Shield,
  CheckSquare,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { computeProfileStatus } from '@/lib/status-engine';

export default function ValidationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [actionDialog, setActionDialog] = useState<{
    validation: Validation;
    action: 'approve' | 'reject';
  } | null>(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchValidations = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('validations')
      .select('*, profile:profiles(*, creator:users!profiles_creator_id_fkey(*)), role:roles(*), owner:users!validations_owner_id_fkey(*)')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load validations');
    } else {
      setValidations((data || []) as Validation[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchValidations();
  }, [fetchValidations]);

  const handleAction = async () => {
    if (!actionDialog) return;
    setProcessing(true);

    const newStatus = actionDialog.action === 'approve' ? 'approved' : 'rejected';

    const { error } = await supabase
      .from('validations')
      .update({
        status: newStatus,
        comment: comment.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionDialog.validation.id);

    if (error) {
      toast.error('Failed to update validation');
      setProcessing(false);
      return;
    }

    // Recalculate profile status
    const profileId = actionDialog.validation.profile_id;

    const { data: allValidations } = await supabase
      .from('validations')
      .select('status')
      .eq('profile_id', profileId);

    if (allValidations && allValidations.length > 0) {
      const newProfileStatus = computeProfileStatus(allValidations);
      await supabase
        .from('profiles')
        .update({ status: newProfileStatus, updated_at: new Date().toISOString() })
        .eq('id', profileId);
    }

    toast.success(newStatus === 'approved' ? 'Role approved' : 'Role rejected');
    setActionDialog(null);
    setComment('');
    setProcessing(false);
    fetchValidations();
  };

  const filteredValidations = validations.filter(v => {
    if (filter !== 'all' && v.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        v.profile?.name?.toLowerCase().includes(s) ||
        v.role?.name?.toLowerCase().includes(s) ||
        (v.profile?.description || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const pendingCount = validations.filter(v => v.status === 'pending').length;
  const approvedCount = validations.filter(v => v.status === 'approved').length;
  const rejectedCount = validations.filter(v => v.status === 'rejected').length;

  if (authLoading) return null;
  if (!user || user.persona !== 'owner') return <LoginPage />;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Validation Requests</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Review and approve role assignments in access profiles
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
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
                  <p className="text-2xl font-bold">{approvedCount}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-red-50 flex items-center justify-center">
                  <XCircle className="h-4 w-4 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{rejectedCount}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filter tabs and table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                  <Button
                    key={f}
                    variant={filter === f ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter(f)}
                    className="capitalize"
                  >
                    {f === 'all' && <FileCheck className="h-3.5 w-3.5 mr-1.5" />}
                    {f === 'pending' && <Clock className="h-3.5 w-3.5 mr-1.5" />}
                    {f === 'approved' && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    {f === 'rejected' && <XCircle className="h-3.5 w-3.5 mr-1.5" />}
                    {f}
                    {f === 'pending' && pendingCount > 0 && (
                      <Badge className="ml-1.5 h-5 min-w-[20px] px-1 text-[10px] bg-amber-500 text-white">
                        {pendingCount}
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-8 text-sm"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-6 w-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filteredValidations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
                <CheckSquare className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">No validation requests found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profile</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Requester</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredValidations.map(v => (
                    <TableRow key={v.id} className={v.status === 'pending' ? 'bg-amber-50/30' : ''}>
                      <TableCell>
                        <p className="text-sm font-medium">{v.profile?.name}</p>
                        {v.profile?.description && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5 line-clamp-1">{v.profile.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                          <span className="text-sm">{v.role?.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                        {(v.profile as any)?.creator?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <span className={`status-badge ${VALIDATION_COLORS[v.status]}`}>
                          <span className={`status-dot ${VALIDATION_DOT_COLORS[v.status]}`} />
                          {VALIDATION_LABELS[v.status]}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                        {format(new Date(v.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {v.status === 'pending' ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => setActionDialog({ validation: v, action: 'approve' })}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setActionDialog({ validation: v, action: 'reject' })}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : v.comment ? (
                          <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span className="text-xs truncate max-w-[80px]">{v.comment}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setComment(''); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === 'approve' ? 'Approve Role' : 'Reject Role'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === 'approve'
                ? `You are approving the use of "${actionDialog?.validation.role?.name}" in profile "${actionDialog?.validation.profile?.name}".`
                : `You are rejecting the use of "${actionDialog?.validation.role?.name}" in profile "${actionDialog?.validation.profile?.name}".`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {actionDialog?.validation.role && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-[hsl(var(--muted))]">
                <Shield className="h-5 w-5 text-[hsl(var(--primary))]" />
                <div>
                  <p className="text-sm font-medium">{actionDialog.validation.role.name}</p>
                  {actionDialog.validation.role.description && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{actionDialog.validation.role.description}</p>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Comment (optional)</label>
              <Textarea
                placeholder={actionDialog?.action === 'reject' ? 'Explain why this role is being rejected...' : 'Add a comment...'}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setComment(''); }}>Cancel</Button>
            <Button
              variant={actionDialog?.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleAction}
              disabled={processing}
              className="gap-1.5"
            >
              {actionDialog?.action === 'approve' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {actionDialog?.action === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
