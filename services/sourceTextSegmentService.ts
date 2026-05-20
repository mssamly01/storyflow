import type {
  BeatAnalysisResult,
  CoverageCheck,
  SourceSegment,
  StoryBeat,
  StoryScreen
} from "../types";

export const SOURCE_SEGMENTER_VERSION = "source-segmenter-v2-word-limit";
export const LEGACY_LINE_SEGMENTER_VERSION = "legacy-line-v1";
export const TARGET_BEAT_WORD_MIN = 20;
export const TARGET_BEAT_WORD_MAX = 60;

const MAX_SEGMENT_CHARS = 520;
const MAX_SEGMENT_WORDS = TARGET_BEAT_WORD_MAX;
const TARGET_SEGMENT_WORDS = 40;
const SOURCE_SEGMENT_PREFIX = "src_";

type SourceSegmenterMode = "current" | "legacyLine" | "auto";

interface HydrationOptions {
  repairMissingSegments?: boolean;
  segmentMode?: SourceSegmenterMode;
  splitLongBeats?: boolean;
}

interface ResolvedSourceSegments {
  segments: SourceSegment[];
  version: string;
  notes?: string;
}
const SENTENCE_BOUNDARY_CHARS = new Set([".", "!", "?", "。", "！", "？", "…", "】"]);
const CLOSING_CHARS = new Set(["”", "’", "'", "\"", "」", "』", "）", ")", "]", "】"]);

function padSegmentId(index: number): string {
  return `${SOURCE_SEGMENT_PREFIX}${String(index).padStart(4, "0")}`;
}

