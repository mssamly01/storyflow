import type {
  BeatCharacterMomentDetail,
  CharacterBlocking,
  CharacterProfile,
  EngineerPrompt,
  LocationProfile,
  ScreenCharacterPosition,
  ScreenCharacterState,
  StoryBeat,
  StoryScreen,
  StoryboardPanel
} from "../types";
import {
  DEFAULT_NEGATIVE_PROMPT,
  createFallbackScreensFromBeats,
  mergeBeatMomentDetailsIntoBeats,
  mergeScreenContinuityIntoScreens,
  normalizeBeats,
  normalizeCharacterLocationLibrary,
  normalizeScreens,
  normalizeScreenContinuity,
  parseJsonSafe
} from "./finalResultBuilderService";
import {
  filterStoryboardBlockingToVisibleCharacters,
  normalizeStoryboardPanels,
  sanitizeStoryboardPanels
} from "./storyboardDataService";
import { normalizePromptSpacing } from "./visualPromptCleanupService";

const DEFAULT_STYLE =
  "Modern Manhua style, Chinese webtoon aesthetic, elegant character designs, vibrant digital coloring, clean line art, beautiful lighting, polished look, contemporary manhua inspired.";

export interface VisualPromptResolverInput {
  analysisJson: string;
  characterLocationJson: string;
  screenContinuityJson: string;
  beatMomentDetailsJson: string;
  storyboardJson: string;
  style?: string;
}

function normalize(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .trim()
    .toLowerCase();
}

function compact(parts: Array<string | undefined | null | false>, separator = ", "): string {
  return parts.map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean)
    .join(separator);
}

