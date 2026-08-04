'use client';

import { supabase } from './supabase';

// Simulated OpenFGA tuple store — in a real deployment this would call the OpenFGA API.
// For this demo, we store tuples in the access_audit table and simulate Check locally.

export interface FGATuple {
  user: string;       // e.g. 'team:abc#member'
  relation: string;   // e.g. 'editor'
  object: string;      // e.g. 'folder:xyz'
}

export interface CheckResult {
  allowed: boolean;
  tuple: FGATuple;
  explanation: string;
}

export interface WriteTupleResult {
  success: boolean;
  tuple: FGATuple;
  error?: string;
}

/**
 * Simulates the OpenFGA Check API.
 * Checks if a user (or team#member) has a relation on an object.
 * In a real deployment, this would call POST /stores/{store_id}/check.
 */
export async function checkAccess(
  tuple: FGATuple
): Promise<CheckResult> {
  // Query the access_audit table for written tuples matching this check
  const { data, error } = await supabase
    .from('access_audit')
    .select('tuple_user, tuple_relation, tuple_object')
    .eq('tuple_user', tuple.user)
    .eq('tuple_relation', tuple.relation)
    .eq('tuple_object', tuple.object)
    .eq('action', 'write');

  if (error) {
    return {
      allowed: false,
      tuple,
      explanation: 'Unable to verify access (database error)',
    };
  }

  const allowed = (data && data.length > 0) || false;

  // Build explanation
  let explanation = '';
  if (allowed) {
    explanation = `Confirmed: ${tuple.user} has ${tuple.relation} on ${tuple.object}`;
  } else {
    // Check for derived access (e.g. editor implies viewer)
    explanation = `No direct ${tuple.relation} grant found for ${tuple.user} on ${tuple.object}`;
  }

  return { allowed, tuple, explanation };
}

/**
 * Simulates the OpenFGA Write API.
 * Writes a tuple to the store. In a real deployment, this would call POST /stores/{store_id}/write.
 * For the demo, we log the tuple in access_audit with action='write'.
 */
export async function writeTuple(
  tuple: FGATuple,
  metadata: {
    requester_id: string;
    approver_id?: string;
    profile_id: string;
    resource_id: string;
    resource_type: string;
  }
): Promise<WriteTupleResult> {
  const { error } = await supabase.from('access_audit').insert({
    tuple_user: tuple.user,
    tuple_relation: tuple.relation,
    tuple_object: tuple.object,
    action: 'write',
    requester_id: metadata.requester_id,
    approver_id: metadata.approver_id || null,
    profile_id: metadata.profile_id,
    resource_id: metadata.resource_id,
    resource_type: metadata.resource_type,
  });

  if (error) {
    return { success: false, tuple, error: error.message };
  }

  return { success: true, tuple };
}

/**
 * Build the OpenFGA user string for a team member check.
 * e.g. teamId -> 'team:{id}#member'
 */
export function buildTeamUserString(teamId: string): string {
  return `team:${teamId}#member`;
}

/**
 * Build the OpenFGA object string for a resource.
 * e.g. (folder, id) -> 'folder:{id}'
 */
export function buildObjectString(resourceType: string, resourceId: string): string {
  return `${resourceType}:${resourceId}`;
}
