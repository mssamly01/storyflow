
import { GoogleGenAI, Part } from "@google/genai";
import { getConfig } from "./configService";

// Helper to get AI instance with current config
export const getAI = () => {
  const config = getConfig();
  const apiKey = config.geminiApiKey || "";
  if (!apiKey) {
    throw new Error("API Key not found. Please configure it in Settings.");
  }
  return new GoogleGenAI({ apiKey });
};

export const getModel = () => {
  const config = getConfig();
  return config.geminiModel || "gemini-2.5-flash";
};

// --- PROMPT GENERATORS ---

export const getPhase1AnalysisPrompt = (script: string, style: string, existingLibrary?: string) => `
Bạn là chuyên gia biên tập sách và thiết kế nhân vật. Hãy thực hiện phân tích TOÀN DIỆN tiểu thuyết dưới đây.

${existingLibrary ? `
DƯỚI ĐÂY LÀ THƯ VIỆN NHÂN VẬT & BỐI CẢNH ĐÃ CÓ TỪ CÁC CHƯƠNG TRƯỚC (MASTER LIBRARY):
${existingLibrary}

QUY TẮC SỬ DỤNG THƯ VIỆN (MASTER LIBRARY RULES - CRITICAL):
0. **TÍNH LIÊN TỤC CỦA CỐT TRUYỆN (TIMELINE & OUTFIT CONTINUITY):**
   - Hãy kiểm tra \`lastChapterContext\` để biết chương trước kết thúc như thế nào (Thời điểm, Bối cảnh, Trang phục).
   - Nếu chương mới là sự **tiếp nối trực tiếp** về mặt thời gian:
     - **BẮT BUỘC** giữ nguyên trang phục của nhân vật từ cuối chương trước. 
     - **ĐỐI CHIẾU OUTFIT (CRITICAL):** Bạn nhận được mô tả trang phục thô trong \`lastChapterContext\`. Hãy đối chiếu mô tả này với danh sách \`outfit\` trong Profile của nhân vật đó.
     - **HÀNH ĐỘNG:** Chọn đúng Outfit (Ví dụ: Outfit 1, Outfit 2) trong chương mới mà có mô tả khớp với mô tả thô từ chương trước. Tuyệt đối không tạo Outfit mới nếu nó đã tồn tại trong Profile.
     - Chỉ được thay đổi trang phục nếu trong văn bản chương mới có mô tả rõ hành động thay đồ hoặc có một khoảng thời gian trôi qua đủ lớn.
1. **KẾ THỪA & CẬP NHẬT (CHARACTERS):** 
   - Nếu nhân vật đã tồn tại trong Master Library:
     - **Giữ nguyên** các thông tin nhận dạng cốt lõi (Giới tính, Tuổi, Chiều cao, Khuôn mặt, Tóc, Mắt).
     - **Cập nhật/Bổ sung**: Nếu chương mới có thông tin chi tiết hơn hoặc có thay đổi (ví dụ: vết sẹo mới, trang bị mới), hãy cập nhật vào profile.
     - **Trang phục (Outfit - GIỚI HẠN & LUÂN PHIÊN):** 
       - **QUY TẮC TỐI ĐA (MAX 2 OUTFITS PER CONTEXT):** Mỗi bối cảnh sinh hoạt (Ví dụ: "Ở nhà", "Đi làm", "Dự tiệc", "Đi chơi") chỉ được phép có tối đa **02 bộ trang phục** khác nhau (Outfit A và Outfit B).
       - **LUÂN PHIÊN THEO NGÀY (A-B ROTATION):** Nếu câu chuyện diễn ra qua nhiều ngày trong cùng một bối cảnh:
         - Ngày 1: Sử dụng Outfit A.
         - Ngày 2: Sử dụng Outfit B.
         - Ngày 3: Quay lại Outfit A.
         - Tiếp tục luân phiên A-B-A-B...
       - **LƯU Ý:** TUYỆT ĐỐI KHÔNG tạo outfit thứ 3 cho cùng một bối cảnh trừ khi văn bản tiểu thuyết có mô tả cực kỳ cụ thể về một bộ đồ mới hoàn toàn.
       - Nếu trang phục mới **GIỐNG HỆT** một trang phục đã có trong bối cảnh đó: **KHÔNG** tạo thêm entry mới. Hãy sử dụng lại.
       - **Cập nhật Profile**: Khi thêm outfit, hãy ghi chú rõ bối cảnh (Ví dụ: "Outfit 1 (Work): [Mô tả]", "Outfit 2 (Home): [Mô tả]").
     - **Image Prompt (Current Chapter Outfits ONLY)**: Trong trường \`imagePrompt\`, bạn PHẢI bao gồm TOÀN BỘ các trang phục mà nhân vật mặc trong CHƯƠNG HIỆN TẠI này, theo đúng thứ tự xuất hiện (Ví dụ: "Outfit 1: [Mô tả], Outfit 2: [Mô tả]"). 
       - **LƯU Ý QUAN TRỌNG**: TUYỆT ĐỐI KHÔNG liệt kê các trang phục từ các chương trước (trong Master Library) vào đây nếu chúng không xuất hiện trong chương hiện tại. Mục tiêu là tạo bản thiết kế chỉ dành riêng cho chương này.
       - **ĐỐI CHIẾU THỨ TỰ OUTFIT**: Đảm bảo số thứ tự Outfit trong \`imagePrompt\` khớp với logic trong phần \`outfit\` của Profile. 
2. **KẾ THỪA & CẬP NHẬT (LOCATIONS):**
   - Nếu địa điểm đã tồn tại:
     - **Giữ nguyên** \`name\`, \`description\` và \`imagePrompt\`.
     - **Cập nhật**: Nếu bối cảnh có sự thay đổi (ví dụ: bị phá hủy, được trang trí lại), hãy cập nhật mô tả hoặc tạo profile mới với hậu tố trạng thái (ví dụ: "Tên Địa Điểm (Phá hủy)").
3. **THỰC THỂ MỚI:** Nếu xuất hiện nhân vật hoặc địa điểm mới hoàn toàn, hãy tạo profile mới theo quy tắc bên dưới.
` : ''}

PHONG CÁCH HÌNH ẢNH (VISUAL STYLE):
${style}

YÊU CẦU ĐẦU RA (PHẢI TRẢ VỀ ĐỊNH DẠNG JSON):

