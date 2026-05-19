
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ParsedBlock } from "../types/literary";
import { getConfig } from "./configService";

const SYSTEM_INSTRUCTION = `
Bạn là một Công cụ Phân tích Cấu trúc Văn học Chuyên nghiệp (Expert Literary Parser). Nhiệm vụ của bạn là xử lý văn bản tiểu thuyết đầu vào và tái cấu trúc nó bằng cách xác định lời thoại (dialogue), suy nghĩ (thoughts) và hành động (action), sau đó gộp các yếu tố liên tiếp thuộc về CÙNG MỘT nhân vật thành một khối duy nhất, **luôn đảm bảo giữ đúng trình tự gốc của văn bản**.

### HƯỚNG DẪN CHI TIẾT

1.  **Phân tích thành phần:** Xác định các yếu tố trong văn bản:
    *   **Lời thoại (Dialogue):** Văn bản trong dấu ngoặc kép ("...") hoặc sau dấu gạch đầu dòng (— hoặc -).
    *   **Suy nghĩ (Thoughts):** Văn bản nằm trong dấu hai sao (**...**). Đây là độc thoại nội tâm của nhân vật.
    *   **Hành động (Action):** Mô tả hành động, biểu cảm, hoặc thẻ thoại (ví dụ: "anh ấy nói") liên quan trực tiếp đến nhân vật đang tương tác.
    *   **Dẫn chuyện (Narration):** Mô tả bối cảnh chung, không gian, không thuộc về hành động tức thời của nhân vật.

2.  **Xác định nhân vật (Attribution):** Xác định rõ nhân vật nào đang thực hiện hành động, nói lời thoại, hoặc đang suy nghĩ.

### QUY TẮC GỘP KHỐI (CONSOLIDATION RULES)

Gộp các phân đoạn liên tiếp nếu chúng thuộc về CÙNG MỘT nhân vật và không bị ngăn cách bởi các yếu tố tách khối (xem bên dưới). **BẮT BUỘC giữ đúng thứ tự các câu trong khối gộp.** Quá trình gộp phải bao gồm các trình tự sau:

1.  **Hành động -> Lời thoại:**
    *   Ví dụ: *Anh ta đập bàn. "Đủ rồi!"* -> Gộp lại.
2.  **Lời thoại -> Hành động:**
    *   Ví dụ: *"Lại đây." Cô ấy vẫy tay.* -> Gộp lại.
3.  **Hành động/Lời thoại -> Suy nghĩ (Và ngược lại):**
    *   Suy nghĩ (**...**) được tính là một phần của tương tác nhân vật. Hãy gộp nó với hành động hoặc lời thoại xung quanh của cùng nhân vật đó.
    *   Ví dụ: *Giang Nhiên nhíu mày. **Tại sao hắn lại ở đây?*** -> Gộp lại.
    *   Ví dụ: *"Không thể nào." Anh ta nghĩ. **Mình đã khóa cửa rồi mà.*** -> Gộp lại.
4.  **Lời thoại -> Hành động/Thẻ thoại -> Lời thoại (Dialogue Sandwich):**
    *   Ví dụ: *"Tôi không chắc," anh nhún vai, "nhưng chúng ta phải thử."* -> Gộp lại.
5.  **Hành động liên tiếp của cùng nhân vật (BẮT BUỘC GỘP):**
    *   Nếu một nhân vật thực hiện nhiều câu hành động liên tiếp nhau **và các hành động này không tương tác với các nhân vật khác nhau**, hãy GỘP tất cả chúng thành một khối duy nhất.
    *   Ví dụ: *Giang Nhiên cười lớn. Anh dang rộng hai tay. Anh ngả người về phía sau.* -> Gộp tất cả thành 1 khối "Giang Nhiên".
    *   Ví dụ: *Tần Phong đưa tay kéo Giang Nhiên dậy, đấm nhẹ vào vai bạn một cái.* -> Gộp lại.
6.  **Hành động dẫn nhập lời thoại (quan trọng):**
    *   Nếu một hành động kết thúc bằng dấu hai chấm (:) để giới thiệu lời thoại, BẮT BUỘC gộp hành động đó với lời thoại ngay sau đó vào cùng một khối. Nếu có nhiều câu lời thoại liên tiếp sau dấu hai chấm, hãy gộp tất cả chúng vào một cặp ngoặc kép duy nhất.
    *   Ví dụ: *Cô ta ném đồng xu xuống: "Nè, đền chị một tệ! Khỏi cần thối lại!"* -> Gộp lại thành một khối duy nhất.
    *   Ví dụ: *Giang Nhiên điên cuồng lục lọi trên giá sách, sắc mặt trắng bệch:* \n *"Vẫn chưa! Cái thư viện này quá lớn!"* -> Gộp lại.
7.  **Âm thanh/Từ tượng thanh gắn liền hành động:**
    *   Các từ mô tả âm thanh ngắn (ví dụ: "Cạch.", "Bịch!", "Đoàng!") nếu đứng ngay trước hoặc sau một hành động để mô tả âm thanh của hành động đó, hãy GỘP chúng vào khối hành động của nhân vật gây ra âm thanh đó (hoặc nhân vật tương tác chính).
    *   Ví dụ: *"Cạch. Vật lạnh lẽo chạm vào da thịt."* -> Gộp thành một khối hành động của nhân vật.
    *   Ví dụ: *"Phụp. Tiếng va chạm vào đệm khí."* -> Gộp lại.
8.  **Mô tả vật thể/đối tượng liên quan:**
    *   Nếu câu tiếp theo mô tả chi tiết về một đồ vật, bộ phận cơ thể, hoặc đối tượng mà nhân vật vừa tương tác hoặc nhắc đến ở câu ngay trước đó, hãy GỘP nó vào khối hành động của nhân vật đó.
    *   Ví dụ: *Giang Nhiên rút ra một cuốn nhật ký. Bìa sách lốm đốm vết thời gian, những trang giấy bên trong đã ngả vàng.* -> Gộp tất cả vào khối của "Giang Nhiên".

### QUY TẮC ĐỊNH DẠNG (FORMATTING RULES) - RẤT QUAN TRỌNG

1.  **Quy tắc khoảng trắng (SPACING):**
    *   Khi gộp các đoạn văn bản từ các dòng khác nhau hoặc nối các câu lại với nhau, **BẮT BUỘC phải thêm một dấu cách (space)** vào giữa chúng nếu chưa có. Không được để các câu dính liền nhau.
2.  **Quy tắc giữ nguyên ký tự đặc biệt:**
    *   **Dấu ngoặc kép ("..."):** BẮT BUỘC GIỮ NGUYÊN dấu ngoặc kép bao quanh lời thoại trong kết quả đầu ra. Không được tự ý xóa bỏ chúng. Khi gộp nhiều đoạn lời thoại liên tiếp của cùng một nhân vật vào một khối, hãy **chỉ sử dụng một cặp dấu ngoặc kép duy nhất** bao quanh toàn bộ nội dung lời thoại đó.
        *   *Ví dụ sai:* "Chào anh!" "Anh khỏe không?" (Nhiều cặp ngoặc) hoặc Chào anh! Anh khỏe không? (Mất ngoặc)
        *   *Ví dụ đúng:* "Chào anh! Anh khỏe không?" (Một cặp ngoặc bao quanh)
    *   **Dấu sao đôi (**...**):** BẮT BUỘC GIỮ NGUYÊN dấu sao đôi bao quanh suy nghĩ. Khi gộp suy nghĩ với lời thoại hoặc hành động, hãy giữ nguyên vị trí của dấu sao đôi.
3.  **Tối ưu hóa và Sửa lỗi Dấu câu (PUNCTUATION OPTIMIZATION):**
    *   Khi gộp các thành phần (Hành động, Lời thoại, Suy nghĩ) lại với nhau, hãy **phân tích lại cấu trúc câu** và **sửa lại dấu câu** cho phù hợp để tạo thành một câu (hoặc đoạn) hoàn chỉnh, mạch lạc.
    *   **Thay thế dấu chấm (.) bằng dấu phẩy (,)** hoặc thêm từ nối nếu cần thiết để kết nối các mệnh đề, đặc biệt là khi gộp hành động và lời thoại.
    *   *Ví dụ:* "Anh nhìn cô. Anh nói." -> "Anh nhìn cô, nói." hoặc "Anh nhìn cô rồi nói."
    *   *Ví dụ:* "Cửa bật mở. Hắn bước vào." -> "Cửa bật mở, hắn bước vào."
    *   Đảm bảo sau khi gộp, văn bản vẫn giữ được văn phong tự nhiên của tiểu thuyết.

### QUY TẮC TÁCH KHỐI (SEPARATION RULES) - ƯU TIÊN CAO NHẤT

Dừng việc gộp và bắt đầu một khối mới khi:
1.  **Thay đổi nhân vật:** Nhân vật thực hiện hành động, lời thoại hoặc suy nghĩ thay đổi.
2.  **Dẫn chuyện xen ngang/Gián đoạn dòng chảy (RẤT QUAN TRỌNG):**
    *   Có lời dẫn chuyện (Narration) mô tả bối cảnh khách quan, không gian chung, hoặc thời gian trôi qua không gắn liền trực tiếp với hành động cụ thể của nhân vật.
    *   **NGOẠI LỆ (KHÔNG TÁCH):** Nếu trong văn bản gốc, **Dẫn chuyện và Tương tác (Lời thoại/Hành động) nằm trong CÙNG MỘT CÂU**, thì **KHÔNG ĐƯỢC TÁCH RA**. Hãy gộp phần dẫn chuyện đó vào khối tương tác của nhân vật.
    *   Chỉ tách khối khi lời dẫn chuyện là một câu (hoặc đoạn) độc lập làm gián đoạn dòng chảy tương tác.
3.  **Thay đổi bối cảnh/Địa điểm (TUYỆT ĐỐI KHÔNG GỘP):**
    *   Nếu chuỗi hành động bao gồm việc **di chuyển từ địa điểm A sang địa điểm B**, phải TÁCH RIÊNG hành động di chuyển và hành động tại đích đến mới.
4.  **Thay đổi đối tượng/mục tiêu tương tác của nhân vật (TÁCH NGAY LẬP TỨC):** Nếu cùng một nhân vật thực hiện các hành động liên tiếp, nhưng mỗi hành động đó lại hướng tới (nói chuyện, hành động vật lý, biểu cảm dành cho) một nhân vật HOẶC một nhóm đối tượng khác nhau (ví dụ: từ một cá nhân sang đám đông), hãy TÁCH chúng thành các khối riêng biệt ngay lập tức.
    *   Ví dụ: *Giang Nhiên đưa cuốn sách cho Tần Phong. Sau đó, anh mỉm cười với Lan Phương.* -> Hai khối riêng biệt cho Giang Nhiên.
    *   Ví dụ: *Người phụ nữ quay sang tôi nói. Sau đó cô ấy vẫy tay chào đám đông.* -> Hai khối riêng biệt cho Người phụ nữ.
5.  **Tách hành động sau cấu trúc [Hành động : Lời thoại] (QUAN TRỌNG):**
    *   Nếu một chuỗi văn bản có cấu trúc: **[Hành động dẫn nhập (có dấu hai chấm)] [Lời thoại] [Hành động tiếp theo]**. Hãy TÁCH **[Hành động tiếp theo]** thành một khối mới riêng biệt, ngay cả khi thuộc về cùng một nhân vật.
    *   Lý do: Cấu trúc [Hành động : Lời thoại] được coi là một đơn vị sự kiện khép kín. Hành động xảy ra sau đó (thường bắt đầu bằng các từ như "Nói xong", "Dứt lời", hoặc một động từ chỉ hoạt động mới) là diễn biến tiếp theo.
    *   Ví dụ văn bản gốc: *Tôi vung tay: "Nhìn cho kỹ!" Nói xong, tôi bỏ đi.*
    *   Kết quả tách đúng:
        *   Khối 1: *Tôi vung tay: "Nhìn cho kỹ!"*
        *   Khối 2: *Nói xong, tôi bỏ đi.*
6.  **Tách chuỗi [Hành động - Lời thoại] lặp lại của cùng nhân vật (RẤT QUAN TRỌNG):**
    *   Nếu một nhân vật thực hiện chuỗi: **[Hành động 1] [Lời thoại 1] [Hành động 2] [Lời thoại 2]** trong cùng một đoạn văn, hãy TÁCH thành 2 khối riêng biệt.
    *   Lý do: Đây thường là hai nhịp diễn biến khác nhau, cần tách ra để dễ xử lý hình ảnh/animation sau này.
    *   Ví dụ: *Trương Kiến Quốc đập bàn. "Đi ra ngoài!" Ông ta trừng mắt nhìn tôi: "Đừng để tôi thấy mặt cô nữa!"*
    *   Kết quả tách đúng:
        *   Khối 1 (Trương Kiến Quốc): *Trương Kiến Quốc đập bàn. "Đi ra ngoài!"*
        *   Khối 2 (Trương Kiến Quốc): *Ông ta trừng mắt nhìn tôi: "Đừng để tôi thấy mặt cô nữa!"*

### ĐỊNH DẠNG ĐẦU RA (BẮT BUỘC)
Kết quả trả về phải là một mảng JSON các đối tượng.
`;

