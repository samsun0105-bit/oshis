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

請分析現場照片，識別所有職業安全衛生危害，包括不安全狀態、不安全行為、設備缺失、環境危害與施工安全問題。

重要判斷原則：
1. 只能根據照片中可明確觀察到的事實進行判斷，不得憑空假設照片外不存在或無法確認的情境。
2. 若照片角度、解析度、遮蔽、距離或光線導致無法確認，請在危害名稱或風險描述中標示「疑似」，並寫明「需人工複核」。
3. 法源依據請優先參考台灣職業安全衛生相關法規，例如：
   - 職業安全衛生法
   - 職業安全衛生設施規則
   - 營造安全衛生設施標準
   - 危害性化學品標示及通識規則
   - 勞工健康保護規則
4. 不確定具體法規條號時，不得捏造條號，請在 legal_basis 欄位寫「需人工確認法規條號」。
5. 若只能判斷為可能危害，請使用「疑似」、「可能」、「需現場確認」等保守用語。
6. 辨識結果僅供安全管理人員初步篩選與複核使用，不得直接作為最終違規認定。`
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

請分析這張職業安全現場照片。

請完成以下任務：
1. 識別照片中的職業安全衛生危害。
2. 每一項危害都要標示照片中的座標位置 box_2d。
3. 座標格式為 [ymin, xmin, ymax, xmax]，數值範圍 0-1000。
4. 每一項危害都要提供：
   - 危害名稱
   - 可能適用的法源依據；不確定條號時請寫「需人工確認法規條號」
   - 風險描述
   - 風險級別：高 / 中 / 低
5. 提供改善建議。

請只輸出純 JSON，不要 markdown，不要說明文字。

JSON 格式如下：
{
  "hazards": [
    {
      "type": "危害名稱",
      "legal_basis": "可能適用的法源依據；不確定條號時寫：需人工確認法規條號",
      "risk": "風險描述",
      "severity": "高/中/低",
      "box_2d": [ymin, xmin, ymax, xmax]
    }
  ],
  "suggestions": [
    "改善建議1",
    "改善建議2"
  ]
}`;

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
        temperature: 0.3,
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
        error: data.error || data,
        sentPayload: payload
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