1. **analysis (Phân tích nhịp truyện):** 
   - Trả về một mảng các đối tượng: [{ "startMarker": "...", "endMarker": "...", "analysis": "...", "atmosphere": "...", "posture": "...", "timeOfDay": "...", "keyActions": ["..."] }]
   - **QUY TẮC ĐÁNH DẤU VĂN BẢN GỐC (TEXT MARKERS - CRITICAL):**
     - **KHÔNG SAO CHÉP** toàn bộ văn bản gốc vào trường output. Thay vào đó, dùng 2 trường đánh dấu:
     - **startMarker**: Sao chép NGUYÊN VĂN **10-15 ký tự đầu tiên** của đoạn văn bản gốc thuộc beat này. Phải khớp chính xác 100% với văn bản gốc (kể cả dấu câu, khoảng trắng).
     - **endMarker**: Sao chép NGUYÊN VĂN **10-15 ký tự cuối cùng** của đoạn văn bản gốc thuộc beat này. Phải khớp chính xác 100% với văn bản gốc.
     - **MỤC ĐÍCH:** Hệ thống sẽ dùng startMarker và endMarker để trích xuất chính xác đoạn văn bản gốc từ input, đảm bảo không bị biến tấu hay mất nội dung.
     - **VÍ DỤ:** Nếu beat là "Vương Việt bước vào phòng, nhìn quanh một lượt rồi ngồi xuống ghế." thì startMarker = "Vương Việt bước" và endMarker = "xuống ghế."
   - Trường **keyActions** là mảng liệt kê TẤT CẢ các hành động/sự kiện chính trong beat (Ví dụ: ["Vương Việt mở cửa", "Trương Kiến Quốc quay đầu nhìn"]). Mỗi hành động phải kèm tên nhân vật cụ thể.
   - Chia TOÀN BỘ văn bản thành các nhịp truyện (beats) liên tục, KHÔNG BỎ SÓT bất kỳ nội dung nào.
   - **TỰ KIỂM TRA SỐ HÀNH ĐỘNG (BEAT COMPLEXITY CHECK - CRITICAL):**
     - Sau khi tạo xong mỗi Beat, đếm số lượng hành động chính (keyActions).
     - Nếu một Beat có **NHIỀU HƠN 2 hành động chính** (keyActions.length > 2) → BẮT BUỘC phải TÁCH beat đó thành các beat nhỏ hơn sao cho mỗi beat chỉ chứa tối đa 2 hành động chính.
     - **LÝ DO:** Mỗi beat sẽ tương ứng với 1 khung hình (panel). Nếu beat chứa quá nhiều hành động, image prompt không thể mô tả hết trong 1 hình ảnh duy nhất, dẫn đến mất thông tin.
     - **NGOẠI LỆ:** Chỉ cho phép >2 hành động nếu tất cả hành động diễn ra ĐỒNG THỜI trong cùng 1 khoảnh khắc (Ví dụ: "Mọi người cùng cười" + "Vương Việt giơ ly" + "Pháo hoa nổ" → cùng 1 thời điểm, gộp được).
   - **QUY TẮC CẮT CẢNH (SCENE-CUTTING RULES - CRITICAL):**
     - **Giới hạn độ dài:** Lý tưởng 40-50 từ/Beat. Giữ trọn vẹn câu văn, KHÔNG bao giờ cắt ngang câu.
     - **TÁCH CẢNH NGAY LẬP TỨC KHI:**
       - **Thay đổi nhân vật:** Khi có một nhân vật mới bắt đầu thực hiện hành động, lời thoại hoặc suy nghĩ.
       - **Dẫn chuyện xen ngang (Narration Interruption):** Bất kỳ đoạn dẫn chuyện nào (mô tả khách quan, bối cảnh, thời gian trôi qua) xuất hiện giữa các hành động/lời thoại của cùng một nhân vật đều PHẢI TÁCH thành khối riêng. Không gộp hành động trước và sau lời dẫn chuyện đó vào cùng một Beat.
       - **Thay đổi bối cảnh/địa điểm:** Nếu có hành động di chuyển từ A sang B, phải TÁCH RIÊNG hành động di chuyển và hành động tại đích đến.
       - **Thay đổi đối tượng tương tác:** Nếu cùng một nhân vật thực hiện các hành động liên tiếp nhưng hướng tới các đối tượng khác nhau (Ví dụ: Nói với A xong quay sang cười với B) -> PHẢI TÁCH thành các Beat riêng biệt.
       - **Thay đổi cảm xúc/Biểu cảm/Hành động TRONG lời thoại dài:** Nếu một nhân vật đang nói nhưng có sự thay đổi trạng thái (Ví dụ: Đang nói bình thường bỗng cười lớn, hoặc đang ngồi bỗng đứng dậy) -> PHẢI TÁCH thành Beat mới ngay tại điểm thay đổi đó.
       - **Lời thoại quá dài:** Nếu lời thoại của một nhân vật dài hơn 3 câu hoặc chứa nhiều thông tin quan trọng khác nhau -> PHẢI TÁCH thành các khối nhỏ để đảm bảo mỗi khung hình chỉ tập trung vào một ý chính/biểu cảm chính.
     - **GỘP CẢNH KHI:**
       - Các nhân vật đang tương tác trực tiếp trong cùng một không gian (Two-shot, Over-the-shoulder) và không bị ngăn cách bởi lời dẫn chuyện.
       - Lời thoại ngắn và hành động đi kèm đơn giản của cùng một người.
       - **DẤU HAI CHẤM GIỚI THIỆU (COLON INTRODUCTION - CRITICAL):** Nếu một hành động/lời dẫn kết thúc bằng dấu hai chấm (:) để giới thiệu lời thoại ngay sau đó -> BẮT BUỘC gộp hành động đó và lời thoại vào cùng một Beat. KHÔNG bao giờ tách chúng ra.
       - **HỘI THOẠI QUA LẠI (MESSAGING/CALLS - CRITICAL):** 
         - Khi có các đoạn nhắn tin hoặc gọi điện thoại qua lại giữa các nhân vật:
           - **GỘP:** Một bộ "Câu hỏi + Câu trả lời" của hai nhân vật lại thành 01 Beat.
           - **GỘP NHIỀU HƠN:** Nếu nội dung ngắn, có thể gộp 02 bộ "Câu hỏi + Câu trả lời" (tức 4 lượt thoại) vào cùng 01 Beat.
           - Mục đích: Giảm số lượng khung hình dư thừa cho các cảnh hội thoại tĩnh.
   - **NỘI DUNG PHÂN TÍCH (CRITICAL):**
      - **Phân tích bối cảnh & hành động chi tiết:** 
         - **Tính tương tác (Interaction):** BẮT BUỘC xác định rõ hành động/câu thoại đang hướng tới nhân vật nào. Tuyệt đối không viết chung chung. (Ví dụ: Thay vì "Giả vờ quan tâm", phải viết "Trương Kiến Quốc giả vờ quan tâm đối với Vương Việt").
         - **Định danh nhân vật (Character Naming):** Luôn sử dụng TÊN CỤ THỂ của nhân vật trong mỗi mô tả hành động. Tuyệt đối không dùng các từ như "tiếp tục hành động đó", "vẫn làm vậy". (Ví dụ: Thay vì "Tiếp tục mắng nhiếc", phải viết "Trương Kiến Quốc tiếp tục mắng nhiếc Vương Việt").
         - **Hành động đám đông (Crowd Actions):** Nếu có đám đông hoặc nhân vật phụ ở bối cảnh, phải mô tả CỤ THỂ họ đang làm gì, nhìn vào đâu hoặc phản ứng thế nào với sự kiện chính. Tuyệt đối không mô tả chung chung như "bối cảnh công khai". (Ví dụ: Thay vì "Bối cảnh công khai", phải viết "Các nhân viên bên ngoài đang rướn cổ nhìn qua khe cửa vào văn phòng nơi Trương Kiến Quốc và Vương Việt đang tranh cãi").
      - **XÁC ĐỊNH TƯ THẾ (POSTURE - CRITICAL):** Xác định rõ tư thế (đứng, ngồi, nằm, quỳ, chạy, nhảy) và trạng thái hành động của từng nhân vật trong Beat này. Thông tin này cực kỳ quan trọng để duy trì tính nhất quán ở các bước sau.
      - **XÁC ĐỊNH THỜI ĐIỂM (TIME OF DAY):** Xác định chính xác thời gian diễn ra (Ví dụ: Early Morning, Mid-day, Golden Hour, Late Night). Thời điểm này PHẢI đồng nhất cho các Beat thuộc cùng một phân đoạn.
      - Xác định Cảm xúc/Không khí (Atmosphere) chủ đạo.

