# StoryFlow - Vibe Code Guide: Khôi phục chức năng Export SRT

## Mục tiêu

Khôi phục chức năng **xuất SRT** cho StoryFlow.

Yêu cầu chính:

```txt
- Xuất file .srt từ dữ liệu đã phân tích.
- Mỗi beat/panel mặc định duration = 5 giây.
- Nội dung subtitle lấy từ originalText.
- Nếu đã có Final Result thì ưu tiên lấy từ finalResult.panels[].source.originalText.
- Nếu chưa có Final Result thì fallback lấy từ project.beats hoặc production.analysis.
- Có thể xuất thêm .txt nếu muốn.
- UI có nút Export SRT ở Final Result hoặc Beat Analysis.
```

---

# 1. Logic xuất SRT nên lấy dữ liệu từ đâu?

Thứ tự ưu tiên:

```txt
1. Final Result
   finalResult.panels[].source.originalText

2. Project State
   project.beats[].originalText

3. Legacy production.analysis
   normalizeBeats(production.analysis).originalText
```

Vì app hiện đã có `FinalResult` build local, nguồn tốt nhất là:

```txt
production.finalResult
```

hoặc:

```txt
project.finalResult
```

Nếu chưa build Final Result, vẫn có thể export từ Beat Analysis.

---

# 2. SRT format

SRT chuẩn:

```srt
1
00:00:00,000 --> 00:00:05,000
Nội dung subtitle beat 1

2
00:00:05,000 --> 00:00:10,000
Nội dung subtitle beat 2
```

Mặc định:

```txt
durationPerItemSeconds = 5
```

Có thể thêm option sau này:

```txt
3s / 5s / 7s / custom
```

MVP dùng 5s cố định.

---

# 3. Plan tổng thể

## Phase A - Tạo subtitle export service

Tạo file mới:

```txt
services/subtitleExportService.ts
```

Service này có:

```txt
formatSrtTimestamp()
buildSrtFromItems()
extractSubtitleItemsFromFinalResult()
extractSubtitleItemsFromBeats()
downloadTextFile()
```

---

## Phase B - Tạo handler trong StoryFlow.tsx

Thêm các handler:

```txt
handleExportSrt()
handleExportTxt()
```

Handler sẽ:

```txt
- Lấy subtitle items từ Final Result nếu có.
- Nếu không có, lấy từ project.beats.
- Nếu project.beats rỗng, parse production.analysis.
- Gọi buildSrtFromItems(items, 5).
- Download file storyflow-subtitles.srt.
```

---

## Phase C - Thêm nút UI

Nên thêm nút ở Final Result panel:

```txt
Export SRT
Export TXT
```

Có thể đặt cùng nhóm với:

```txt
Build Final Result
Copy Final JSON
Export JSON
Save Project
```

---

# 4. Code mới: `services/subtitleExportService.ts`

Tạo file:

```txt
services/subtitleExportService.ts
```

```ts
import type { FinalResult, StoryBeat } from "../types";

export interface SubtitleItem {
  index: number;
  text: string;
}

export interface SubtitleExportOptions {
  durationPerItemSeconds?: number;
  startOffsetSeconds?: number;
}

function sanitizeSubtitleText(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

export function formatSrtTimestamp(totalSeconds: number): string {
  const safeSeconds = Math.max(0, totalSeconds);

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = Math.floor(safeSeconds % 60);
  const milliseconds = Math.round((safeSeconds - Math.floor(safeSeconds)) * 1000);

  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const ms = String(milliseconds).padStart(3, "0");

  return `${hh}:${mm}:${ss},${ms}`;
}

export function buildSrtFromItems(
  items: SubtitleItem[],
  options: SubtitleExportOptions = {}
): string {
  const duration = options.durationPerItemSeconds ?? 5;
  const startOffset = options.startOffsetSeconds ?? 0;

  return items
    .filter((item) => item.text.trim().length > 0)
    .map((item, arrayIndex) => {
      const subtitleIndex = arrayIndex + 1;
      const startSeconds = startOffset + arrayIndex * duration;
      const endSeconds = startSeconds + duration;

      return [
        String(subtitleIndex),
        `${formatSrtTimestamp(startSeconds)} --> ${formatSrtTimestamp(endSeconds)}`,
        sanitizeSubtitleText(item.text),
      ].join("\n");
    })
    .join("\n\n");
}

export function buildTxtFromItems(items: SubtitleItem[]): string {
  return items
    .filter((item) => item.text.trim().length > 0)
    .map((item) => sanitizeSubtitleText(item.text))
    .join("\n\n");
}

export function extractSubtitleItemsFromFinalResult(
  finalResult: FinalResult | null | undefined
): SubtitleItem[] {
  if (!finalResult?.panels || !Array.isArray(finalResult.panels)) {
    return [];
  }

  return finalResult.panels.map((panel, index) => ({
    index: index + 1,
    text: panel.source?.originalText ?? "",
  }));
}

export function extractSubtitleItemsFromBeats(beats: StoryBeat[]): SubtitleItem[] {
  return beats.map((beat, index) => ({
    index: index + 1,
    text: beat.originalText ?? "",
  }));
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType = "text/plain;charset=utf-8"
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}
```