function trimRange(sourceText: string, startOffset: number, endOffset: number) {
  let start = startOffset;
  let end = endOffset;
  while (start < end && /\s/.test(sourceText[start])) start += 1;
  while (end > start && /\s/.test(sourceText[end - 1])) end -= 1;
  return { startOffset: start, endOffset: end };
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function hashSourceText(sourceText: string): string {
  let hash = 2166136261;
  for (let index = 0; index < sourceText.length; index += 1) {
    hash ^= sourceText.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function rangeWordCount(sourceText: string, startOffset: number, endOffset: number): number {
  return countWords(sourceText.slice(startOffset, endOffset));
}

function isDecimalPoint(sourceText: string, index: number): boolean {
  return (
    sourceText[index] === "." &&
    /\d/.test(sourceText[index - 1] || "") &&
    /\d/.test(sourceText[index + 1] || "")
  );
}

function isSentenceBoundary(sourceText: string, index: number): boolean {
  const char = sourceText[index];
  if (!SENTENCE_BOUNDARY_CHARS.has(char)) return false;
  if (isDecimalPoint(sourceText, index)) return false;
  return true;
}

function splitLongRange(sourceText: string, startOffset: number, endOffset: number): Array<{ startOffset: number; endOffset: number }> {
  if (
    endOffset - startOffset <= MAX_SEGMENT_CHARS &&
    rangeWordCount(sourceText, startOffset, endOffset) <= MAX_SEGMENT_WORDS
  ) {
    return [trimRange(sourceText, startOffset, endOffset)].filter((range) => range.endOffset > range.startOffset);
  }

  const ranges: Array<{ startOffset: number; endOffset: number }> = [];
  let currentStart = startOffset;

  for (let index = startOffset; index < endOffset; index += 1) {
    if (!isSentenceBoundary(sourceText, index)) continue;

    let boundaryEnd = index + 1;
    while (boundaryEnd < endOffset && CLOSING_CHARS.has(sourceText[boundaryEnd])) {
      boundaryEnd += 1;
    }

    const trimmed = trimRange(sourceText, currentStart, boundaryEnd);
    if (trimmed.endOffset > trimmed.startOffset) ranges.push(trimmed);
    currentStart = boundaryEnd;
  }

  const tail = trimRange(sourceText, currentStart, endOffset);
  if (tail.endOffset > tail.startOffset) ranges.push(tail);

  if (
    ranges.length <= 1 &&
    (
      endOffset - startOffset > MAX_SEGMENT_CHARS ||
      rangeWordCount(sourceText, startOffset, endOffset) > MAX_SEGMENT_WORDS
    )
  ) {
    return splitRangeByWhitespace(sourceText, startOffset, endOffset);
  }

  return ranges.flatMap((range) => {
    if (
      range.endOffset - range.startOffset <= MAX_SEGMENT_CHARS &&
      rangeWordCount(sourceText, range.startOffset, range.endOffset) <= MAX_SEGMENT_WORDS
    ) {
      return [range];
    }
    return splitRangeByWhitespace(sourceText, range.startOffset, range.endOffset);
  });
}

function splitRangeByWhitespace(sourceText: string, startOffset: number, endOffset: number): Array<{ startOffset: number; endOffset: number }> {
  const ranges: Array<{ startOffset: number; endOffset: number }> = [];
  let currentStart = startOffset;

  while (currentStart < endOffset) {
    const targetEnd = findWhitespaceSplitEnd(sourceText, currentStart, endOffset);
    let splitEnd = targetEnd;

    if (targetEnd < endOffset) {
      for (let index = targetEnd; index > currentStart + Math.floor(MAX_SEGMENT_CHARS * 0.5); index -= 1) {
        if (/\s/.test(sourceText[index])) {
          splitEnd = index;
          break;
        }
      }
    }

    const trimmed = trimRange(sourceText, currentStart, splitEnd);
    if (trimmed.endOffset > trimmed.startOffset) ranges.push(trimmed);
    currentStart = splitEnd;
  }

  return ranges;
}

function findWhitespaceSplitEnd(sourceText: string, startOffset: number, endOffset: number): number {
  let words = 0;
  let inWord = false;
  let lastWhitespaceAfterTarget = -1;
  const maxCharEnd = Math.min(startOffset + MAX_SEGMENT_CHARS, endOffset);

  for (let index = startOffset; index < endOffset && index <= maxCharEnd; index += 1) {
    const char = sourceText[index] || "";
    const isWhitespace = /\s/.test(char);
    if (isWhitespace) {
      if (inWord) {
        words += 1;
        inWord = false;
        if (words >= TARGET_SEGMENT_WORDS) lastWhitespaceAfterTarget = index;
        if (words >= MAX_SEGMENT_WORDS) return lastWhitespaceAfterTarget > startOffset ? lastWhitespaceAfterTarget : index;
      }
      continue;
    }
    inWord = true;
  }

  if (endOffset <= maxCharEnd) return endOffset;
  if (lastWhitespaceAfterTarget > startOffset) return lastWhitespaceAfterTarget;

  for (let index = maxCharEnd; index > startOffset + Math.floor(MAX_SEGMENT_CHARS * 0.5); index -= 1) {
    if (/\s/.test(sourceText[index])) return index;
  }

  return maxCharEnd;
}

function isLikelyTitleSegment(segment: SourceSegment, index: number, segments: SourceSegment[]): boolean {
  if (index !== 0 || segments.length < 2) return false;
  const text = segment.text.trim();
  if (!text || text.length > 140) return false;
  if (text.startsWith("【")) return false;
  if (/[.!?。！？…]$/.test(text)) return false;
  return true;
}

export function segmentSourceText(sourceText: string): SourceSegment[] {
  const ranges: Array<{ startOffset: number; endOffset: number }> = [];
  let cursor = sourceText.charCodeAt(0) === 0xfeff ? 1 : 0;

  while (cursor < sourceText.length) {
    const nextLineBreakMatch = /\r\n|\n|\r/g;
    nextLineBreakMatch.lastIndex = cursor;
    const match = nextLineBreakMatch.exec(sourceText);
    const lineEnd = match ? match.index : sourceText.length;
    const nextCursor = match ? match.index + match[0].length : sourceText.length;
    const trimmedLine = trimRange(sourceText, cursor, lineEnd);

    if (trimmedLine.endOffset > trimmedLine.startOffset) {
      ranges.push(...splitLongRange(sourceText, trimmedLine.startOffset, trimmedLine.endOffset));
    }

    cursor = nextCursor;
  }

  const segments = ranges.map<SourceSegment>((range, index) => ({
    sourceSegmentId: padSegmentId(index + 1),
    text: sourceText.slice(range.startOffset, range.endOffset),
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    role: "body"
  }));

  return segments.map((segment, index) => ({
    ...segment,
    role: isLikelyTitleSegment(segment, index, segments) ? "title" : "body"
  }));
}

export function segmentSourceTextByLegacyLines(sourceText: string): SourceSegment[] {
  const ranges: Array<{ startOffset: number; endOffset: number }> = [];
  let cursor = sourceText.charCodeAt(0) === 0xfeff ? 1 : 0;

  while (cursor < sourceText.length) {
    const nextLineBreakMatch = /\r\n|\n|\r/g;
    nextLineBreakMatch.lastIndex = cursor;
    const match = nextLineBreakMatch.exec(sourceText);
    const lineEnd = match ? match.index : sourceText.length;
    const nextCursor = match ? match.index + match[0].length : sourceText.length;
    const trimmedLine = trimRange(sourceText, cursor, lineEnd);

    if (trimmedLine.endOffset > trimmedLine.startOffset) {
      ranges.push(trimmedLine);
    }

    cursor = nextCursor;
  }

  const segments = ranges.map<SourceSegment>((range, index) => ({
    sourceSegmentId: padSegmentId(index + 1),
    text: sourceText.slice(range.startOffset, range.endOffset),
    startOffset: range.startOffset,
    endOffset: range.endOffset,
    role: "body"
  }));

  return segments.map((segment, index) => ({
    ...segment,
    role: isLikelyTitleSegment(segment, index, segments) ? "title" : "body"
  }));
}

function getSegmentIndexById(segments: SourceSegment[]): Map<string, number> {
  const map = new Map<string, number>();
  segments.forEach((segment, index) => map.set(segment.sourceSegmentId, index));
  return map;
}

function normalizeSourceSegmentIds(value: unknown, segmentById: Map<string, SourceSegment>, indexById: Map<string, number>): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();

  return value
    .map((item) => String(item).trim())
    .filter((id) => id && segmentById.has(id) && !seen.has(id) && seen.add(id))
    .sort((left, right) => (indexById.get(left) ?? Number.MAX_SAFE_INTEGER) - (indexById.get(right) ?? Number.MAX_SAFE_INTEGER));
}

function getSourceSegmentNumericId(id: string): number {
  const match = id.match(/^src_(\d+)$/i);
  return match ? Number(match[1]) : 0;
}

function collectSourceSegmentIds(beats: Array<Partial<StoryBeat>>): string[] {
  const ids = new Set<string>();
  beats.forEach((beat) => (beat.sourceSegmentIds || []).forEach((id) => ids.add(id)));
  return Array.from(ids);
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function hydrateOriginalTextFromIds(sourceText: string, sourceSegmentIds: string[], segments: SourceSegment[], indexById: Map<string, number>): {
  originalText: string;
  sourceStartOffset?: number;
  sourceEndOffset?: number;
} {
  const selected = sourceSegmentIds
    .map((id) => segments[indexById.get(id) ?? -1])
    .filter((segment): segment is SourceSegment => Boolean(segment));

  if (!selected.length) {
    return { originalText: "" };
  }

  const indexes = selected.map((segment) => indexById.get(segment.sourceSegmentId) ?? -1);
  const contiguous = indexes.every((index, position) => position === 0 || index === indexes[position - 1] + 1);
  const sourceStartOffset = selected[0].startOffset;
  const sourceEndOffset = selected[selected.length - 1].endOffset;

  return {
    originalText: contiguous
      ? sourceText.slice(sourceStartOffset, sourceEndOffset)
      : selected.map((segment) => segment.text).join("\n"),
    sourceStartOffset,
    sourceEndOffset
  };
}

function scoreOriginalTextMatches(
  beats: Array<Partial<StoryBeat>>,
  sourceText: string,
  segments: SourceSegment[]
): number {
  const indexById = getSegmentIndexById(segments);
  return beats.reduce((score, beat) => {
    const originalText = normalizeForCompare(beat.originalText || "");
    if (!originalText || !beat.sourceSegmentIds?.length) return score;
    const hydrated = normalizeForCompare(
      hydrateOriginalTextFromIds(sourceText, beat.sourceSegmentIds, segments, indexById).originalText
    );
    if (!hydrated) return score;
    if (hydrated === originalText) return score + 4;
    if (hydrated.includes(originalText) || originalText.includes(hydrated)) return score + 2;
    if (hydrated.slice(0, 90) === originalText.slice(0, 90)) return score + 1;
    return score;
  }, 0);
}

function resolveSourceSegments(
  parsed: BeatAnalysisResult,
  sourceText: string,
  currentSegments: SourceSegment[],
  mode: SourceSegmenterMode
): ResolvedSourceSegments {
  const parsedVersion = parsed.sourceSegmenterVersion;
  if (mode === "current" || parsedVersion === SOURCE_SEGMENTER_VERSION) {
    return { segments: currentSegments, version: SOURCE_SEGMENTER_VERSION };
  }

  const legacySegments = segmentSourceTextByLegacyLines(sourceText);
  if (mode === "legacyLine" || parsedVersion === LEGACY_LINE_SEGMENTER_VERSION) {
    return { segments: legacySegments, version: LEGACY_LINE_SEGMENTER_VERSION };
  }

  const ids = collectSourceSegmentIds(parsed.beats || []);
  const maxId = Math.max(0, ...ids.map(getSourceSegmentNumericId));
  if (maxId > legacySegments.length && maxId <= currentSegments.length) {
    return { segments: currentSegments, version: SOURCE_SEGMENTER_VERSION };
  }
  if (maxId > currentSegments.length && maxId <= legacySegments.length) {
    return {
      segments: legacySegments,
      version: LEGACY_LINE_SEGMENTER_VERSION,
      notes: "Auto-selected legacy line-based source segment IDs because pasted JSON references IDs outside the current segmenter range."
    };
  }

  const currentScore = scoreOriginalTextMatches(parsed.beats || [], sourceText, currentSegments);
  const legacyScore = scoreOriginalTextMatches(parsed.beats || [], sourceText, legacySegments);
  if (legacyScore > currentScore) {
    return {
      segments: legacySegments,
      version: LEGACY_LINE_SEGMENTER_VERSION,
      notes: "Auto-selected legacy line-based source segment IDs because they match the pasted originalText more closely."
    };
  }

  if (!parsedVersion && currentSegments.length !== legacySegments.length && maxId <= legacySegments.length) {
    return {
      segments: legacySegments,
      version: LEGACY_LINE_SEGMENTER_VERSION,
      notes: "Auto-selected legacy line-based source segment IDs for metadata-free pasted JSON."
    };
  }

  return { segments: currentSegments, version: SOURCE_SEGMENTER_VERSION };
}

function findSourceOrder(beat: Partial<StoryBeat>, indexById: Map<string, number>, fallback: number): number {
  const ids = beat.sourceSegmentIds || [];
  const indexes = ids
    .map((id) => indexById.get(id))
    .filter((index): index is number => typeof index === "number");
  return indexes.length ? Math.min(...indexes) : Number.MAX_SAFE_INTEGER - fallback;
}

function groupConsecutiveSegments(segments: SourceSegment[]): SourceSegment[][] {
  const groups: SourceSegment[][] = [];
  for (const segment of segments) {
    const lastGroup = groups[groups.length - 1];
    const lastSegment = lastGroup?.[lastGroup.length - 1];
    if (lastGroup && lastSegment && segment.startOffset >= lastSegment.endOffset) {
      const expectedNext = Number(segment.sourceSegmentId.replace(SOURCE_SEGMENT_PREFIX, ""));
      const previous = Number(lastSegment.sourceSegmentId.replace(SOURCE_SEGMENT_PREFIX, ""));
      if (expectedNext === previous + 1) {
        lastGroup.push(segment);
        continue;
      }
    }
    groups.push([segment]);
  }
  return groups;
}

function chunkSegmentGroupByLength(group: SourceSegment[]): SourceSegment[][] {
  const chunks: SourceSegment[][] = [];
  let current: SourceSegment[] = [];
  let currentLength = 0;
  let currentWords = 0;

  for (const segment of group) {
    const segmentWords = countWords(segment.text);
    const nextLength = currentLength + segment.text.length + (current.length ? 1 : 0);
    const nextWords = currentWords + segmentWords;
    if (current.length && (nextLength > MAX_SEGMENT_CHARS || nextWords > MAX_SEGMENT_WORDS)) {
      chunks.push(current);
      current = [];
      currentLength = 0;
      currentWords = 0;
    }

    current.push(segment);
    currentLength += segment.text.length + (current.length > 1 ? 1 : 0);
    currentWords += segmentWords;
  }

  if (current.length) chunks.push(current);
  return chunks;
}

function createFallbackBeatForMissingSegments(
  sourceSegmentIds: string[],
  beforeBeat: Partial<StoryBeat> | undefined,
  afterBeat: Partial<StoryBeat> | undefined
): Partial<StoryBeat> {
  const referenceBeat = beforeBeat || afterBeat;
  return {
    screenId: referenceBeat?.screenId || "screen_001",
    sourceSegmentIds,
    summary: "Exact source text preserved automatically because the AI did not assign these source segments to a beat.",
    focusCharacters: referenceBeat?.focusCharacters || [],
    visibleCharacters: referenceBeat?.visibleCharacters || referenceBeat?.focusCharacters || [],
    offscreenPresentCharacters: referenceBeat?.offscreenPresentCharacters || [],
    characters: referenceBeat?.characters || referenceBeat?.visibleCharacters || referenceBeat?.focusCharacters || [],
    location: referenceBeat?.location || referenceBeat?.locationName || "Unknown",
    locationId: referenceBeat?.locationId,
    action: "Preserve this exact source text segment for storyboard analysis.",
    visualFocus: "Exact source text coverage.",
    atmosphere: referenceBeat?.atmosphere || "Neutral",
    timeOfDay: referenceBeat?.timeOfDay || "Unknown"
  };
}

function insertMissingSegmentFallbackBeats(beats: Array<Partial<StoryBeat>>, segments: SourceSegment[], indexById: Map<string, number>): Array<Partial<StoryBeat>> {
  const used = new Set<string>();
  beats.forEach((beat) => (beat.sourceSegmentIds || []).forEach((id) => used.add(id)));

  const missingBodySegments = segments.filter((segment) => segment.role !== "title" && !used.has(segment.sourceSegmentId));
  if (!missingBodySegments.length) return beats;

  const fallbackGroups = groupConsecutiveSegments(missingBodySegments)
    .flatMap((group) => chunkSegmentGroupByLength(group));

  const fallbackBeats = fallbackGroups.map((group) => {
    const firstOrder = indexById.get(group[0].sourceSegmentId) ?? 0;
    const beforeBeat = [...beats]
      .filter((beat) => findSourceOrder(beat, indexById, 0) < firstOrder)
      .sort((left, right) => findSourceOrder(right, indexById, 0) - findSourceOrder(left, indexById, 0))[0];
    const afterBeat = [...beats]
      .filter((beat) => findSourceOrder(beat, indexById, 0) > firstOrder)
      .sort((left, right) => findSourceOrder(left, indexById, 0) - findSourceOrder(right, indexById, 0))[0];

    return createFallbackBeatForMissingSegments(
      group.map((segment) => segment.sourceSegmentId),
      beforeBeat,
      afterBeat
    );
  });

  return [...beats, ...fallbackBeats];
}

function splitBeatByOriginalTextLength(
  beat: Partial<StoryBeat>,
  sourceText: string,
  segments: SourceSegment[],
  indexById: Map<string, number>
): Array<Partial<StoryBeat>> {
  const ids = beat.sourceSegmentIds || [];
  if (ids.length <= 1) return [beat];

  const chunks: string[][] = [];
  let current: string[] = [];

  for (const id of ids) {
    const candidate = [...current, id];
    const candidateText = hydrateOriginalTextFromIds(sourceText, candidate, segments, indexById).originalText;
    if (current.length && countWords(candidateText) > MAX_SEGMENT_WORDS) {
      chunks.push(current);
      current = [id];
    } else {
      current = candidate;
    }
  }

  if (current.length) chunks.push(current);
  if (chunks.length <= 1) return [beat];

  return chunks.map((sourceSegmentIds, index) => ({
    ...beat,
    sourceSegmentIds,
    summary: index === 0 ? beat.summary : `${beat.summary || "Continuation of visual beat"} (${index + 1})`
  }));
}

function repairScreensWithBeatIds(screens: StoryScreen[] | undefined, beats: StoryBeat[]): StoryScreen[] | undefined {
  if (!screens?.length) return screens;
  return screens.map((screen) => {
    const screenBeats = beats.filter((beat) => beat.screenId === screen.screenId);
    if (!screenBeats.length) return screen;
    const beatIds = screenBeats.map((beat) => beat.beatId);
    return {
      ...screen,
      beatIds,
      startBeatId: Math.min(...beatIds),
      endBeatId: Math.max(...beatIds)
    };
  });
}

function formatCoverageText(segments: SourceSegment[], limit = 2000): string {
  const text = segments.map((segment) => segment.text).join("\n");
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

export function validateSourceTextCoverage(beats: Array<Partial<StoryBeat>>, segments: SourceSegment[]): CoverageCheck {
  const counts = new Map<string, number>();
  beats.forEach((beat) => {
    (beat.sourceSegmentIds || []).forEach((id) => {
      counts.set(id, (counts.get(id) || 0) + 1);
    });
  });

  const requiredSegments = segments.filter((segment) => segment.role !== "title");
  const missingSegments = requiredSegments.filter((segment) => !counts.has(segment.sourceSegmentId));
  const duplicatedSegments = requiredSegments.filter((segment) => (counts.get(segment.sourceSegmentId) || 0) > 1);
  const ignoredTitleSegments = segments.filter((segment) => segment.role === "title" && !counts.has(segment.sourceSegmentId));

  return {
    allSourceTextCovered: missingSegments.length === 0 && duplicatedSegments.length === 0,
    missingText: formatCoverageText(missingSegments),
    duplicatedText: formatCoverageText(duplicatedSegments),
    notes: [
      `Coverage computed by code from sourceSegmentIds: ${requiredSegments.length - missingSegments.length}/${requiredSegments.length} body source segments covered.`,
      duplicatedSegments.length ? `${duplicatedSegments.length} source segments were assigned more than once.` : "",
      ignoredTitleSegments.length ? `${ignoredTitleSegments.length} likely title/header segment ignored for body coverage.` : ""
    ].filter(Boolean).join(" ")
  };
}

export function hydrateBeatAnalysisOriginalText(
  parsed: BeatAnalysisResult,
  sourceText: string,
  segments: SourceSegment[],
  options: HydrationOptions = { repairMissingSegments: true, segmentMode: "current" }
): BeatAnalysisResult {
  const sourceTextHash = hashSourceText(sourceText);
  const resolved = resolveSourceSegments(parsed, sourceText, segments, options.segmentMode || "current");
  const activeSegments = resolved.segments;
  const segmentById = new Map(activeSegments.map((segment) => [segment.sourceSegmentId, segment]));
  const indexById = getSegmentIndexById(activeSegments);
  const notes: string[] = [];

  if (parsed.sourceTextHash && parsed.sourceTextHash !== sourceTextHash) {
    notes.push("Source text hash mismatch; regenerated originalText from the current script, but Beat Analysis should be regenerated if the source text changed.");
  }
  if (resolved.notes) notes.push(resolved.notes);

  const preparedBeats = (parsed.beats || []).map((beat) => {
    let ids = beat.sourceSegmentIds;
    if (!Array.isArray(ids) || ids.length === 0) {
      const originalText = String(beat.originalText || "").trim();
      if (originalText) {
        const matched = activeSegments.filter((segment) => {
          const segmentText = String(segment.text || "").trim();
          if (!segmentText) return false;
          const normSegment = segmentText.replace(/\s+/g, " ").toLowerCase();
          const normOriginal = originalText.replace(/\s+/g, " ").toLowerCase();
          return normSegment.includes(normOriginal) || normOriginal.includes(normSegment);
        });
        if (matched.length > 0) {
          ids = matched.map((segment) => segment.sourceSegmentId);
        }
      }
    }
    return {
      ...beat,
      sourceSegmentIds: normalizeSourceSegmentIds(ids, segmentById, indexById)
    };
  });

  const beatsWithFallbacks = options.repairMissingSegments
    ? insertMissingSegmentFallbackBeats(preparedBeats, activeSegments, indexById)
    : preparedBeats;

  const fallbackBeatCount = Math.max(0, beatsWithFallbacks.length - preparedBeats.length);
  if (fallbackBeatCount) {
    notes.push(`Added ${fallbackBeatCount} fallback beat(s) for source segments the AI did not assign.`);
  }

  let splitSourceBeatCount = 0;
  const lengthRepairedBeats = options.splitLongBeats
    ? beatsWithFallbacks.flatMap((beat) => {
        const parts = splitBeatByOriginalTextLength(beat, sourceText, activeSegments, indexById);
        if (parts.length > 1) splitSourceBeatCount += 1;
        return parts;
      })
    : beatsWithFallbacks;
  const addedSplitBeatCount = Math.max(0, lengthRepairedBeats.length - beatsWithFallbacks.length);
  if (splitSourceBeatCount) {
    notes.push(`Auto-split ${splitSourceBeatCount} long beat(s) into ${splitSourceBeatCount + addedSplitBeatCount} beat(s) to keep originalText near ${TARGET_BEAT_WORD_MIN}-${TARGET_BEAT_WORD_MAX} words.`);
  }

  const sortedBeats = [...lengthRepairedBeats].sort((left, right) =>
    findSourceOrder(left, indexById, 0) - findSourceOrder(right, indexById, 0)
  );

  const hydratedBeats = sortedBeats.map<StoryBeat>((beat, index) => {
    const hydrated = hydrateOriginalTextFromIds(sourceText, beat.sourceSegmentIds || [], activeSegments, indexById);
    return {
      ...beat,
      beatId: index + 1,
      originalText: hydrated.originalText || beat.originalText || "",
      sourceStartOffset: hydrated.sourceStartOffset,
      sourceEndOffset: hydrated.sourceEndOffset
    } as StoryBeat;
  });

  const remainingLongBeats = hydratedBeats.filter((beat) => countWords(beat.originalText) > TARGET_BEAT_WORD_MAX);
  if (remainingLongBeats.length) {
    notes.push(`${remainingLongBeats.length} beat(s) still exceed ${TARGET_BEAT_WORD_MAX} words because their mapped source segment is already too long or cannot be split by sourceSegmentIds.`);
  }

  const repairNotes = [parsed.repairNotes, ...notes].filter(Boolean).join(" ");

  return {
    ...parsed,
    beats: hydratedBeats,
    screens: repairScreensWithBeatIds(parsed.screens, hydratedBeats),
    coverageCheck: validateSourceTextCoverage(hydratedBeats, activeSegments),
    sourceSegmenterVersion: resolved.version,
    sourceTextHash,
    targetBeatWordMin: TARGET_BEAT_WORD_MIN,
    targetBeatWordMax: TARGET_BEAT_WORD_MAX,
    repairNotes
  };
}

export interface BeatRhythmWarning {
  beatId: number;
  wordCount: number;
  type: "too_short" | "too_long";
  message: string;
}

export function validateBeatRhythm(beats: StoryBeat[]): BeatRhythmWarning[] {
  const warnings: BeatRhythmWarning[] = [];
  beats.forEach((beat) => {
    const wordCount = countWords(beat.originalText);
    if (wordCount < 20) {
      const isExcepted = beat.beatType === "transition" || beat.beatType === "reveal";
      if (!isExcepted) {
        warnings.push({
          beatId: beat.beatId,
          wordCount,
          type: "too_short",
          message: `Beat ${beat.beatId} is very short (${wordCount} words). Verify if this is a key transition, dialogue/reaction turn, or major reveal. Otherwise, consider merging it.`
        });
      }
    } else if (wordCount > 120) {
      warnings.push({
        beatId: beat.beatId,
        wordCount,
        type: "too_long",
        message: `Beat ${beat.beatId} is too long (${wordCount} words). Consider splitting it into separate visual moments to keep the illustration precise.`
      });
    }
  });
  return warnings;
}