2. **characterLocationAnalysis (Hồ sơ Nhân vật & Bối cảnh):**
   - Trả về đối tượng: { "characters": [...], "locations": [...] }
   - **QUY TẮC CHỌN NHÂN VẬT (CHARACTER SELECTION - CRITICAL):**
    - **BAO GỒM:** 
      - Nhân vật chính.
      - Các nhân vật phụ có xuất hiện thực tế (có hành động hoặc lời thoại).
      - **QUY TẮC ĐỒNG BỘ (CONSISTENCY RULE):** Nếu một nhân vật xuất hiện (hoặc được nhắc đến và cần minh họa hình ảnh) ở **nhiều Beat (từ 2 lần trở lên)** -> BẮT BUỘC tạo hồ sơ để đảm bảo tính đồng bộ hình ảnh giữa các panel.
    - **LOẠI BỎ:** Chỉ KHÔNG tạo hồ sơ cho nhân vật chỉ được nhắc tên thoáng qua trong lời kể/lời thoại mà **hoàn toàn không** xuất hiện trong bất kỳ khung hình nào (Ví dụ: "Mẹ tôi thường nói..." nhưng người mẹ không bao giờ xuất hiện).
   - **CẤU TRÚC JSON NHÂN VẬT:** Mỗi nhân vật trong mảng \`characters\` phải có ĐÚNG các trường sau:
     - \`name\`: Tên nhân vật.
     - \`gender\`: Giới tính (Tiếng Anh).
     - \`age\`: Tuổi cụ thể (Ví dụ: "18").
     - \`height\`: Chiều cao cụ thể (Ví dụ: "172cm").
     - \`face\`: Mô tả chi tiết cấu trúc khuôn mặt (Tiếng Anh).
     - \`hair\`: Kiểu tóc và màu sắc (Tiếng Anh).
     - \`eyes\`: Đặc điểm đôi mắt (Tiếng Anh).
     - \`outfit\`: Trang phục (Theo quy tắc bên dưới).
     - \`imagePrompt\`: Prompt tạo ảnh nhân vật (Tiếng Anh, theo quy tắc bên dưới).
   - **CẤU TRÚC JSON ĐỊA ĐIỂM:** Mỗi địa điểm trong mảng \`locations\` phải có:
     - \`name\`: Tên địa điểm.
     - \`description\`: Mô tả chi tiết (Tiếng Anh).
     - \`imagePrompt\`: Prompt Establishing Shot (Tiếng Anh).
   
   **QUY TẮC CHI TIẾT NHÂN VẬT (CHARACTERS):**
   - **Thư viện:** Kiểm tra kỹ Master Library (nếu có thông tin từ trước). Nếu nhân vật đã tồn tại, COPY LẠI Profile cũ.
   - **Mới:** Nếu nhân vật mới, hãy tạo Profile cực kỳ chi tiết bằng **TIẾNG ANH**.
   - **QUY TẮC CHI TIẾT (STRICT ENGLISH):**
     - **Face:** KHÔNG dùng từ cảm tính (handsome, beautiful). Phải mô tả cấu trúc vật lý (Jawline, cheekbones, nose shape, chin shape). **TUYỆT ĐỐI KHÔNG** mô tả các trạng thái nhất thời, cảm xúc hoặc dấu hiệu mệt mỏi (Ví dụ: KHÔNG dùng "tired", "angry", "sweaty", "crying", "dark circles", "stern look", "exhausted", "frowning"). Hồ sơ phải mô tả diện mạo ở trạng thái trung tính, bền vững suốt cả câu chuyện.
     - **Tuổi/Chiều cao:** Phải là SỐ CỤ THỂ (Ví dụ: "18", "172cm"). KHÔNG dùng khoảng ("18-20").
     - **Gender, Hair, Eyes:** Mô tả bằng TIẾNG ANH (Ví dụ: "Oval face", "Short black hair", "Deep blue eyes").
     - **Trang phục (Outfit):** Phải mô tả CỤ THỂ bằng TIẾNG ANH về màu sắc, layer, loại vải. KHÔNG dùng từ chung chung (như "casual clothes").
     - **QUY TẮC OUTFIT (CRITICAL):** 
       - Nếu chỉ có MỘT trang phục: Mô tả trực tiếp (Ví dụ: "Short-sleeved white shirt, blue jeans"). 
       - Nếu có NHIỀU trang phục: Phân chia cụ thể trong cùng một chuỗi (Ví dụ: "Outfit 1: [Mô tả], Outfit 2: [Mô tả]").
     - **QUY TẮC IMAGE PROMPT (CRITICAL):** 
     - Image Prompt phải được tổng hợp từ Profile bằng TIẾNG ANH.
     - **BẮT BUỘC:** Phải bắt đầu prompt bằng tên phong cách hình ảnh: "${style}".
     - **CHỈ DÙNG TRANG PHỤC TRONG CHƯƠNG NÀY (CURRENT CHAPTER OUTFITS):** Bạn PHẢI đưa TOÀN BỘ các bộ trang phục nhân vật mặc trong chương này vào prompt, liệt kê theo thứ tự (Ví dụ: "Outfit 1: [Mô tả], Outfit 2: [Mô tả]"). 
       - **TUYỆT ĐỐI KHÔNG** liệt kê các trang phục cũ từ Master Library nếu chúng không xuất hiện trong chương hiện tại.
     - **KHÔNG** bao gồm các cảm xúc hay biểu cảm phân tích được từ văn bản.
     - **BIỂU CẢM MẶC ĐỊNH:** Luôn sử dụng "Neutral and calm expression" để đảm bảo tính nhất quán cho thiết kế nhân vật.
     - Cấu trúc: "${style}, [Name], [Gender], [Age], [Height], [Face details], [Hair], [Eyes], [ALL OUTFITS FROM CURRENT CHAPTER ONLY]. Front view, full body, standing pose with upright posture, arms relaxed at sides. Neutral and calm expression. Character design, clean white background. NO text, NO labels, clean artwork only."
     - **QUY TẮC VISUAL DISTINCTIVENESS:** Mỗi nhân vật phải có màu sắc chủ đạo khác nhau hoặc đặc điểm nhận dạng riêng biệt (Silhouette) để không bị nhầm lẫn khi tạo ảnh.

   **ĐỊA ĐIỂM (LOCATIONS) - TRÍCH XUẤT TRIỆT ĐỂ (EXHAUSTIVE):**
   - **KIỂM TRA THƯ VIỆN:** Luôn kiểm tra Master Library trước. Nếu địa điểm đã tồn tại và không thay đổi trạng thái, PHẢI COPY LẠI Profile cũ.
   - **PHẢI TRÍCH XUẤT TẤT CẢ:** Đối chiếu với từng Beat trong phần \`analysis\` ở trên. Bất kỳ địa điểm nào được nhắc đến hoặc ngụ ý trong các Beat đều PHẢI có một Profile riêng trong mảng \`locations\`. 
   - **Không bỏ sót:** Bao gồm cả những bối cảnh nhỏ nhất hoặc thoáng qua (hành lang, góc tối, bậc thềm, cổng trường, bên trong xe, v.v.).
   - **KIỂM TRA TRẠNG THÁI (STATE CHECK):**
     - Nếu địa điểm ĐÃ CÓ nhưng trạng thái thị giác thay đổi đáng kể trong chương này (Ví dụ: "Messy Room" -> "Cleaned Room", "Intact Building" -> "Ruined Building"), hãy tạo một **PROFILE MỚI** với tên kèm hậu tố trạng thái (Ví dụ: "Tên Địa Điểm (Trạng thái)").
     - Ví dụ: \`My Bedroom (Cleaned)\`, \`CitySquare (Ruined)\`.
     - **Description:** Mô tả trạng thái hiện tại chi tiết bằng TIẾNG ANH (Kiến trúc, Vật liệu, Ánh sáng, Không khí).
     - **imagePrompt:** Phải bắt đầu bằng "${style}", sau đó mô tả một Establishing Shot (khung hình thiết lập) cho địa điểm này bằng TIẾNG ANH.

TIỂU THUYẾT:
${script}
`;

