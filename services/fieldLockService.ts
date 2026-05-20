import type { EditableMeta } from "../types";

export type LockableEntity = {
  meta?: EditableMeta;
};

const nowIso = () => new Date().toISOString();
const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

export function getLockedFields(entity?: LockableEntity | null): string[] {
  return entity?.meta?.locks?.lockedFields ?? [];
}

export function getApprovedFields(entity?: LockableEntity | null): string[] {
  return entity?.meta?.locks?.approvedFields ?? [];
}

export function isFieldLocked(entity: LockableEntity | null | undefined, fieldName: string): boolean {
  return getLockedFields(entity).includes(fieldName);
}

export function isFieldApproved(entity: LockableEntity | null | undefined, fieldName: string): boolean {
  return getApprovedFields(entity).includes(fieldName);
}

export function lockField<T extends LockableEntity>(
  entity: T,
  fieldName: string,
  lockedBy: "user" | "system" = "user"
): T {
  return {
    ...entity,
    meta: {
      ...entity.meta,
      locks: {
        ...entity.meta?.locks,
        lockedFields: unique([...getLockedFields(entity), fieldName]),
        lockedAt: nowIso(),
        lockedBy
      }
    }
  };
}

export function unlockField<T extends LockableEntity>(entity: T, fieldName: string): T {
  return {
    ...entity,
    meta: {
      ...entity.meta,
      locks: {
        ...entity.meta?.locks,
        lockedFields: getLockedFields(entity).filter((field) => field !== fieldName)
      }
    }
  };
}

export function approveField<T extends LockableEntity>(entity: T, fieldName: string): T {
  return {
    ...entity,
    meta: {
      ...entity.meta,
      locks: {
        ...entity.meta?.locks,
        approvedFields: unique([...getApprovedFields(entity), fieldName]),
        approvedAt: nowIso()
      }
    }
  };
}

export function unapproveField<T extends LockableEntity>(entity: T, fieldName: string): T {
  return {
    ...entity,
    meta: {
      ...entity.meta,
      locks: {
        ...entity.meta?.locks,
        approvedFields: getApprovedFields(entity).filter((field) => field !== fieldName)
      }
    }
  };
}

export function approveAndLockField<T extends LockableEntity>(entity: T, fieldName: string): T {
  return lockField(approveField(entity, fieldName), fieldName);
}

export function lockFields<T extends LockableEntity>(
  entity: T,
  fieldNames: string[],
  lockedBy: "user" | "system" = "user"
): T {
  return fieldNames.reduce((current, fieldName) => lockField(current, fieldName, lockedBy), entity);
}

export function unlockFields<T extends LockableEntity>(entity: T, fieldNames: string[]): T {
  return fieldNames.reduce((current, fieldName) => unlockField(current, fieldName), entity);
}

export function approveAndLockFields<T extends LockableEntity>(entity: T, fieldNames: string[]): T {
  return fieldNames.reduce((current, fieldName) => approveAndLockField(current, fieldName), entity);
}

export function unlockAllFields<T extends LockableEntity>(entity: T): T {
  return {
    ...entity,
    meta: {
      ...entity.meta,
      locks: {
        ...entity.meta?.locks,
        lockedFields: []
      }
    }
  };
}

export function mergeRespectingLocks<T extends LockableEntity>(
  currentEntity: T,
  incomingEntity: Partial<T>
): T {
  const lockedFields = getLockedFields(currentEntity);
  const merged = {
    ...currentEntity,
    ...incomingEntity,
    meta: {
      ...currentEntity.meta,
      ...incomingEntity.meta,
      locks: {
        ...currentEntity.meta?.locks,
        ...incomingEntity.meta?.locks,
        lockedFields: currentEntity.meta?.locks?.lockedFields ?? [],
        approvedFields: currentEntity.meta?.locks?.approvedFields ?? []
      }
    }
  } as T;

  for (const fieldName of lockedFields) {
    if (fieldName in currentEntity) {
      (merged as Record<string, unknown>)[fieldName] = (currentEntity as Record<string, unknown>)[fieldName];
    }
  }

  return merged;
}

export function buildLockedFieldsPromptBlock(entityName: string, entity: LockableEntity): string {
  const lockedFields = getLockedFields(entity);
  if (!lockedFields.length) return `LOCKED FIELDS for ${entityName}: None.`;

  const lines = lockedFields.map((fieldName) => (
    `- ${fieldName}: ${JSON.stringify((entity as Record<string, unknown>)[fieldName])}`
  ));

  return `LOCKED FIELDS for ${entityName}:
The following fields are locked and must not be changed.
Copy these values exactly if they are needed.
Do not rewrite, summarize, reinterpret, or improve locked fields.
${lines.join("\n")}`;
}

export const BEAT_SOURCE_FIELDS = [
  "originalText",
  "sourceSegmentIds",
  "summary",
  "timeOfDay",
  "location",
  "locationName",
  "locationId",
  "characters",
  "charactersInvolved",
  "focusCharacters",
  "visibleCharacters",
  "offscreenPresentCharacters",
  "action",
  "actionAnalysis",
  "beatType",
  "atmosphere",
  "visualFocus"
];

export const CHARACTER_APPEARANCE_FIELDS = [
  "name",
  "gender",
  "age",
  "height",
  "bodyType",
  "face",
  "hair",
  "eyes",
  "outfit",
  "accessories",
  "colorPalette",
  "continuityNotes"
];

export const LOCATION_CONTINUITY_FIELDS = [
  "name",
  "description",
  "details",
  "layout",
  "keyObjects",
  "lighting",
  "colorPalette",
  "baseState",
  "continuityNotes"
];

export const STORYBOARD_VISUAL_FIELDS = [
  "shotType",
  "cameraAngle",
  "cameraDistance",
  "lensFeel",
  "composition",
  "foreground",
  "midground",
  "background",
  "characterBlocking",
  "lightingDirection",
  "depthAndPerspective",
  "visualEmphasis",
  "cameraNotes"
];

export const PROMPT_FIELDS = ["visualPrompt"];
