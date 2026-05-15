# StoryFlow - Vibe Code Guide: Thêm EXPORT IMAGE PROMPT ở Final Result

## Mục tiêu

Thêm nút **EXPORT IMAGE PROMPT** ở màn **Final Result** để xuất file `.txt` chứa toàn bộ `visualPrompt`.

Format bắt buộc:

```txt
mỗi dòng = một visualPrompt hoàn chỉnh
```

Không xuất:

```txt
- JSON
- beatId
- screenId
- panelId
- Screen title
- Beat title
- dấu phân cách ---
- Negative prompt riêng
```

Vì `Negative prompt` đã được gộp vào `visualPrompt`, nên chỉ lấy nguyên:

```ts
item.prompt.visualPrompt
```

---

# 1. Output file mong muốn

File `storyflow-image-prompts.txt` nên có dạng:

```txt
Modern Manhua style, Chinese webtoon aesthetic... Negative prompt: low quality, blurry...
Modern Manhua style, Chinese webtoon aesthetic... Negative prompt: low quality, blurry...
Modern Manhua style, Chinese webtoon aesthetic... Negative prompt: low quality, blurry...
```

Quy tắc:

```txt
1 dòng = 1 visualPrompt
không có metadata
không có dòng trống giữa các prompt
không tách Negative prompt riêng
```

---

# 2. Files cần sửa

```txt
components/StoryFlow.tsx
```

Nếu app đã có export helper/service riêng thì có thể thêm vào:

```txt
services/finalResultExportService.ts
services/exportService.ts
```

Nhưng MVP chỉ cần sửa trong `StoryFlow.tsx`.

---

# 3. Thêm helper lấy items từ Final Result

Trong `components/StoryFlow.tsx`, gần các helper export hiện có, thêm:

```ts
function getFinalResultItems(finalResult: any): any[] {
  if (Array.isArray(finalResult?.panels)) {
    return finalResult.panels;
  }

  if (Array.isArray(finalResult?.items)) {
    return finalResult.items;
  }

  return [];
}
```

Lý do: Final Result có thể dùng `panels` hoặc `items`.

---

# 4. Thêm helper normalize prompt thành một dòng

Vì user yêu cầu:

```txt
mỗi dòng là mỗi visualPrompt
```

nên nếu `visualPrompt` có xuống dòng, phải gom lại thành một dòng.

```ts
function normalizePromptToOneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
```

---

# 5. Thêm helper build file txt

```ts
function buildImagePromptTxt(finalResult: any): string {
  const items = getFinalResultItems(finalResult);

  return items
    .map((item) => normalizePromptToOneLine(item?.prompt?.visualPrompt ?? ""))
    .filter(Boolean)
    .join("\n");
}
```

Quan trọng:

```txt
Không thêm Beat #
Không thêm Screen #
Không thêm separator
Không thêm Negative prompt riêng
Không JSON.stringify
```

---

# 6. Thêm helper download text file

Nếu repo đã có helper download file cho Export TXT/SRT/JSON, hãy reuse. Nếu chưa có, thêm:

```ts
function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}
```

---

# 7. Thêm handler export Image Prompt

Trong component `StoryFlow`:

```ts
function handleExportImagePrompts(): void {
  const finalResult = parseJsonSafe(production.finalResult, { panels: [] });
  const content = buildImagePromptTxt(finalResult);

  if (!content.trim()) {
    setError("Không có visualPrompt để export.");
    return;
  }

  downloadTextFile("storyflow-image-prompts.txt", content);
}
```

Nếu app đang dùng toast/status thay vì `setError`, dùng đúng pattern hiện có.

---

# 8. Thêm nút vào Final Result actions

Tìm cụm nút ở Final Result:

```tsx
BUILD FINAL RESULT
COPY FINAL JSON
EXPORT JSON
EXPORT SRT
EXPORT TXT
SAVE PROJECT
```

Thêm nút sau `EXPORT TXT`:

```tsx
<button
  type="button"
  onClick={handleExportImagePrompts}
  disabled={!production.finalResult?.trim()}
  className="..."
>
  EXPORT IMAGE PROMPT
</button>
```

Nếu repo dùng component Button:

```tsx
<Button
  onClick={handleExportImagePrompts}
  disabled={!hasFinalResult}
  variant="secondary"
>
  EXPORT IMAGE PROMPT
</Button>
```

---

# 9. Không được xuất Negative prompt riêng

Không dùng:

```ts
item.prompt.negativePrompt
item.negativePrompt
negativePrompt
```

Không làm:

```ts
return [
  item.prompt.visualPrompt,
  item.prompt.negativePrompt,
].join("\n");
```

Đúng:

```ts
return item.prompt.visualPrompt.trim();
```

Vì `Negative prompt` đã được gộp vào `visualPrompt`.

---

# 10. Không được xuất metadata

Không làm:

```ts
return `Beat ${item.beatId}: ${item.prompt.visualPrompt}`;
```

Không làm:

```ts
return `${item.screenId} | ${item.beatId} | ${item.prompt.visualPrompt}`;
```

Không làm:

```ts
return JSON.stringify(item.prompt);
```

Đúng:

```ts
return item.prompt.visualPrompt.trim();
```

---

# 11. Code hoàn chỉnh đề xuất

Thêm vào `StoryFlow.tsx`:

```ts
function getFinalResultItems(finalResult: any): any[] {
  if (Array.isArray(finalResult?.panels)) {
    return finalResult.panels;
  }

  if (Array.isArray(finalResult?.items)) {
    return finalResult.items;
  }

  return [];
}

function normalizePromptToOneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildImagePromptTxt(finalResult: any): string {
  const items = getFinalResultItems(finalResult);

  return items
    .map((item) => normalizePromptToOneLine(item?.prompt?.visualPrompt ?? ""))
    .filter(Boolean)
    .join("\n");
}

function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  URL.revokeObjectURL(url);
}
```

