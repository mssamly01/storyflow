import type {
  CharacterProfile,
  EngineerPrompt,
  FinalResult,
  LocationProfile,
  ProductionData,
  QAResult,
  ScriptData,
  StoryBeat,
  StoryScreen,
  StoryboardPanel,
  StoryFlowProject
} from "../types";
import {
  buildFinalResult,
  createFallbackScreensFromBeats,
  normalizeBeats,
  normalizeCharacterLocationLibrary,
  normalizeEngineerPrompts,
  normalizeQAResults,
  normalizeScreens,
  parseJsonSafe,
  mergeScreenContinuityIntoScreens,
  mergeBeatMomentDetailsIntoBeats,
  extractBeatMomentDetailsFromLegacyBeats
} from "./finalResultBuilderService";
import { normalizeStoryboardPanels, sanitizeStoryboardPanels } from "./storyboardDataService";
import {
  createEmptyWorkflow,
  createWorkflowStep,
  markDownstreamStaleAfterBeatEdit,
  markDownstreamStaleAfterSourceEdit,
  markDownstreamStaleAfterCharacterEdit,
  markDownstreamStaleAfterLocationEdit,
  markDownstreamStaleAfterPromptEdit,
  markDownstreamStaleAfterStoryboardEdit,
  markFinalResultStale,
  markStepNeedsReview
} from "./workflowStateService";
import {
  approveAndLockField,
  lockField,
  lockFields,
  mergeRespectingLocks,
  unlockField
} from "./fieldLockService";

const nowIso = () => new Date().toISOString();
const workflowStatuses = new Set(["not_started", "generating", "needs_review", "approved", "stale", "error"]);

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function withTimestamp(project: StoryFlowProject): StoryFlowProject {
  return {
    ...project,
    updatedAt: nowIso()
  };
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function asArray<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? value as T[] : fallback;
}

function hydrateWorkflowStep(raw: unknown, fallback: StoryFlowProject["workflow"]["beatAnalysis"]) {
  if (!isRecord(raw)) return fallback;
  const status = workflowStatuses.has(raw.status) ? raw.status : fallback.status;
  return {
    ...fallback,
    ...raw,
    status
  };
}

function normalizeText(value?: string): string {
  return (value || "").trim().toLowerCase();
}

function aliasesOverlap(currentAliases?: string[], incomingAliases?: string[]): boolean {
  const incoming = new Set((incomingAliases || []).map(normalizeText).filter(Boolean));
  return (currentAliases || []).some((alias) => incoming.has(normalizeText(alias)));
}

function findCharacterMatch(currentCharacters: CharacterProfile[], incomingCharacter: CharacterProfile): CharacterProfile | undefined {
  const incomingId = incomingCharacter.characterId;
  const incomingName = normalizeText(incomingCharacter.name);
  return currentCharacters.find((character) => {
    if (incomingId && character.characterId === incomingId) return true;
    if (incomingName && normalizeText(character.name) === incomingName) return true;
    return aliasesOverlap(character.aliases, incomingCharacter.aliases);
  });
}

function findLocationMatch(currentLocations: LocationProfile[], incomingLocation: LocationProfile): LocationProfile | undefined {
  const incomingId = incomingLocation.locationId;
  const incomingName = normalizeText(incomingLocation.name);
  return currentLocations.find((location) => {
    if (incomingId && location.locationId === incomingId) return true;
    if (incomingName && normalizeText(location.name) === incomingName) return true;
    return aliasesOverlap(location.aliases, incomingLocation.aliases);
  });
}

function findPanelMatch(currentPanels: StoryboardPanel[], incomingPanel: StoryboardPanel): StoryboardPanel | undefined {
  return currentPanels.find((panel) => {
    if (incomingPanel.beatId && panel.beatId === incomingPanel.beatId) return true;
    if (incomingPanel.panelId && panel.panelId === incomingPanel.panelId) return true;
    return Boolean(incomingPanel.panelNumber && panel.panelNumber === incomingPanel.panelNumber);
  });
}

function findPromptMatch(currentPrompts: EngineerPrompt[], incomingPrompt: EngineerPrompt): EngineerPrompt | undefined {
  return currentPrompts.find((prompt) => {
    if (incomingPrompt.beatId && prompt.beatId === incomingPrompt.beatId) return true;
    if (incomingPrompt.panelId && prompt.panelId === incomingPrompt.panelId) return true;
    return Boolean(incomingPrompt.panelNumber && prompt.panelNumber === incomingPrompt.panelNumber);
  });
}


