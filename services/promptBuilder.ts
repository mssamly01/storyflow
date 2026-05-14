import type {
  BeatAnalysis,
  CharacterProfile,
  LocationProfile,
  StoryboardPanel
} from '../types';

const compact = (parts: Array<string | undefined | null | false>) =>
  parts.filter(Boolean).join(', ');

export function buildCharacterReferencePrompt(character: CharacterProfile): string {
  const signatureFeatures = Array.isArray(character.signatureFeatures)
    ? character.signatureFeatures.join(', ')
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
    character.continuityNotes ? `continuity: ${character.continuityNotes}` : ''
  ]);
}

export function buildLocationReferencePrompt(location: LocationProfile, style: string): string {
  const keyObjects = Array.isArray(location.keyObjects)
    ? location.keyObjects.join(', ')
    : '';

  return compact([
    style,
    `establishing shot of ${location.name}`,
    location.description || location.details,
    keyObjects ? `key objects: ${keyObjects}` : '',
    location.lightingDefault ? `default lighting: ${location.lightingDefault}` : '',
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
}): string {
  const { style, beat, panel, characters, location } = params;
  const visibleNames = Array.isArray(panel.visibleCharacters) ? panel.visibleCharacters : [];
  const visibleCharacterPrompts = visibleNames
    .map((name) => characters.find((character) => character.name === name))
    .filter((character): character is CharacterProfile => Boolean(character))
    .map(buildCharacterReferencePrompt);
  const locationObjects = Array.isArray(location?.keyObjects) ? location?.keyObjects.join(', ') : '';
  const props = Array.isArray(beat.props) ? beat.props.join(', ') : '';

  return compact([
    style,
    `single vertical comic panel, panel ${panel.panelNumber}`,
    location ? `location: ${location.name}, ${location.description || location.details || ''}` : '',
    locationObjects ? `location key objects: ${locationObjects}` : '',
    beat.timeOfDay ? `time of day: ${beat.timeOfDay}` : '',
    beat.atmosphere ? `atmosphere: ${beat.atmosphere}` : '',
    panel.shotType ? `shot type: ${panel.shotType}` : '',
    panel.cameraAngle ? `camera angle: ${panel.cameraAngle}` : '',
    panel.framing ? `framing: ${panel.framing}` : '',
    panel.composition ? `composition: ${panel.composition}` : '',
    panel.lighting ? `lighting: ${panel.lighting}` : '',
    panel.actionInFrame ? `visible action: ${panel.actionInFrame}` : '',
    beat.interaction ? `interaction: ${beat.interaction}` : '',
    beat.posture ? `posture: ${beat.posture}` : '',
    props ? `important props: ${props}` : '',
    visibleCharacterPrompts.length ? `visible characters: ${visibleCharacterPrompts.join(' | ')}` : '',
    panel.continuityNotes ? `panel continuity: ${panel.continuityNotes}` : '',
    'preserve character identity and outfit exactly',
    'preserve location layout and key objects exactly',
    'no text, no captions, no subtitles, no speech bubbles, no watermark'
  ]);
}
