export type Persona = 'manager' | 'owner' | 'user';

export type ProfileStatus = 'draft' | 'pending_approval' | 'partially_approved' | 'approved' | 'rejected';

export type ValidationStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  name: string;
  email: string;
  persona: Persona;
  avatar_url: string | null;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  active: boolean;
  created_at: string;
  owner?: User;
}

export interface Profile {
  id: string;
  name: string;
  description: string | null;
  creator_id: string;
  status: ProfileStatus;
  created_at: string;
  updated_at: string;
  creator?: User;
  profile_roles?: ProfileRole[];
  roles?: Role[];
}

export interface ProfileRole {
  id: string;
  profile_id: string;
  role_id: string;
  added_at: string;
  role?: Role;
}

export interface Validation {
  id: string;
  profile_id: string;
  role_id: string;
  owner_id: string;
  status: ValidationStatus;
  comment: string | null;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  role?: Role;
  owner?: User;
}

export type RequestStatus = 'pending_manager' | 'manager_approved' | 'approved' | 'rejected';

export interface RoleRequest {
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
  user?: User;
  role?: Role;
  profile?: Profile;
  owner?: User;
}

export interface UserProfile {
  id: string;
  user_id: string;
  profile_id: string;
  assigned_at: string;
  assigned_by: string | null;
  profile?: Profile;
  user?: User;
  assigner?: User;
}

export interface HREmployee {
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
  user?: User;
  manager?: User | null;
  user_profiles?: UserProfile[];
}

// OpenFGA resource types
export interface FGAResource {
  id: string;
  name: string;
  resource_type: string;
  parent_id: string | null;
  owner_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  owner?: User;
  parent?: FGAResource | null;
}

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AccessRequest {
  id: string;
  profile_id: string;
  resource_id: string;
  resource_type: string;
  relation: string;
  relation_label: string;
  status: AccessRequestStatus;
  requested_by: string;
  owner_id: string;
  manager_comment: string | null;
  owner_comment: string | null;
  decided_at: string | null;
  requires_approval: boolean;
  tuple_written: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
  resource?: FGAResource;
  requester?: User;
  owner?: User;
}

export interface AccessAudit {
  id: string;
  tuple_user: string;
  tuple_relation: string;
  tuple_object: string;
  action: 'write' | 'delete';
  requester_id: string;
  approver_id: string | null;
  profile_id: string;
  resource_id: string;
  resource_type: string;
  created_at: string;
  requester?: User;
  approver?: User | null;
  profile?: Profile;
  resource?: FGAResource;
}
