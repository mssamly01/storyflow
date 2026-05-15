import type { StoryBeat, StoryboardPanel } from "../types";
import { getPanelSourceBundle } from "./sourceOfTruthService";

export function findBeatForPanel(
  panel: StoryboardPanel,
  beats: StoryBeat[]
): StoryBeat | undefined {
  return beats.find((beat) => beat.beatId === panel.beatId);
}

export function getPanelSourceFields(
  panel: StoryboardPanel,
  beats: StoryBeat[]
) {
  const bundle = getPanelSourceBundle(panel, beats);
  const source = bundle.sourceFields;

  return {
    ...source,
    location: source.locationName
  };
}

export function normalizeStoryboardPanels(data: unknown): StoryboardPanel[] {
  if (Array.isArray(data)) return data as StoryboardPanel[];
  if (data && typeof data === "object" && Array.isArray((data as { panels?: unknown }).panels)) {
    return (data as { panels: StoryboardPanel[] }).panels;
  }
  return [];
}

export function sanitizeStoryboardPanels(panels: StoryboardPanel[]): StoryboardPanel[] {
  return panels.map((panel, index) => ({
    beatId: panel.beatId || panel.panelNumber || index + 1,
    shotType: panel.shotType || "",
    cameraAngle: panel.cameraAngle || "",
    cameraDistance: panel.cameraDistance || "",
    lensFeel: panel.lensFeel || "",
    composition: panel.composition || "",
    foreground: panel.foreground || "",
    midground: panel.midground || "",
    background: panel.background || "",
    characterBlocking: panel.characterBlocking || [],
    lightingDirection: panel.lightingDirection || panel.lighting || "",
    depthAndPerspective: panel.depthAndPerspective || "",
    visualEmphasis: panel.visualEmphasis || "",
    cameraNotes: panel.cameraNotes || panel.continuityNotes || "",
    framing: panel.framing
  }));
}
