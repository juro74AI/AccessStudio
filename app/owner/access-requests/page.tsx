'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { AppShell } from '@/components/app-shell';
import { LoginPage } from '@/components/login-page';
import { supabase } from '@/lib/supabase';
import { AccessRequest, Profile, FGAResource, User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Shield,
  Folder,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  Check,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { buildTeamUserString, buildObjectString, writeTuple, checkAccess } from '@/lib/openfga';

export default function AccessRequestsPage() {
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisionDialog, setDecisionDialog] = useState<{ request: AccessRequest; action: 'approve' | 'reject' } | null>(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [checkResults, setCheckResults] = useState<Record<string, { allowed: boolean; explanation: string }>>({});

  const fetchRequests = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('access_requests')
      .select(`
        *,
        profile:profiles(*),
        resource:fga_resources(*),
        requester:users!access_requests_requested_by_fkey(*),
        owner:users!access_requests_owner_id_fkey(*)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load access requests');
    } else if (data) {
      setRequests(data as AccessRequest[]);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  const handleDecision = async () => {
    if (!decisionDialog || !user) return;
    setProcessing(true);

    const { request, action } = decisionDialog;
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { error } = await supabase
      .from('access_requests')
      .update({
        status: newStatus,
        owner_comment: comment || null,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (error) {
      toast.error('Failed to update request');
      setProcessing(false);
      return;
    }

    if (action === 'approve') {
      // Write the tuple to OpenFGA
      const tupleUser = buildTeamUserString(request.profile_id);
      const tupleObject = buildObjectString(request.resource_type, request.resource_id);

      const writeResult = await writeTuple(
        {
          user: tupleUser,
          relation: request.relation,
          object: tupleObject,
        },
        {
          requester_id: request.requested_by,
          approver_id: user.id,
          profile_id: request.profile_id,
          resource_id: request.resource_id,
          resource_type: request.resource_type,
        }
      );

      if (writeResult.success) {
        // Mark tuple as written
        await supabase
          .from('access_requests')
          .update({ tuple_written: true })
          .eq('id', request.id);

        // Run Check to verify
        const check = await checkAccess({
          user: tupleUser,
          relation: request.relation,
          object: tupleObject,
        });

        setCheckResults(prev => ({
          ...prev,
          [request.id]: { allowed: check.allowed, explanation: check.explanation },
        }));

        toast.success('Access approved and tuple written');
      } else {
        toast.error('Approved but failed to write tuple');
      }
    } else {
      toast.success('Request rejected');
    }

    setDecisionDialog(null);
    setComment('');
    setProcessing(false);
    fetchRequests();
  };

  if (authLoading) return null;
  if (!user || user.persona !== 'owner') return <LoginPage />;

  if (loading) {
    return (
      <AppShell>
        <div className="flex justify-center py-20">
          <div className="h-8 w-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    );
  }

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const decidedRequests = requests.filter(r => r.status !== 'pending');

  const resourceIcon = (type: string) => {
    if (type === 'folder') return <Folder className="h-4 w-4 text-amber-500" />;
    if (type === 'document') return <FileText className="h-4 w-4 text-blue-500" />;
    return <FileText className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />;
  };

  return (
    <AppShell>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Access Requests</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Review and approve access requests from managers
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
                  <p className="text-2xl font-bold">{pendingRequests.length}</p>
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
                  <p className="text-2xl font-bold">{requests.filter(r => r.status === 'approved').length}</p>
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
                  <p className="text-2xl font-bold">{requests.filter(r => r.status === 'rejected').length}</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Requests */}
        {pendingRequests.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pending Approval</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {pendingRequests.map(req => (
                  <div key={req.id} className="px-6 py-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                        {resourceIcon(req.resource_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{req.resource?.name || req.resource_type}</p>
                          <Badge variant="secondary" className="text-xs">{req.relation_label}</Badge>
                          <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-700 bg-amber-50">
                            <Lock className="h-3 w-3" />
                            Approval needed
                          </Badge>
                        </div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                          Team &ldquo;{req.profile?.name}&rdquo; requested by {req.requester?.name} on{' '}
                          {format(new Date(req.created_at), 'MMM d, yyyy HH:mm')}
                        </p>
                        {req.manager_comment && (
                          <div className="mt-2 p-2.5 rounded-md bg-[hsl(var(--muted))] text-xs">
                            <span className="font-medium">Comment: </span>
                            {req.manager_comment}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => { setDecisionDialog({ request: req, action: 'reject' }); setComment(''); }}
                        >
                          <X className="h-3.5 w-3.5" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="gap-1.5"
                          onClick={() => { setDecisionDialog({ request: req, action: 'approve' }); setComment(''); }}
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Decided Requests */}
        {decidedRequests.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {decidedRequests.map(req => {
                  const checkResult = checkResults[req.id];
                  return (
                    <div key={req.id} className="px-6 py-4">
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5">
                          {req.status === 'approved' ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">{req.resource?.name || req.resource_type}</p>
                            <Badge variant="secondary" className="text-xs">{req.relation_label}</Badge>
                            <span className={`status-badge text-xs ${req.status === 'approved' ? 'status-approved' : 'status-rejected'}`}>
                              {req.status}
                            </span>
                          </div>
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">
                            Team &ldquo;{req.profile?.name}&rdquo; &middot; {req.requester?.name} &middot;{' '}
                            {req.decided_at ? format(new Date(req.decided_at), 'MMM d, yyyy HH:mm') : ''}
                          </p>
                          {req.owner_comment && (
                            <div className="mt-2 p-2.5 rounded-md bg-[hsl(var(--muted))] text-xs">
                              <span className="font-medium">Decision comment: </span>
                              {req.owner_comment}
                            </div>
                          )}
                          {req.status === 'approved' && checkResult && (
                            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700">
                              <Shield className="h-3.5 w-3.5" />
                              <span>{checkResult.explanation}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {requests.length === 0 && (
          <Card className="shadow-sm">
            <CardContent className="py-12 text-center">
              <Shield className="h-10 w-10 mx-auto mb-3 text-[hsl(var(--muted-foreground))] opacity-40" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">No access requests yet</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Decision Dialog */}
      <Dialog open={!!decisionDialog} onOpenChange={() => setDecisionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {decisionDialog?.action === 'approve' ? 'Approve Access Request' : 'Reject Access Request'}
            </DialogTitle>
            <DialogDescription>
              {decisionDialog?.action === 'approve'
                ? 'The access tuple will be written to OpenFGA upon approval.'
                : 'No tuple will be written. The request will be marked as rejected.'}
            </DialogDescription>
          </DialogHeader>
          {decisionDialog && (
            <div className="space-y-3 py-2">
              <div className="p-3 rounded-lg bg-[hsl(var(--muted))] text-sm">
                <p><span className="font-medium">Team:</span> {decisionDialog.request.profile?.name}</p>
                <p><span className="font-medium">Resource:</span> {decisionDialog.request.resource?.name}</p>
                <p><span className="font-medium">Access level:</span> {decisionDialog.request.relation_label}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Comment (optional)</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Add a comment..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDialog(null)}>Cancel</Button>
            <Button
              variant={decisionDialog?.action === 'approve' ? 'default' : 'destructive'}
              onClick={handleDecision}
              disabled={processing}
            >
              {processing ? 'Processing...' : decisionDialog?.action === 'approve' ? 'Approve & Write Tuple' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
