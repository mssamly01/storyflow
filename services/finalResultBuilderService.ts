import type {
  CharacterProfile,
  EngineerPrompt,
  FinalResult,
  FinalResultPanel,
  LocationProfile,
  QAResult,
  StoryBeat,
  StoryboardPanel
} from "../types";
import { getPanelSourceBundle } from "./sourceOfTruthService";
import { normalizeStoryboardPanels, sanitizeStoryboardPanels } from "./storyboardDataService";

type UnknownRecord = Record<string, any>;

export function parseJsonSafe<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

const normalizeText = (value?: string) => (value || "").trim().toLowerCase();
const asArray = (value: unknown): UnknownRecord[] => Array.isArray(value) ? value as UnknownRecord[] : [];
const asNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

function getItems(raw: unknown, keys: string[]): UnknownRecord[] {
  if (Array.isArray(raw)) return raw as UnknownRecord[];
  if (!raw || typeof raw !== "object") return [];
  const record = raw as UnknownRecord;
  for (const key of keys) {
    const items = asArray(record[key]);
    if (items.length) return items;
  }
  return [];
}

export function normalizeEngineerPrompts(raw: unknown): EngineerPrompt[] {
  return getItems(raw, ["engineerPrompts", "prompts", "panels", "results"]).map((item, index) => ({
    panelNumber: asNumber(item.panelNumber ?? item.panel_number, index + 1),
    panelId: item.panelId ?? item.panel_id,
    beatId: asNumber(item.beatId ?? item.beat_id, 0) || undefined,
    visualPrompt: item.visualPrompt ?? item.visual_prompt ?? "",
    negativePrompt: item.negativePrompt ?? item.negative_prompt ?? "",
    negative_prompt: item.negative_prompt,
    notes: item.notes,
    sourceUsage: item.sourceUsage ?? item.source_usage
  }));
}

export function normalizeQAResults(raw: unknown): QAResult[] {
  return getItems(raw, ["qaResults", "results", "panels"]).map((item, index) => {
    const issues = Array.isArray(item.issues)
      ? item.issues
      : item.qaNotes
        ? [String(item.qaNotes)]
        : [];
    const qaNotes = item.qaNotes ?? item.qa_notes ?? "";
    const rawStatus = item.status ?? (
      String(qaNotes).toLowerCase().includes("pass") ? "pass" : undefined
    );

    return {
      panelNumber: asNumber(item.panelNumber ?? item.panel_number, index + 1),
      panelId: item.panelId ?? item.panel_id,
      beatId: asNumber(item.beatId ?? item.beat_id, 0) || undefined,
      status: rawStatus ?? "unchecked",
      issues,
      suggestedPromptPatch: item.suggestedPromptPatch ?? item.suggested_prompt_patch ?? "",
      visualPrompt: item.visualPrompt ?? item.visual_prompt,
      qaNotes
    };
  });
}

export function normalizeBeats(raw: unknown): StoryBeat[] {
  if (Array.isArray(raw)) return raw as StoryBeat[];
  if (raw && typeof raw === "object" && Array.isArray((raw as { beats?: unknown }).beats)) {
    return (raw as { beats: StoryBeat[] }).beats;
  }
  return [];
}

export function normalizeCharacterLocationLibrary(raw: unknown): {
  characters: CharacterProfile[];
  locations: LocationProfile[];
} {
  if (!raw || typeof raw !== "object") return { characters: [], locations: [] };
  const record = raw as UnknownRecord;
  return {
    characters: Array.isArray(record.characters) ? record.characters : [],
    locations: Array.isArray(record.locations) ? record.locations : []
  };
}

function findEngineerPromptForPanel(
  panel: StoryboardPanel,
  prompts: EngineerPrompt[]
): EngineerPrompt | null {
  return prompts.find((item) => item.panelId && item.panelId === panel.panelId)
    ?? prompts.find((item) => item.beatId && item.beatId === panel.beatId)
    ?? prompts.find((item) => item.panelNumber && item.panelNumber === panel.panelNumber)
    ?? null;
}

function findQAResultForPanel(
  panel: StoryboardPanel,
  qaResults: QAResult[]
): QAResult | null {
  return qaResults.find((item) => item.panelId && item.panelId === panel.panelId)
    ?? qaResults.find((item) => item.beatId && item.beatId === panel.beatId)
    ?? qaResults.find((item) => item.panelNumber && item.panelNumber === panel.panelNumber)
    ?? null;
}

