# StoryFlow - Vibe Code Guide: Thêm hệ thống Accessories + Outfit Continuity theo Character / Screen / Beat

## Mục tiêu

Bổ sung hệ thống **phụ kiện và trang phục theo ngữ cảnh** để `visualPrompt` mô tả nhân vật chính xác hơn, nhưng không bị trộn phụ kiện/trang phục từ các đoạn khác của câu chuyện.

Vấn đề cần giải quyết:

```txt
- Character Library chỉ lưu một outfit/phụ kiện chung → dễ sai khi nhân vật thay đồ theo screen.
- visualPrompt có thể liệt kê quá nhiều outfit/phụ kiện ở nhiều beat khác nhau.
- Nhân vật bị mang phụ kiện không thuộc scene hiện tại.
- Các vật cầm tay như điện thoại, ly rượu, hợp đồng, bó hoa thay đổi theo beat nhưng chưa được quản lý rõ.
```

Thiết kế mới:

```txt
Character Library = identity gốc + signature accessories
Screen = outfit/accessories/handheld continuity của cảnh
Beat = momentary props/accessory changes trong khoảnh khắc cụ thể
```

---

# 1. Nguyên tắc thiết kế

## 1.1. Không coi mọi phụ kiện là cố định

Phụ kiện chia thành 3 tầng:

```txt
A. Character-level / Signature
B. Screen-level / Current state
C. Beat-level / Momentary change
```

---

## 1.2. Character-level accessories

Dùng cho phụ kiện đặc trưng, gần như gắn với nhân vật lâu dài:

```txt
- kính cận
- nhẫn cưới / nhẫn đính hôn
- đồng hồ quen thuộc
- dây chuyền đặc trưng
- bông tai ngọc trai
- vòng tay đặc trưng
- kẹp tóc đặc trưng
```

Field đề xuất:

```txt
signatureAccessories
defaultStyle
styleNotes
```

Ví dụ:

```json
{
  "name": "Khúc Thanh Y",
  "signatureAccessories": ["pearl earrings", "thin platinum bracelet"],
  "defaultStyle": "elegant, restrained high-society fashion",
  "styleNotes": "minimal luxury accessories, graceful and expensive but not flashy"
}
```

---

## 1.3. Screen-level outfit/accessories

Dùng cho trạng thái trang phục/phụ kiện chính trong một screen/cảnh liên tục.

Ví dụ:

```json
{
  "screenId": "screen_001",
  "screenCharacterStates": [
    {
      "characterName": "Khúc Thanh Y",
      "outfit": "champagne-gold evening gown with pearl-white embroidery",
      "accessories": ["pearl earrings", "silver clutch"],
      "handheldItems": ["wine glass"]
    }
  ]
}
```

Đây là tầng quan trọng nhất cho visualPrompt vì outfit/accessory thường thay đổi theo screen.

---

## 1.4. Beat-level accessory state

Dùng cho vật cầm tay hoặc thay đổi tức thời trong một beat:

```txt
- cầm điện thoại
- nâng ly rượu
- đưa chìa khóa
- cầm hợp đồng
- đặt túi lên bàn
- tháo kính
- cầm bó hoa
```

Field đề xuất:

```txt
characterMomentDetails
```

Ví dụ:

```json
{
  "beatId": 18,
  "characterMomentDetails": [
    {
      "characterName": "Khúc Thanh Y",
      "handheldItems": ["phone"],
      "accessoriesChange": ["silver clutch placed on the banquet table"],
      "visibleAccessories": ["pearl earrings"]
    }
  ]
}
```

---

# 2. Schema đề xuất

## 2.1. Cập nhật CharacterProfile

File:

```txt
types.ts
```

### Code cũ có thể là

```ts
export interface CharacterProfile {
  characterId: string;
  name: string;
  gender?: string;
  age?: string;
  height?: string;
  face?: string;
  hair?: string;
  eyes?: string;
  posture?: string;
  outfit?: string;
  notes?: string;
}
```

### Code mới

```ts
export interface CharacterProfile {
  characterId: string;
  name: string;

  gender?: string;
  age?: string;
  height?: string;
  face?: string;

  hair?: string;
  hairColor?: string;

  eyes?: string;
  eyeColor?: string;

  posture?: string;

  /**
   * Legacy/default outfit. Keep for backward compatibility.
   * Screen-level outfit should override this.
   */
  outfit?: string;
  outfitMainColor?: string;
  outfitAccentColor?: string;

  /**
   * Stable character-level accessories.
   * These should be used only when visually relevant or when the character normally wears them.
   */
  signatureAccessories?: string[];

  /**
   * General fashion identity for this character.
   */
  defaultStyle?: string;
  styleNotes?: string;

  notes?: string;
}
```

