import type {
  CharacterProfile,
  EngineerPrompt,
  FinalResult,
  FinalResultPanel,
  LocationProfile,
  QAResult,
  StoryBeat,
  StoryScreen,
  StoryboardPanel,
  ScreenCharacterState,
  BeatCharacterMomentDetail
} from "../types";
import { getPanelSourceBundle } from "./sourceOfTruthService";
import { normalizeStoryboardPanels, sanitizeStoryboardPanels } from "./storyboardDataService";
import { cleanVisualPrompt } from "./visualPromptCleanupService";

type UnknownRecord = Record<string, any>;

export interface FinalResultBuildCheck {
  canBuild: boolean;
  missingInputs: string[];
  warnings: string[];
}

export const DEFAULT_NEGATIVE_PROMPT =
  "low quality, blurry, low resolution, bad anatomy, extra fingers, missing fingers, deformed hands, distorted face, inconsistent character design, wrong outfit, changed hairstyle, changed eye color, random extra characters, missing approved characters, random furniture, changed location layout, inconsistent background, missing key objects, unreadable text, speech bubbles, captions, subtitles, watermark, logo, heavy shadows";

export function ensureVisualPromptHasNegativePrompt(
  visualPrompt: string,
  legacyNegativePrompt?: string
): string {
  const trimmedPrompt = (visualPrompt || "").trim();
  const negativeText = (legacyNegativePrompt || DEFAULT_NEGATIVE_PROMPT).trim();

  if (!trimmedPrompt) return `Negative prompt: ${negativeText}`;
  if (/negative prompt\s*:/i.test(trimmedPrompt)) return trimmedPrompt;
  return `${trimmedPrompt}\n\nNegative prompt: ${negativeText}`;
}

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
const asString = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const asStringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.map((item) => String(item)).filter(Boolean)
  : [];

const asNumberArray = (value: unknown): number[] => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
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
  return getItems(raw, ["engineerPrompts", "prompts", "panels", "results"]).map((item, index) => {
    const visualPrompt = item.visualPrompt ?? item.visual_prompt ?? "";
    const legacyNegativePrompt = item.negativePrompt ?? item.negative_prompt ?? "";

    return {
      beatId: asNumber(item.beatId ?? item.beat_id ?? item.panelNumber ?? item.panel_number, index + 1),
      visualPrompt: ensureVisualPromptHasNegativePrompt(cleanVisualPrompt(visualPrompt), legacyNegativePrompt),
      meta: item.meta
    };
  });
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
      beatId: asNumber(item.beatId ?? item.beat_id ?? item.panelNumber ?? item.panel_number, index + 1),
      status: rawStatus ?? "unchecked",
      issues,
      suggestedPromptPatch: item.suggestedPromptPatch ?? item.suggested_prompt_patch ?? "",
      visualPrompt: item.visualPrompt ?? item.visual_prompt,
      qaNotes
    };
  });
}

export function normalizeScreenCharacterStates(raw: any): ScreenCharacterState[] {
  const items = raw?.screenCharacterStates ?? raw?.screen_character_states ?? [];
  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    characterName: item.characterName ?? item.character_name ?? item.name ?? "",
    characterId: item.characterId ?? item.character_id,
    outfit: item.outfit ?? "",
    outfitMainColor: item.outfitMainColor ?? item.outfit_main_color,
    outfitAccentColor: item.outfitAccentColor ?? item.outfit_accent_color,
    accessories: asStringArray(item.accessories),
    handheldItems: asStringArray(item.handheldItems ?? item.handheld_items),
    appearanceNotes: item.appearanceNotes ?? item.appearance_notes ?? "",
    stateChanges: asStringArray(item.stateChanges ?? item.state_changes),
  }));
}