function getCharacterIds(
  visibleCharacters: string[],
  matchedCharacters: CharacterProfile[],
  allCharacters: CharacterProfile[]
): string[] {
  const candidates = matchedCharacters.length ? matchedCharacters : allCharacters;
  const visibleSet = new Set(visibleCharacters.map(normalizeText));

  return candidates
    .filter((character) => {
      if (!visibleSet.size && matchedCharacters.length) return true;
      if (visibleSet.has(normalizeText(character.name))) return true;
      return (character.aliases || []).some((alias) => visibleSet.has(normalizeText(alias)));
    })
    .map((character) => character.characterId)
    .filter((id): id is string => Boolean(id));
}

export function buildFinalResultPanel(params: {
  panel: StoryboardPanel;
  beats: StoryBeat[];
  engineerPrompts: EngineerPrompt[];
  qaResults: QAResult[];
  characters: CharacterProfile[];
  locations: LocationProfile[];
}): FinalResultPanel {
  const { panel, beats, engineerPrompts, qaResults, characters, locations } = params;
  const bundle = getPanelSourceBundle(panel, beats, characters, locations);
  const source = bundle.sourceFields;
  const prompt = findEngineerPromptForPanel(panel, engineerPrompts);
  const qa = findQAResultForPanel(panel, qaResults);
  const finalVisualPrompt = qa?.visualPrompt || prompt?.visualPrompt || "";
  const negativePrompt = prompt?.negativePrompt || prompt?.negative_prompt || "text, speech bubbles, watermark, low quality, blurry";
  const qaStatus = qa?.status || "unchecked";
  const qaIssues = qa?.issues || [];
  const qaPatch = qa?.suggestedPromptPatch || "";
  const panelNumber = panel.panelNumber || prompt?.panelNumber || qa?.panelNumber || 0;
  const beatId = panel.beatId || prompt?.beatId || qa?.beatId || panelNumber;
  const subject = source.visibleCharacters.length
    ? source.visibleCharacters.join(", ")
    : source.visualFocus || source.summary || "N/A";

  return {
    panelId: panel.panelId || `panel_${String(panelNumber || 1).padStart(3, "0")}`,
    panelNumber,
    beatId,
    source: {
      originalText: source.originalText,
      summary: source.summary,
      timeOfDay: source.timeOfDay,
      location: source.locationName,
      locationId: source.locationId,
      locationState: source.locationState,
      visibleCharacters: source.visibleCharacters,
      props: source.props,
      action: source.action,
      interaction: source.interaction,
      posture: source.posture,
      atmosphere: source.atmosphere,
      visualFocus: source.visualFocus
    },
    storyboard: {
      shotType: panel.shotType || "",
      cameraAngle: panel.cameraAngle || "",
      cameraDistance: panel.cameraDistance,
      lensFeel: panel.lensFeel,
      composition: panel.composition || panel.framing || "",
      foreground: panel.foreground || "",
      midground: panel.midground || "",
      background: panel.background || "",
      characterBlocking: panel.characterBlocking || [],
      lightingDirection: panel.lightingDirection || panel.lighting || "",
      depthAndPerspective: panel.depthAndPerspective || "",
      visualEmphasis: panel.visualEmphasis || "",
      cameraNotes: panel.cameraNotes || panel.continuityNotes || ""
    },
    prompt: {
      visualPrompt: finalVisualPrompt,
      negativePrompt
    },
    qa: {
      status: qaStatus,
      issues: qaIssues,
      suggestedPromptPatch: qaPatch
    },
    refs: {
      characterIds: getCharacterIds(source.visibleCharacters, bundle.characters, characters),
      locationId: source.locationId || bundle.location?.locationId
    },
    originalText: source.originalText,
    cameraAngle: panel.cameraAngle || "",
    framing: panel.composition || panel.framing || "",
    subject,
    action: source.action,
    location_cues: source.locationName,
    lighting: panel.lightingDirection || panel.lighting || bundle.location?.lighting || "",
    visualPrompt: finalVisualPrompt,
    negative_prompt: negativePrompt,
    qaNotes: [qaStatus, ...qaIssues, qaPatch].filter(Boolean).join("; ")
  };
}

export function buildFinalResult(params: {
  beats: StoryBeat[];
  panels: StoryboardPanel[];
  engineerPrompts: EngineerPrompt[];
  qaResults: QAResult[];
  characters: CharacterProfile[];
  locations: LocationProfile[];
}): FinalResult {
  const panels = sanitizeStoryboardPanels(normalizeStoryboardPanels(params.panels));
  const finalPanels = panels.map((panel) => buildFinalResultPanel({
    panel,
    beats: params.beats,
    engineerPrompts: params.engineerPrompts,
    qaResults: params.qaResults,
    characters: params.characters,
    locations: params.locations
  }));

  return {
    panels: finalPanels,
    metadata: {
      totalPanels: finalPanels.length,
      generatedAt: new Date().toISOString(),
      source: "code-builder"
    }
  };
}
