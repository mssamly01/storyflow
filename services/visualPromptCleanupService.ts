export function removeInternalIdsFromPrompt(value: string): string {
  return value
    .replace(/\buse location\s+loc_\d+\s*:?\s*/gi, "")
    .replace(/\bloc_\d+\b/gi, "")
    .replace(/\bscreen_\d+\b/gi, "")
    .replace(/\bchar_\d+\b/gi, "")
    .replace(/\bpanel_\d+\b/gi, "")
    .replace(/\bbeatId\s*[:=]\s*\d+\b/gi, "")
    .replace(/\bscreenId\s*[:=]\s*["']?screen_\d+["']?/gi, "")
    .replace(/\blocationId\s*[:=]\s*["']?loc_\d+["']?/gi, "");
}

export function removeBeatRangeMetadata(value: string): string {
  return value
    .replace(/\s*\(\s*beats?\s+\d+\s*[-–]\s*\d+(?:\s*,\s*\d+\s*[-–]\s*\d+)*\s*\)/gi, "")
    .replace(/\s*\(\s*beats?\s+\d+(?:\s*,\s*\d+)*\s*\)/gi, "")
    .replace(/\s*\(\s*beat\s+\d+\s*[-–]\s*\d+\s*\)/gi, "")
    .replace(/\s*\(\s*beat\s+\d+\s*\)/gi, "");
}

export function removeRawHexColors(value: string): string {
  return value.replace(/#[0-9a-fA-F]{3,8}\b/g, "");
}

export function simplifyDebugLabels(value: string): string {
  return value
    .replace(/\bbase description\s*:\s*/gi, "")
    .replace(/\bspatial layout\s*:\s*/gi, "")
    .replace(/\bkey objects to preserve\s*:\s*/gi, "")
    .replace(/\bcurrent beat state\s*:\s*/gi, "")
    .replace(/\bcolor palette\s*:\s*/gi, "")
    .replace(/\blighting\s*:\s*/gi, "");
}

export function normalizePromptSpacing(value: string): string {
  return value
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/,\s*,+/g, ",")
    .replace(/;\s*;/g, ";")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanVisualPrompt(value: string): string {
  return normalizePromptSpacing(
    simplifyDebugLabels(
      removeRawHexColors(
        removeBeatRangeMetadata(
          removeInternalIdsFromPrompt(value || "")
        )
      )
    )
  );
}