export function normalizeCharacterMomentDetails(raw: any): BeatCharacterMomentDetail[] {
  const items = raw?.characterMomentDetails ?? raw?.character_moment_details ?? [];
  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    characterName: item.characterName ?? item.character_name ?? item.name ?? "",
    characterId: item.characterId ?? item.character_id,
    visibleAccessories: asStringArray(item.visibleAccessories ?? item.visible_accessories),
    handheldItems: asStringArray(item.handheldItems ?? item.handheld_items),
    accessoriesChange: asStringArray(item.accessoriesChange ?? item.accessories_change),
    momentNotes: item.momentNotes ?? item.moment_notes ?? "",
    poseRefinement: item.poseRefinement ?? item.pose_refinement ?? "",
    expression: item.expression ?? "",
  }));
}

export function normalizeScreens(raw: unknown): StoryScreen[] {
  return getItems(raw, ["screens", "storyScreens"]).map((item, index) => {
    const screenNumber = asNumber(item.screenNumber ?? item.screen_number, index + 1);
    return {
      screenId: asString(item.screenId ?? item.screen_id, `screen_${String(screenNumber).padStart(3, "0")}`),
      screenNumber,
      screenName: asString(item.screenName ?? item.screen_name, `Screen ${screenNumber}`),
      location: asString(item.location),
      locationId: asString(item.locationId ?? item.location_id, undefined as unknown as string),
      timeOfDay: asString(item.timeOfDay ?? item.time_of_day),
      screenState: asString(item.screenState ?? item.screen_state),
      screenCharacters: asStringArray(item.screenCharacters ?? item.screen_characters),
      screenProps: asStringArray(item.screenProps ?? item.screen_props),
      startBeatId: asNumber(item.startBeatId ?? item.start_beat_id, 0),
      endBeatId: asNumber(item.endBeatId ?? item.end_beat_id, 0),
      beatIds: (item.beatIds ?? item.beat_ids) ? asNumberArray(item.beatIds ?? item.beat_ids) : undefined,
      summary: asString(item.summary),
      continuityNotes: asString(item.continuityNotes ?? item.continuity_notes),
      screenCharacterStates: normalizeScreenCharacterStates(item),
      meta: item.meta
    };
  });
}

export function normalizeBeats(raw: unknown): StoryBeat[] {
  const items = getItems(raw, ["beats"]);
  return items.map((item, index) => {
    const beatId = asNumber(item.beatId ?? item.beat_id, index + 1);
    const legacyCharacters = asStringArray(item.characters ?? item.charactersInvolved ?? item.characters_involved);
    const focusCharacters = asStringArray(item.focusCharacters ?? item.focus_characters);
    const visibleCharacters = asStringArray(item.visibleCharacters ?? item.visible_characters);
    const offscreenPresentCharacters = asStringArray(item.offscreenPresentCharacters ?? item.offscreen_present_characters);

    return {
      ...item,
      beatId,
      screenId: asString(item.screenId ?? item.screen_id, "screen_001"),
      originalText: asString(item.originalText ?? item.original_text),
      summary: asString(item.summary),
      characters: legacyCharacters,
      focusCharacters: focusCharacters.length ? focusCharacters : legacyCharacters,
      visibleCharacters: visibleCharacters.length ? visibleCharacters : (focusCharacters.length ? focusCharacters : legacyCharacters),
      offscreenPresentCharacters,
      location: asString(item.location ?? item.locationName ?? item.location_name),
      locationId: asString(item.locationId ?? item.location_id),
      locationState: asString(item.locationState ?? item.location_state),
      action: asString(item.action ?? item.actionAnalysis ?? item.action_analysis),
      interaction: asString(item.interaction),
      posture: asString(item.posture),
      props: asStringArray(item.props),
      visualFocus: asString(item.visualFocus ?? item.visual_focus),
      atmosphere: asString(item.atmosphere),
      timeOfDay: asString(item.timeOfDay ?? item.time_of_day),
      characterMomentDetails: normalizeCharacterMomentDetails(item),
      meta: item.meta
    } as StoryBeat;
  });
}

export function normalizeScreenContinuity(raw: unknown): StoryScreen[] {
  return normalizeScreens(raw);
}

