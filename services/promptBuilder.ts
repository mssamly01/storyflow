import type {
  BeatAnalysis,
  CharacterProfile,
  LocationProfile,
  StoryBeat,
  StoryboardPanel
} from '../types';
import { buildLocationContinuityBlock } from './locationContinuityService';
import { getPanelSourceBundle } from './sourceOfTruthService';

const compact = (parts: Array<string | undefined | null | false>) =>
  parts.filter(Boolean).join(', ');

export function buildCharacterReferencePrompt(character: CharacterProfile): string {
  const signatureFeatures = Array.isArray(character.signatureFeatures)
    ? character.signatureFeatures.join(', ')
    : '';
  const accessories = Array.isArray(character.accessories)
    ? character.accessories.join(', ')
    : '';
  const props = Array.isArray(character.props)
    ? character.props.join(', ')
    : '';
  const colorPalette = Array.isArray(character.colorPalette)
    ? character.colorPalette.join(', ')
    : '';

  return compact([
    character.name,
    character.role ? `role: ${character.role}` : '',
    character.gender,
    character.age,
    character.height ? `height: ${character.height}` : '',
    character.bodyType ? `body type: ${character.bodyType}` : '',
    character.face ? `face: ${character.face}` : '',
    character.hair ? `hair: ${character.hair}` : '',
    character.eyes ? `eyes: ${character.eyes}` : '',
    signatureFeatures ? `signature features: ${signatureFeatures}` : '',
    character.outfit ? `current outfit: ${character.outfit}` : '',
    accessories ? `accessories: ${accessories}` : '',
    props ? `recurring props: ${props}` : '',
    colorPalette ? `color palette: ${colorPalette}` : '',
    character.continuityNotes ? `continuity: ${character.continuityNotes}` : ''
  ]);
}

export function buildLocationReferencePrompt(location: LocationProfile, style: string): string {
  const keyObjects = Array.isArray(location.keyObjects)
    ? location.keyObjects.join(', ')
    : '';
  const colorPalette = Array.isArray(location.colorPalette)
    ? location.colorPalette.join(', ')
    : '';

  return compact([
    style,
    `establishing shot of ${location.name}`,
    location.description || location.details,
    location.layout ? `spatial layout: ${location.layout}` : '',
    keyObjects ? `key objects: ${keyObjects}` : '',
    location.lighting || location.lightingDefault ? `default lighting: ${location.lighting || location.lightingDefault}` : '',
    colorPalette ? `color palette: ${colorPalette}` : '',
    location.baseState ? `base state: ${location.baseState}` : '',
    location.atmosphereDefault ? `default atmosphere: ${location.atmosphereDefault}` : '',
    location.continuityNotes ? `continuity: ${location.continuityNotes}` : '',
    'no text, no labels, no speech bubbles, no watermark'
  ]);
}

export function buildFinalVisualPrompt(params: {
  style: string;
  beat: BeatAnalysis;
  panel: StoryboardPanel;
  characters: CharacterProfile[];
  location?: LocationProfile;
  locations?: LocationProfile[];
  beats?: StoryBeat[];
}): string {
  const { style, beat, panel, characters, location, locations, beats } = params;
  const allBeats = beats || [beat as StoryBeat];
  const allLocations = locations || (location ? [location] : []);
  const bundle = getPanelSourceBundle(panel, allBeats, characters, allLocations);
  const source = bundle.sourceFields;
  const effectiveLocation = location || bundle.location || undefined;
  const visibleNames = source.visibleCharacters;
  const visibleCharacterPrompts = (bundle.characters.length
    ? bundle.characters
    : visibleNames
      .map((name) => characters.find((character) => character.name === name || character.aliases?.includes(name)))
      .filter((character): character is CharacterProfile => Boolean(character))
  )
    .map(buildCharacterReferencePrompt);
  const locationObjects = Array.isArray(effectiveLocation?.keyObjects) ? effectiveLocation?.keyObjects.join(', ') : '';
  const props = Array.isArray(source.props) ? source.props.join(', ') : '';
  const locationContinuityBlock = buildLocationContinuityBlock({
    ...beat,
    beatId: beat.beatId || panel.beatId || panel.panelNumber,
    location: source.locationName,
    locationName: source.locationName,
    locationId: source.locationId,
    locationState: source.locationState
  }, allLocations);

  return compact([
    style,
    `single vertical comic panel, panel ${panel.panelNumber}`,
    effectiveLocation ? `location: ${effectiveLocation.name}, ${effectiveLocation.description || effectiveLocation.details || ''}` : '',
    locationObjects ? `location key objects: ${locationObjects}` : '',
    locationContinuityBlock,
    source.atmosphere ? `atmosphere: ${source.atmosphere}` : '',
    panel.shotType ? `shot type: ${panel.shotType}` : '',
    panel.cameraAngle ? `camera angle: ${panel.cameraAngle}` : '',
    panel.cameraDistance ? `camera distance: ${panel.cameraDistance}` : '',
    panel.lensFeel ? `lens feel: ${panel.lensFeel}` : '',
    panel.framing ? `framing: ${panel.framing}` : '',
    panel.composition ? `composition: ${panel.composition}` : '',
    panel.foreground ? `foreground: ${panel.foreground}` : '',
    panel.midground ? `midground: ${panel.midground}` : '',
    panel.background ? `background: ${panel.background}` : '',
    panel.lightingDirection || panel.lighting ? `lighting direction: ${panel.lightingDirection || panel.lighting}` : '',
    panel.depthAndPerspective ? `depth and perspective: ${panel.depthAndPerspective}` : '',
    panel.visualEmphasis ? `visual emphasis: ${panel.visualEmphasis}` : '',
    source.action ? `visible action: ${source.action}` : '',
    source.interaction ? `interaction: ${source.interaction}` : '',
    source.posture ? `posture: ${source.posture}` : '',
    props ? `important props: ${props}` : '',
    panel.characterBlocking?.length ? `character blocking: ${panel.characterBlocking.map((item) => `${item.characterName}: ${item.framePosition}, ${item.bodyPosition}, facing ${item.facingDirection}, expression ${item.expression}, pose refinement ${item.poseRefinement}`).join(' | ')}` : '',
    visibleCharacterPrompts.length ? `visible characters: ${visibleCharacterPrompts.join(' | ')}` : '',
    panel.cameraNotes || panel.continuityNotes ? `panel continuity: ${panel.cameraNotes || panel.continuityNotes}` : '',
    'preserve character identity and outfit exactly',
    'preserve location layout and key objects exactly',
    'no text, no captions, no subtitles, no speech bubbles, no watermark'
  ]);
}
