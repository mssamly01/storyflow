import type { BeatAnalysis } from "../types";

export interface BeatSkeletonValidationWarning {
  beatId: number | string;
  severity: "warning" | "error";
  code:
    | "BEAT_TOO_LONG"
    | "BEAT_VERY_LONG"
    | "TOO_MANY_SOURCE_SEGMENTS"
    | "MONTAGE_BEAT"
    | "EMPTY_SOURCE_SEGMENTS";
  message: string;
  wordCount?: number;
  sourceSegmentCount?: number;
}

function countWords(text: string): number {
  return String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function containsMontageLanguage(beat: BeatAnalysis): boolean {
  const text = [
    beat.summary,
    beat.action,
    beat.actionAnalysis,
    beat.analysis,
    beat.visualFocus,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    "montage",
    "brief visual montage",
    "series of small panels",
    "quick sequence",
    "multiple moments",
    "several scenes",
    "set of panels",
    "a series of",
  ].some((pattern) => text.includes(pattern));
}

export function validateBeatSkeletonRhythm(
  beats: BeatAnalysis[]
): BeatSkeletonValidationWarning[] {
  const warnings: BeatSkeletonValidationWarning[] = [];

  for (const beat of beats || []) {
    const beatId = beat.beatId ?? "unknown";
    const originalText = beat.originalText || "";
    const wordCount = countWords(originalText);
    const sourceSegmentCount = Array.isArray(beat.sourceSegmentIds)
      ? beat.sourceSegmentIds.length
      : 0;

    if (!sourceSegmentCount) {
      warnings.push({
        beatId,
        severity: "error",
        code: "EMPTY_SOURCE_SEGMENTS",
        message: `Beat ${beatId} has no sourceSegmentIds.`,
        wordCount,
        sourceSegmentCount,
      });
    }

    if (wordCount > 60) {
      warnings.push({
        beatId,
        severity: "warning",
        code: "BEAT_TOO_LONG",
        message: `Beat ${beatId} is ${wordCount} words. Target is 20-60 words.`,
        wordCount,
        sourceSegmentCount,
      });
    }

    if (wordCount > 80) {
      warnings.push({
        beatId,
        severity: "error",
        code: "BEAT_VERY_LONG",
        message: `Beat ${beatId} is ${wordCount} words. This is invalid unless it is one unsplittable source segment.`,
        wordCount,
        sourceSegmentCount,
      });
    }

    if (sourceSegmentCount >= 5) {
      warnings.push({
        beatId,
        severity: "error",
        code: "TOO_MANY_SOURCE_SEGMENTS",
        message: `Beat ${beatId} uses ${sourceSegmentCount} source segments. Most beats should use 1-2; 5+ should be split.`,
        wordCount,
        sourceSegmentCount,
      });
    }

    if (containsMontageLanguage(beat)) {
      warnings.push({
        beatId,
        severity: "warning",
        code: "MONTAGE_BEAT",
        message: `Beat ${beatId} looks like a montage beat. Beat Skeleton should be one concrete drawable moment.`,
        wordCount,
        sourceSegmentCount,
      });
    }
  }

  return warnings;
}

export function hasBlockingBeatSkeletonErrors(
  warnings: BeatSkeletonValidationWarning[]
): boolean {
  return warnings.some((warning) => warning.severity === "error");
}