export const getStoryboardPrompt = (analysis: string, charLocAnalysis: string) => `
Bạn là chuyên gia họa sĩ minh họa và đạo diễn hình ảnh. Dựa trên kết quả phân tích nội dung và hồ sơ nhân vật/bối cảnh, hãy phác thảo storyboard chi tiết.

YÊU CẦU ĐẦU RA (PHẢI TRẢ VỀ ĐỊNH DẠNG JSON):
- Trả về một mảng các đối tượng: [{ "panelNumber": 1, "originalText": "...", "description": "...", "timeOfDay": "...", "keyActions": ["..."] }]
- Tạo danh sách các khung hình tương ứng với từng Beat trong bản phân tích.
- Giá trị "timeOfDay" phải được lấy chính xác từ phần "PHÂN TÍCH NHỊP TRUYỆN" bên dưới.
- Trường "keyActions" phải được SAO CHÉP NGUYÊN VĂN từ phần phân tích nhịp truyện (beat analysis) tương ứng. Đây là danh sách các hành động chính mà mỗi panel CẦN mô tả hết.
- Mô tả chi tiết: Bố cục, Ánh sáng, Hành động. Đảm bảo mọi hành động trong keyActions đều được phản ánh trong description.

PHÂN TÍCH NHỊP TRUYỆN:
${analysis}

HỒ SƠ NHÂN VẬT & BỐI CẢNH:
${charLocAnalysis}

QUY TẮC MÔ TẢ (DESCRIPTION RULES - CRITICAL):
1. **SỰ NHẤT QUÁN CỦA ĐẠO CỤ (PROP CONTINUITY):** Nếu một nhân vật đang cầm hoặc sử dụng một vật dụng (thùng, túi, vũ khí, vật dụng cá nhân) trong một khung hình, vật dụng đó PHẢI được nhắc lại trong mô tả của các khung hình tiếp theo trừ khi có hành động rõ ràng là họ đã bỏ nó xuống.
2. **CHI TIẾT TƯ THẾ & HÀNH ĐỘNG (POSTURE & ACTION - MANDATORY):** 
   - Mô tả rõ tư thế (nằm, ngồi, đứng, quỳ, chạy, nhảy), cử chỉ và biểu cảm dựa trên nội dung văn bản. 
   - **QUY TẮC DUY TRÌ TƯ THẾ:** Nếu nhân vật đang ở một tư thế đặc biệt (ví dụ: đang nằm trên sofa) và chưa có hành động thay đổi tư thế trong văn bản, tư thế này PHẢI được nhắc lại RÕ RÀNG trong mô tả của các khung hình tiếp theo. TUYỆT ĐỐI KHÔNG được bỏ qua thông tin tư thế ở các khung hình sau.
   - **QUY TẮC ĐỊNH DANH & TƯƠNG TÁC (CRITICAL):** 
     - Luôn sử dụng TÊN CỤ THỂ của nhân vật. KHÔNG dùng đại từ hoặc mô tả chung chung.
     - Phải mô tả rõ nhân vật đang tương tác với ai, nhìn vào ai. (Ví dụ: "Trương Kiến Quốc nhìn chằm chằm vào Vương Việt với vẻ khinh miệt").
     - **QUY TẮC OFF-SCREEN:** Ngay cả khi nhân vật ở ngoài màn hình (off-screen), nếu họ được nhắc đến trong hành động hoặc tương tác, họ vẫn phải được mô tả đầy đủ đặc điểm nhận dạng từ Profile.
     - Đối với đám đông hoặc nhân vật phụ, phải mô tả cụ thể hành động và hướng nhìn của họ (Ví dụ: "Nhóm nhân viên ở tiền cảnh đang xì xào và nhìn về phía văn phòng nơi xảy ra tranh chấp").
3. **BỐI CẢNH:** Luôn nhắc lại các chi tiết bối cảnh quan trọng để duy trì không gian.
`;

