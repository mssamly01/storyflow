import type {
  CharacterProfile,
  EngineerPrompt,
  FinalResult,
  LocationProfile,
  ProductionData,
  QAResult,
  ScriptData,
  StoryBeat,
  StoryboardPanel,
  StoryFlowProject
} from "../types";
import {
  buildFinalResult,
  normalizeBeats,
  normalizeCharacterLocationLibrary,
  normalizeEngineerPrompts,
  normalizeQAResults,
  parseJsonSafe
} from "./finalResultBuilderService";
import { normalizeStoryboardPanels } from "./storyboardDataService";
import {
  createEmptyWorkflow,
  markDownstreamStaleAfterBeatEdit,
  markDownstreamStaleAfterSourceEdit,
  markDownstreamStaleAfterCharacterEdit,
  markDownstreamStaleAfterLocationEdit,
  markDownstreamStaleAfterPromptEdit,
  markDownstreamStaleAfterStoryboardEdit,
  markFinalResultStale,
  markStepNeedsReview
} from "./workflowStateService";

const nowIso = () => new Date().toISOString();

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function withTimestamp(project: StoryFlowProject): StoryFlowProject {
  return {
    ...project,
    updatedAt: nowIso()
  };
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
    beats: [],
    characters: [],
    locations: [],
    storyboardPanels: [],
    engineerPrompts: [],
    qaResults: [],
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

  return withTimestamp({
    ...project,
    beats: normalizeBeats(parseJsonSafe<unknown>(production.analysis, [])),
    characters: library.characters,
    locations: library.locations,
    storyboardPanels: normalizeStoryboardPanels(parseJsonSafe<unknown>(production.storyboard, { panels: [] })),
    engineerPrompts: normalizeEngineerPrompts(parseJsonSafe<unknown>(production.prompts, [])),
    qaResults: normalizeQAResults(parseJsonSafe<unknown>(production.qaReport, [])),
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

export function syncProjectSource(project: StoryFlowProject, inputData: ScriptData): StoryFlowProject {
  if (
    project.title === inputData.title &&
    project.sourceText === inputData.script &&
    project.selectedStyleId === inputData.selectedStyle
  ) {
    return project;
  }

  const hasGeneratedData = Boolean(
    project.beats.length ||
    project.characters.length ||
    project.locations.length ||
    project.storyboardPanels.length ||
    project.engineerPrompts.length ||
    project.qaResults.length ||
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
  return withTimestamp({
    ...project,
    beats,
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
  return withTimestamp({
    ...project,
    characters: library.characters,
    locations: library.locations,
    workflow: {
      ...project.workflow,
      characterLocation: markStepNeedsReview(project.workflow.characterLocation)
    }
  });
}

export function replaceStoryboardPanels(project: StoryFlowProject, storyboardPanels: StoryboardPanel[]): StoryFlowProject {
  return withTimestamp({
    ...project,
    storyboardPanels,
    workflow: {
      ...project.workflow,
      storyboard: markStepNeedsReview(project.workflow.storyboard)
    }
  });
}

export function replaceEngineerPrompts(project: StoryFlowProject, engineerPrompts: EngineerPrompt[]): StoryFlowProject {
  return withTimestamp({
    ...project,
    engineerPrompts,
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

export function updateStoryboardPanel(project: StoryFlowProject, panelId: string, patch: Partial<StoryboardPanel>): StoryFlowProject {
  return withTimestamp({
    ...project,
    storyboardPanels: project.storyboardPanels.map((panel) => panel.panelId === panelId ? {
      ...panel,
      ...patch,
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

export function updateEngineerPrompt(project: StoryFlowProject, panelId: string, patch: Partial<EngineerPrompt>): StoryFlowProject {
  return withTimestamp({
    ...project,
    engineerPrompts: project.engineerPrompts.map((prompt) => prompt.panelId === panelId ? {
      ...prompt,
      ...patch,
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

export function updateQAResult(project: StoryFlowProject, panelId: string, patch: Partial<QAResult>): StoryFlowProject {
  return withTimestamp({
    ...project,
    qaResults: project.qaResults.map((qa) => qa.panelId === panelId ? {
      ...qa,
      ...patch,
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

export function buildFinalResultFromProject(project: StoryFlowProject): FinalResult {
  return buildFinalResult({
    beats: project.beats,
    panels: project.storyboardPanels,
    engineerPrompts: project.engineerPrompts,
    qaResults: project.qaResults,
    characters: project.characters,
    locations: project.locations
  });
}