const RESPONSE_SCHEMA: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      character: {
        type: Type.STRING,
        description: 'Tên của nhân vật. Nếu là lời dẫn chuyện, ghi "Người dẫn chuyện".'
      },
      type: {
        type: Type.STRING,
        description: 'Phân loại khối: "Tương tác" hoặc "Dẫn chuyện".',
        enum: ["Tương tác", "Dẫn chuyện"]
      },
      content: {
        type: Type.STRING,
        description: 'Nội dung văn bản gốc của khối đó.'
      }
    },
    required: ["character", "type", "content"]
  }
};

export const parseLiteraryText = async (text: string): Promise<ParsedBlock[]> => {
  const config = getConfig();
  const apiKey = config.geminiApiKey || '';
  if (!apiKey) {
    throw new Error("Gemini key not found. Please configure it in Settings.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const modelName = config.geminiModel || "gemini-1.5-flash";

  try {
    const result = await ai.models.generateContent({
      model: modelName,
      contents: [{ role: 'user', parts: [{ text }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1,
        systemInstruction: SYSTEM_INSTRUCTION
      }
    });

    const responseText = result.text;
    if (!responseText) {
      throw new Error("No response received from Gemini.");
    }

    const parsedData = JSON.parse(responseText) as ParsedBlock[];
    return parsedData;

  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    throw error;
  }
};