export const getEngineerPromptsPrompt = (storyboard: string, charLocAnalysis: string, style: string) => `
Bạn là chuyên gia Prompt Engineering cấp cao. Hãy chuyển đổi Storyboard thành các prompt AI Image Generation (16:9) tuân thủ các quy tắc "NHẤT QUÁN CỰC ĐOAN".

DỮ LIỆU:
STORYBOARD: ${storyboard}

PHONG CÁCH HÌNH ẢNH (VISUAL STYLE):
${style}

QUY TẮC CẤU TRÚC PROMPT (PHẢI TUÂN THỦ THỨ TỰ):
1. **STYLE FIRST (BẮT BUỘC):** Luôn bắt đầu prompt bằng tên phong cách kèm mô tả chi tiết của nó: "${style}".
2. **LOCATION (BẮT BUỘC - CRITICAL FOR CONSISTENCY):** Tiếp theo là: "Location: [Tên địa điểm] ([Mô tả chi tiết địa điểm từ profile]), [Mô tả vật liệu/ánh sáng từ storyboard/profile]."
   - **THỜI ĐIỂM (TIMEOFDAY):** Phải sử dụng thông tin \`timeOfDay\` từ STORYBOARD để mô tả ánh sáng tự nhiên một cách chính xác.
   - **LÝ DO:** TUYỆT ĐỐI KHÔNG được chỉ nhắc tên địa điểm đơn độc. Nếu chỉ ghi tên, AI sẽ tự tạo ra bối cảnh ngẫu nhiên (hallucination), dẫn đến việc địa điểm không đồng nhất giữa các PANEL.
   - **YÊU CẦU:** Phải sao chép đầy đủ mô tả từ Profile và Storyboard vào mỗi prompt.
   - **VÍ DỤ ĐÚNG:** "Location: Finance Department Office (A spacious modern office with glass walls, rows of white desks, and blue ergonomic chairs), night time with moonlight through windows mixed with flickering overhead fluorescent lights."
3. **SCENE & CHARACTERS (MANDATORY POSTURE & INTERACTION):** Sau đó là: "Scene: [Góc máy/Camera Angle], [Mô tả chi tiết TƯ THẾ (POSTURE), HÀNH ĐỘNG và TƯƠNG TÁC của từng nhân vật]. 
   - **BẮT BUỘC** mô tả tư thế (đứng, ngồi, nằm, quỳ, v.v.) ngay cả khi nó không thay đổi so với panel trước.
   - **BẮT BUỘC** xác định rõ đối tượng tương tác (nhìn ai, nói với ai, chạm vào ai). Sử dụng tên nhân vật cụ thể.
   - **ĐÁM ĐÔNG/NHÂN VẬT PHỤ:** Phải mô tả cụ thể hành động và hướng nhìn của họ đối với sự kiện chính.
4. **GLOBAL CHARACTER DESCRIPTION (CHARACTERS MUST HAVE PROFILES - CRITICAL):** 
   - **BẤT KỲ** nhân vật nào được nhắc đến trong prompt (kể cả nhân vật chính, phụ, phản diện, người qua đường, hay nhân vật ở tiền cảnh/hậu cảnh) đều **BẮT BUỘC** phải có mô tả Profile chi tiết kèm theo ngay sau tên.
   - **LƯU Ý QUAN TRỌNG:** Quy tắc này áp dụng cho cả các nhân vật được ghi chú là **(off-screen)**. Dù không xuất hiện trên khung hình, việc mô tả đầy đủ giúp AI hiểu rõ ngữ cảnh và tương tác.
   - **LÝ DO:** Nếu chỉ ghi tên nhân vật mà không có mô tả, AI sẽ tự động tạo ra ngoại hình ngẫu nhiên, làm mất tính nhất quán (hallucination).
   - **BẮT BUỰC** áp dụng cho cả khi chỉ mô tả một bộ phận cơ thể (tay, chân, vai).
   - Định dạng: "CharacterName (Gender: [gender], Age: [age], Height: [height], Face: [face], Hair: [hair], Eyes: [eyes], [Posture: [tư thế hiện tại]], [Mô tả 01 Outfit phù hợp nhất])".
   - **VÍ DỤ ĐÚNG:** "Police Officer (Male, 30, 180cm, Square face, ..., Posture: Standing upright, ...) enters the frame... Behind him, Chị Trương (Female, 35, 160cm, Round face, ..., Posture: Sitting on a chair, ...) looks smug... To the side, Vương Việt (Male, 28, 175cm, Sharp features, ..., Outfit 1: Black suit) (off-screen) is shouting."
   - **OUTFIT SELECTION (STRICT & SEQUENTIAL):** Nếu hồ sơ nhân vật có nhiều Outfit, AI phải phân tích nội dung Panel và đối chiếu với thứ tự trong danh sách \`outfit\` để chọn ra trang phục chính xác nhất theo diễn biến truyện. CHỈ đưa mô tả của outfit đó vào prompt.
   - **OUTFIT FIDELITY (TRUNG THỰC TUYỆT ĐỐI):**
     - Khi chèn mô tả Outfit vào prompt, bạn PHẢI sao chép **NGUYÊN VĂN 100%** từng từ trong mô tả Outfit từ Profile.
     - **CẤM** rút gọn, tóm tắt, hoặc lược bỏ bất kỳ chi tiết nào (ví dụ: không được bỏ "traditional-style", "velvet", "leggings").
     - **VÍ DỤ SAI:** Profile: "Bright purple velvet traditional-style coat and black leggings" -> Prompt: "Bright purple coat". (SAI - Rút gọn).
     - **VÍ DỤ ĐÚNG:** Profile: "Bright purple velvet traditional-style coat and black leggings" -> Prompt: "Bright purple velvet traditional-style coat and black leggings". (ĐÚNG - Nguyên văn).
5. **CẤM DANH TỪ TẬP HỢP:** Tuyệt đối không dùng "The trio", "The group", "Both of them".
6. **QUY TẮC GÓC MÁY & TƯƠNG TÁC (CAMERA ANGLES & INTERACTION - CRITICAL):** 
   - Hội thoại dùng Close-up, Tương tác dùng Medium/OTS, Hành động dùng Wide.
   - **QUY TẮC OTS & POV (OTS & POV RULES - CRITICAL):**
     - Trong góc máy **Over-the-shoulder (OTS)** hoặc **POV**, nhân vật đóng vai trò là "điểm nhìn" (người có vai/lưng ở tiền cảnh) PHẢI được mô tả Profile đầy đủ. 
     - **CẤM** chỉ ghi "from Character's perspective" mà không có mô tả ngoại hình của Character.
     - **CẤU TRÚC ĐÚNG:** "Over-the-shoulder shot, foreground: [Character A Profile]'s shoulder and back of head, background: [Character B's Profile] [Action]...".
     - Điều này đảm bảo AI biết được màu tóc, trang phục của người ở tiền cảnh để duy trì tính nhất quán.
   - **TƯƠNG TÁC VẬT DỤNG (OBJECT INTERACTION):** Khi nhân vật tương tác với vật dụng (điện thoại, sách, gương, đồ vật), TUYỆT ĐỐI KHÔNG được chỉ mô tả vật dụng đó đơn độc. 
   - **BẮT BUỘC** phải sử dụng góc máy **Over-the-shoulder (OTS)** hoặc **Point of View (POV)** để thấy tay/vai của nhân vật đang cầm/nhìn vật dụng đó. 
   - Ví dụ: Thay vì "A phone screen", phải là "Over-the-shoulder shot, CharacterName's hand holding a phone, looking at the screen showing...". Điều này giúp duy trì sự hiện diện của nhân vật ngay cả khi tập trung vào chi tiết.
   - **QUY TẮC PHẢN CHIẾU (REFLECTION RULES):** Khi mô tả sự phản chiếu của nhân vật hoặc biểu cảm lên màn hình điện thoại, tivi, hoặc cửa kính:
     - BẮT BUỘC mô tả sự phản chiếu là **"faint reflection"** hoặc **"low opacity reflection"**.
     - Phải đảm bảo nội dung chính trên màn hình hoặc bối cảnh phía sau kính vẫn rõ nét (Ví dụ: "faint reflection of CharacterName's worried face on the glowing phone screen showing chat messages").
   - **HIỂN THỊ MÀN HÌNH GIÁN TIẾP (INDIRECT SCREEN VISUALIZATION - CRITICAL):**
     - Khi góc máy quay từ phía sau thiết bị (nhìn thấy lưng điện thoại/máy tính) hoặc màn hình không hướng trực diện vào camera, nhưng nội dung trên màn hình là quan trọng:
     - **HÀNH ĐỘNG:** Yêu cầu tạo một khung hình nhỏ (inset panel/bubble) hoặc bố cục chia đôi (split screen) để hiển thị rõ nội dung đó.
     - **PROMPT:** Thêm từ khóa "with an inset close-up of the phone screen showing [Content]" hoặc "split screen: one side shows [Character holding phone], other side shows [Phone Screen Content]".
     - **CẤM:** Tuyệt đối không để AI vẽ nội dung màn hình đè lên mặt lưng điện thoại hoặc lơ lửng trong không gian.
7. **TÍNH LIÊN TỤC & VẬT THỂ BẤT BIẾN (OBJECT PERMANENCE & STATE CONTINUITY - CRITICAL):** 
   - AI phải ghi nhớ vị trí, **TƯ THẾ (POSTURE - nằm, ngồi, đứng, quỳ)**, TRẠNG THÁI HÀNH ĐỘNG và **CÁC VẬT DỤNG ĐANG CẦM/SỬ DỤNG** của nhân vật từ các panel trước đó. 
   - **QUY TẮC TƯ THẾ (POSTURE):** Nếu ở panel trước nhân vật đang nằm hoặc ngồi, và văn bản tiếp theo không mô tả hành động đứng dậy, thì ở panel sau nhân vật PHẢI tiếp tục ở tư thế đó. 
   - **QUY TẮC VẬT DỤNG (PROPS):** Nếu ở panel trước nhân vật đang cầm một vật dụng (ví dụ: cái thùng, túi xách, vũ khí, điện thoại), thì ở các panel tiếp theo vật dụng đó PHẢI XUẤT HIỆN TRONG PROMPT cho đến khi có hành động rõ ràng là nhân vật đã đặt xuống hoặc làm mất nó. 
   - Tuyệt đối không được bỏ quên các trạng thái này giữa các khung hình. (Ví dụ: Nếu Panel 1 đang nằm trên sofa thì Panel 2 dù chỉ mô tả "looking at phone" vẫn PHẢI thêm "while still lying on the sofa" vào prompt).
8. **CẤM VĂN BẢN & BÓNG (STRICT):** 
   - Tuyệt đối KHÔNG bao gồm lời thoại, văn bản, bong bóng chat (speech bubbles) trong prompt. 
   - Hạn chế tối đa các mô tả về bóng đổ (shadows) quá mạnh làm mất chi tiết nhân vật. Thêm "no text, no speech bubbles, no shadows" vào cuối mỗi prompt.

VÍ DỤ CẤU TRÚC:
"${style}, Location: Living Room, wooden floor, warm sunset light. Scene: John (Male, 25, 180cm, ...) sitting on the sofa, holding a cup of coffee..."

9. **ĐỐI CHIẾU VỚI VĂN BẢN GỐC (CROSS-REFERENCE WITH ORIGINAL TEXT - CRITICAL):**
   - Sau khi tạo xong visualPrompt cho mỗi panel, BẮT BUỘC đối chiếu lại với trường \`originalText\` và \`description\` trong storyboard.
   - **KIỂM TRA:** Mỗi hành động/sự kiện quan trọng trong \`originalText\` có được phản ánh trong visualPrompt không?
   - **NẾU THIẾU:** Bổ sung chi tiết bị thiếu vào prompt. Ví dụ: Nếu originalText nói "cô ấy vừa cầm ly nước vừa nhìn ra cửa sổ" nhưng prompt chỉ mô tả "looking out the window" → phải thêm "holding a glass of water".
   - **TRƯỜNG HỢP ĐẶC BIỆT:** Nếu originalText chứa hành động/chi tiết mà KHÔNG THỂ mô tả bằng hình ảnh tĩnh (suy nghĩ nội tâm, hồi tưởng, cảm giác trừu tượng), hãy chuyển thành biểu cảm khuôn mặt hoặc ngôn ngữ cơ thể tương ứng.
   - **MỤC TIÊU:** Người đọc nhìn vào hình ảnh phải hiểu được TẤT CẢ diễn biến quan trọng trong đoạn văn bản gốc mà không cần đọc text.

YÊU CẦU ĐẦU RA (PHẢI TRẢ VỀ JSON):
Trả về một mảng các đối tượng, mỗi đối tượng tương ứng với một panel:
{
  "panelNumber": number,
  "timeOfDay": "string",
  "visualPrompt": "string (định dạng Style-First + Location-First)",
  "coverageNotes": "string (ghi chú ngắn gọn: các chi tiết nào từ originalText đã được phản ánh trong prompt, và các chi tiết nào bị bỏ qua kèm lý do)"
}

HỒ SƠ NHÂN VẬT & ĐỊA ĐIỂM:
${charLocAnalysis}
`;

