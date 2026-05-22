import type { FinalResult, FinalResultPanel, ScriptData } from "../types";

function cleanInlineText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function stripScenePrefix(value: string): string {
  return value.replace(/^\s*(INT\.|EXT\.)\s+/i, "").trim();
}

function getScenePrefix(panel: FinalResultPanel): string {
  const candidates = [
    panel.screen?.screenName,
    panel.screen?.location,
    panel.source?.location,
  ];

  for (const candidate of candidates) {
    const match = cleanInlineText(candidate).match(/^\s*(INT\.|EXT\.)\s+/i);
    if (match?.[1]) return match[1].toUpperCase();
  }

  return "";
}

function getPanelLocation(panel: FinalResultPanel): string {
  const rawLocation =
    cleanInlineText(panel.screen?.location) ||
    cleanInlineText(panel.source?.location) ||
    "UNKNOWN LOCATION";

  return stripScenePrefix(rawLocation).toUpperCase();
}

function getPanelTime(panel: FinalResultPanel): string {
  return (
    cleanInlineText(panel.screen?.timeOfDay) ||
    cleanInlineText(panel.source?.timeOfDay) ||
    "TIME UNKNOWN"
  ).toUpperCase();
}

function getSceneHeading(panel: FinalResultPanel): string {
  const prefix = getScenePrefix(panel);
  const location = getPanelLocation(panel);
  const time = getPanelTime(panel);
  return prefix ? `${prefix} ${location} - ${time}` : `${location} - ${time}`;
}

function getSceneGroupKey(panel: FinalResultPanel, index: number): string {
  const screenId = cleanInlineText(panel.screen?.screenId || panel.refs?.screenId);
  if (screenId) return `screen:${screenId}`;

  const screenName = cleanInlineText(panel.screen?.screenName);
  if (screenName) return `screen-name:${screenName}`;

  const location = cleanInlineText(panel.screen?.location || panel.source?.location);
  if (location) return `location:${location}|${getPanelTime(panel)}`;

  return `panel:${index}`;
}

interface StorySceneGroup {
  key: string;
  heading: string;
  lines: string[];
}

export function buildScreenplayStoryTxtFromFinalResult(
  finalResult: FinalResult | null,
  inputData: ScriptData
): string {
  const panels = Array.isArray(finalResult?.panels) ? finalResult.panels : [];
  const groups: StorySceneGroup[] = [];

  panels.forEach((panel, index) => {
    const line = cleanInlineText(panel.source?.originalText || panel.originalText);
    if (!line) return;

    const key = getSceneGroupKey(panel, index);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup?.key === key) {
      lastGroup.lines.push(line);
      return;
    }

    groups.push({
      key,
      heading: getSceneHeading(panel),
      lines: [line],
    });
  });

  if (groups.length === 0) return "";

  const title = (cleanInlineText(inputData.title) || "Untitled Story").toUpperCase();
  const scenes = groups.map((group) =>
    [`### ${group.heading}`, "", group.lines.join("\n\n")].join("\n")
  );

  return [`# ${title}`, "", "", scenes.join("\n\n\n")].join("\n").trimEnd();
}
