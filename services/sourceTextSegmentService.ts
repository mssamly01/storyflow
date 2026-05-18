import type {
  BeatAnalysisResult,
  CoverageCheck,
  SourceSegment,
  StoryBeat,
  StoryScreen
} from "../types";

const MAX_SEGMENT_CHARS = 700;
const SOURCE_SEGMENT_PREFIX = "src_";
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
  if (endOffset - startOffset <= MAX_SEGMENT_CHARS) {
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

  if (ranges.length <= 1 && endOffset - startOffset > MAX_SEGMENT_CHARS) {
    return splitRangeByWhitespace(sourceText, startOffset, endOffset);
  }

  return ranges;
}

function splitRangeByWhitespace(sourceText: string, startOffset: number, endOffset: number): Array<{ startOffset: number; endOffset: number }> {
  const ranges: Array<{ startOffset: number; endOffset: number }> = [];
  let currentStart = startOffset;

  while (currentStart < endOffset) {
    const targetEnd = Math.min(currentStart + MAX_SEGMENT_CHARS, endOffset);
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

  for (const segment of group) {
    const nextLength = currentLength + segment.text.length + (current.length ? 1 : 0);
    if (current.length && nextLength > MAX_SEGMENT_CHARS) {
      chunks.push(current);
      current = [];
      currentLength = 0;
    }

    current.push(segment);
    currentLength += segment.text.length + (current.length > 1 ? 1 : 0);
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
  options: { repairMissingSegments?: boolean } = { repairMissingSegments: true }
): BeatAnalysisResult {
  const segmentById = new Map(segments.map((segment) => [segment.sourceSegmentId, segment]));
  const indexById = getSegmentIndexById(segments);

  const preparedBeats = (parsed.beats || []).map((beat) => ({
    ...beat,
    sourceSegmentIds: normalizeSourceSegmentIds(beat.sourceSegmentIds, segmentById, indexById)
  }));

  const beatsWithFallbacks = options.repairMissingSegments
    ? insertMissingSegmentFallbackBeats(preparedBeats, segments, indexById)
    : preparedBeats;

  const sortedBeats = [...beatsWithFallbacks].sort((left, right) =>
    findSourceOrder(left, indexById, 0) - findSourceOrder(right, indexById, 0)
  );

  const hydratedBeats = sortedBeats.map<StoryBeat>((beat, index) => {
    const hydrated = hydrateOriginalTextFromIds(sourceText, beat.sourceSegmentIds || [], segments, indexById);
    return {
      ...beat,
      beatId: index + 1,
      originalText: hydrated.originalText || beat.originalText || "",
      sourceStartOffset: hydrated.sourceStartOffset,
      sourceEndOffset: hydrated.sourceEndOffset
    } as StoryBeat;
  });

  return {
    ...parsed,
    beats: hydratedBeats,
    screens: repairScreensWithBeatIds(parsed.screens, hydratedBeats),
    coverageCheck: validateSourceTextCoverage(hydratedBeats, segments)
  };
}