export const getQAPrompt = (data: string, charLocAnalysis: string, style: string) => `
Bạn là QA Director kiểm định tính nhất quán hình ảnh và logic không gian.

PHONG CÁCH HÌNH ẢNH (VISUAL STYLE) CẦN KIỂM TRA:
${style}

KIỂM TRA CÁC LỖI SAU (ĐẶC BIỆT CHÚ TRỌNG TÍNH NHẤT QUÁN):
1. Prompt có bắt đầu bằng phong cách "${style}" kèm mô tả đầy đủ không?
2. Prompt có Location kèm theo đầy đủ mô tả chi tiết địa điểm (từ profile) và mô tả vật liệu/ánh sáng (từ storyboard) không?
   - **KIỂM TRA LỖI:** Nếu chỉ thấy "Location: [Tên]" mà thiếu phần mô tả chi tiết trong ngoặc đơn hoặc thiếu mô tả ánh sáng/vật liệu -> **LỖI NGHIÊM TRỌNG**. AI sẽ tự vẽ bối cảnh sai lệch. 
   - **HÀNH ĐỘNG:** Phải chèn đầy đủ mô tả từ Profile và Storyboard vào để đảm bảo tất cả các PANEL có bối cảnh giống hệt nhau.
3. TẤT CẢ các nhân vật xuất hiện (kể cả nhân vật chính, phụ, phản diện, hay người qua đường, và ngay cả khi chỉ nhắc đến bộ phận cơ thể) đã có mô tả Profile chi tiết đi kèm ngay sau tên chưa? 
   - **CẤM TUYỆT ĐỐI** việc chỉ để tên nhân vật mà không có mô tả hình thể và trang phục trong ngoặc đơn.
   - **QUY TẮC OFF-SCREEN:** Ngay cả khi nhân vật được ghi chú là **(off-screen)**, họ vẫn BẮT BUỘC phải có Profile chi tiết đi kèm.
   - **LÝ DO KIỂM TRA:** Nếu thiếu mô tả, AI sẽ tự vẽ ngẫu nhiên (hallucination) làm sai lệch nhân vật.
   - **KIỂM TRA LỖI:** Nếu thấy "CharacterName" hoặc "CharacterName's [body part]" mà không có ngoặc đơn mô tả profile -> BẮT BUỘC sửa lại bằng cách chèn Profile từ thư viện vào.
4. Có xuất hiện "The group" hay "The trio" không?
5. Trang phục (Outfit) của nhân vật có được chọn đúng theo diễn biến truyện không? (Phải chọn đúng 1 bộ trang phục phù hợp nhất từ danh sách \`outfit\` dựa trên thứ tự xuất hiện trong nội dung).
   - **TÍNH LIÊN TỤC GIỮA CÁC CHƯƠNG (CROSS-CHAPTER CONTINUITY):** Đặc biệt lưu ý nếu đây là phần tiếp nối của chương trước, nhân vật PHẢI mặc đúng bộ trang phục đã mặc ở cuối chương trước trừ khi có tình tiết thay đồ rõ ràng.
   - **KIỂM TRA GIỚI HẠN OUTFIT (MAX 2 PER CONTEXT):** Đảm bảo trong cùng một bối cảnh (Ví dụ: Công sở) không xuất hiện quá 2 bộ đồ khác nhau. 
   - **KIỂM TRA TÍNH LUÂN PHIÊN (ROTATION LOGIC):** Nếu qua ngày mới trong cùng bối cảnh, hãy kiểm tra xem outfit có được luân phiên A-B-A-B hợp lý không. TUYỆT ĐỐI không để nhân vật mặc bộ thứ 3 nếu không có mô tả thay đồ đặc biệt trong tiểu thuyết.
   - **KIỂM TRA ĐỘ ĐẦY ĐỦ CỦA OUTFIT (OUTFIT COMPLETENESS CHECK):**
     - So sánh mô tả Outfit trong prompt với mô tả gốc trong Profile.
     - Nếu thấy prompt bị rút gọn, lược bỏ từ khóa quan trọng (Ví dụ: Bỏ "leggings", bỏ "velvet", bỏ "traditional-style") -> **LỖI**.
     - **HÀNH ĐỘNG:** Sửa lại bằng cách sao chép đầy đủ mô tả từ Profile vào.
6. **TÍNH NHẤT QUÁN VẬT DỤNG (PROP CONSISTENCY - CỰC KỲ QUAN TRỌNG):** 
   - So sánh giữa các panel liên tiếp: Nếu panel trước nhân vật đang cầm/mang theo một vật dụng (thùng, túi, đạo cụ), hãy kiểm tra xem panel sau có còn mô tả vật dụng đó không?
   - Nếu bị mất vật dụng mà không có lý do trong văn bản -> PHẢI THÊM LẠI vật dụng đó vào prompt.
7. **SỰ HIỆN DIỆN CỦA NHÂN VẬT TRONG CẢNH CHI TIẾT (CHARACTER PRESENCE):**
   - Kiểm tra các cảnh tập trung vào vật dụng (như nhìn điện thoại, xem tài liệu). Nếu prompt chỉ mô tả vật dụng mà quên mất nhân vật -> PHẢI yêu cầu sửa lại thành góc máy **Over-the-shoulder (OTS)** hoặc thêm mô tả tay/vai nhân vật đang tương tác.
   - **KIỂM TRA OTS/POV (CRITICAL):** Nếu cameraAngle là OTS hoặc POV, hãy kiểm tra xem trong prompt đã có mô tả Profile của nhân vật ở tiền cảnh (foreground character) chưa?
     - Nếu chỉ có "from [Name]'s perspective" mà thiếu Profile của [Name] ở tiền cảnh -> **LỖI NGHIÊM TRỌNG**. Phải sửa lại bằng cách thêm: "foreground: [Character Profile]'s shoulder and back of head".
   - **KIỂM TRA PHẢN CHIẾU (REFLECTION CHECK):** Nếu có mô tả phản chiếu (reflection), phải đảm bảo có các từ khóa như "faint", "low opacity", hoặc "translucent" để không làm mờ nội dung chính của màn hình/kính.
   - **KIỂM TRA HIỂN THỊ MÀN HÌNH (SCREEN VISUALIZATION CHECK):**
     - Nếu prompt mô tả nội dung trên màn hình (điện thoại, máy tính) nhưng góc máy không nhìn thấy màn hình (ví dụ: quay lưng, góc nghiêng khuất):
     - **HÀNH ĐỘNG:** Kiểm tra xem đã có yêu cầu "inset panel", "close-up bubble" hoặc "split screen" chưa. Nếu chưa -> **LỖI**. Phải thêm vào để tránh lỗi AI vẽ nội dung lên lưng thiết bị.
8. **TÍNH NHẤT QUÁN TƯ THẾ (POSTURE CONSISTENCY):** 
   - Kiểm tra tư thế của nhân vật giữa các panel liên tiếp. 
   - Nếu panel trước nhân vật đang ở một tư thế (nằm, ngồi, quỳ) và văn bản không có hành động thay đổi tư thế (đứng dậy, đi lại) -> PHẢI đảm bảo panel sau vẫn mô tả nhân vật ở tư thế đó, ngay cả trong các cảnh cận cảnh (Close-up).
   - Ví dụ: Nếu nhân vật đang nằm, cảnh cận cảnh điện thoại phải mô tả "phone held by a character lying down".
9. Kiểm tra văn bản/lời thoại: Prompt có chứa từ khóa về "speech bubbles", "text", "dialogue" không? (Phải loại bỏ).
10. **KIỂM TRA THỜI ĐIỂM (TIMEOFDAY CHECK):** Đảm bảo thông tin timeOfDay không bị mất hoặc thay đổi sai lệch so với phân tích ban đầu.
11. **KIỂM TRA TỪ CẤM & NHẠY CẢM (CONTENT SAFETY - CRITICAL):**
   - Kiểm tra các từ ngữ có thể bị các công cụ tạo ảnh (như Midjourney, DALL-E) chặn do vi phạm chính sách (bạo lực, máu me, nhạy cảm, bộ phận cơ thể, từ lóng...).
   - **HÀNH ĐỘNG:** Thay thế các từ này bằng các từ ngữ nghệ thuật, ẩn dụ hoặc mô tả gián tiếp nhưng vẫn giữ nguyên ý nghĩa của khung hình.
   - **VÍ DỤ:** 
     - Thay "blood" bằng "crimson liquid" hoặc "dark red splashes".
     - Thay "killing/murder" bằng "defeated/neutralized".
     - Thay các từ nhạy cảm về cơ thể bằng các mô tả về trang phục hoặc ánh sáng che khuất.
     - Thay "gun/weapon" (nếu bị chặn) bằng "metallic tool" hoặc mô tả hình dáng cụ thể.
12. Vị trí nhân vật có bị thay đổi vô lý giữa các screen không?
13. **KIỂM TRA ĐỘ PHỦ NỘI DUNG (CONTENT COVERAGE CHECK - CRITICAL):**
   - Đối chiếu \`originalText\` của mỗi panel với \`visualPrompt\` tương ứng.
   - **KIỂM TRA:** Mỗi hành động/sự kiện quan trọng trong originalText có được mô tả trong visualPrompt không?
   - **CÁC LOẠI THIẾU SÓT CẦN PHÁT HIỆN:**
     a) **Thiếu hành động:** originalText mô tả nhân vật làm gì đó nhưng prompt không nhắc (Ví dụ: văn bản nói "cầm điện thoại" nhưng prompt không mô tả điện thoại).
     b) **Thiếu đối tượng/vật dụng:** Văn bản nhắc đến vật dụng quan trọng nhưng prompt bỏ qua.
     c) **Thiếu phản ứng:** Văn bản mô tả phản ứng của nhân vật phụ nhưng prompt chỉ tập trung nhân vật chính.
     d) **Thiếu chi tiết bối cảnh:** Văn bản mô tả thay đổi trong bối cảnh (cửa mở, đèn tắt, mưa rơi) nhưng prompt không phản ánh.
   - **HÀNH ĐỘNG KHI PHÁT HIỆN THIẾU:** Bổ sung chi tiết bị thiếu vào visualPrompt đã sửa.
   - **GHI CHÚ:** Ghi rõ trong qaNotes: "COVERAGE: Đã bổ sung [chi tiết] từ originalText vào prompt".
14. **KIỂM TRA ĐỘ PHỦ TOÀN CỤC (GLOBAL COVERAGE):**
   - Đảm bảo TẤT CẢ các beat/panel đều có visualPrompt tương ứng. Không được bỏ sót panel nào.
   - Nếu phát hiện panel thiếu visualPrompt hoặc visualPrompt rỗng → phải tạo prompt đầy đủ theo quy tắc.

YÊU CẦU ĐẦU RA (PHẢI TRẢ VỀ JSON):
CHỈ trả về các panel có lỗi cần sửa hoặc có thay đổi. Các panel đạt yêu cầu (Pass) thì KHÔNG cần đưa vào danh sách kết quả này.
{
  "panelNumber": number,
  "visualPrompt": "string (đã được fix)",
  "qaNotes": "string (ghi chú lỗi đã sửa, bao gồm cả ghi chú COVERAGE nếu có)"
}

HỒ SƠ GỐC:
${charLocAnalysis}

PROMPTS CẦN KIỂM TRA (JSON):
${data}
`;

