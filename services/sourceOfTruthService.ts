import type {
  CharacterProfile,
  CharacterVisualState,
  InteractionTarget,
  LocationProfile,
  StoryBeat,
  StoryboardPanel
} from "../types";

export interface PanelSourceBundle {
  panel: StoryboardPanel;
  beat: StoryBeat | null;
  characters: CharacterProfile[];
  location: LocationProfile | null;
  sourceFields: {
    originalText: string;
    summary: string;
    timeOfDay: string;
    locationName: string;
    locationId?: string;
    locationState?: string;
    focusCharacters: string[];
    visibleCharacters: string[];
    offscreenPresentCharacters: string[];
    mentionedCharacters: string[];
    props: string[];
    action: string;
    visualMoment: string;
    mainAction: string;
    interaction: string;
    interactionTarget: InteractionTarget[];
    posture: string;
    characterVisualStates: CharacterVisualState[];
    environmentDetails: string;
    continuityNotes: string;
    atmosphere: string;
    visualFocus: string;
  };
}

const normalize = (value?: string) => (value || "").trim().toLowerCase();

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const clean = String(value || "").trim();
    const key = normalize(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function withoutMentioned(values: string[], mentionedCharacters: string[]): string[] {
  const mentionedSet = new Set(mentionedCharacters.map(normalize).filter(Boolean));
  return unique(values).filter((name) => !mentionedSet.has(normalize(name)));
}

export function getBeatById(beats: StoryBeat[], beatId?: number): StoryBeat | null {
  if (!beatId) return null;
  return beats.find((beat) => beat.beatId === beatId) ?? null;
}

export function getLocationForBeat(
  beat: StoryBeat | null,
  locations: LocationProfile[]
): LocationProfile | null {
  if (!beat) return null;

  if (beat.locationId) {
    const byId = locations.find((location) => location.locationId === beat.locationId);
    if (byId) return byId;
  }

  const beatLocation = normalize(beat.location || beat.locationName);
  if (!beatLocation) return null;

  return locations.find((location) => {
    if (normalize(location.name) === beatLocation) return true;
    return (location.aliases || []).some((alias) => normalize(alias) === beatLocation);
  }) ?? null;
}

export function getCharactersForBeat(
  beat: StoryBeat | null,
  characters: CharacterProfile[]
): CharacterProfile[] {
  if (!beat) return [];
  const mentionedCharacters = beat.mentionedCharacters || [];

  const names = new Set(
    withoutMentioned([
      ...(beat.focusCharacters || []),
      ...(beat.visibleCharacters || []),
      ...(beat.offscreenPresentCharacters || []),
      ...(beat.characters || []),
      ...(beat.charactersInvolved || [])
    ], mentionedCharacters).map((name) => normalize(name))
  );

  return characters.filter((character) => {
    if (names.has(normalize(character.name))) return true;
    return (character.aliases || []).some((alias) => names.has(normalize(alias)));
  });
}

export function getPanelSourceBundle(
  panel: StoryboardPanel,
  beats: StoryBeat[],
  characters: CharacterProfile[] = [],
  locations: LocationProfile[] = []
): PanelSourceBundle {
  const beat = getBeatById(beats, panel.beatId || panel.panelNumber);
  const location = getLocationForBeat(beat, locations);
  const matchedCharacters = getCharactersForBeat(beat, characters);
  const mentionedCharacters = unique(beat?.mentionedCharacters || []);
  const focusCharacters = beat?.focusCharacters?.length
    ? withoutMentioned(beat.focusCharacters, mentionedCharacters)
    : withoutMentioned(beat?.characters || beat?.charactersInvolved || [], mentionedCharacters);
  const visibleCharacters = beat?.visibleCharacters?.length
    ? withoutMentioned(beat.visibleCharacters, mentionedCharacters)
    : focusCharacters.length
      ? focusCharacters
      : withoutMentioned(panel.visibleCharacters || [], mentionedCharacters);
  const offscreenPresentCharacters = withoutMentioned(beat?.offscreenPresentCharacters || [], mentionedCharacters);

  return {
    panel,
    beat,
    characters: matchedCharacters,
    location,
    sourceFields: {
      originalText: beat?.originalText ?? panel.originalText ?? "",
      summary: beat?.summary ?? "",
      timeOfDay: beat?.timeOfDay ?? panel.timeOfDay ?? "Unknown",
      locationName: beat?.location ?? beat?.locationName ?? location?.name ?? panel.locationName ?? "Unknown",
      locationId: beat?.locationId ?? location?.locationId ?? panel.locationId,
      locationState: beat?.locationState ?? panel.locationState,
      focusCharacters,
      visibleCharacters,
      offscreenPresentCharacters,
      mentionedCharacters,
      props: beat?.props ?? [],
      action: beat?.action ?? beat?.actionAnalysis ?? panel.actionInFrame ?? panel.description ?? "",
      visualMoment: beat?.visualMoment ?? "",
      mainAction: beat?.mainAction ?? "",
      interaction: beat?.interaction ?? "",
      interactionTarget: beat?.interactionTarget ?? [],
      posture: beat?.posture ?? "",
      characterVisualStates: beat?.characterVisualStates ?? [],
      environmentDetails: beat?.environmentDetails ?? "",
      continuityNotes: beat?.continuityNotes ?? "",
      atmosphere: beat?.atmosphere ?? "",
      visualFocus: beat?.visualFocus ?? ""
    }
  };
}