export function createInitialProject(params?: {
  title?: string;
  sourceText?: string;
  selectedStyleId?: string;
}): StoryFlowProject {
  const now = nowIso();
  return {
    id: createId("project"),
    title: params?.title || "Untitled StoryFlow Project",
    sourceText: params?.sourceText || "",
    selectedStyleId: params?.selectedStyleId,
    screens: [],
    beats: [],
    characters: [],
    locations: [],
    storyboardPanels: [],
    engineerPrompts: [],
    qaResults: [],
    screenContinuity: "",
    beatMomentDetails: "",
    finalResult: null,
    workflow: createEmptyWorkflow(),
    createdAt: now,
    updatedAt: now
  };
}

export function serializeProjectForStorage(project: StoryFlowProject): StoryFlowProject {
  return {
    ...project,
    updatedAt: nowIso()
  };
}

export function normalizeLegacyProductionToProject(inputData: ScriptData, production: ProductionData): StoryFlowProject {
  const project = createInitialProject({
    title: inputData.title || "Untitled StoryFlow Project",
    sourceText: inputData.script || "",
    selectedStyleId: inputData.selectedStyle
  });
  const library = normalizeCharacterLocationLibrary(parseJsonSafe<unknown>(production.characterLocationAnalysis, {}));
  const finalResult = parseJsonSafe<FinalResult | null>(production.finalResult, null);
  const analysisData = parseJsonSafe<unknown>(production.analysis, []);
  const beats = normalizeBeats(analysisData);
  const screens = normalizeScreens(analysisData);
  const extractedBeatMomentDetails = extractBeatMomentDetailsFromLegacyBeats(analysisData);
  const beatMomentDetails = production.beatMomentDetails || (
    extractedBeatMomentDetails.length
      ? JSON.stringify({ beatDetails: extractedBeatMomentDetails }, null, 2)
      : ""
  );
  const mergedBeats = mergeBeatMomentDetailsIntoBeats(beats, beatMomentDetails);

  return withTimestamp({
    ...project,
    screens: screens.length ? screens : createFallbackScreensFromBeats(mergedBeats),
    beats: mergedBeats,
    characters: library.characters,
    locations: library.locations,
    storyboardPanels: sanitizeStoryboardPanels(normalizeStoryboardPanels(parseJsonSafe<unknown>(production.storyboard, { panels: [] }))),
    engineerPrompts: normalizeEngineerPrompts(parseJsonSafe<unknown>(production.prompts, [])),
    qaResults: normalizeQAResults(parseJsonSafe<unknown>(production.qaReport, [])),
    screenContinuity: production.screenContinuity || "",
    beatMomentDetails,
    finalResult,
    workflow: {
      ...project.workflow,
      beatAnalysis: production.analysis ? markStepNeedsReview(project.workflow.beatAnalysis) : project.workflow.beatAnalysis,
      characterLocation: production.characterLocationAnalysis ? markStepNeedsReview(project.workflow.characterLocation) : project.workflow.characterLocation,
      storyboard: production.storyboard ? markStepNeedsReview(project.workflow.storyboard) : project.workflow.storyboard,
      promptEngineering: production.prompts ? markStepNeedsReview(project.workflow.promptEngineering) : project.workflow.promptEngineering,
      qa: production.qaReport ? markStepNeedsReview(project.workflow.qa) : project.workflow.qa,
      finalResult: production.finalResult ? markStepNeedsReview(project.workflow.finalResult) : project.workflow.finalResult
    }
  });
}

