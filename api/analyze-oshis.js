export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : req.body || {};

    const imageBase64 = String(body.imageBase64 || "").trim();
    const mimeType = String(body.mimeType || "image/png").trim();

const systemPrompt = String(
  body.systemPrompt ||
  body.prompt ||
    `你是一位專業職業安全衛生管理師與職安法規查核專家。

請根據照片可見事實，辨識職業安全衛生危害；若照片明顯涉及消防或建築安全，也可輔助判斷。不得憑空假設照片外無法確認的情境。

判斷原則：
1. 僅根據照片可見事實判斷；無法確認時使用「疑似」、「可能」、「需現場確認」等保守用語。
2. type 欄位請使用具體、正式、簡潔的現場識別標題，不要只寫抽象分類。
3. risk 欄位請描述照片可見狀況、可能事故型態及可能影響，避免過度推測。
4. suggestions 欄位請提供具體、可執行且與危害對應的改善措施。
5. 辨識結果僅供安全管理人員初步篩選與複核，不得直接作為最終違規認定。

法源依據原則：
1. 法源依據以台灣職業安全衛生相關法規為主，例如職業安全衛生法、職業安全衛生設施規則、營造安全衛生設施標準、職業安全衛生管理辦法、職業安全衛生教育訓練規則、危害性化學品標示及通識規則、勞工健康保護規則、危險性機械及設備安全檢查規則、機械設備器具安全標準。
2. 若明顯涉及消防安全，可參考消防法或消防安全設備相關規定；若明顯涉及建築安全，可參考建築法、建築技術規則或相關建築管理規範。
3. legal_basis 欄位請列出 1 至 2 個最可能適用的法源；高度確認時才寫條號或項次。
4. 若無法高度確認條號或項次，不得捏造，僅列可能適用的法規名稱或法規類別。`
).trim();

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        error: "缺少 GEMINI_API_KEY，請到 Vercel Environment Variables 設定"
      });
    }

    if (!imageBase64) {
      return res.status(400).json({
        error: "缺少 imageBase64",
        receivedBody: body
      });
    }

const prompt = `${systemPrompt}

請分析這張職業安全現場照片，輸出純 JSON，不要 markdown，不要說明文字。

請回傳格式如下：
{
  "hazards": [
    {
      "type": "具體識別項目標題，12至28個中文字",
      "legal_basis": "1至2個最可能適用的法源依據；無法高度確認條號或項次時，僅寫法規名稱或法規類別",
      "risk": "35至90個中文字，描述照片可見狀況、可能事故型態及可能影響",
      "severity": "高/中/低",
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ],
  "suggestions": [
    "35至100個中文字，具體、可執行且與照片危害相關的改善建議"
  ]
}

規則：
1. 每項 hazards 都必須包含 box_2d，格式為 [ymin, xmin, ymax, xmax]，數值範圍 0-1000。
2. 最多列出 5 項主要危害；若危害很多，優先列風險較高或最明顯者。
3. suggestions 請對應主要危害，避免空泛文字。`;

    const cleanBase64 = imageBase64.includes(",")
      ? imageBase64.split(",")[1]
      : imageBase64;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: cleanBase64
              }
            }
          ]
        }
      ],
generationConfig: {
  temperature: 0.2,
  maxOutputTokens: 2048,
  responseMimeType: "application/json"
}
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", JSON.stringify(data, null, 2));
return res.status(response.status).json({
  error: data.error || data
});
    }

    return res.status(200).json(data);
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({
      error: error.message
    });
  }
}