---

# 5. Sửa `StoryFlow.tsx`

## 5.1. Import mới

### Code cũ

Trong `components/StoryFlow.tsx`, bạn đã có import từ các service.

### Code mới thêm

```ts
import {
  buildSrtFromItems,
  buildTxtFromItems,
  downloadTextFile,
  extractSubtitleItemsFromBeats,
  extractSubtitleItemsFromFinalResult,
} from '../services/subtitleExportService';
```

Nếu import path khác, điều chỉnh theo repo.

---

## 5.2. Helper lấy subtitle items

Thêm trong component `StoryFlow`:

```ts
function getSubtitleItems() {
  const finalResult = parseJsonSafe<FinalResult | null>(
    production.finalResult,
    null
  );

  const finalResultItems = extractSubtitleItemsFromFinalResult(finalResult);
  if (finalResultItems.length > 0) {
    return finalResultItems;
  }

  if (project?.beats && project.beats.length > 0) {
    return extractSubtitleItemsFromBeats(project.beats);
  }

  const analysisData = parseJsonSafe<unknown>(production.analysis, {});
  const beats = normalizeBeats(analysisData);

  return extractSubtitleItemsFromBeats(beats);
}
```

Nếu chưa có `project` state:

```ts
function getSubtitleItems() {
  const finalResult = parseJsonSafe<FinalResult | null>(
    production.finalResult,
    null
  );

  const finalResultItems = extractSubtitleItemsFromFinalResult(finalResult);
  if (finalResultItems.length > 0) {
    return finalResultItems;
  }

  const analysisData = parseJsonSafe<unknown>(production.analysis, {});
  const beats = normalizeBeats(analysisData);

  return extractSubtitleItemsFromBeats(beats);
}
```

Nếu TypeScript chưa import `FinalResult`, thêm:

```ts
import type { FinalResult } from '../types';
```

---

## 5.3. Handler Export SRT

Thêm trong `StoryFlow.tsx`:

```ts
const handleExportSrt = () => {
  const subtitleItems = getSubtitleItems();

  if (subtitleItems.length === 0) {
    setError?.("Không có dữ liệu để xuất SRT. Hãy chạy Beat Analysis hoặc Build Final Result trước.");
    return;
  }

  const srtContent = buildSrtFromItems(subtitleItems, {
    durationPerItemSeconds: 5,
  });

  downloadTextFile(
    "storyflow-subtitles.srt",
    srtContent,
    "application/x-subrip;charset=utf-8"
  );
};
```

Nếu không có `setError`, dùng state báo lỗi hiện tại hoặc `alert` tạm:

```ts
alert("Không có dữ liệu để xuất SRT. Hãy chạy Beat Analysis hoặc Build Final Result trước.");
```

---

## 5.4. Handler Export TXT

```ts
const handleExportTxt = () => {
  const subtitleItems = getSubtitleItems();

  if (subtitleItems.length === 0) {
    setError?.("Không có dữ liệu để xuất TXT. Hãy chạy Beat Analysis hoặc Build Final Result trước.");
    return;
  }

  const txtContent = buildTxtFromItems(subtitleItems);

  downloadTextFile(
    "storyflow-original-text.txt",
    txtContent,
    "text/plain;charset=utf-8"
  );
};
```

---

# 6. Thêm nút UI ở Final Result

## 6.1. Code cũ có thể đang có

Trong Final Result UI có các button:

```tsx
<button onClick={handleBuildFinalResult}>Build Final Result</button>
<button onClick={handleCopyFinalResult}>Copy Final JSON</button>
<button onClick={handleExportFinalResultJson}>Export JSON</button>
<button onClick={handleSaveProject}>Save Project</button>
```

## 6.2. Code mới thêm

Thêm:

```tsx
<button
  type="button"
  onClick={handleExportSrt}
  className="rounded-xl border px-4 py-2 text-sm font-semibold"
>
  Export SRT
</button>

<button
  type="button"
  onClick={handleExportTxt}
  className="rounded-xl border px-4 py-2 text-sm font-semibold"
>
  Export TXT
</button>
```

Nếu đang dùng component `FinalResultBuilderPanel`, thêm props:

```tsx
onExportSrt={handleExportSrt}
onExportTxt={handleExportTxt}
```

Component props:

```tsx
function FinalResultBuilderPanel({
  finalResult,
  buildCheck,
  onBuild,
  onCopy,
  onExportJson,
  onExportSrt,
  onExportTxt,
  onSaveProject,
}: {
  finalResult: string;
  buildCheck: FinalResultBuildCheck;
  onBuild: () => void;
  onCopy: () => void;
  onExportJson: () => void;
  onExportSrt: () => void;
  onExportTxt: () => void;
  onSaveProject?: () => void;
}) {
  ...
}
```

Button group:

```tsx
<button
  type="button"
  onClick={onExportSrt}
  className="rounded-xl border px-4 py-2 text-sm font-semibold"
>
  Export SRT
</button>

<button
  type="button"
  onClick={onExportTxt}
  className="rounded-xl border px-4 py-2 text-sm font-semibold"
>
  Export TXT
</button>
```

---

# 7. Optional: chọn duration mỗi subtitle

MVP mặc định 5s là đủ.

Nếu muốn UI chỉnh duration:

```ts
const [subtitleDurationSeconds, setSubtitleDurationSeconds] = useState(5);
```

UI:

```tsx
<label className="text-sm font-semibold">Subtitle duration</label>
<input
  type="number"
  min={1}
  max={30}
  value={subtitleDurationSeconds}
  onChange={(event) =>
    setSubtitleDurationSeconds(Number(event.target.value) || 5)
  }
  className="w-24 rounded border px-3 py-2"
/>
```

Handler:

```ts
const srtContent = buildSrtFromItems(subtitleItems, {
  durationPerItemSeconds: subtitleDurationSeconds,
});
```

Nhưng nếu muốn ít sửa, giữ hardcode `5`.

---

# 8. Optional: Export SRT từ Beat Analysis stage

Ngoài Final Result, có thể thêm nút ở Beat Analysis:

```txt
Export SRT from Beats
Export TXT from Beats
```

Vì SRT chỉ cần `originalText`, không bắt buộc phải có Final Result.

Button:

```tsx
<button
  type="button"
  onClick={handleExportSrt}
>
  Export SRT
</button>
```

---

# 9. Prompt cho vibe coding agent

Copy prompt này đưa cho Codex/vibe code trong repo StoryFlow.

```txt
Bạn đang sửa repo StoryFlow.

Mục tiêu:
Khôi phục chức năng xuất SRT. SRT lấy nội dung từ originalText của từng beat/panel, duration mặc định 5 giây mỗi item.

Yêu cầu:
- Tạo service mới services/subtitleExportService.ts.
- Export được .srt.
- Export được .txt nếu dễ.
- Ưu tiên lấy data từ Final Result:
  finalResult.panels[].source.originalText
- Nếu chưa có Final Result, fallback lấy từ project.beats.
- Nếu project.beats rỗng, fallback parse production.analysis bằng normalizeBeats.
- Không gọi AI.
- Không phân tích lại.
- Chỉ lấy dữ liệu đã có.
- UI có nút Export SRT và Export TXT ở Final Result.
- Có thể thêm ở Beat Analysis nếu dễ.
- Mặc định mỗi subtitle 5 giây.

Làm các bước:

A. Tạo services/subtitleExportService.ts
- Thêm types:
  SubtitleItem
  SubtitleExportOptions
- Export functions:
  formatSrtTimestamp(totalSeconds)
  buildSrtFromItems(items, options)
  buildTxtFromItems(items)
  extractSubtitleItemsFromFinalResult(finalResult)
  extractSubtitleItemsFromBeats(beats)
  downloadTextFile(filename, content, mimeType)

B. Sửa components/StoryFlow.tsx
- Import subtitle export functions.
- Thêm helper getSubtitleItems():
  1. parse production.finalResult -> extractSubtitleItemsFromFinalResult
  2. nếu có project.beats -> extractSubtitleItemsFromBeats(project.beats)
  3. fallback parse production.analysis -> normalizeBeats -> extractSubtitleItemsFromBeats
- Thêm handler handleExportSrt():
  - const items = getSubtitleItems()
  - nếu rỗng báo lỗi
  - const srt = buildSrtFromItems(items, { durationPerItemSeconds: 5 })
  - downloadTextFile("storyflow-subtitles.srt", srt, "application/x-subrip;charset=utf-8")
- Thêm handler handleExportTxt():
  - buildTxtFromItems(items)
  - downloadTextFile("storyflow-original-text.txt", txt, "text/plain;charset=utf-8")

C. Sửa UI Final Result
- Trong button group Final Result, thêm:
  Export SRT
  Export TXT
- Nếu FinalResultBuilderPanel là component riêng, thêm props:
  onExportSrt
  onExportTxt
- Nếu không có data, button có thể vẫn enabled nhưng handler báo lỗi.

D. Optional
- Thêm duration input sau này, nhưng MVP hardcode 5s.
- Có thể thêm Export SRT ở Beat Analysis stage.

E. Không sửa phần không liên quan
- Không đổi FinalResult builder.
- Không đổi prompt AI.
- Không gọi Gemini.
- Không rewrite originalText.
- Không thay đổi data model nếu không cần.

F. Kiểm tra
- npm run typecheck
- npm run build
- Manual test:
  1. Chạy Beat Analysis.
  2. Export SRT khi chưa build Final Result vẫn được.
  3. Build Final Result.
  4. Export SRT từ Final Result.
  5. File .srt có format đúng:
     index
     00:00:00,000 --> 00:00:05,000
     originalText
  6. Mỗi item tăng 5 giây.
  7. Export TXT có nội dung originalText.
```