export function hydrateStoryFlowProject(
  inputData: ScriptData,
  production: ProductionData,
  rawProject: unknown
): StoryFlowProject {
  const fallback = normalizeLegacyProductionToProject(inputData, production);
  if (!isRecord(rawProject)) return fallback;

  const rawWorkflow = isRecord(rawProject.workflow) ? rawProject.workflow : {};
  const hydratedBeats = asArray<StoryBeat>(rawProject.beats, fallback.beats);
  const rawBeatMomentDetails = typeof rawProject.beatMomentDetails === "string"
    ? rawProject.beatMomentDetails
    : fallback.beatMomentDetails;
  const extractedBeatMomentDetails = extractBeatMomentDetailsFromLegacyBeats(rawProject.beats);
  const beatMomentDetails = rawBeatMomentDetails || fallback.beatMomentDetails || (
    extractedBeatMomentDetails.length
      ? JSON.stringify({ beatDetails: extractedBeatMomentDetails }, null, 2)
      : ""
  );
  const mergedBeats = mergeBeatMomentDetailsIntoBeats(hydratedBeats, beatMomentDetails);

  return withTimestamp({
    ...fallback,
    ...rawProject,
    id: typeof rawProject.id === "string" ? rawProject.id : fallback.id,
    title: typeof rawProject.title === "string" && rawProject.title ? rawProject.title : fallback.title,
    sourceText: typeof rawProject.sourceText === "string" ? rawProject.sourceText : fallback.sourceText,
    selectedStyleId: typeof rawProject.selectedStyleId === "string" ? rawProject.selectedStyleId : fallback.selectedStyleId,
    screens: asArray<StoryScreen>(rawProject.screens, fallback.screens),
    beats: mergedBeats,
    characters: asArray<CharacterProfile>(rawProject.characters, fallback.characters),
    locations: asArray<LocationProfile>(rawProject.locations, fallback.locations),
    storyboardPanels: asArray<StoryboardPanel>(rawProject.storyboardPanels, fallback.storyboardPanels),
    engineerPrompts: asArray<EngineerPrompt>(rawProject.engineerPrompts, fallback.engineerPrompts),
    qaResults: asArray<QAResult>(rawProject.qaResults, fallback.qaResults),
    screenContinuity: typeof rawProject.screenContinuity === "string" ? rawProject.screenContinuity : fallback.screenContinuity,
    beatMomentDetails,
    finalResult: isRecord(rawProject.finalResult) ? rawProject.finalResult as FinalResult : fallback.finalResult,
    workflow: {
      beatAnalysis: hydrateWorkflowStep(rawWorkflow.beatAnalysis, fallback.workflow.beatAnalysis),
      characterLocation: hydrateWorkflowStep(rawWorkflow.characterLocation, fallback.workflow.characterLocation),
      screenContinuity: hydrateWorkflowStep(rawWorkflow.screenContinuity, fallback.workflow.screenContinuity),
      beatMomentDetails: hydrateWorkflowStep(rawWorkflow.beatMomentDetails, fallback.workflow.beatMomentDetails),
      storyboard: hydrateWorkflowStep(rawWorkflow.storyboard, fallback.workflow.storyboard),
      promptEngineering: hydrateWorkflowStep(rawWorkflow.promptEngineering, fallback.workflow.promptEngineering),
      qa: hydrateWorkflowStep(rawWorkflow.qa, fallback.workflow.qa),
      finalResult: hydrateWorkflowStep(rawWorkflow.finalResult, fallback.workflow.finalResult)
    },
    createdAt: typeof rawProject.createdAt === "string" ? rawProject.createdAt : fallback.createdAt,
    updatedAt: typeof rawProject.updatedAt === "string" ? rawProject.updatedAt : fallback.updatedAt
  });
}

export function syncProjectSource(project: StoryFlowProject, inputData: ScriptData): StoryFlowProject {
  if (
    project.title === inputData.title &&
    project.sourceText === inputData.script &&
    project.selectedStyleId === inputData.selectedStyle
  ) {
    return project;
  }

  const hasGeneratedData = Boolean(
    (Array.isArray(project.screens) && project.screens.length) ||
    (Array.isArray(project.beats) && project.beats.length) ||
    (Array.isArray(project.characters) && project.characters.length) ||
    (Array.isArray(project.locations) && project.locations.length) ||
    (Array.isArray(project.storyboardPanels) && project.storyboardPanels.length) ||
    (Array.isArray(project.engineerPrompts) && project.engineerPrompts.length) ||
    (Array.isArray(project.qaResults) && project.qaResults.length) ||
    project.finalResult
  );

  return withTimestamp({
    ...project,
    title: inputData.title || project.title,
    sourceText: inputData.script,
    selectedStyleId: inputData.selectedStyle,
    workflow: inputData.script !== project.sourceText && hasGeneratedData
      ? markDownstreamStaleAfterSourceEdit(project.workflow)
      : project.workflow
  });
}

