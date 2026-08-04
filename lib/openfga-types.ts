// OpenFGA authorization model types

export type FGAValueType =
  | { type: string; relation?: string }   // e.g. { type: 'team', relation: 'member' }
  | { type: string; wildcard?: '*' };      // e.g. { type: 'user', wildcard: '*' }

export type FGARewrite =
  | { userset: FGAUserset }                 // direct userset reference
  | { tupleToUserset: FGATupleToUserset };  // computed from a relation

export interface FGAUserset {
  type: string;       // 'self' | 'computedUserset' | 'tupleToUserset' | 'union' | 'intersection' | 'difference'
  relation?: string;  // for computedUserset / self
  source?: string;    // for tupleToUserset source relation
  target?: string;    // for tupleToUserset target relation
  child?: FGAUserset[]; // for union / intersection / difference
}

export interface FGATupleToUserset {
  tupleset: { relation: string };       // source relation to follow
  computedUserset: { relation: string }; // target relation to compute
}

export interface FGARelation {
  name: string;
  // Direct assignable types (from the `define X: [...]` list)
  assignableTypes: FGAValueType[];
  // Whether this relation is purely computed (no direct assignable types)
  isComputed: boolean;
  // The rewrite expression (what this relation expands to)
  rewrite?: FGARewrite;
  // Human-readable metadata
  label: string;
  description: string;
  // Whether assigning this relation requires owner approval
  requiresApproval: boolean;
  // Whether this relation is "sensitive" (triggers approval workflow)
  sensitive: boolean;
}

export interface FGATypeDefinition {
  type: string;
  relations: Record<string, FGARelation>;
  metadata?: {
    relations: Record<string, { directly_related_user_types: FGAValueType[]; template: string }>;
  };
}

export interface FGAModel {
  schema_version: string;
  type_definitions: FGATypeDefinition[];
  conditions?: Record<string, unknown>;
}

// Introspection result for a single resource type
export interface IntrospectedRelation {
  name: string;
  label: string;
  description: string;
  assignable: boolean;       // can be directly assigned (has team#member in type restriction)
  requiresApproval: boolean;
  sensitive: boolean;
  assignableTypes: FGAValueType[];
  // For computed relations: explanation of how they're derived
  derivedFrom?: string;
  // For assignable relations: what computed relations they imply
  implies?: { relation: string; explanation: string }[];
}

export interface IntrospectedType {
  type: string;
  relations: IntrospectedRelation[];
}