---

## 2.2. Thêm ScreenCharacterState

File:

```txt
types.ts
```

```ts
export interface ScreenCharacterState {
  characterName: string;
  characterId?: string;

  outfit: string;
  outfitMainColor?: string;
  outfitAccentColor?: string;

  accessories: string[];
  handheldItems: string[];

  /**
   * Describes how outfit/accessories look in this screen.
   */
  appearanceNotes?: string;

  /**
   * Example: "jacket removed", "tie loosened", "hair slightly messy".
   */
  stateChanges?: string[];
}
```

---

## 2.3. Cập nhật StoryScreen

### Code cũ có thể là

```ts
export interface StoryScreen {
  screenId: string;
  screenNumber: number;
  screenName: string;
  location: string;
  locationId?: string;
  timeOfDay: string;
  screenState: string;
  screenCharacters: string[];
  screenProps: string[];
  startBeatId: number;
  endBeatId: number;
  summary: string;
  continuityNotes?: string;
}
```

### Code mới

```ts
export interface StoryScreen {
  screenId: string;
  screenNumber: number;
  screenName: string;

  location: string;
  locationId?: string;
  timeOfDay: string;

  screenState: string;
  screenCharacters: string[];
  screenProps: string[];

  /**
   * Current outfit/accessory state for characters in this screen.
   */
  screenCharacterStates: ScreenCharacterState[];

  startBeatId: number;
  endBeatId: number;

  summary: string;
  continuityNotes?: string;

  meta?: EditableMeta;
}
```

---

## 2.4. Thêm Beat Character Moment Details

File:

```txt
types.ts
```

```ts
export interface BeatCharacterMomentDetail {
  characterName: string;
  characterId?: string;

  visibleAccessories?: string[];
  handheldItems?: string[];
  accessoriesChange?: string[];

  /**
   * Temporary outfit/accessory state for this exact beat.
   * Example: "holding wine glass", "phone raised in her right hand".
   */
  momentNotes?: string;
}
```

---

## 2.5. Cập nhật StoryBeat

### Code cũ có thể là

```ts
export interface StoryBeat {
  beatId: number;
  screenId: string;
  originalText: string;
  summary: string;
  focusCharacters: string[];
  visibleCharacters: string[];
  offscreenPresentCharacters: string[];
  location: string;
  action: string;
  props: string[];
  visualFocus: string;
}
```

### Code mới

```ts
export interface StoryBeat {
  beatId: number;
  screenId: string;

  originalText: string;
  summary: string;

  characters?: string[];
  focusCharacters: string[];
  visibleCharacters: string[];
  offscreenPresentCharacters: string[];

  location: string;
  locationId?: string;
  locationState?: string;

  action: string;
  interaction: string;
  posture: string;
  props: string[];

  /**
   * Beat-level accessory/handheld overrides.
   */
  characterMomentDetails?: BeatCharacterMomentDetail[];

  visualFocus: string;
  atmosphere: string;
  timeOfDay: string;

  meta?: EditableMeta;
}
```

---

# 3. Update Beat Analysis Prompt

File:

```txt
services/geminiService.ts
```

Tìm prompt Beat Analysis.

Thêm rules:

```txt
CHARACTER OUTFIT AND ACCESSORY CONTINUITY RULE - CRITICAL:
Use three levels of character appearance state:

1. Character-level signature:
Stable traits and signature accessories that belong to the character across the story.
Examples: pearl earrings, luxury wristwatch, thin platinum bracelet, glasses.

2. Screen-level state:
The outfit, accessories, and handheld items that persist throughout a continuous screen.
Use screenCharacterStates for this.
If a character changes clothes, starts wearing/removing an accessory, or enters a new major location/time segment, create/update the screen state.

3. Beat-level moment:
Temporary items/actions visible only in this beat.
Use characterMomentDetails for visible accessories, handheldItems, and accessoriesChange.

Do not put every accessory into Character Library as permanent.
Do not copy accessories from other screens into the current beat.
Do not list accessories that are not visible or relevant.
```

Thêm schema screen:

```txt
Each screen must include screenCharacterStates:
{
  "characterName": "Character name",
  "characterId": "char_001 if available",
  "outfit": "current outfit for this screen with color",
  "outfitMainColor": "main color",
  "outfitAccentColor": "accent color",
  "accessories": ["screen-level accessories"],
  "handheldItems": ["items held throughout or frequently in this screen"],
  "appearanceNotes": "short visual note",
  "stateChanges": ["optional state changes"]
}
```

Thêm schema beat:

```txt
Each beat may include characterMomentDetails if needed:
{
  "characterName": "Character name",
  "characterId": "char_001 if available",
  "visibleAccessories": ["accessories visible in this beat"],
  "handheldItems": ["items held in this beat"],
  "accessoriesChange": ["accessory/item change in this beat"],
  "momentNotes": "temporary visual state"
}
```

---

# 4. Update Character/Location Library Prompt

File:

```txt
services/geminiService.ts
```

Trong prompt Character/Location Analysis, thêm:

```txt
SIGNATURE ACCESSORY RULE:
Character profiles should include only stable/signature accessories, not every prop or temporary item.
Good signature accessories:
- glasses
- wedding ring
- luxury wristwatch
- pearl earrings
- thin platinum bracelet
- signature hairpin

Do not include temporary screen/beat items as permanent accessories:
- wine glass
- phone in hand
- contract
- bouquet
- suitcase
- umbrella
unless they are a recurring signature object.
```

Nếu đã thêm fields vào CharacterProfile, update JSON shape:

```json
{
  "characterId": "char_001",
  "name": "Khúc Thanh Y",
  "hair": "long silky hair",
  "hairColor": "jet black",
  "eyes": "deep expressive eyes",
  "eyeColor": "dark brown",
  "outfit": "default elegant high-society style",
  "outfitMainColor": "champagne gold",
  "outfitAccentColor": "pearl white",
  "signatureAccessories": ["pearl earrings", "thin platinum bracelet"],
  "defaultStyle": "restrained luxury",
  "styleNotes": "elegant, minimal, high-society styling"
}
```

---

# 5. Update Prompt Engineering Prompt

File:

```txt
services/geminiService.ts
```

Trong `getEngineerPromptsPrompt()`, thêm:

```txt
ACCESSORY SELECTION RULE - CRITICAL:
When writing visualPrompt for a beat:
1. Start with the character's stable identity from Character Library.
2. Use the current screenCharacterState for outfit, accessories, and handheld items.
3. Apply beat.characterMomentDetails only if the accessory/item is visible or important in this exact beat.
4. Do not include accessories from other screens.
5. Do not list every known accessory. Include only:
   - signature accessories visible on the character,
   - current screen-level accessories,
   - current beat-level handheld items or changes.

Outfit/accessories in visualPrompt must match the current screen and beat.
```

Thêm template:

```txt
For each visible character, describe:
[Name] (Gender, Age, Face, Hair with color, Eyes with color, Current screen outfit with colors, visible signature accessories, screen-level accessories, beat-level handheld item if visible, Posture)
```

Ví dụ:

```txt
Khúc Thanh Y (Female, late 20s, refined face, long silky jet-black hair, deep dark-brown eyes, Outfit: champagne-gold evening gown with pearl-white embroidery, Accessories: pearl earrings and a thin platinum bracelet, holding a wine glass, Posture: sitting upright with calm restraint)
```

Thêm negative rule:

```txt
Do NOT include:
- accessories from other screens
- alternate outfits
- beat ranges
- invisible accessories unless needed as continuity note
- every prop in the scene as character accessories
```

---

# 6. Update Normalizers

File có thể là:

```txt
services/finalResultBuilderService.ts
```

hoặc file chứa `normalizeScreens` / `normalizeBeats`.

## 6.1. normalizeScreenCharacterStates

```ts
export function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item).trim()).filter(Boolean)
    : [];
}

export function normalizeScreenCharacterStates(raw: any): ScreenCharacterState[] {
  const items = raw?.screenCharacterStates ?? raw?.screen_character_states ?? [];

  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    characterName: item.characterName ?? item.character_name ?? item.name ?? "",
    characterId: item.characterId ?? item.character_id,
    outfit: item.outfit ?? "",
    outfitMainColor: item.outfitMainColor ?? item.outfit_main_color,
    outfitAccentColor: item.outfitAccentColor ?? item.outfit_accent_color,
    accessories: normalizeStringArray(item.accessories),
    handheldItems: normalizeStringArray(item.handheldItems ?? item.handheld_items),
    appearanceNotes: item.appearanceNotes ?? item.appearance_notes ?? "",
    stateChanges: normalizeStringArray(item.stateChanges ?? item.state_changes),
  }));
}
```