export function replaceBeats(project: StoryFlowProject, beats: StoryBeat[]): StoryFlowProject {
  const mergedBeats = beats.map((incomingBeat) => {
    const currentBeat = project.beats.find((beat) => beat.beatId === incomingBeat.beatId);
    return currentBeat ? mergeRespectingLocks(currentBeat, incomingBeat) : incomingBeat;
  });

  return withTimestamp({
    ...project,
    beats: mergedBeats,
    workflow: {
      ...project.workflow,
      beatAnalysis: markStepNeedsReview(project.workflow.beatAnalysis)
    }
  });
}

export function replaceBeatsFromUserEdit(project: StoryFlowProject, beats: StoryBeat[]): StoryFlowProject {
  return withTimestamp({
    ...project,
    beats: beats.map((beat) => ({
      ...beat,
      meta: {
        ...beat.meta,
        source: "user",
        status: "needs_review",
        updatedAt: nowIso()
      }
    })),
    workflow: {
      ...markDownstreamStaleAfterBeatEdit(project.workflow),
      beatAnalysis: markStepNeedsReview(project.workflow.beatAnalysis)
    }
  });
}

export function replaceCharacterLocationLibrary(project: StoryFlowProject, library: {
  characters: CharacterProfile[];
  locations: LocationProfile[];
}): StoryFlowProject {
  const characters = library.characters.map((incomingCharacter) => {
    const currentCharacter = findCharacterMatch(project.characters, incomingCharacter);
    return currentCharacter ? mergeRespectingLocks(currentCharacter, incomingCharacter) : incomingCharacter;
  });
  const locations = library.locations.map((incomingLocation) => {
    const currentLocation = findLocationMatch(project.locations, incomingLocation);
    return currentLocation ? mergeRespectingLocks(currentLocation, incomingLocation) : incomingLocation;
  });

  return withTimestamp({
    ...project,
    characters,
    locations,
    workflow: {
      ...project.workflow,
      characterLocation: markStepNeedsReview(project.workflow.characterLocation)
    }
  });
}

export function replaceStoryboardPanels(project: StoryFlowProject, storyboardPanels: StoryboardPanel[]): StoryFlowProject {
  const sanitizedPanels = sanitizeStoryboardPanels(storyboardPanels);
  const mergedPanels = sanitizedPanels.map((incomingPanel) => {
    const currentPanel = findPanelMatch(project.storyboardPanels, incomingPanel);
    return currentPanel ? mergeRespectingLocks(currentPanel, incomingPanel) : incomingPanel;
  });

  return withTimestamp({
    ...project,
    storyboardPanels: mergedPanels,
    workflow: {
      ...project.workflow,
      storyboard: markStepNeedsReview(project.workflow.storyboard)
    }
  });
}

export function replaceEngineerPrompts(project: StoryFlowProject, engineerPrompts: EngineerPrompt[]): StoryFlowProject {
  const mergedPrompts = engineerPrompts.map((incomingPrompt) => {
    const currentPrompt = findPromptMatch(project.engineerPrompts, incomingPrompt);
    return currentPrompt ? mergeRespectingLocks(currentPrompt, incomingPrompt) : incomingPrompt;
  });

  return withTimestamp({
    ...project,
    engineerPrompts: mergedPrompts,
    workflow: {
      ...project.workflow,
      promptEngineering: markStepNeedsReview(project.workflow.promptEngineering)
    }
  });
}

export function replaceQAResults(project: StoryFlowProject, qaResults: QAResult[]): StoryFlowProject {
  return withTimestamp({
    ...project,
    qaResults,
    workflow: {
      ...project.workflow,
      qa: markStepNeedsReview(project.workflow.qa)
    }
  });
}

export function replaceFinalResult(project: StoryFlowProject, finalResult: FinalResult): StoryFlowProject {
  return withTimestamp({
    ...project,
    finalResult,
    workflow: {
      ...project.workflow,
      finalResult: markStepNeedsReview(project.workflow.finalResult)
    }
  });
}

