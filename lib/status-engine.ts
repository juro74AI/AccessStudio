import { ValidationStatus, ProfileStatus } from './types';

export function computeProfileStatus(validations: { status: ValidationStatus }[]): ProfileStatus {
  if (validations.length === 0) return 'draft';

  const statuses = validations.map(v => v.status);

  if (statuses.some(s => s === 'rejected')) return 'rejected';
  if (statuses.every(s => s === 'approved')) return 'approved';
  if (statuses.some(s => s === 'pending') && statuses.some(s => s === 'approved')) return 'partially_approved';
  if (statuses.every(s => s === 'pending')) return 'pending_approval';

  return 'draft';
}

export const STATUS_LABELS: Record<ProfileStatus, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  partially_approved: 'Partially Approved',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const STATUS_COLORS: Record<ProfileStatus, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_approval: 'bg-amber-50 text-amber-700 border-amber-200',
  partially_approved: 'bg-sky-50 text-sky-700 border-sky-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

export const STATUS_DOT_COLORS: Record<ProfileStatus, string> = {
  draft: 'bg-slate-400',
  pending_approval: 'bg-amber-400',
  partially_approved: 'bg-sky-400',
  approved: 'bg-emerald-400',
  rejected: 'bg-red-400',
};

export const VALIDATION_LABELS: Record<ValidationStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const VALIDATION_COLORS: Record<ValidationStatus, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

export const VALIDATION_DOT_COLORS: Record<ValidationStatus, string> = {
  pending: 'bg-amber-400',
  approved: 'bg-emerald-400',
  rejected: 'bg-red-400',
};