export function normalizeBeatMomentDetails(raw: unknown): any[] {
  return getItems(raw, ["beatDetails", "beats", "details"]).map((item, index) => {
    const beatId = asNumber(item.beatId ?? item.beat_id, index + 1);
    const characterMomentDetails = asArray(item.characterMomentDetails ?? item.character_moment_details ?? []).map((cmd: any) => ({
      characterName: cmd.characterName ?? cmd.character_name ?? cmd.name ?? "",
      characterId: cmd.characterId ?? cmd.character_id,
      poseRefinement: cmd.poseRefinement ?? cmd.pose_refinement ?? "",
      expression: cmd.expression ?? "",
      handheldItems: asStringArray(cmd.handheldItems ?? cmd.handheld_items ?? [])
    }));

    return {
      beatId,
      screenId: asString(item.screenId ?? item.screen_id),
      locationState: asString(item.locationState ?? item.location_state),
      posture: asString(item.posture),
      interaction: asString(item.interaction),
      props: asStringArray(item.props),
      characterMomentDetails
    };
  });
}

export function mergeScreenContinuityIntoScreens(
  screens: StoryScreen[],
  screenContinuityRaw: unknown
): StoryScreen[] {
  if (!screenContinuityRaw) return screens;
  const continuityScreens = normalizeScreenContinuity(screenContinuityRaw);
  if (!continuityScreens.length) return screens;

  return screens.map((screen) => {
    const matched = continuityScreens.find(
      (c) => c.screenId === screen.screenId || c.screenNumber === screen.screenNumber
    );
    if (!matched) return screen;

    return {
      ...screen,
      beatIds: matched.beatIds?.length ? matched.beatIds : screen.beatIds,
      startBeatId: matched.startBeatId ?? screen.startBeatId,
      endBeatId: matched.endBeatId ?? screen.endBeatId,
      screenState: matched.screenState || screen.screenState,
      screenProps: matched.screenProps?.length ? matched.screenProps : screen.screenProps,
      continuityNotes: matched.continuityNotes || screen.continuityNotes,
      screenCharacterStates: matched.screenCharacterStates?.length
        ? matched.screenCharacterStates
        : screen.screenCharacterStates
    };
  });
}

export function mergeBeatMomentDetailsIntoBeats(
  beats: StoryBeat[],
  beatMomentDetailsRaw: unknown
): StoryBeat[] {
  if (!beatMomentDetailsRaw) return beats;
  const details = normalizeBeatMomentDetails(beatMomentDetailsRaw);
  if (!details.length) return beats;

  return beats.map((beat) => {
    const matched = details.find((d) => d.beatId === beat.beatId);
    if (!matched) return beat;

    const characterMomentDetails = matched.characterMomentDetails?.map((cmd: any) => {
      const existing = beat.characterMomentDetails?.find(
        (e) => e.characterName === cmd.characterName || e.characterId === cmd.characterId
      );
      return {
        characterName: cmd.characterName,
        characterId: cmd.characterId,
        poseRefinement: cmd.poseRefinement,
        expression: cmd.expression,
        handheldItems: cmd.handheldItems,
        visibleAccessories: existing?.visibleAccessories || [],
        accessoriesChange: existing?.accessoriesChange || [],
        momentNotes: existing?.momentNotes || ""
      };
    }) || beat.characterMomentDetails;

    return {
      ...beat,
      locationState: matched.locationState || beat.locationState,
      posture: matched.posture || beat.posture,
      interaction: matched.interaction || beat.interaction,
      props: matched.props?.length ? matched.props : beat.props,
      characterMomentDetails
    };
  });
}