export function updateBeat(project: StoryFlowProject, beatId: number, patch: Partial<StoryBeat>): StoryFlowProject {
  return withTimestamp({
    ...project,
    beats: project.beats.map((beat) => beat.beatId === beatId ? {
      ...beat,
      ...patch,
      meta: {
        ...beat.meta,
        source: "user",
        status: "needs_review",
        updatedAt: nowIso()
      }
    } : beat),
    workflow: {
      ...markDownstreamStaleAfterBeatEdit(project.workflow),
      beatAnalysis: markStepNeedsReview(project.workflow.beatAnalysis)
    }
  });
}

export function updateCharacter(project: StoryFlowProject, characterId: string, patch: Partial<CharacterProfile>): StoryFlowProject {
  return withTimestamp({
    ...project,
    characters: project.characters.map((character) => character.characterId === characterId ? {
      ...character,
      ...patch,
      meta: {
        ...character.meta,
        source: "user",
        status: "needs_review",
        updatedAt: nowIso()
      }
    } : character),
    workflow: {
      ...markDownstreamStaleAfterCharacterEdit(project.workflow),
      characterLocation: markStepNeedsReview(project.workflow.characterLocation)
    }
  });
}

export function updateLocation(project: StoryFlowProject, locationId: string, patch: Partial<LocationProfile>): StoryFlowProject {
  return withTimestamp({
    ...project,
    locations: project.locations.map((location) => location.locationId === locationId ? {
      ...location,
      ...patch,
      meta: {
        ...location.meta,
        source: "user",
        status: "needs_review",
        updatedAt: nowIso()
      }
    } : location),
    workflow: {
      ...markDownstreamStaleAfterLocationEdit(project.workflow),
      characterLocation: markStepNeedsReview(project.workflow.characterLocation)
    }
  });
}

export function updateStoryboardPanel(project: StoryFlowProject, beatId: number, patch: Partial<StoryboardPanel>): StoryFlowProject {
  return withTimestamp({
    ...project,
    storyboardPanels: project.storyboardPanels.map((panel) => panel.beatId === beatId ? {
      ...panel,
      ...patch,
      beatId: panel.beatId,
      meta: {
        ...panel.meta,
        source: "user",
        status: "needs_review",
        updatedAt: nowIso()
      }
    } : panel),
    workflow: {
      ...markDownstreamStaleAfterStoryboardEdit(project.workflow),
      storyboard: markStepNeedsReview(project.workflow.storyboard)
    }
  });
}

export function updateEngineerPrompt(project: StoryFlowProject, beatId: number, patch: Partial<EngineerPrompt>): StoryFlowProject {
  return withTimestamp({
    ...project,
    engineerPrompts: project.engineerPrompts.map((prompt) => prompt.beatId === beatId ? {
      ...prompt,
      ...patch,
      beatId: prompt.beatId,
      meta: {
        ...prompt.meta,
        source: "user",
        status: "needs_review",
        updatedAt: nowIso()
      }
    } : prompt),
    workflow: {
      ...markDownstreamStaleAfterPromptEdit(project.workflow),
      promptEngineering: markStepNeedsReview(project.workflow.promptEngineering)
    }
  });
}

export function updateQAResult(project: StoryFlowProject, beatId: number, patch: Partial<QAResult>): StoryFlowProject {
  return withTimestamp({
    ...project,
    qaResults: project.qaResults.map((qa) => qa.beatId === beatId ? {
      ...qa,
      ...patch,
      beatId: qa.beatId,
      meta: {
        ...qa.meta,
        source: "user",
        status: "needs_review",
        updatedAt: nowIso()
      }
    } : qa),
    workflow: {
      ...markFinalResultStale(project.workflow, "QA changed; final result must be rebuilt."),
      qa: markStepNeedsReview(project.workflow.qa)
    }
  });
}

export function replaceScreens(project: StoryFlowProject, screens: StoryScreen[]): StoryFlowProject {
  return withTimestamp({
    ...project,
    screens,
    workflow: {
      ...project.workflow,
      beatAnalysis: markStepNeedsReview(project.workflow.beatAnalysis)
    }
  });
}

export function lockBeatField(project: StoryFlowProject, beatId: number, fieldName: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    beats: project.beats.map((beat) => beat.beatId === beatId ? lockField(beat, fieldName) : beat)
  });
}

export function unlockBeatField(project: StoryFlowProject, beatId: number, fieldName: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    beats: project.beats.map((beat) => beat.beatId === beatId ? unlockField(beat, fieldName) : beat)
  });
}

