import type {
  CharacterProfile,
  StoryBeat,
  StoryScreen,
  ScreenCharacterState,
  BeatCharacterMomentDetail
} from "../types";

function findByName<T extends { characterName?: string; name?: string }>(
  items: T[],
  name: string
): T | undefined {
  const lower = name.toLowerCase().trim();
  return items.find((item) => {
    const itemName = (item.characterName ?? item.name ?? "").toLowerCase().trim();
    return itemName === lower;
  });
}

export interface ResolvedCharacterAppearance {
  characterName: string;
  profile?: CharacterProfile;
  screenState?: ScreenCharacterState;
  momentState?: BeatCharacterMomentDetail;
  outfit: string;
  accessories: string[];
  handheldItems: string[];
  hairColor: string;
  eyeColor: string;
  gender: string;
  age: string;
  height: string;
  face: string;
  hair: string;
  eyes: string;
}

export function resolveCharacterAppearanceForBeat(
  characterName: string,
  beat: StoryBeat,
  screen: StoryScreen | undefined,
  profiles: CharacterProfile[]
): ResolvedCharacterAppearance {
  const profile = profiles.find(
    (item) => item.name.toLowerCase().trim() === characterName.toLowerCase().trim()
  );

  const screenState = findByName(screen?.screenCharacterStates ?? [], characterName);
  const momentState = findByName(beat.characterMomentDetails ?? [], characterName);

  // 1. Resolve Outfit: Screen State -> Character Library profile -> fallback empty
  const outfit = screenState?.outfit || profile?.outfit || "";

  // 2. Resolve Colors
  const hairColor = profile?.hairColor ?? "";
  const eyeColor = profile?.eyeColor ?? "";

  // 3. Resolve Accessories: Combine stable/signature accessories + screen-level accessories + beat-level visible accessories
  const signatureAccs = profile?.signatureAccessories ?? profile?.accessories ?? [];
  const screenAccs = screenState?.accessories ?? [];
  const beatAccs = momentState?.visibleAccessories ?? [];

  const accessories = Array.from(
    new Set(
      [...signatureAccs, ...screenAccs, ...beatAccs]
        .map((a) => String(a).trim())
        .filter(Boolean)
    )
  );

  // 4. Resolve Handheld Items: Combine screen handheld items + beat handheld items
  const screenHandheld = screenState?.handheldItems ?? [];
  const beatHandheld = momentState?.handheldItems ?? [];

  const handheldItems = Array.from(
    new Set(
      [...screenHandheld, ...beatHandheld]
        .map((h) => String(h).trim())
        .filter(Boolean)
    )
  );

  return {
    characterName,
    profile,
    screenState,
    momentState,
    outfit,
    accessories,
    handheldItems,
    hairColor,
    eyeColor,
    gender: profile?.gender ?? "Unknown",
    age: profile?.age ?? "Unknown",
    height: profile?.height ?? "Unknown",
    face: profile?.face ?? "Unknown",
    hair: profile?.hair ?? "Unknown",
    eyes: profile?.eyes ?? "Unknown",
  };
}
