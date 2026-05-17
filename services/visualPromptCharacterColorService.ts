import type { CharacterProfile } from "../types";

export function buildCharacterAppearanceLine(character: CharacterProfile): string {
  const segments: string[] = [];

  if (character.gender) segments.push(character.gender);
  if (character.age) segments.push(character.age);

  const hairText =
    character.hairColor && character.hair
      ? `${character.hairColor} ${character.hair}`.trim()
      : character.hair;

  const eyeText =
    character.eyeColor && character.eyes
      ? `${character.eyeColor} ${character.eyes}`.trim()
      : character.eyes;

  const outfitColorText = [character.outfitMainColor, character.outfitAccentColor]
    .filter(Boolean)
    .join(" with ");

  const outfitText =
    outfitColorText && character.outfit
      ? `${outfitColorText} ${character.outfit}`.trim()
      : character.outfit;

  if (hairText) segments.push(`Hair: ${hairText}`);
  if (eyeText) segments.push(`Eyes: ${eyeText}`);
  // posture is typically dynamic per beat and storyboard panel,
  // but if the library has a default posture, we support it.
  const posture = (character as any).posture;
  if (posture) segments.push(`Posture: ${posture}`);
  if (outfitText) segments.push(`Outfit: ${outfitText}`);

  return `${character.name} (${segments.join(", ")})`;
}

export function looksLikeCharacterHasColorDetails(value: string): boolean {
  const colorWords = [
    "black",
    "brown",
    "blue",
    "green",
    "gray",
    "grey",
    "white",
    "cream",
    "gold",
    "silver",
    "pink",
    "red",
    "navy",
    "beige",
    "chestnut",
    "jet-black",
    "dark-brown",
    "light-brown",
    "champagne-gold",
    "pearl-white",
  ];

  const lower = value.toLowerCase();
  return colorWords.some((word) => lower.includes(word));
}
