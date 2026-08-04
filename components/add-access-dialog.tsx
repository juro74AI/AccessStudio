'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Folder,
  FileText,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  Lock,
  Sparkles,
  ShieldCheck,
  Loader2,
  Info,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { FGAResource, Profile, AccessRequest } from '@/lib/types';
import {
  introspectType,
  getAllResourceTypes,
} from '@/lib/openfga-model';
import type { IntrospectedRelation, IntrospectedType } from '@/lib/openfga-types';
import {
  buildTeamUserString,
  buildObjectString,
  checkAccess,
  writeTuple,
} from '@/lib/openfga';
import { toast } from 'sonner';
import { format } from 'date-fns';

type Step = 'resource' | 'relation' | 'summary' | 'result';

interface AddAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  onAccessGranted?: () => void;
}

export function AddAccessDialog({
  open,
  onOpenChange,
  profile,
  onAccessGranted,
}: AddAccessDialogProps) {
  const [step, setStep] = useState<Step>('resource');
  const [resources, setResources] = useState<FGAResource[]>([]);
  const [loadingResources, setLoadingResources] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedResource, setSelectedResource] = useState<FGAResource | null>(null);
  const [introspected, setIntrospected] = useState<IntrospectedType | null>(null);
  const [selectedRelation, setSelectedRelation] = useState<IntrospectedRelation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkResult, setCheckResult] = useState<{ allowed: boolean; explanation: string } | null>(null);
  const [requestResult, setRequestResult] = useState<{
    type: 'immediate' | 'approval' | 'rejected';
    message: string;
    request?: AccessRequest;
  } | null>(null);

  const resourceTypes = getAllResourceTypes();

  const fetchResources = useCallback(async () => {
    setLoadingResources(true);
    const { data, error } = await supabase
      .from('fga_resources')
      .select('*, owner:users!fga_resources_owner_id_fkey(*)')
      .order('name');

    if (error) {
      toast.error('Failed to load resources');
    } else if (data) {
      setResources(data as FGAResource[]);
    }
    setLoadingResources(false);
  }, []);

  useEffect(() => {
    if (open) {
      fetchResources();
      setStep('resource');
      setSearch('');
      setTypeFilter('all');
      setSelectedResource(null);
      setIntrospected(null);
      setSelectedRelation(null);
      setCheckResult(null);
      setRequestResult(null);
    }
  }, [open, fetchResources]);

  const handleSelectResource = (resource: FGAResource) => {
    setSelectedResource(resource);
    const introspection = introspectType(resource.resource_type);
    setIntrospected(introspection);
    setStep('relation');
  };

  const handleSelectRelation = (relation: IntrospectedRelation) => {
    setSelectedRelation(relation);
    setStep('summary');
  };

  const handleSubmit = async () => {
    if (!selectedResource || !selectedRelation) return;
    setSubmitting(true);
    setCheckResult(null);
    setRequestResult(null);

    const { user } = JSON.parse(localStorage.getItem('auth_user') || '{}');
    const requesterId = user?.id;
    if (!requesterId) {
      toast.error('Authentication error');
      setSubmitting(false);
      return;
    }

    // Check if approval is required
    const requiresApproval = selectedRelation.requiresApproval;

    // Create access request record
    const requestData: Record<string, unknown> = {
      profile_id: profile.id,
      resource_id: selectedResource.id,
      resource_type: selectedResource.resource_type,
      relation: selectedRelation.name,
      relation_label: selectedRelation.label,
      status: requiresApproval ? 'pending' : 'approved',
      requested_by: requesterId,
      owner_id: selectedResource.owner_id,
      requires_approval: requiresApproval,
      tuple_written: false,
    };

    const { data: request, error: reqError } = await supabase
      .from('access_requests')
      .insert(requestData)
      .select('*, profile:profiles(*), resource:fga_resources(*, owner:users!fga_resources_owner_id_fkey(*)), requester:users!access_requests_requested_by_fkey(*), owner:users!access_requests_owner_id_fkey(*)')
      .single();

    if (reqError || !request) {
      toast.error('Failed to create access request');
      setSubmitting(false);
      return;
    }

    const accessRequest = request as AccessRequest;

    if (requiresApproval) {
      // Approval needed — don't write the tuple yet
      setRequestResult({
        type: 'approval',
        message: `Access request submitted. The resource owner (${selectedResource.owner?.name || 'owner'}) has been notified and must approve before the access takes effect.`,
        request: accessRequest,
      });
      setStep('result');
      setSubmitting(false);
      onAccessGranted?.();
      return;
    }

    // No approval needed — write the tuple immediately
    const tupleUser = buildTeamUserString(profile.id);
    const tupleObject = buildObjectString(selectedResource.resource_type, selectedResource.id);

    const writeResult = await writeTuple(
      {
        user: tupleUser,
        relation: selectedRelation.name,
        object: tupleObject,
      },
      {
        requester_id: requesterId,
        profile_id: profile.id,
        resource_id: selectedResource.id,
        resource_type: selectedResource.resource_type,
      }
    );

    if (!writeResult.success) {
      toast.error('Failed to write access tuple');
      setSubmitting(false);
      return;
    }

    // Update the access request to mark tuple as written
    await supabase
      .from('access_requests')
      .update({ tuple_written: true })
      .eq('id', accessRequest.id);

    // Simulate Check to confirm the access
    const check = await checkAccess({
      user: tupleUser,
      relation: selectedRelation.name,
      object: tupleObject,
    });

    setCheckResult({
      allowed: check.allowed,
      explanation: check.explanation,
    });

    setRequestResult({
      type: 'immediate',
      message: `Access granted immediately. The team "${profile.name}" now has ${selectedRelation.label} access to "${selectedResource.name}".`,
      request: accessRequest,
    });
    setStep('result');
    setSubmitting(false);
    onAccessGranted?.();
  };

  const filteredResources = resources.filter((r) => {
    const matchesSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.resource_type.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === 'all' || r.resource_type === typeFilter;
    return matchesSearch && matchesType;
  });

  const resourceTypeIcon = (type: string) => {
    if (type === 'folder') return <Folder className="h-4 w-4 text-amber-500" />;
    if (type === 'document') return <FileText className="h-4 w-4 text-blue-500" />;
    return <FileText className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-[hsl(var(--primary))]" />
            Add Access
          </DialogTitle>
          <DialogDescription>
            Grant the team &ldquo;{profile.name}&rdquo; access to a resource
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))] mb-2">
          <span className={step === 'resource' ? 'font-semibold text-[hsl(var(--foreground))]' : ''}>Resource</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === 'relation' ? 'font-semibold text-[hsl(var(--foreground))]' : ''}>Relation</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === 'summary' ? 'font-semibold text-[hsl(var(--foreground))]' : ''}>Summary</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === 'result' ? 'font-semibold text-[hsl(var(--foreground))]' : ''}>Result</span>
        </div>

        <Separator />

        {/* Step 1: Resource Selection */}
        {step === 'resource' && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                <Input
                  placeholder="Search resources..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-md border border-[hsl(var(--border))] bg-background text-sm"
              >
                <option value="all">All types</option>
                {resourceTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {loadingResources ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[hsl(var(--muted-foreground))]" />
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="text-center py-8 text-sm text-[hsl(var(--muted-foreground))]">
                No resources found
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                {filteredResources.map((resource) => (
                  <button
                    key={resource.id}
                    onClick={() => handleSelectResource(resource)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5 transition-all text-left group"
                  >
                    <div className="h-9 w-9 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center shrink-0">
                      {resourceTypeIcon(resource.resource_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{resource.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs capitalize">{resource.resource_type}</Badge>
                        {resource.parent && (
                          <span className="text-xs text-[hsl(var(--muted-foreground))]">
                            in {resource.parent?.name || 'parent'}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 2: Relation Selection */}
        {step === 'relation' && selectedResource && introspected && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(var(--muted))]">
              <div className="h-9 w-9 rounded-lg bg-white flex items-center justify-center shrink-0">
                {resourceTypeIcon(selectedResource.resource_type)}
              </div>
              <div>
                <p className="text-sm font-medium">{selectedResource.name}</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] capitalize">{selectedResource.resource_type}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">Choose an access level</p>
              <div className="space-y-2">
                {introspected.relations.map((rel) => (
                  <button
                    key={rel.name}
                    onClick={() => rel.assignable && handleSelectRelation(rel)}
                    disabled={!rel.assignable}
                    className={`w-full text-left p-3 rounded-lg border transition-all ${
                      rel.assignable
                        ? 'border-[hsl(var(--border))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/5 cursor-pointer'
                        : 'border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 opacity-70 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{rel.label}</p>
                          {rel.requiresApproval && (
                            <Badge variant="outline" className="text-xs gap-1 border-amber-300 text-amber-700 bg-amber-50">
                              <Lock className="h-3 w-3" />
                              Requires approval
                            </Badge>
                          )}
                          {!rel.assignable && (
                            <Badge variant="outline" className="text-xs">
                              <Info className="h-3 w-3 mr-1" />
                              Derived
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{rel.description}</p>
                        {rel.derivedFrom && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1.5 italic">
                            Derived from: {rel.derivedFrom}
                          </p>
                        )}
                        {rel.implies && rel.implies.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {rel.implies.map((imp, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-xs text-emerald-700">
                                <ArrowRight className="h-3 w-3 shrink-0" />
                                <span>{imp.explanation}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Summary */}
        {step === 'summary' && selectedResource && selectedRelation && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="h-5 w-5 text-[hsl(var(--primary))]" />
                <p className="text-sm font-semibold">Access Summary</p>
              </div>
              <p className="text-sm">
                The team <span className="font-semibold">&ldquo;{profile.name}&rdquo;</span> will be able to act as{' '}
                <span className="font-semibold">{selectedRelation.label.toLowerCase()}</span> on{' '}
                <span className="font-semibold">&ldquo;{selectedResource.name}&rdquo;</span>.
              </p>
            </div>

            {/* Impact preview */}
            {selectedRelation.implies && selectedRelation.implies.length > 0 && (
              <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50">
                <p className="text-sm font-medium text-emerald-900 mb-2">Additional access that will be granted automatically:</p>
                <div className="space-y-2">
                  {selectedRelation.implies.map((imp, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-emerald-800">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>{imp.explanation}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Computed relations info */}
            {introspected?.relations.filter(r => !r.assignable).map(rel => (
              <div key={rel.name} className="p-3 rounded-lg bg-[hsl(var(--muted))]">
                <div className="flex items-center gap-2 mb-1">
                  <Info className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
                  <p className="text-sm font-medium">{rel.label} (derived)</p>
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">{rel.description}</p>
                {rel.derivedFrom && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 italic">{rel.derivedFrom}</p>
                )}
              </div>
            ))}

            {/* Approval warning */}
            {selectedRelation.requiresApproval && (
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-900">Approval required</p>
                    <p className="text-xs text-amber-700 mt-1">
                      This access level requires approval from the resource owner{' '}
                      ({selectedResource.owner?.name || 'the owner'}). The access will not take effect until approved.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Technical detail (collapsed) */}
            <details className="text-xs text-[hsl(var(--muted-foreground))]">
              <summary className="cursor-pointer hover:text-[hsl(var(--foreground))]">Technical details</summary>
              <div className="mt-2 p-3 rounded-md bg-[hsl(var(--muted))] font-mono">
                <p>tuple: user=team:{profile.id}#member, relation={selectedRelation.name}, object={selectedResource.resource_type}:{selectedResource.id}</p>
              </div>
            </details>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && requestResult && (
          <div className="space-y-4">
            {requestResult.type === 'immediate' && (
              <>
                <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-900">Access Granted</p>
                  </div>
                  <p className="text-sm text-emerald-800">{requestResult.message}</p>
                </div>

                {checkResult && (
                  <div className="p-4 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                    <div className="flex items-center gap-2 mb-2">
                      <ShieldCheck className="h-4 w-4 text-[hsl(var(--primary))]" />
                      <p className="text-sm font-medium">Verification (Check API simulation)</p>
                    </div>
                    {checkResult.allowed ? (
                      <div className="flex items-center gap-2 text-sm text-emerald-700">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{checkResult.explanation}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-amber-700">
                        <AlertCircle className="h-4 w-4" />
                        <span>{checkResult.explanation}</span>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {requestResult.type === 'approval' && (
              <div className="p-4 rounded-lg border border-amber-200 bg-amber-50">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-amber-600" />
                  <p className="text-sm font-semibold text-amber-900">Approval Pending</p>
                </div>
                <p className="text-sm text-amber-800">{requestResult.message}</p>
                {requestResult.request && (
                  <div className="mt-3 pt-3 border-t border-amber-200 text-xs text-amber-700">
                    <p>Request ID: {requestResult.request.id.slice(0, 8)}...</p>
                    <p>Submitted: {format(new Date(requestResult.request.created_at), 'MMM d, yyyy HH:mm')}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 'resource' && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          )}
          {step === 'relation' && (
            <>
              <Button variant="outline" onClick={() => setStep('resource')}>Back</Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            </>
          )}
          {step === 'summary' && (
            <>
              <Button variant="outline" onClick={() => setStep('relation')}>Back</Button>
              <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {selectedRelation?.requiresApproval ? 'Submit for Approval' : 'Grant Access'}
              </Button>
            </>
          )}
          {step === 'result' && (
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