---

# 10. Manual test checklist

## 10.1. Test format timestamp

```txt
[ ] formatSrtTimestamp(0) = 00:00:00,000
[ ] formatSrtTimestamp(5) = 00:00:05,000
[ ] formatSrtTimestamp(65) = 00:01:05,000
[ ] formatSrtTimestamp(3661.5) = 01:01:01,500
```

## 10.2. Test export từ Beat Analysis

```txt
[ ] Chạy Beat Analysis.
[ ] Chưa build Final Result.
[ ] Bấm Export SRT.
[ ] File tải xuống.
[ ] SRT lấy beat.originalText.
[ ] Mỗi subtitle 5s.
```

## 10.3. Test export từ Final Result

```txt
[ ] Build Final Result.
[ ] Bấm Export SRT.
[ ] SRT lấy finalResult.panels[].source.originalText.
[ ] Số dòng subtitle bằng số panels.
```

## 10.4. Test TXT

```txt
[ ] Bấm Export TXT.
[ ] File .txt tải xuống.
[ ] Nội dung là originalText theo thứ tự.
```

## 10.5. Test thiếu dữ liệu

```txt
[ ] Không có Beat Analysis và không có Final Result.
[ ] Bấm Export SRT.
[ ] App báo không có dữ liệu.
[ ] Không crash.
```

---

# 11. Edge cases

## Case 1 - originalText nhiều dòng

Expected:

```txt
SRT vẫn giữ xuống dòng trong block subtitle.
```

## Case 2 - originalText rỗng

Expected:

```txt
Item rỗng bị bỏ qua hoặc không xuất.
MVP hiện filter item text rỗng.
```

## Case 3 - Final Result parse lỗi

Expected:

```txt
Fallback sang project.beats hoặc production.analysis.
Không crash.
```

## Case 4 - QA/Prompt/Storyboard thiếu

Expected:

```txt
Vẫn export SRT được nếu có beats.
SRT không phụ thuộc QA/Prompt/Storyboard.
```

## Case 5 - User sửa Beat rồi export

Expected:

```txt
Nếu project.beats đã cập nhật, export lấy nội dung mới.
```

---

# 12. Definition of Done

Task hoàn thành khi:

```txt
[ ] Có services/subtitleExportService.ts.
[ ] Có buildSrtFromItems().
[ ] Có formatSrtTimestamp().
[ ] Có extractSubtitleItemsFromFinalResult().
[ ] Có extractSubtitleItemsFromBeats().
[ ] Có downloadTextFile().
[ ] StoryFlow.tsx có handleExportSrt().
[ ] StoryFlow.tsx có handleExportTxt().
[ ] Final Result UI có Export SRT.
[ ] Final Result UI có Export TXT.
[ ] Export SRT dùng duration mặc định 5s.
[ ] Export fallback được từ Beat Analysis nếu chưa có Final Result.
[ ] npm run typecheck pass.
[ ] npm run build pass.
```