function sentence(value: string): string {
  const clean = normalizePromptSpacing(value);
  if (!clean) return "";
  return /[.!?]$/.test(clean) ? clean : `${clean}.`;
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const clean = item.trim();
    const key = normalize(clean);
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function formatList(items: string[] | undefined, fallback = "none"): string {
  const clean = unique((items || []).map(String));
  return clean.length ? clean.join(", ") : fallback;
}

function withoutMentioned(values: string[], beat: StoryBeat): string[] {
  const mentionedSet = new Set((beat.mentionedCharacters || []).map(normalize).filter(Boolean));
  return unique(values).filter((name) => !mentionedSet.has(normalize(name)));
}

function getDrawableCharacterNames(beat: StoryBeat): string[] {
  return withoutMentioned(beat.visibleCharacters || [], beat);
}

function warnIfMentionedCharactersLeakIntoPrompt(beat: StoryBeat, visualPrompt: string) {
  for (const name of beat.mentionedCharacters || []) {
    if (name && visualPrompt.includes(name)) {
      console.warn(
        `[Storyflow] Mentioned-only character leaked into visualPrompt: ${name} in beat ${beat.beatId}`
      );
    }
  }
}

function containsMentionedOnlyName(value: string | undefined, beat: StoryBeat): boolean {
  const haystack = value || "";
  return (beat.mentionedCharacters || []).some((name) => Boolean(name && haystack.includes(name)));
}

function omitIfMentionsMentionedOnly(value: string | undefined, beat: StoryBeat): string {
  return containsMentionedOnlyName(value, beat) ? "" : (value || "");
}

function cleanCopyReadyText(value?: string): string {
  return normalizePromptSpacing((value || "").replace(/\s+/g, " "));
}

function stripTrailingPunctuation(value?: string): string {
  return cleanCopyReadyText(value).replace(/[.;,\s]+$/g, "");
}

function combineColorAndDetail(color?: string, detail?: string): string {
  const cleanDetail = cleanCopyReadyText(detail);
  const cleanColor = cleanCopyReadyText(color);
  if (!cleanDetail) return cleanColor;
  if (!cleanColor || colorIsRepresented(cleanColor, cleanDetail)) return cleanDetail;
  return `${cleanColor} ${cleanDetail}`;
}

function colorIsRepresented(color: string, value: string): boolean {
  const lowerValue = normalize(value);
  const lowerColor = normalize(color);
  if (!lowerColor) return true;
  if (lowerValue.includes(lowerColor)) return true;

  return lowerColor
    .split(/[-\s]+/)
    .filter((token) => token.length > 2)
    .some((token) => lowerValue.includes(token));
}

function cleanOutfitBase(value?: string): string {
  return cleanCopyReadyText(value)
    .replace(/^(the\s+)?same\s+/i, "")
    .replace(/\s+from\s+(the\s+)?previous\s+screen\.?$/i, "")
    .replace(/^(current|default)\s+outfit\s*:?\s*/i, "")
    .replace(/[.;,\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function expandGenericOutfit(value: string): string {
  const clean = cleanCopyReadyText(value);
  const lower = normalize(clean);
  if (!clean) return clean;

  if (lower.includes("nurse uniform") || lower.includes("hospital uniform")) {
    return `${clean}; render as specific garments in top-down and inner-to-outer order: nurse cap on the head if appropriate, inner undershirt if visible, scrub top or nurse blouse as the upper-body garment, nurse coat or apron worn outside if present, matching scrub pants or skirt, socks or stockings if visible, and practical nurse shoes`;
  }

  if (lower.includes("school uniform")) {
    return `${clean}; render as specific garments in top-down and inner-to-outer order: collared shirt worn inside, optional tie or ribbon at the neck, sweater vest or blazer worn outside if present, school skirt or trousers, socks or stockings, and school shoes`;
  }

  if (lower.includes("business suit") || lower.includes("suit") || lower.includes("vest") || lower.includes("blazer")) {
    const hasInnerLayer = /(shirt|blouse|t-?shirt|sơ mi|ao so mi|áo sơ mi)/i.test(clean);
    const innerLayer = hasInnerLayer ? "" : "button-up shirt worn inside, ";
    return `${clean}; render as specific layers in top-down and inner-to-outer order: ${innerLayer}suit vest if present worn over the inner shirt, blazer or suit jacket worn outside, matching trousers or skirt, belt if visible, and dress shoes`;
  }

  if (lower.includes("domestic clothing") || lower.includes("casual clothing") || lower.includes("home clothes")) {
    return `${clean}; render as specific garments in top-down and inner-to-outer order: blouse or simple top as the upper-body garment, optional cardigan or apron worn outside if present, skirt or trousers as the lower-body garment, and house slippers or simple shoes`;
  }

  return clean;
}

function itemAlreadyHasPosition(value: string): boolean {
  return /\b(on|around|at|over|under|inside|outside|pinned|clipped|hanging|worn|wrapped|tied|held|gripped|tucked|slung|strapped|đeo|cài|ghim|treo|cầm|nắm|kẹp)\b/i.test(value);
}

function addAccessoryPosition(value: string): string {
  const clean = cleanCopyReadyText(value);
  const lower = normalize(clean);
  if (!clean || itemAlreadyHasPosition(clean)) return clean;

  if (lower.includes("earring")) return `${clean} on both earlobes`;
  if (lower.includes("necklace") || lower.includes("choker")) return `${clean} around the neck`;
  if (lower.includes("watch")) return `${clean} on the left wrist`;
  if (lower.includes("bracelet")) return `${clean} around the wrist`;
  if (lower.includes("ring")) return `${clean} on the ring finger`;
  if (lower.includes("glasses") || lower.includes("spectacles")) return `${clean} worn on the face`;
  if (lower.includes("hair clip") || lower.includes("hairpin")) return `${clean} clipped into the hair`;
  if (lower.includes("badge") || lower.includes("name tag")) return `${clean} pinned to the left chest pocket`;
  if (lower.includes("id card") || lower.includes("lanyard")) return `${clean} hanging from a neck lanyard`;
  if (lower.includes("bag") || lower.includes("purse")) return `${clean} carried from the shoulder or hand as indicated by the beat`;

  return clean;
}

function findCharacterProfile(
  characterName: string,
  characterId: string | undefined,
  profiles: CharacterProfile[]
): CharacterProfile | undefined {
  const normalizedName = normalize(characterName);
  return profiles.find((profile) => {
    if (characterId && profile.characterId === characterId) return true;
    if (normalize(profile.name) === normalizedName) return true;
    return (profile.aliases || []).some((alias) => normalize(alias) === normalizedName);
  });
}

function namesMatch(
  name: string | undefined,
  id: string | undefined,
  candidateName: string,
  candidateId?: string,
  profile?: CharacterProfile
): boolean {
  if (id && candidateId && id === candidateId) return true;
  const left = normalize(name);
  const right = normalize(candidateName);
  if (left && right && left === right) return true;
  return Boolean(profile?.aliases?.some((alias) => normalize(alias) === right || normalize(alias) === left));
}

function findScreenForBeat(beat: StoryBeat, screens: StoryScreen[]): StoryScreen | undefined {
  if (beat.screenId) {
    const byId = screens.find((screen) => screen.screenId === beat.screenId);
    if (byId) return byId;
  }

  return screens.find((screen) => {
    if (Array.isArray(screen.beatIds) && screen.beatIds.includes(beat.beatId)) return true;
    return beat.beatId >= screen.startBeatId && beat.beatId <= screen.endBeatId;
  });
}

function findLocationForBeat(
  beat: StoryBeat,
  screen: StoryScreen | undefined,
  locations: LocationProfile[]
): LocationProfile | undefined {
  const idCandidates = [beat.locationId, screen?.locationId].filter(Boolean);
  for (const id of idCandidates) {
    const byId = locations.find((location) => location.locationId === id);
    if (byId) return byId;
  }

  const nameCandidates = [beat.location, beat.locationName, screen?.location].map(normalize).filter(Boolean);
  return locations.find((location) => {
    const locationNames = [location.name, ...(location.aliases || [])].map(normalize);
    return nameCandidates.some((name) => locationNames.includes(name));
  });
}

function findScreenCharacterState(
  characterName: string,
  characterId: string | undefined,
  screen: StoryScreen | undefined,
  profile: CharacterProfile | undefined
): ScreenCharacterState | undefined {
  return (screen?.screenCharacterStates || []).find((state) =>
    namesMatch(state.characterName, state.characterId, characterName, characterId, profile)
  );
}

function findScreenCharacterPosition(
  characterName: string,
  characterId: string | undefined,
  screen: StoryScreen | undefined,
  profile: CharacterProfile | undefined
): ScreenCharacterPosition | undefined {
  return (screen?.screenCharacterPositions || []).find((position) =>
    namesMatch(position.characterName, position.characterId, characterName, characterId, profile)
  );
}

function findMomentState(
  characterName: string,
  characterId: string | undefined,
  beat: StoryBeat,
  profile: CharacterProfile | undefined
): BeatCharacterMomentDetail | undefined {
  return (beat.characterMomentDetails || []).find((state) =>
    namesMatch(state.characterName, state.characterId, characterName, characterId, profile)
  );
}

function findBlocking(
  characterName: string,
  characterId: string | undefined,
  panel: StoryboardPanel,
  profile: CharacterProfile | undefined
): CharacterBlocking | undefined {
  return (panel.characterBlocking || []).find((blocking) =>
    namesMatch(blocking.characterName, blocking.characterId, characterName, characterId, profile)
  );
}

function characterMentionedInPanelText(
  characterName: string,
  profile: CharacterProfile | undefined,
  panel: StoryboardPanel
): boolean {
  const haystack = normalize(compact([
    panel.composition,
    panel.foreground,
    panel.midground,
    panel.background,
    panel.visualEmphasis
  ], " "));
  if (!haystack) return false;

  const coreNames = [characterName, profile?.name]
    .map(normalize)
    .filter(Boolean);
  const aliases = (profile?.aliases || []).map(normalize).filter((alias) => alias.length > 2);
  const lastTokens = coreNames
    .map((name) => name.split(/\s+/).filter(Boolean).at(-1) || "")
    .filter((token) => token.length > 2);
  return [...coreNames, ...aliases, ...lastTokens].some((name) => haystack.includes(name));
}

function resolveVisibleCharacterNames(
  beat: StoryBeat,
  panel: StoryboardPanel,
  profiles: CharacterProfile[]
): string[] {
  const approvedVisibleNames = getDrawableCharacterNames(beat);
  if (approvedVisibleNames.length) return approvedVisibleNames;

  const mentionedSet = new Set((beat.mentionedCharacters || []).map(normalize).filter(Boolean));
  const blockingNames = (panel.characterBlocking || [])
    .map((blocking) => blocking.characterName)
    .filter((name): name is string => Boolean(name && !mentionedSet.has(normalize(name))));

  if (blockingNames.length) {
    const additionalBeatNames = getDrawableCharacterNames(beat)
      .filter((name) => {
        const profile = findCharacterProfile(name, undefined, profiles);
        return characterMentionedInPanelText(name, profile, panel);
      });
    return unique([...blockingNames, ...additionalBeatNames]);
  }

  return [];
}

function buildLocationDescription(location: LocationProfile | undefined, fallbackName: string): string {
  if (!location) return fallbackName || "established environment";
  const copyReady = cleanCopyReadyText(location.locationPrompt);
  if (copyReady) return copyReady;

  const keyObjects = location.keyObjects?.length
    ? `Key recurring elements include ${location.keyObjects.join(", ")}`
    : "";
  const palette = location.colorPalette?.length
    ? `The visual palette uses ${location.colorPalette.join(", ")} tones`
    : "";

  return compact([
    stripTrailingPunctuation(location.description || location.details),
    stripTrailingPunctuation(location.layout),
    keyObjects,
    palette
  ], ". ") || location.name;
}

function buildLocationContinuity(
  location: LocationProfile | undefined,
  screen: StoryScreen | undefined
): string {
  const copyReady = cleanCopyReadyText(location?.continuityPrompt);
  const screenSpatialLayout = cleanCopyReadyText(screen?.screenSpatialLayout);
  const screenFixedElements = unique(screen?.screenFixedElements || []);
  const screenLockDetails = compact([
    screenSpatialLayout ? `keep this fixed screen layout: ${screenSpatialLayout}` : "",
    screenFixedElements.length ? `keep these fixed element positions: ${screenFixedElements.join("; ")}` : ""
  ], "; ");

  if (copyReady) {
    return `Location Continuity: ${copyReady}${screenLockDetails ? `; ${screenLockDetails}` : ""}`;
  }

  const locationName = location?.name || screen?.location || "the established location";
  const details = compact([
    screenSpatialLayout,
    screenFixedElements.length ? screenFixedElements.join(", ") : "",
    location?.layout,
    location?.keyObjects?.length ? location.keyObjects.join(", ") : "",
    location?.lighting || location?.lightingDefault,
    location?.continuityNotes,
    screen?.screenProps?.length ? `screen props: ${screen.screenProps.join(", ")}` : "",
    screen?.continuityNotes
  ]);

  return `Location Continuity: keep ${locationName}'s established layout${details ? `, ${details}` : ""} consistent across this screen; camera focus may move to details such as tables, floors, sofas, hallways, or close-ups, but the environment identity must not change.`;
}

function buildScreenSpatialLock(
  location: LocationProfile | undefined,
  screen: StoryScreen | undefined
): string {
  const locationName = location?.name || screen?.location || "the established location";
  const fixedElements = unique([
    ...(screen?.screenFixedElements || []),
    ...(screen?.screenProps || []).map((prop) => `screen prop fixed in established position: ${prop}`),
    ...(location?.keyObjects || []).map((object) => `recurring location object fixed in established position: ${object}`)
  ]);
  const layout = cleanCopyReadyText(screen?.screenSpatialLayout)
    || cleanCopyReadyText(location?.layout)
    || cleanCopyReadyText(location?.locationPrompt)
    || `${locationName}'s established layout`;

  return `Screen Spatial Lock: ${layout}${fixedElements.length ? ` Fixed elements: ${fixedElements.join("; ")}.` : "."} Camera may crop, zoom, or pan within this locked layout, but must not redesign the environment, change fixed object positions, or turn a camera layer into a new location.`;
}

function formatPositionLock(
  name: string,
  position: ScreenCharacterPosition | undefined,
  visible: boolean,
  blocking: CharacterBlocking | undefined
): string {
  if (position?.anchorPosition) {
    const details = compact([
      `fixed anchor: ${position.anchorPosition}`,
      position.facingDirection ? `facing: ${position.facingDirection}` : "",
      position.relationshipToKeyObjects ? `relation: ${position.relationshipToKeyObjects}` : "",
      position.visibilityRule ? `visibility: ${position.visibilityRule}` : "",
      visible ? "visible only if the current crop includes this anchor" : "present at this anchor but off-frame or cropped in this beat"
    ], "; ");
    return `${name}: ${details}`;
  }

  const fallbackBlocking = visible && blocking
    ? compact([
      blocking.framePosition ? `current crop position: ${blocking.framePosition}` : "",
      blocking.facingDirection ? `facing: ${blocking.facingDirection}` : ""
    ], "; ")
    : "";
  return `${name}: ${fallbackBlocking || "keeps the established screen anchor"}${visible ? "" : "; present but off-frame or cropped in this beat"}`;
}

function buildCharacterPositionLock(
  beat: StoryBeat,
  screen: StoryScreen | undefined,
  panel: StoryboardPanel,
  visibleNames: string[],
  profiles: CharacterProfile[]
): string {
  const characterPool = withoutMentioned([
    ...(screen?.screenCharacters || []),
    ...(beat.characters || []),
    ...(beat.focusCharacters || []),
    ...(beat.visibleCharacters || []),
    ...(beat.offscreenPresentCharacters || [])
  ], beat);
  const visibleSet = new Set(visibleNames.map(normalize));
  const entries = characterPool.map((name) => {
    const profile = findCharacterProfile(name, undefined, profiles);
    const position = findScreenCharacterPosition(name, profile?.characterId, screen, profile);
    const blocking = position
      ? undefined
      : findBlocking(name, profile?.characterId, panel, profile);
    const normalizedNames = [name, profile?.name, ...(profile?.aliases || [])].map(normalize).filter(Boolean);
    const visible = normalizedNames.some((candidate) => visibleSet.has(candidate));
    return formatPositionLock(profile?.name || name, position, visible, blocking);
  });

  return `Character Position Lock: ${formatList(entries, "approved characters keep their established screen anchors")}. Camera may crop, zoom, or hide off-frame characters, but must not relocate them, seat them elsewhere, move them to another workstation/background area, or swap their side of key objects.`;
}

function buildResolvedOutfit(
  screenState: ScreenCharacterState | undefined,
  profile: CharacterProfile | undefined
): string {
  const base = cleanOutfitBase(screenState?.outfit)
    || cleanOutfitBase(profile?.outfitPrompt)
    || cleanOutfitBase(profile?.outfit)
    || "current outfit";

  return expandGenericOutfit(base);
}

function buildOutfitColorNote(
  screenState: ScreenCharacterState | undefined,
  profile: CharacterProfile | undefined
): string {
  const mainColor = cleanCopyReadyText(screenState?.outfitMainColor || profile?.outfitMainColor);
  const accentColor = cleanCopyReadyText(screenState?.outfitAccentColor || profile?.outfitAccentColor);

  return compact([
    mainColor ? `main color ${mainColor}` : "",
    accentColor ? `accent color ${accentColor}` : ""
  ]);
}

function buildCharacterIdentity(profile: CharacterProfile | undefined): string[] {
  if (!profile) return [];

  const appearancePrompt = cleanCopyReadyText(profile.appearancePrompt);
  if (appearancePrompt) {
    return [
      profile.gender ? `Gender: ${profile.gender}` : "",
      profile.age ? `Age: ${profile.age}` : "",
      profile.height ? `Height: ${profile.height}` : "",
      `Appearance: ${appearancePrompt}`
    ].filter(Boolean);
  }

  const hair = combineColorAndDetail(profile.hairColor, profile.hair);
  const eyes = combineColorAndDetail(profile.eyeColor, profile.eyes);

  return [
    profile.gender ? `Gender: ${profile.gender}` : "",
    profile.age ? `Age: ${profile.age}` : "",
    profile.height ? `Height: ${profile.height}` : "",
    profile.face ? `Face: ${profile.face}` : "",
    hair ? `Hair: ${hair}` : "",
    eyes ? `Eyes: ${eyes}` : "",
    profile.bodyType ? `Body: ${profile.bodyType}` : "",
    profile.styleNotes ? `Style: ${profile.styleNotes}` : ""
  ].filter(Boolean);
}

function buildCharacterPosture(
  beat: StoryBeat,
  blocking: CharacterBlocking | undefined,
  moment: BeatCharacterMomentDetail | undefined,
  useBeatPostureFallback: boolean,
  position?: ScreenCharacterPosition
): string {
  if (position?.anchorPosition) {
    const anchoredPosture = compact([
      `fixed at screen anchor: ${position.anchorPosition}`,
      position.facingDirection ? `facing ${position.facingDirection}` : "",
      position.relationshipToKeyObjects,
      blocking?.poseRefinement,
      moment?.poseRefinement,
      moment?.momentNotes
    ]);
    if (anchoredPosture) return anchoredPosture;
  }

  const localPosture = compact([
    blocking?.bodyPosition,
    blocking?.poseRefinement,
    moment?.poseRefinement,
    moment?.momentNotes
  ]);

  return localPosture || (useBeatPostureFallback ? beat.posture : "") || "visible in the current shot";
}

function itemMentionedInContext(
  item: string,
  beat: StoryBeat,
  panel: StoryboardPanel,
  moment: BeatCharacterMomentDetail | undefined
): boolean {
  const needle = normalize(item);
  if (!needle) return false;
  const haystack = normalize(compact([
    beat.action,
    beat.actionAnalysis,
    beat.mainAction,
    beat.visualMoment,
    beat.interaction,
    beat.visualFocus,
    ...(beat.props || []),
    moment?.momentNotes,
    ...(moment?.handheldItems || []),
    panel.composition,
    panel.foreground,
    panel.midground,
    panel.background,
    panel.visualEmphasis,
    panel.cameraNotes
  ], " "));
  return haystack.includes(needle) || needle.split(/\s+/).filter((token) => token.length > 3).some((token) => haystack.includes(token));
}

function buildCharacterProfileLine(params: {
  characterName: string;
  profile?: CharacterProfile;
  screenState?: ScreenCharacterState;
  moment?: BeatCharacterMomentDetail;
  blocking?: CharacterBlocking;
  position?: ScreenCharacterPosition;
  panel: StoryboardPanel;
  beat: StoryBeat;
  useBeatPostureFallback: boolean;
}): string {
  const { characterName, profile, screenState, moment, blocking, position, panel, beat, useBeatPostureFallback } = params;
  
  const visualState = (beat.characterVisualStates || []).find(
    (vs: any) => vs.characterName && normalize(vs.characterName) === normalize(characterName)
  );

  const identity = buildCharacterIdentity(profile);
  const outfit = buildResolvedOutfit(screenState, profile);
  const outfitColorNote = buildOutfitColorNote(screenState, profile);
  const accessories = unique([
    ...(profile?.signatureAccessories || []),
    ...(screenState?.accessories || []),
    ...(moment?.visibleAccessories || [])
  ].map(addAccessoryPosition));
  const momentHandheld = unique(moment?.handheldItems || []);
  const screenHandheld = momentHandheld.length
    ? []
    : (screenState?.handheldItems || []).filter((item) => itemMentionedInContext(item, beat, panel, moment));
  const handheld = unique([...momentHandheld, ...screenHandheld]);

  const basePosture = buildCharacterPosture(beat, blocking, moment, useBeatPostureFallback, position);
  const posture = basePosture || visualState?.bodyLanguage || visualState?.position;

  const visualExpression = visualState ? compact([visualState.facialExpression, visualState.emotionalState], " / ") : "";
  const expression = compact([blocking?.expression, moment?.expression, visualExpression]
    .filter((value) => value && normalize(value) !== "none"));

  const role = visualState?.roleInShot ? `Role in shot: ${visualState.roleInShot}` : "";
  const gaze = visualState?.gazeTarget ? `Gaze target: ${visualState.gazeTarget}` : "";

  const profileParts = [
    ...identity,
    role,
    position?.anchorPosition ? `Position Lock: ${compact([
      position.anchorPosition,
      position.facingDirection ? `facing ${position.facingDirection}` : "",
      position.relationshipToKeyObjects
    ])}` : "",
    posture ? `Posture: ${posture}` : "",
    expression ? `Expression: ${expression}` : "",
    gaze,
    outfit ? `Outfit top-down inner-to-outer: ${outfit}` : "",
    outfitColorNote ? `Outfit colors: ${outfitColorNote}` : "",
    `Accessories with exact position: ${formatList(accessories)}`,
    `Handheld or variable items with current position: ${formatList(handheld)}`
  ].filter(Boolean);

  return `${characterName} (${profileParts.join(", ")})`;
}

function buildScreenContinuityLine(
  beat: StoryBeat,
  screen: StoryScreen | undefined,
  visibleNames: string[],
  locationName: string
): string {
  const screenCharacters = screen?.screenCharacters?.length
    ? withoutMentioned(screen.screenCharacters, beat)
    : withoutMentioned([
      ...(beat.visibleCharacters || []),
      ...(beat.characters || [])
    ], beat);
  const visibleSet = new Set(visibleNames.map(normalize));
  const offscreenNames = screenCharacters.filter((name) => !visibleSet.has(normalize(name)));
  const focus = beat.focusCharacters?.length ? withoutMentioned(beat.focusCharacters, beat) : visibleNames;

  return `Screen Continuity: ${formatList(screenCharacters, "approved characters")} remain present in or around ${locationName}; this shot visually frames ${formatList(visibleNames, "the active subject")}; focus stays on ${formatList(focus, "the active subject")}; ${offscreenNames.length ? `${offscreenNames.join(", ")} stay nearby but outside the frame` : "no extra characters are added"}.`;
}

function buildSceneLine(panel: StoryboardPanel, beat: StoryBeat): string {
  // Legacy fallback only. New Beat Analysis must not output cameraHint/compositionHint.
  const legacyShotType = beat.cameraHint && beat.cameraHint !== "unknown" ? beat.cameraHint : "";
  const legacyComposition = beat.compositionHint || "";
  const shotType = panel.shotType || legacyShotType;
  const cameraAngle = panel.cameraAngle;
  const composition = omitIfMentionsMentionedOnly(panel.composition || legacyComposition, beat);

  const scene = compact([
    shotType,
    cameraAngle,
    composition
  ]) || "storyboard-directed shot";
  return `Scene: ${scene}. This is a crop, zoom, or pan from the locked screen layout; it must not relocate characters or rebuild the setting`;
}

function buildActionLine(
  beat: StoryBeat,
  visibleNames: string[],
  panel: StoryboardPanel,
  profiles: CharacterProfile[],
  screen: StoryScreen | undefined
): string {
  const characterActions = visibleNames.map((name) => {
    const profile = findCharacterProfile(name, undefined, profiles);
    const blocking = findBlocking(name, profile?.characterId, panel, profile);
    const moment = findMomentState(name, profile?.characterId, beat, profile);
    const position = findScreenCharacterPosition(name, profile?.characterId || blocking?.characterId, screen, profile);
    const action = compact([
      position?.anchorPosition
        ? `${profile?.name || name} remains at locked anchor ${position.anchorPosition}`
        : blocking?.framePosition
          ? `${name} is ${blocking.framePosition}`
          : "",
      position?.facingDirection
        ? `facing ${position.facingDirection}`
        : blocking?.facingDirection
          ? `facing ${blocking.facingDirection}`
          : "",
      blocking?.expression ? `with ${blocking.expression} expression` : "",
      position ? "" : blocking?.poseRefinement,
      moment?.momentNotes
    ]);
    return action;
  }).filter(Boolean);

  const drawableSet = new Set(visibleNames.map(normalize));
  const interactionDetails = (beat.interactionTarget || [])
    .filter((it) => {
      const actor = normalize(it.actor);
      const target = normalize(it.target);
      return (!actor || drawableSet.has(actor)) && (!target || drawableSet.has(target));
    })
    .map((it) => `${it.actor} acts/says toward ${it.target}: ${it.interaction}`);

  return `Action and interaction: ${compact([
    omitIfMentionsMentionedOnly(beat.visualMoment, beat),
    omitIfMentionsMentionedOnly(beat.mainAction || beat.action || beat.actionAnalysis, beat),
    omitIfMentionsMentionedOnly(beat.interaction, beat),
    beat.posture ? `posture: ${beat.posture}` : "",
    beat.props?.length ? `props: ${beat.props.join(", ")}` : "",
    beat.locationState ? `location state: ${beat.locationState}` : "",
    interactionDetails.join(" | "),
    characterActions.join(" | ")
  ], "; ") || "the approved beat action remains the focus"}`;
}

function buildLayerLines(panel: StoryboardPanel, beat: StoryBeat): string[] {
  return [
    panel.foreground && !containsMentionedOnlyName(panel.foreground, beat) ? `Foreground: ${panel.foreground}` : "",
    panel.midground && !containsMentionedOnlyName(panel.midground, beat) ? `Midground: ${panel.midground}` : "",
    panel.background && !containsMentionedOnlyName(panel.background, beat) ? `Background: ${panel.background}` : "",
    panel.visualEmphasis && !containsMentionedOnlyName(panel.visualEmphasis, beat) ? `Visual emphasis: ${panel.visualEmphasis}` : ""
  ].filter(Boolean);
}

function buildPromptForPanel(params: {
  beat: StoryBeat;
  screen?: StoryScreen;
  panel: StoryboardPanel;
  characters: CharacterProfile[];
  locations: LocationProfile[];
  style?: string;
}): EngineerPrompt {
  const { beat, screen, panel, characters, locations, style } = params;
  const location = findLocationForBeat(beat, screen, locations);
  const locationName = location?.name || screen?.location || beat.location || beat.locationName || "Unknown Location";
  
  const baseLocDesc = buildLocationDescription(location, locationName);
  const environmentDetails = beat.environmentDetails || "";
  const locationDescription = compact([baseLocDesc, environmentDetails], "; ");

  const timeOfDay = beat.timeOfDay || screen?.timeOfDay || panel.timeOfDay || "Unknown time";
  const locationLighting = compact([
    location?.lighting || location?.lightingDefault
  ]) || "established lighting";
  const visibleNames = resolveVisibleCharacterNames(beat, panel, characters);
  const screenContinuityLine = buildScreenContinuityLine(beat, screen, visibleNames, locationName);
  const screenSpatialLockLine = buildScreenSpatialLock(location, screen);
  const characterPositionLockLine = buildCharacterPositionLock(beat, screen, panel, visibleNames, characters);

  const characterLines = visibleNames.map((name) => {
    const blocking = findBlocking(name, undefined, panel, undefined);
    const profile = findCharacterProfile(name, blocking?.characterId, characters);
    const screenState = findScreenCharacterState(name, profile?.characterId || blocking?.characterId, screen, profile);
    const moment = findMomentState(name, profile?.characterId || blocking?.characterId, beat, profile);
    const position = findScreenCharacterPosition(name, profile?.characterId || blocking?.characterId, screen, profile);

    return buildCharacterProfileLine({
      characterName: profile?.name || name,
      profile,
      screenState,
      moment,
      blocking,
      position,
      panel,
      beat,
      useBeatPostureFallback: !panel.characterBlocking?.length || Boolean(blocking)
    });
  });

  const promptParts = [
    sentence(style || DEFAULT_STYLE),
    sentence(`Location: ${locationName} (${locationDescription}), ${timeOfDay}, ${locationLighting}`),
    sentence(buildLocationContinuity(location, screen)),
    sentence(screenSpatialLockLine),
    sentence(characterPositionLockLine),
    sentence(screenContinuityLine),
    sentence(buildSceneLine(panel, beat)),
    characterLines.map(sentence).join(" "),
    sentence(buildActionLine(beat, visibleNames, panel, characters, screen)),
    buildLayerLines(panel, beat).map(sentence).join(" "),
    sentence("no text, no speech bubbles, no captions, no subtitles, no watermark, no logo"),
    `Negative prompt: ${DEFAULT_NEGATIVE_PROMPT}.`
  ].filter(Boolean);
  const visualPrompt = normalizePromptSpacing(promptParts.join(" "));
  warnIfMentionedCharactersLeakIntoPrompt(beat, visualPrompt);

  return {
    beatId: beat.beatId,
    visualPrompt
  };
}

function findBeatForPanel(panel: StoryboardPanel, beats: StoryBeat[]): StoryBeat | undefined {
  const beatId = panel.beatId || panel.panelNumber;
  return beatId ? beats.find((beat) => beat.beatId === beatId) : undefined;
}

export function buildEngineerPromptsWithResolver(input: VisualPromptResolverInput): EngineerPrompt[] {
  const analysisData = parseJsonSafe<unknown>(input.analysisJson, {});
  const libraryData = normalizeCharacterLocationLibrary(
    parseJsonSafe<unknown>(input.characterLocationJson, {})
  );
  const screenContinuityData = parseJsonSafe<unknown>(input.screenContinuityJson, {});
  const beatMomentData = parseJsonSafe<unknown>(input.beatMomentDetailsJson, {});
  const storyboardData = parseJsonSafe<unknown>(input.storyboardJson, { panels: [] });

  const beats = mergeBeatMomentDetailsIntoBeats(
    normalizeBeats(analysisData),
    beatMomentData
  );
  const parsedScreens = normalizeScreens(analysisData);
  const baseScreens = parsedScreens.length ? parsedScreens : createFallbackScreensFromBeats(beats);
  const screens = mergeScreenContinuityIntoScreens(baseScreens, screenContinuityData);
  const panels = filterStoryboardBlockingToVisibleCharacters(
    sanitizeStoryboardPanels(normalizeStoryboardPanels(storyboardData)),
    beats
  );
  const targetPanels = panels.length
    ? panels
    : beats.map((beat) => ({ beatId: beat.beatId } as StoryboardPanel));

  const continuityItems = normalizeScreenContinuity(screenContinuityData);
  const screensWithFallbackStates = screens.map((screen) => {
    if (screen.screenCharacterStates?.length) return screen;
    const continuity = continuityItems.find((item) => item.screenId === screen.screenId);
    return continuity?.screenCharacterStates?.length
      ? { ...screen, screenCharacterStates: continuity.screenCharacterStates }
      : screen;
  });

  return targetPanels
    .map((panel) => {
      const beat = findBeatForPanel(panel, beats);
      if (!beat) return null;
      const screen = findScreenForBeat(beat, screensWithFallbackStates);
      return buildPromptForPanel({
        beat,
        screen,
        panel,
        characters: libraryData.characters,
        locations: libraryData.locations,
        style: input.style
      });
    })
    .filter((prompt): prompt is EngineerPrompt => Boolean(prompt));
}

export function buildEngineerPromptsJsonWithResolver(input: VisualPromptResolverInput): string {
  return JSON.stringify({
    engineerPrompts: buildEngineerPromptsWithResolver(input)
  }, null, 2);
}