export const getFinalResultPrompt = (storyboard: string, prompts: string, qaReport: string, charLocAnalysis: string) => `
Bạn là Production Manager cho dự án minh họa tiểu thuyết. Tổng hợp dữ liệu thành JSON. 

QUY TẮC LẤY VISUAL PROMPT:
1. Bản QA chỉ chứa các panel đã được sửa lỗi hoặc thay đổi.
2. NẾU panelNumber có trong bản QA, PHẢI lấy visualPrompt từ bản QA đó.
3. NẾU panelNumber KHÔNG có trong bản QA, hãy lấy visualPrompt từ bản PROMPTS gốc.
4. Đảm bảo kết quả cuối cùng có đầy đủ tất cả các panel từ 1 đến hết.

YÊU CẦU CẤU TRÚC JSON ĐẦU RA:
{
  "characterName": ["tong_mat", "vuong_viet", ...], // Danh sách tên nhân vật dạng snake_case, không dấu (ví dụ: "Tống Mật" thành "tong_mat") từ HỒ SƠ NHÂN VẬT bên dưới.
  "panels": [ // Mảng chứa thông tin các khung hình
    {
      "panelNumber": Số thứ tự khung hình,
      "shotName": "Tiêu đề ngắn gọn cho khung hình",
      "originalText": "Câu văn hoặc đoạn văn gốc được minh họa",
      "timeOfDay": "Thời điểm diễn ra (Lấy chính xác từ STORYBOARD)",
      "cameraAngle": "Góc máy",
      "framing": "Bố cục khung hình",
      "subject": "Chủ thể chính",
      "action": "Hành động diễn ra",
      "location_cues": "Dấu hiệu bối cảnh",
      "lighting": "Ánh sáng (theo quy tắc [Global Light] mixed with [Accent Light])",
      "visualPrompt": "Prompt hình ảnh cuối cùng",
      "negative_prompt": "text, speech bubbles, watermark, low quality, shadows, blurry"
    }
  ]
}

DỮ LIỆU:
HỒ SƠ NHÂN VẬT: ${charLocAnalysis}
STORYBOARD: ${storyboard}
PROMPTS: ${prompts}
QA (Chỉ gồm các bản sửa lỗi): ${qaReport}
`;