export function createFallbackScreensFromBeats(beats: StoryBeat[]): StoryScreen[] {
  if (!beats.length) return [];

  const grouped = new Map<string, StoryBeat[]>();
  for (const beat of beats) {
    const key = beat.screenId && beat.screenId !== "screen_001"
      ? beat.screenId
      : `${beat.locationId || beat.location || beat.locationName || "Unknown"}|${beat.timeOfDay || "Unknown"}`;
    grouped.set(key, [...(grouped.get(key) || []), beat]);
  }

  return Array.from(grouped.values()).map((group, index) => {
    const first = group[0];
    const screenNumber = index + 1;
    const screenId = first.screenId && first.screenId !== "screen_001"
      ? first.screenId
      : `screen_${String(screenNumber).padStart(3, "0")}`;
    return {
      screenId,
      screenNumber,
      screenName: `${first.location || first.locationName || "Unknown Location"} - ${first.timeOfDay || "Unknown Time"}`,
      location: first.location || first.locationName || "",
      locationId: first.locationId,
      timeOfDay: first.timeOfDay || "",
      screenState: first.locationState || "",
      screenCharacters: Array.from(new Set(group.flatMap((beat) => [
        ...(beat.focusCharacters || []),
        ...(beat.visibleCharacters || []),
        ...(beat.offscreenPresentCharacters || []),
        ...(beat.characters || []),
        ...(beat.charactersInvolved || [])
      ]).filter(Boolean))),
      screenProps: Array.from(new Set(group.flatMap((beat) => beat.props || []).filter(Boolean))),
      startBeatId: group[0].beatId,
      endBeatId: group[group.length - 1].beatId,
      summary: `Fallback screen from beats ${group[0].beatId}-${group[group.length - 1].beatId}`,
      continuityNotes: "Generated fallback screen from legacy beat data."
    };
  });
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
  return prompts.find((item) => item.beatId && item.beatId === panel.beatId)
    ?? prompts.find((item) => item.panelId && panel.panelId && item.panelId === panel.panelId)
    ?? prompts.find((item) => item.panelNumber && panel.panelNumber && item.panelNumber === panel.panelNumber)
    ?? null;
}

