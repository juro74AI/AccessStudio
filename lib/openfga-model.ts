import {
  FGAModel,
  FGATypeDefinition,
  FGARelation,
  IntrospectedType,
  IntrospectedRelation,
  FGAValueType,
} from './openfga-types';

// The OpenFGA demo model, stored as a structured JS object.
// In a real deployment this would be fetched from OpenFGA's ReadAuthorizationModel API.
export const FGA_MODEL: FGAModel = {
  schema_version: '1.1',
  type_definitions: [
    {
      type: 'user',
      relations: {},
    },
    {
      type: 'team',
      relations: {
        member: {
          name: 'member',
          assignableTypes: [{ type: 'user' }],
          isComputed: false,
          label: 'Member',
          description: 'A direct member of this team',
          requiresApproval: false,
          sensitive: false,
        },
      },
    },
    {
      type: 'folder',
      relations: {
        owner: {
          name: 'owner',
          assignableTypes: [{ type: 'user' }],
          isComputed: false,
          label: 'Owner',
          description: 'Full control over this folder and its contents',
          requiresApproval: true,
          sensitive: true,
        },
        editor: {
          name: 'editor',
          assignableTypes: [{ type: 'user' }, { type: 'team', relation: 'member' }],
          isComputed: false,
          label: 'Editor',
          description: 'Can read, modify, and share this folder. Automatically grants viewer access to all documents within it.',
          requiresApproval: true,
          sensitive: true,
        },
        viewer: {
          name: 'viewer',
          assignableTypes: [{ type: 'user' }, { type: 'team', relation: 'member' }],
          isComputed: false,
          label: 'Viewer',
          description: 'Can read this folder and its contents',
          requiresApproval: false,
          sensitive: false,
        },
      },
    },
    {
      type: 'document',
      relations: {
        parent: {
          name: 'parent',
          assignableTypes: [{ type: 'folder' }],
          isComputed: false,
          label: 'Parent Folder',
          description: 'The folder that contains this document',
          requiresApproval: false,
          sensitive: false,
        },
        owner: {
          name: 'owner',
          assignableTypes: [{ type: 'user' }],
          isComputed: false,
          label: 'Owner',
          description: 'Full control over this document',
          requiresApproval: true,
          sensitive: true,
        },
        editor: {
          name: 'editor',
          assignableTypes: [{ type: 'user' }, { type: 'team', relation: 'member' }],
          isComputed: false,
          label: 'Editor',
          description: 'Can read and modify this document. If the team has editor on the parent folder, this access is inherited automatically.',
          requiresApproval: true,
          sensitive: true,
        },
        viewer: {
          name: 'viewer',
          assignableTypes: [{ type: 'user' }, { type: 'team', relation: 'member' }],
          isComputed: false,
          label: 'Viewer',
          description: 'Can read this document. Editors automatically receive viewer access.',
          requiresApproval: false,
          sensitive: false,
        },
      },
    },
  ],
};

// Relations that are purely computed (not directly assignable)
const COMPUTED_RELATIONS: Record<string, Record<string, { derivedFrom: string; implies: { relation: string; explanation: string }[] }>> = {
  folder: {
    viewer: {
      derivedFrom: 'viewer = viewer OR editor',
      implies: [],
    },
  },
  document: {
    editor: {
      derivedFrom: 'editor = editor OR editor FROM parent',
      implies: [],
    },
    viewer: {
      derivedFrom: 'viewer = viewer OR editor',
      implies: [],
    },
  },
};

// Map of which assignable relations imply which computed relations
const RELATION_IMPLIES: Record<string, Record<string, { relation: string; explanation: string }[]>> = {
  folder: {
    editor: [
      { relation: 'viewer', explanation: 'Editors automatically have viewer access to this folder' },
    ],
  },
  document: {
    editor: [
      { relation: 'viewer', explanation: 'Editors automatically have viewer access to this document' },
    ],
  },
};

/**
 * Checks if a relation accepts a direct tuple of type team#member.
 * This is the core introspection logic: a relation is "assignable" from the UI
 * if its type restrictions include { type: 'team', relation: 'member' }.
 */
export function isAssignableToTeam(relation: FGARelation): boolean {
  return relation.assignableTypes.some(
    (t) => t.type === 'team' && 'relation' in t && t.relation === 'member'
  );
}

/**
 * Checks if a relation is purely computed (no direct assignable types at all,
 * or only computed via or/from/tuple-to-userset).
 */
export function isPurelyComputed(relation: FGARelation): boolean {
  // If it has no assignable types, it's purely computed
  if (relation.assignableTypes.length === 0) return true;
  // If it has assignable types but also has a rewrite that includes computed parts,
  // it's both assignable AND computed (like viewer = viewer OR editor)
  // We treat it as assignable (the direct part) and show the computed part as implied
  return false;
}

/**
 * Introspect a type definition and return all relations categorized as
 * assignable or computed, with human-readable explanations.
 */
export function introspectType(typeName: string): IntrospectedType | null {
  const typeDef = FGA_MODEL.type_definitions.find((t) => t.type === typeName);
  if (!typeDef) return null;

  const relations: IntrospectedRelation[] = [];

  for (const [name, relation] of Object.entries(typeDef.relations)) {
    const assignable = isAssignableToTeam(relation);
    const computed = isPurelyComputed(relation);

    // Skip relations that are neither assignable to team nor computed (e.g. 'parent', 'member')
    if (!assignable && !computed) continue;
    // Skip the 'parent' relation - it's structural, not an access relation
    if (name === 'parent') continue;

    const implies = RELATION_IMPLIES[typeName]?.[name] || [];
    const computedInfo = COMPUTED_RELATIONS[typeName]?.[name];

    relations.push({
      name: relation.name,
      label: relation.label,
      description: relation.description,
      assignable,
      requiresApproval: relation.requiresApproval,
      sensitive: relation.sensitive,
      assignableTypes: relation.assignableTypes,
      derivedFrom: computedInfo?.derivedFrom,
      implies: implies,
    });
  }

  // Sort: assignable first, then computed
  relations.sort((a, b) => {
    if (a.assignable && !b.assignable) return -1;
    if (!a.assignable && b.assignable) return 1;
    return 0;
  });

  return { type: typeName, relations };
}

/**
 * Get all resource types that have at least one relation assignable to team#member.
 */
export function getAssignableResourceTypes(): string[] {
  return FGA_MODEL.type_definitions
    .filter((t) =>
      Object.values(t.relations).some((r) => isAssignableToTeam(r))
    )
    .map((t) => t.type);
}

/**
 * Get all resource types (for the resource selector dropdown).
 */
export function getAllResourceTypes(): string[] {
  return FGA_MODEL.type_definitions
    .filter((t) => t.type !== 'user' && t.type !== 'team')
    .map((t) => t.type);
}

/**
 * Get the label for a relation given its type and name.
 */
export function getRelationLabel(typeName: string, relationName: string): string {
  const typeDef = FGA_MODEL.type_definitions.find((t) => t.type === typeName);
  if (!typeDef) return relationName;
  return typeDef.relations[relationName]?.label || relationName;
}

/**
 * Get the description for a relation.
 */
export function getRelationDescription(typeName: string, relationName: string): string {
  const typeDef = FGA_MODEL.type_definitions.find((t) => t.type === typeName);
  if (!typeDef) return '';
  return typeDef.relations[relationName]?.description || '';
}