// --- API SERVICES ---

export const analyzePhase1Analysis = async (script: string, style: string, existingLibrary?: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getPhase1AnalysisPrompt(script, style, existingLibrary),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          analysis: {
            type: "array",
            items: {
              type: "object",
              properties: {
                startMarker: { type: "string" },
                endMarker: { type: "string" },
                analysis: { type: "string" },
                atmosphere: { type: "string" },
                posture: { type: "string" },
                timeOfDay: { type: "string" },
                keyActions: { type: "array", items: { type: "string" } }
              }
            }
          },
          characterLocationAnalysis: {
            type: "object",
            properties: {
              characters: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    age: { type: "string" },
                    height: { type: "string" },
                    gender: { type: "string" },
                    face: { type: "string" },
                    hair: { type: "string" },
                    eyes: { type: "string" },
                    outfit: { type: "string" },
                    imagePrompt: { type: "string" }
                  },
                  required: ["name", "age", "height", "gender", "face", "hair", "eyes", "outfit", "imagePrompt"]
                }
              },
              locations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" },
                    imagePrompt: { type: "string" }
                  },
                  required: ["name", "description", "imagePrompt"]
                }
              }
            }
          }
        },
        required: ["analysis", "characterLocationAnalysis"]
      } as any
    }
  });
  return response.text;
};

export const createStoryboard = async (analysis: string, charLocAnalysis: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getStoryboardPrompt(analysis, charLocAnalysis),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            panelNumber: { type: "integer" },
            originalText: { type: "string" },
            description: { type: "string" },
            timeOfDay: { type: "string" }
          },
          required: ["panelNumber", "originalText", "description", "timeOfDay"]
        }
      } as any
    }
  });
  return response.text;
};

export const engineerPrompts = async (storyboard: string, charLocAnalysis: string, style: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getEngineerPromptsPrompt(storyboard, charLocAnalysis, style),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            panelNumber: { type: "integer" },
            visualPrompt: { type: "string" },
            timeOfDay: { type: "string" }
          },
          required: ["panelNumber", "visualPrompt", "timeOfDay"]
        }
      } as any
    }
  });
  return response.text;
};

export const runQA = async (data: string, charLocAnalysis: string, style: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getQAPrompt(data, charLocAnalysis, style),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "array",
        items: {
          type: "object",
          properties: {
            panelNumber: { type: "integer" },
            visualPrompt: { type: "string" },
            timeOfDay: { type: "string" },
            qaNotes: { type: "string" }
          },
          required: ["panelNumber", "visualPrompt", "qaNotes", "timeOfDay"]
        }
      } as any
    }
  });
  return response.text;
};

export const generateFinalResult = async (storyboard: string, prompts: string, qaReport: string, charLocAnalysis: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: getModel(),
    contents: getFinalResultPrompt(storyboard, prompts, qaReport, charLocAnalysis),
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: {
          characterName: {
            type: "array",
            items: { type: "string" }
          },
          panels: {
            type: "array",
            items: {
              type: "object",
              properties: {
                panelNumber: { type: "integer" },
                shotName: { type: "string" },
                originalText: { type: "string" },
                timeOfDay: { type: "string" },
                cameraAngle: { type: "string" },
                framing: { type: "string" },
                subject: { type: "string" },
                action: { type: "string" },
                location_cues: { type: "string" },
                lighting: { type: "string" },
                visualPrompt: { type: "string" },
                negative_prompt: { type: "string" }
              },
              required: ["panelNumber", "shotName", "originalText", "visualPrompt", "timeOfDay"]
            }
          }
        },
        required: ["characterName", "panels"]
      } as any
    }
  });
  return response.text;
};