## 6.2. Update normalizeScreens

Trong return object, thêm:

```ts
screenCharacterStates: normalizeScreenCharacterStates(item),
```

Fallback nếu không có:

```ts
screenCharacterStates: [],
```

## 6.3. normalizeCharacterMomentDetails

```ts
export function normalizeCharacterMomentDetails(raw: any): BeatCharacterMomentDetail[] {
  const items =
    raw?.characterMomentDetails ??
    raw?.character_moment_details ??
    [];

  if (!Array.isArray(items)) return [];

  return items.map((item: any) => ({
    characterName: item.characterName ?? item.character_name ?? item.name ?? "",
    characterId: item.characterId ?? item.character_id,
    visibleAccessories: normalizeStringArray(
      item.visibleAccessories ?? item.visible_accessories
    ),
    handheldItems: normalizeStringArray(item.handheldItems ?? item.handheld_items),
    accessoriesChange: normalizeStringArray(
      item.accessoriesChange ?? item.accessories_change
    ),
    momentNotes: item.momentNotes ?? item.moment_notes ?? "",
  }));
}
```

## 6.4. Update normalizeBeats

Trong return object, thêm:

```ts
characterMomentDetails: normalizeCharacterMomentDetails(item),
```

---

# 7. Add resolver for current character appearance

File mới đề xuất:

```txt
services/characterAppearanceResolver.ts
```

```ts
import type {
  BeatCharacterMomentDetail,
  CharacterProfile,
  ScreenCharacterState,
  StoryBeat,
  StoryScreen,
} from "../types";

function findByName<T extends { characterName?: string; name?: string }>(
  items: T[],
  name: string
): T | undefined {
  const lower = name.toLowerCase();
  return items.find((item) => {
    const itemName = (item.characterName ?? item.name ?? "").toLowerCase();
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
}

export function resolveCharacterAppearanceForBeat(
  characterName: string,
  beat: StoryBeat,
  screen: StoryScreen | undefined,
  profiles: CharacterProfile[]
): ResolvedCharacterAppearance {
  const profile = profiles.find(
    (item) => item.name.toLowerCase() === characterName.toLowerCase()
  );

  const screenState = findByName(screen?.screenCharacterStates ?? [], characterName);
  const momentState = findByName(beat.characterMomentDetails ?? [], characterName);

  const outfit = screenState?.outfit || profile?.outfit || "";

  const accessories = Array.from(
    new Set([
      ...(profile?.signatureAccessories ?? []),
      ...(screenState?.accessories ?? []),
      ...(momentState?.visibleAccessories ?? []),
    ])
  );

  const handheldItems = Array.from(
    new Set([
      ...(screenState?.handheldItems ?? []),
      ...(momentState?.handheldItems ?? []),
    ])
  );

  return {
    characterName,
    profile,
    screenState,
    momentState,
    outfit,
    accessories,
    handheldItems,
  };
}
```

MVP có thể chỉ dùng prompt AI, chưa cần resolver. Nhưng resolver sẽ hữu ích nếu sau này app tự build prompt.

---

# 8. Update Final Result Builder

File:

```txt
services/finalResultBuilderService.ts
```

Final output nên giữ screen/beat accessory data để debug và export.

Trong final panel source, thêm:

```ts
screenCharacterStates: screen?.screenCharacterStates ?? [],
characterMomentDetails: beat.characterMomentDetails ?? [],
```

Ví dụ:

```ts
source: {
  originalText: beat.originalText,
  summary: beat.summary,
  focusCharacters: beat.focusCharacters,
  visibleCharacters: beat.visibleCharacters,
  offscreenPresentCharacters: beat.offscreenPresentCharacters,
  characterMomentDetails: beat.characterMomentDetails ?? [],
  props: beat.props,
  action: beat.action,
  ...
},
screen: screen
  ? {
      ...,
      screenCharacterStates: screen.screenCharacterStates ?? [],
    }
  : undefined,
```

---

# 9. Update UI

## 9.1. ScreenStudioView

File:

```txt
components/storyflow/ScreenStudioView.tsx
```

Trong Screen Card, thêm section:

```tsx
{screen.screenCharacterStates?.length > 0 && (
  <div className="rounded-3xl border border-slate-200 bg-white p-5">
    <SectionLabel>Character Outfit / Accessories</SectionLabel>
    <div className="mt-3 space-y-3">
      {screen.screenCharacterStates.map((state) => (
        <div
          key={state.characterName}
          className="rounded-2xl border border-slate-100 bg-slate-50 p-3 text-sm"
        >
          <p className="font-bold text-slate-900">{state.characterName}</p>
          <p className="mt-1 text-slate-700">
            <span className="font-semibold">Outfit:</span> {state.outfit || "Unknown"}
          </p>
          {state.accessories?.length > 0 && (
            <p className="mt-1 text-slate-700">
              <span className="font-semibold">Accessories:</span>{" "}
              {state.accessories.join(", ")}
            </p>
          )}
          {state.handheldItems?.length > 0 && (
            <p className="mt-1 text-slate-700">
              <span className="font-semibold">Handheld:</span>{" "}
              {state.handheldItems.join(", ")}
            </p>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

## 9.2. Beat Card

Trong expanded details, thêm:

```tsx
{beat.characterMomentDetails?.length > 0 && (
  <div>
    <SectionLabel>Moment Accessories</SectionLabel>
    <div className="mt-2 space-y-2">
      {beat.characterMomentDetails.map((detail) => (
        <div key={detail.characterName} className="rounded-2xl bg-slate-50 p-3 text-sm">
          <p className="font-bold">{detail.characterName}</p>
          {detail.handheldItems?.length > 0 && (
            <p>Handheld: {detail.handheldItems.join(", ")}</p>
          )}
          {detail.visibleAccessories?.length > 0 && (
            <p>Visible accessories: {detail.visibleAccessories.join(", ")}</p>
          )}
          {detail.accessoriesChange?.length > 0 && (
            <p>Changes: {detail.accessoriesChange.join(", ")}</p>
          )}
        </div>
      ))}
    </div>
  </div>
)}
```

---

# 10. Update Final Result UI

File:

```txt
components/storyflow/FinalResultStudioView.tsx
```

Trong Screen section, hiển thị `screen.screenCharacterStates` nếu có.

Trong Beat details, hiển thị `item.source.characterMomentDetails` nếu có.

---

# 11. Prompt cho vibe coding agent

Copy prompt này đưa cho Codex/vibe code trong repo StoryFlow.

```txt
Bạn đang sửa repo StoryFlow.

Mục tiêu:
Thêm hệ thống outfit/accessory continuity theo Character / Screen / Beat để visualPrompt dùng đúng trang phục/phụ kiện theo từng screen/beat, không trộn từ cảnh khác.

Thiết kế:
- Character Library = identity gốc + signature accessories + default style.
- Screen = current outfit/accessories/handheld items for each character in that continuous screen.
- Beat = momentary accessory/handheld changes only for that beat.

A. Update types.ts
1. CharacterProfile:
   add optional fields:
   hairColor, eyeColor, outfitMainColor, outfitAccentColor,
   signatureAccessories?: string[],
   defaultStyle?: string,
   styleNotes?: string
2. Add ScreenCharacterState:
   characterName, characterId?,
   outfit, outfitMainColor?, outfitAccentColor?,
   accessories: string[],
   handheldItems: string[],
   appearanceNotes?,
   stateChanges?: string[]
3. Update StoryScreen:
   screenCharacterStates: ScreenCharacterState[]
4. Add BeatCharacterMomentDetail:
   characterName, characterId?,
   visibleAccessories?: string[],
   handheldItems?: string[],
   accessoriesChange?: string[],
   momentNotes?: string
5. Update StoryBeat:
   characterMomentDetails?: BeatCharacterMomentDetail[]

B. Update Beat Analysis prompt in services/geminiService.ts
- Add CHARACTER OUTFIT AND ACCESSORY CONTINUITY RULE:
  1. Character-level signature accessories are stable.
  2. Screen-level state stores outfit/accessories/handheld items for the screen.
  3. Beat-level moment stores temporary visible items or changes.
- Add screenCharacterStates schema to each screen.
- Add characterMomentDetails schema to each beat.
- Do not put every temporary prop into Character Library.
- Do not copy accessories from other screens into current beat.

C. Update Character/Location prompt
- Add SIGNATURE ACCESSORY RULE:
  Character profiles should only include stable/signature accessories.
  Do not include wine glass, phone in hand, contract, suitcase, bouquet as permanent accessories unless recurring signature object.
- Add fields signatureAccessories, defaultStyle, styleNotes to output schema if schema is explicit.

D. Update Prompt Engineering prompt
- Add ACCESSORY SELECTION RULE:
  Start with Character Library identity.
  Use current screenCharacterState for outfit/accessories/handheld items.
  Apply beat.characterMomentDetails only if visible or important in this beat.
  Do not include accessories from other screens.
  Do not list every known accessory.
