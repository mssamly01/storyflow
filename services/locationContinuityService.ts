import type { LocationProfile, StoryBeat } from "../types";

function normalizeText(value?: string | null): string {
  return (value || "").trim().toLowerCase();
}

function formatList(items?: string[], fallback = "None specified"): string {
  const cleanItems = items?.map((item) => item.trim()).filter(Boolean) || [];
  return cleanItems.length ? cleanItems.join(", ") : fallback;
}

function valueOrUnknown(value?: string | null): string {
  const cleanValue = value?.trim();
  return cleanValue || "Unknown";
}

function matchLocationByNameOrAlias(
  beatLocation: string | undefined,
  locations: LocationProfile[]
): LocationProfile | null {
  const normalizedBeatLocation = normalizeText(beatLocation);
  if (!normalizedBeatLocation) return null;

  for (const location of locations) {
    if (normalizeText(location.name) === normalizedBeatLocation) return location;

    const aliases = location.aliases || [];
    if (aliases.some((alias) => normalizeText(alias) === normalizedBeatLocation)) {
      return location;
    }
  }

  return null;
}

export function mapLocationIdsToBeats(
  beats: StoryBeat[],
  locations: LocationProfile[]
): StoryBeat[] {
  return beats.map((beat) => {
    const matchedLocation = matchLocationByNameOrAlias(
      beat.location || beat.locationName,
      locations
    );

    if (!matchedLocation) {
      return {
        ...beat,
        locationId: beat.locationId,
        locationState: beat.locationState || ""
      };
    }

    return {
      ...beat,
      locationId: matchedLocation.locationId || beat.locationId,
      locationState: beat.locationState?.trim()
        ? beat.locationState
        : matchedLocation.baseState || ""
    };
  });
}

export function buildLocationContinuityBlock(
  beat: StoryBeat,
  locations: LocationProfile[]
): string {
  const location = locations.find((item) => item.locationId && item.locationId === beat.locationId)
    || matchLocationByNameOrAlias(beat.location || beat.locationName, locations);

  if (!location) {
    return `LOCATION CONTINUITY:
- No matched location profile.
- Beat location text: ${beat.location || beat.locationName || "Unknown"}
- Preserve any previously established environment if available.
- Camera angle may change, but avoid random environment redesign.`;
  }

  return `LOCATION CONTINUITY:
- Use location ${location.locationId || "unknown_id"}: ${location.name}
- Base description: ${location.description || location.details || "Unknown"}
- Spatial layout: ${location.layout || "Unknown"}
- Key objects to preserve: ${formatList(location.keyObjects)}
- Lighting: ${location.lighting || location.lightingDefault || "Unknown"}
- Color palette: ${formatList(location.colorPalette)}
- Continuity notes: ${location.continuityNotes || "Keep the same environment identity across beats."}
- Current beat state: ${beat.locationState || location.baseState || "No special state change."}
- Keep the same environment identity, furniture placement, architectural features, and object relationships as previous beats.
- Camera angle may change, but object positions and room structure must remain consistent.`;
}

export function buildLocationReferenceSheetPrompt(
  location: LocationProfile,
  artStyleDescription = ""
): string {
  return `Create a clean professional LOCATION REFERENCE SHEET for a consistent visual environment.

IMPORTANT:
This is NOT a story scene.
This is NOT a cinematic image.
This is a production environment model sheet / location design bible used to keep the same location consistent across many generated images.

Location identity:
- Name: ${valueOrUnknown(location.name)}
- Aliases: ${formatList(location.aliases)}
- Description: ${valueOrUnknown(location.description || location.details)}
- Layout: ${valueOrUnknown(location.layout)}
- Key objects: ${formatList(location.keyObjects)}
- Lighting: ${valueOrUnknown(location.lighting || location.lightingDefault)}
- Color palette: ${formatList(location.colorPalette)}
- Continuity notes: ${valueOrUnknown(location.continuityNotes)}
- Base state: ${valueOrUnknown(location.baseState)}

Art style:
${artStyleDescription || "Consistent high-quality environment design, clean production art style."}

Reference sheet layout:
- White or very light neutral background.
- Clean organized reference sheet layout with thin panel borders.
- Main environment views:
  1. wide establishing shot
  2. front view
  3. left-side view
  4. right-side view
- Optional top-down layout map / floor-plan style diagram.
- Key object close-up panels.
- Lighting reference section.
- If useful, show day/night or mood variation only if the location actually requires it.
- Show the exact same environment identity across all panels.

Visual quality rules:
- Environment design board.
- Location reference board.
- Consistent spatial layout across all panels.
- Consistent furniture placement and architectural features across all views.
- Clean studio-like presentation.
- No characters unless absolutely necessary for scale.
- No speech bubbles.
- No random extra furniture.
- No layout changes between panels.
- No unreadable tiny text.

Text rendering rule:
- Avoid detailed readable text inside the image.
- Use simple section boxes or minimal labels only.
- Prioritize accurate environment visuals over written labels.

Final image should look like a professional location reference sheet, with multiple panels showing the same environment from different angles, layout consistency, key objects, lighting, and reusable visual identity.`;
}