Trong component:

```ts
function handleExportImagePrompts(): void {
  const finalResult = parseJsonSafe(production.finalResult, { panels: [] });
  const content = buildImagePromptTxt(finalResult);

  if (!content.trim()) {
    setError("Không có visualPrompt để export.");
    return;
  }

  downloadTextFile("storyflow-image-prompts.txt", content);
}
```

Trong JSX:

```tsx
<button
  type="button"
  onClick={handleExportImagePrompts}
  disabled={!production.finalResult?.trim()}
  className="..."
>
  EXPORT IMAGE PROMPT
</button>
```

---

# 12. Prompt cho vibe coding agent

Copy prompt này đưa cho Codex/vibe code trong repo StoryFlow.

```txt
Bạn đang sửa repo StoryFlow.

Mục tiêu:
Thêm nút EXPORT IMAGE PROMPT ở màn Final Result để xuất file .txt chứa toàn bộ visualPrompt. Format bắt buộc: mỗi dòng là một visualPrompt hoàn chỉnh.

Yêu cầu:
- Chỉ xuất item.prompt.visualPrompt.
- Mỗi visualPrompt nằm trên đúng 1 dòng.
- Nếu visualPrompt có line breaks, normalize thành 1 dòng bằng replace(/\s+/g, " ").
- Không xuất JSON.
- Không xuất beatId.
- Không xuất screenId.
- Không xuất panelId.
- Không xuất Screen/Beat title.
- Không thêm separator "---".
- Không xuất Negative prompt riêng vì Negative prompt đã được gộp vào visualPrompt.
- Không dùng item.prompt.negativePrompt hoặc item.negativePrompt.
- File name: storyflow-image-prompts.txt.

A. Sửa components/StoryFlow.tsx
- Thêm helper:
  getFinalResultItems(finalResult)
  normalizePromptToOneLine(value)
  buildImagePromptTxt(finalResult)
- Nếu chưa có helper download text file thì thêm downloadTextFile(filename, content), hoặc reuse helper export TXT hiện có.
- Thêm handler:
  handleExportImagePrompts()
  parse production.finalResult bằng parseJsonSafe(production.finalResult, { panels: [] })
  build content = buildImagePromptTxt(finalResult)
  nếu content rỗng thì setError("Không có visualPrompt để export.")
  nếu có thì downloadTextFile("storyflow-image-prompts.txt", content)

B. Thêm nút UI
- Trong cụm action buttons của Final Result, thêm nút:
  EXPORT IMAGE PROMPT
- Đặt sau EXPORT TXT.
- disabled khi !production.finalResult?.trim()
- onClick = handleExportImagePrompts

C. Không làm
- Không thêm metadata vào txt.
- Không thêm header.
- Không thêm beat number.
- Không thêm screen number.
- Không thêm Negative prompt riêng.
- Không đổi schema Final Result.
- Không gọi Gemini.
- Không ảnh hưởng export SRT/TXT/JSON hiện có.

D. Test
- npm run typecheck
- npm run build
- Manual:
  1. Build Final Result.
  2. Click EXPORT IMAGE PROMPT.
  3. File storyflow-image-prompts.txt được tải.
  4. Số dòng = số item/panel có visualPrompt.
  5. Mỗi dòng là một visualPrompt.
  6. Không có Beat #, Screen #, JSON, separator.
  7. Không có negativePrompt riêng ngoài phần đã nằm trong visualPrompt.
```

---

# 13. Manual test checklist

```txt
[ ] Có nút EXPORT IMAGE PROMPT ở Final Result.
[ ] Nút nằm sau EXPORT TXT.
[ ] Nút disabled khi chưa có finalResult.
[ ] Sau khi build finalResult, nút enabled.
[ ] Bấm nút tải file storyflow-image-prompts.txt.
[ ] File chỉ chứa visualPrompt.
[ ] Mỗi dòng là một visualPrompt.
[ ] visualPrompt có xuống dòng đã được normalize thành một dòng.
[ ] Không có beatId.
[ ] Không có screenId.
[ ] Không có panelId.
[ ] Không có JSON.
[ ] Không có separator "---".
[ ] Không xuất negativePrompt riêng.
[ ] Export JSON/SRT/TXT cũ vẫn hoạt động.
[ ] typecheck pass.
[ ] build pass.
```

---

# 14. Edge cases

## Case 1 - Một số item không có visualPrompt

Expected:

```txt
Bỏ qua item đó.
Không xuất dòng rỗng.
```

## Case 2 - visualPrompt có nhiều dòng

Expected:

```txt
Normalize thành 1 dòng.
```

## Case 3 - finalResult dùng `items` thay vì `panels`

Expected:

```txt
Helper getFinalResultItems hỗ trợ cả panels và items.
```

## Case 4 - finalResult malformed

Expected:

```txt
parseJsonSafe fallback.
Nếu không có visualPrompt thì báo "Không có visualPrompt để export."
Không crash.
```

---

# 15. Definition of Done

Task hoàn thành khi:

```txt
[ ] Có helper buildImagePromptTxt.
[ ] Có handler handleExportImagePrompts.
[ ] Có nút EXPORT IMAGE PROMPT.
[ ] File txt mỗi dòng là một visualPrompt.
[ ] Không export metadata.
[ ] Không export negativePrompt riêng.
[ ] Không ảnh hưởng export hiện có.
[ ] typecheck/build pass.
```
