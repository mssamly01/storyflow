import type { FinalResult, StoryBeat } from "../types";

export interface SubtitleItem {
  index: number;
  text: string;
}

export interface SubtitleExportOptions {
  durationPerItemSeconds?: number;
  startOffsetSeconds?: number;
}

function sanitizeSubtitleText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatSrtTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const ms = String(milliseconds).padStart(3, "0");

  return `${hh}:${mm}:${ss},${ms}`;
}

export function buildSrtFromItems(
  items: SubtitleItem[],
  options: SubtitleExportOptions = {}
): string {
  const duration = options.durationPerItemSeconds ?? 5;
  const startOffset = options.startOffsetSeconds ?? 0;

  return items
    .filter((item) => item.text.trim().length > 0)
    .map((item, arrayIndex) => {
      const subtitleIndex = arrayIndex + 1;
      const startSeconds = startOffset + arrayIndex * duration;
      const endSeconds = startSeconds + duration;

      return [
        String(subtitleIndex),
        `${formatSrtTimestamp(startSeconds)} --> ${formatSrtTimestamp(endSeconds)}`,
        sanitizeSubtitleText(item.text),
      ].join("\n");
    })
    .join("\n\n");
}

export function buildTxtFromItems(items: SubtitleItem[]): string {
  return items
    .filter((item) => item.text.trim().length > 0)
    .map((item) => sanitizeSubtitleText(item.text))
    .join("\n");
}

export function extractSubtitleItemsFromFinalResult(
  finalResult: FinalResult | null | undefined
): SubtitleItem[] {
  if (!finalResult?.panels || !Array.isArray(finalResult.panels)) {
    return [];
  }

  return finalResult.panels.map((panel, index) => ({
    index: index + 1,
    text: panel.source?.originalText ?? "",
  }));
}

export function extractSubtitleItemsFromBeats(beats: StoryBeat[]): SubtitleItem[] {
  return beats.map((beat, index) => ({
    index: index + 1,
    text: beat.originalText ?? "",
  }));
}

export function buildImagePromptTxtFromFinalResult(
  finalResult: FinalResult | null | undefined
): string {
  if (!finalResult?.panels || !Array.isArray(finalResult.panels)) {
    return "";
  }

  return finalResult.panels
    .map((panel) => {
      const visualPrompt = panel.prompt?.visualPrompt ?? "";
      // Normalize to single line: replace all whitespace (including newlines) with single space
      return visualPrompt.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}
