import type { StoryBeat, StoryboardPanel } from "../types";

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
  const beat = findBeatForPanel(panel, beats);
  const visibleCharacters = beat?.characters
    || beat?.charactersInvolved
    || panel.visibleCharacters
    || [];

  return {
    originalText: beat?.originalText ?? panel.originalText ?? "",
    summary: beat?.summary ?? "",
    timeOfDay: beat?.timeOfDay ?? panel.timeOfDay ?? "Unknown",
    location: beat?.location ?? beat?.locationName ?? panel.locationName ?? "Unknown",
    locationId: beat?.locationId ?? panel.locationId,
    locationState: beat?.locationState ?? panel.locationState,
    visibleCharacters,
    props: beat?.props ?? [],
    action: beat?.action ?? beat?.actionAnalysis ?? panel.actionInFrame ?? panel.description ?? "",
    interaction: beat?.interaction ?? "",
    posture: beat?.posture ?? "",
    atmosphere: beat?.atmosphere ?? "",
    visualFocus: beat?.visualFocus ?? ""
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
    panelId: panel.panelId || `panel_${String(index + 1).padStart(3, "0")}`,
    panelNumber: panel.panelNumber || index + 1,
    beatId: panel.beatId || index + 1,
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