export function approveAndLockBeatField(project: StoryFlowProject, beatId: number, fieldName: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    beats: project.beats.map((beat) => beat.beatId === beatId ? approveAndLockField(beat, fieldName) : beat)
  });
}

export function lockBeatFields(project: StoryFlowProject, beatId: number, fieldNames: string[]): StoryFlowProject {
  return withTimestamp({
    ...project,
    beats: project.beats.map((beat) => beat.beatId === beatId ? lockFields(beat, fieldNames) : beat)
  });
}

export function lockCharacterField(project: StoryFlowProject, characterId: string, fieldName: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    characters: project.characters.map((character) => character.characterId === characterId || character.name === characterId ? lockField(character, fieldName) : character)
  });
}

export function unlockCharacterField(project: StoryFlowProject, characterId: string, fieldName: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    characters: project.characters.map((character) => character.characterId === characterId || character.name === characterId ? unlockField(character, fieldName) : character)
  });
}

export function approveAndLockCharacterField(project: StoryFlowProject, characterId: string, fieldName: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    characters: project.characters.map((character) => character.characterId === characterId || character.name === characterId ? approveAndLockField(character, fieldName) : character)
  });
}

export function lockCharacterFields(project: StoryFlowProject, characterId: string, fieldNames: string[]): StoryFlowProject {
  return withTimestamp({
    ...project,
    characters: project.characters.map((character) => character.characterId === characterId || character.name === characterId ? lockFields(character, fieldNames) : character)
  });
}

export function lockLocationField(project: StoryFlowProject, locationId: string, fieldName: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    locations: project.locations.map((location) => location.locationId === locationId || location.name === locationId ? lockField(location, fieldName) : location)
  });
}

export function unlockLocationField(project: StoryFlowProject, locationId: string, fieldName: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    locations: project.locations.map((location) => location.locationId === locationId || location.name === locationId ? unlockField(location, fieldName) : location)
  });
}

export function approveAndLockLocationField(project: StoryFlowProject, locationId: string, fieldName: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    locations: project.locations.map((location) => location.locationId === locationId || location.name === locationId ? approveAndLockField(location, fieldName) : location)
  });
}

export function lockLocationFields(project: StoryFlowProject, locationId: string, fieldNames: string[]): StoryFlowProject {
  return withTimestamp({
    ...project,
    locations: project.locations.map((location) => location.locationId === locationId || location.name === locationId ? lockFields(location, fieldNames) : location)
  });
}

export function lockStoryboardPanelField(project: StoryFlowProject, beatId: number, fieldName: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    storyboardPanels: project.storyboardPanels.map((panel) => panel.beatId === beatId ? lockField(panel, fieldName) : panel)
  });
}

export function lockEngineerPromptField(project: StoryFlowProject, beatId: number, fieldName: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    engineerPrompts: project.engineerPrompts.map((prompt) => prompt.beatId === beatId ? lockField(prompt, fieldName) : prompt)
  });
}

export function buildFinalResultFromProject(project: StoryFlowProject): FinalResult {
  const mergedScreens = mergeScreenContinuityIntoScreens(
    project.screens?.length ? project.screens : createFallbackScreensFromBeats(project.beats),
    project.screenContinuity
  );
  const mergedBeats = mergeBeatMomentDetailsIntoBeats(project.beats, project.beatMomentDetails);

  return buildFinalResult({
    screens: mergedScreens,
    beats: mergedBeats,
    panels: project.storyboardPanels,
    engineerPrompts: project.engineerPrompts,
    qaResults: [],
    characters: project.characters,
    locations: project.locations
  });
}

export function replaceScreenContinuity(project: StoryFlowProject, screenContinuity: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    screenContinuity,
    workflow: {
      ...project.workflow,
      screenContinuity: markStepNeedsReview(project.workflow.screenContinuity || createWorkflowStep())
    }
  });
}

export function replaceBeatMomentDetails(project: StoryFlowProject, beatMomentDetails: string): StoryFlowProject {
  return withTimestamp({
    ...project,
    beatMomentDetails,
    beats: mergeBeatMomentDetailsIntoBeats(project.beats, beatMomentDetails),
    workflow: {
      ...project.workflow,
      beatMomentDetails: markStepNeedsReview(project.workflow.beatMomentDetails || createWorkflowStep())
    }
  });
}
