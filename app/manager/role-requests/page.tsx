'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/components/login-page';
import { supabase } from '@/lib/supabase';
import { Role, User, RequestStatus } from '@/lib/types';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Inbox,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  Shield,

  MessageSquare,
  Loader2,
  CheckSquare,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface RoleRequestWithDetails {
  id: string;
  user_id: string;
  role_id: string;
  profile_id: string | null;
  status: RequestStatus;
  manager_comment: string | null;
  manager_decided_at: string | null;
  owner_comment: string | null;
  owner_decided_at: string | null;
  created_at: string;
  updated_at: string;
  role: Role;
  user: User;
  profile: { name: string } | null;
}

export default function ManagerRoleRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<RoleRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending_manager' | 'manager_approved' | 'approved' | 'rejected'>('all');
  const [actionDialog, setActionDialog] = useState<{
    request: RoleRequestWithDetails;
    action: 'approve' | 'reject';
  } | null>(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('role_requests')
      .select('*, role:roles(*, owner:users!roles_owner_id_fkey(*)), user:users(*), profile:profiles(name)')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load role requests');
    } else {
      setRequests((data || []) as RoleRequestWithDetails[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleAction = async () => {
    if (!actionDialog || !user) return;
    setProcessing(true);

    const newStatus = actionDialog.action === 'approve' ? 'manager_approved' : 'rejected';

    const { error } = await supabase
      .from('role_requests')
      .update({
        status: newStatus,
        manager_comment: comment.trim() || null,
        manager_decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionDialog.request.id);

    if (error) {
      toast.error('Failed to update request');
      setProcessing(false);
      return;
    }

    toast.success(actionDialog.action === 'approve' ? 'Request approved' : 'Request rejected');
    setActionDialog(null);
    setComment('');
    setProcessing(false);
    fetchRequests();
  };

  const filteredRequests = requests.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        r.role.name.toLowerCase().includes(s) ||
        r.user.name.toLowerCase().includes(s) ||
        (r.profile?.name || '').toLowerCase().includes(s)
      );
    }
    return true;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter(r => r.status === 'pending_manager').length,
    managerApproved: requests.filter(r => r.status === 'manager_approved').length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  };

  const getStatusBadge = (status: string) => {
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
  if (!user || user.persona !== 'manager') return <LoginPage />;

  return (
    <AppShell>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Role Requests</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Review and approve role requests submitted by users
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="shadow-sm">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-[hsl(var(--primary))]/10 flex items-center justify-center">
                  <Inbox className="h-4 w-4 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Total</p>
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
                  <p className="text-2xl font-bold">{stats.pending}</p>
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
                  <p className="text-2xl font-bold">{stats.managerApproved}</p>
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
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Fully Approved</p>
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
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                {(['all', 'pending_manager', 'manager_approved', 'approved', 'rejected'] as const).map(f => (
                  <Button
                    key={f}
                    variant={filter === f ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setFilter(f)}
                    className="capitalize"
                  >
                    {f === 'all' && <Inbox className="h-3.5 w-3.5 mr-1.5" />}
                    {f === 'pending_manager' && <Clock className="h-3.5 w-3.5 mr-1.5" />}
                    {f === 'manager_approved' && <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />}
                    {f === 'approved' && <CheckSquare className="h-3.5 w-3.5 mr-1.5" />}
                    {f === 'rejected' && <XCircle className="h-3.5 w-3.5 mr-1.5" />}
                    {f === 'pending_manager' ? 'Pending' : f === 'manager_approved' ? 'Manager Approved' : f}
                    {f === 'pending_manager' && stats.pending > 0 && (
                      <Badge className="ml-1.5 h-5 min-w-[20px] px-1 text-[10px] bg-amber-500 text-white">
                        {stats.pending}
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
            ) : filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--muted-foreground))]">
                <CheckSquare className="h-10 w-10 mb-3 opacity-50" />
                <p className="text-sm">No role requests found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Profile</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="w-28">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map(req => (
                    <TableRow key={req.id} className={req.status === 'pending_manager' ? 'bg-amber-50/30' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[8px] bg-[hsl(var(--muted))]">
                              {req.user.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{req.user.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Shield className="h-3.5 w-3.5 text-[hsl(var(--muted-foreground))]" />
                          <span className="text-sm">{req.role.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                        {req.profile?.name || '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(req.status)}</TableCell>
                      <TableCell className="text-sm text-[hsl(var(--muted-foreground))]">
                        {format(new Date(req.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        {req.status === 'pending_manager' ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                              onClick={() => setActionDialog({ request: req, action: 'approve' })}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => setActionDialog({ request: req, action: 'reject' })}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : req.manager_comment ? (
                          <div className="flex items-center gap-1 text-[hsl(var(--muted-foreground))]">
                            <MessageSquare className="h-3.5 w-3.5" />
                            <span className="text-xs truncate max-w-[80px]">{req.manager_comment}</span>
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
              {actionDialog?.action === 'approve' ? 'Approve Role Request' : 'Reject Role Request'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === 'approve'
                ? `You are approving the request for "${actionDialog?.request.role?.name}" from ${actionDialog?.request.user?.name}. It will be forwarded to the role owner for final validation.`
                : `You are rejecting the request for "${actionDialog?.request.role?.name}" from ${actionDialog?.request.user?.name}.`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {actionDialog?.request.role && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-[hsl(var(--muted))]">
                <Shield className="h-5 w-5 text-[hsl(var(--primary))]" />
                <div>
                  <p className="text-sm font-medium">{actionDialog.request.role.name}</p>
                  {actionDialog.request.role.description && (
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">{actionDialog.request.role.description}</p>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Comment (optional)</label>
              <Textarea
                placeholder={actionDialog?.action === 'reject' ? 'Explain why this request is being rejected...' : 'Add a comment...'}
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
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  {actionDialog?.action === 'approve' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  {actionDialog?.action === 'approve' ? 'Approve' : 'Reject'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