function findQAResultForPanel(
  panel: StoryboardPanel,
  qaResults: QAResult[]
): QAResult | null {
  return qaResults.find((item) => item.beatId && item.beatId === panel.beatId)
    ?? qaResults.find((item) => item.panelId && panel.panelId && item.panelId === panel.panelId)
    ?? qaResults.find((item) => item.panelNumber && panel.panelNumber && item.panelNumber === panel.panelNumber)
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
  screens?: StoryScreen[];
  beats: StoryBeat[];
  engineerPrompts: EngineerPrompt[];
  qaResults: QAResult[];
  characters: CharacterProfile[];
  locations: LocationProfile[];
}): FinalResultPanel {
  const { panel, screens = [], beats, engineerPrompts, qaResults, characters, locations } = params;
  const bundle = getPanelSourceBundle(panel, beats, characters, locations);
  const source = bundle.sourceFields;
  const prompt = findEngineerPromptForPanel(panel, engineerPrompts);
  const qa = findQAResultForPanel(panel, qaResults);
  const finalVisualPrompt = ensureVisualPromptHasNegativePrompt(cleanVisualPrompt(
    qa?.visualPrompt || prompt?.visualPrompt || ""
  ));
  const qaStatus = qa?.status || "unchecked";
  const qaIssues = qa?.issues || [];
  const qaPatch = qa?.suggestedPromptPatch || "";
  const beatId = panel.beatId || prompt?.beatId || qa?.beatId || panel.panelNumber || 0;
  const subject = source.visibleCharacters.length
    ? source.visibleCharacters.join(", ")
    : source.visualFocus || source.summary || "N/A";
  let screen = screens.find((item) => item.screenId && item.screenId === bundle.beat?.screenId);
  if (!screen && beatId > 0) {
    screen = screens.find((item) => {
      if (Array.isArray(item.beatIds) && item.beatIds.includes(beatId)) return true;
      if (
        item.startBeatId != null &&
        item.endBeatId != null &&
        beatId >= item.startBeatId &&
        beatId <= item.endBeatId
      ) {
        return true;
      }
      return false;
    });
  }
  const characterRefNames = Array.from(new Set([
    ...(screen?.screenCharacters || []),
    ...source.focusCharacters,
    ...source.visibleCharacters,
    ...source.offscreenPresentCharacters
  ].filter(Boolean)));

  return {
    beatId,
    screenId: bundle.beat?.screenId,
    screen: screen ? {
      screenId: screen.screenId,
      screenName: screen.screenName,
      location: screen.location,
      locationId: screen.locationId,
      timeOfDay: screen.timeOfDay,
      screenCharacters: screen.screenCharacters,
      screenProps: screen.screenProps,
      screenState: screen.screenState,
      continuityNotes: screen.continuityNotes,
      screenCharacterStates: screen.screenCharacterStates
    } : undefined,
    source: {
      originalText: source.originalText,
      summary: source.summary,
      timeOfDay: source.timeOfDay,
      location: source.locationName,
      locationId: source.locationId,
      locationState: source.locationState,
      focusCharacters: source.focusCharacters,
      visibleCharacters: source.visibleCharacters,
      offscreenPresentCharacters: source.offscreenPresentCharacters,
      props: source.props,
      action: source.action,
      interaction: source.interaction,
      posture: source.posture,
      atmosphere: source.atmosphere,
      visualFocus: source.visualFocus,
      characterMomentDetails: bundle.beat?.characterMomentDetails
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
      visualPrompt: finalVisualPrompt
    },
    qa: {
      status: qaStatus,
      issues: qaIssues,
      suggestedPromptPatch: qaPatch
    },
    refs: {
      characterIds: getCharacterIds(characterRefNames, bundle.characters, characters),
      locationId: source.locationId || bundle.location?.locationId,
      screenId: bundle.beat?.screenId
    },
    originalText: source.originalText,
    cameraAngle: panel.cameraAngle || "",
    framing: panel.composition || panel.framing || "",
    subject,
    action: source.action,
    location_cues: source.locationName,
    lighting: panel.lightingDirection || panel.lighting || bundle.location?.lighting || "",
    visualPrompt: finalVisualPrompt,
    qaNotes: [qaStatus, ...qaIssues, qaPatch].filter(Boolean).join("; ")
  };
}

export function buildFinalResult(params: {
  screens?: StoryScreen[];
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
    screens: params.screens,
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

export function getFinalResultMissingInputs(params: {
  beats: StoryBeat[];
  panels: StoryboardPanel[];
  engineerPrompts: EngineerPrompt[];
  qaResults: QAResult[];
  characters: CharacterProfile[];
  locations: LocationProfile[];
}): FinalResultBuildCheck {
  const missingInputs: string[] = [];
  const warnings: string[] = [];

  if (!params.beats?.length) missingInputs.push("Beat Analysis");
  if (!params.panels?.length) missingInputs.push("Storyboard Panels");
  if (!params.engineerPrompts?.length) missingInputs.push("Prompt Engineering");
  if (!params.characters?.length) warnings.push("Character Library is empty.");
  if (!params.locations?.length) warnings.push("Location Library is empty.");
  if (!params.qaResults?.length) warnings.push("QA results are empty. Final Result can still be built, but QA status will be unchecked.");

  return {
    canBuild: missingInputs.length === 0,
    missingInputs,
    warnings
  };
}

export function findScreenContinuityForBeat(
  beatId: number,
  screenId: string | undefined,
  continuityItems: any[]
): any | undefined {
  if (screenId) {
    const byScreenId = continuityItems.find((item) => item.screenId === screenId);
    if (byScreenId) return byScreenId;
  }

  return continuityItems.find((item) => {
    if (Array.isArray(item.beatIds) && item.beatIds.includes(beatId)) return true;

    if (
      item.startBeatId != null &&
      item.endBeatId != null &&
      beatId >= item.startBeatId &&
      beatId <= item.endBeatId
    ) {
      return true;
    }

    return false;
  });
}