- For visible characters include:
  identity + hair/eyes color + current screen outfit + visible signature accessories + screen-level accessories + beat-level handheld item if visible.
- Do not include invisible accessories unless needed in continuity note.

E. Update normalizers
- Add normalizeStringArray helper if not existing.
- Add normalizeScreenCharacterStates(raw).
- Add normalizeCharacterMomentDetails(raw).
- Update normalizeScreens to include screenCharacterStates.
- Update normalizeBeats to include characterMomentDetails.
- Keep backward compatibility if fields missing.

F. Optional resolver
- Add services/characterAppearanceResolver.ts:
  resolveCharacterAppearanceForBeat(characterName, beat, screen, profiles)
  combines:
  profile.signatureAccessories
  screenState.accessories
  momentState.visibleAccessories
  screenState.handheldItems
  momentState.handheldItems
  screen outfit overrides character default outfit.

G. Update Final Result Builder
- Include screen.screenCharacterStates in final screen data.
- Include beat.characterMomentDetails in final source data.
- Do not crash if fields missing.

H. Update UI
- ScreenStudioView:
  show Character Outfit / Accessories section for screen.screenCharacterStates.
- Beat expanded details:
  show Moment Accessories from beat.characterMomentDetails.
- FinalResultStudioView:
  optionally show screen outfit/accessory states and beat moment accessory details.

I. Do not do
- Do not treat all accessories as permanent.
- Do not put every prop into Character Library.
- Do not make visualPrompt list all accessories every time.
- Do not include accessories from another screen.
- Do not break old projects without screenCharacterStates/characterMomentDetails.
- Do not change beatId-only linkage.

J. Check
- npm run typecheck
- npm run build

Manual test:
1. Run Beat Analysis.
2. screens[] include screenCharacterStates.
3. beats[] include characterMomentDetails when needed.
4. Character Library has signatureAccessories only.
5. Prompt Engineering visualPrompt uses current screen outfit/accessories.
6. visualPrompt does not list accessories from other screens.
7. UI displays screen outfit/accessory state.
8. Final Result still builds and renders.
```

---

# 12. Manual test checklist

```txt
[ ] CharacterProfile có signatureAccessories/defaultStyle/styleNotes.
[ ] StoryScreen có screenCharacterStates.
[ ] StoryBeat có characterMomentDetails.
[ ] Beat Analysis output có screenCharacterStates.
[ ] Beat Analysis output có characterMomentDetails khi cần.
[ ] Character Library không đưa phone/wine glass/contract thành permanent accessory.
[ ] Prompt Engineering dùng outfit/accessories đúng current screen.
[ ] Prompt Engineering dùng handheld item đúng current beat.
[ ] visualPrompt không trộn phụ kiện từ screen khác.
[ ] UI Screen hiển thị outfit/accessories theo character.
[ ] UI Beat hiển thị moment accessories khi mở chi tiết.
[ ] Final Result vẫn build.
[ ] Legacy data thiếu fields mới vẫn chạy.
[ ] typecheck pass.
[ ] build pass.
```

---

# 13. Edge cases

## Case 1 - Nhân vật đổi outfit giữa hai screen

Expected:

```txt
screen_001 uses banquet outfit.
screen_002 uses airport outfit.
visualPrompt uses the current screen outfit only.
```

## Case 2 - Nhân vật cầm ly rượu trong một beat

Expected:

```txt
Beat characterMomentDetails has handheldItems: ["wine glass"].
visualPrompt includes wine glass only for that beat.
```

## Case 3 - Signature accessory

Expected:

```txt
Pearl earrings can appear across screens if character usually wears them.
But still omit if not visible due to camera framing.
```

## Case 4 - Prop vs accessory

Expected:

```txt
A contract on table is a prop.
A contract held by character in beat is handheldItems.
```

---

# 14. Definition of Done

Task hoàn thành khi:

```txt
[ ] Có schema phụ kiện 3 tầng: Character / Screen / Beat.
[ ] Prompt Beat Analysis tạo screenCharacterStates và characterMomentDetails.
[ ] Prompt Engineering chọn đúng outfit/accessories theo current screen/beat.
[ ] UI hiển thị outfit/accessory continuity.
[ ] Final Result giữ dữ liệu outfit/accessory.
[ ] Không trộn phụ kiện từ screen khác.
[ ] typecheck/build pass.
```
