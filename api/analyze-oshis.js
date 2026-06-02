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

請分析現場照片，識別所有職業安全衛生危害，包括不安全狀態、不安全行為、設備缺失、環境危害、施工安全、消防安全與建築安全相關問題。

重要判斷原則：
1. 只能根據照片中可明確觀察到的事實進行判斷，不得憑空假設照片外不存在或無法確認的情境。
2. 若照片角度、解析度、遮蔽、距離或光線導致無法確認，請在危害名稱或風險描述中標示「疑似」，並寫明「需人工複核」。
3. 若只能判斷為可能危害，請使用「疑似」、「可能」、「需現場確認」等保守用語。
4. 辨識結果僅供安全管理人員初步篩選與複核使用，不得直接作為最終違規認定。

法源依據判斷原則：
1. 法源依據請以台灣職業安全衛生相關法規為主要參考範圍，包含但不限於：
   - 職業安全衛生法
   - 職業安全衛生法施行細則
   - 職業安全衛生設施規則
   - 營造安全衛生設施標準
   - 職業安全衛生管理辦法
   - 職業安全衛生教育訓練規則
   - 危害性化學品標示及通識規則
   - 勞工健康保護規則
   - 危險性機械及設備安全檢查規則
   - 機械設備器具安全標準
2. 若照片內容涉及其他特殊職業安全衛生危害，例如化學品、粉塵、缺氧、有機溶劑、高壓氣體、噪音、游離輻射、機械設備、危險性機械設備等，請依可能相關之職業安全衛生法規方向判斷。
3. 若照片內容明顯涉及消防安全、火災防護、滅火設備、警報設備、避難逃生動線、防火區劃、易燃物堆放、用火用電安全等事項，可標示「可能涉及消防相關法規，需人工確認」，並可參考消防法及相關消防安全設備規範方向，但不得捏造具體法規條號。
4. 若照片內容明顯涉及建築物安全、施工架、臨時構造物、開口防護、通道、樓梯、欄杆、建築結構、公共安全、使用管理或建築技術規則相關事項，可標示「可能涉及建築相關法規，需人工確認」，並可參考建築法、建築技術規則及相關建築管理規範方向，但不得捏造具體法規條號。
5. legal_basis 欄位請優先提供「可能適用之法規名稱、條號及項次」。若可高度確認適用法規，請盡量寫出第幾條、第幾項；只有在照片資訊不足、適用條件無法確認、或無法高度確認條號時，才寫「需人工確認法規條號」；不得捏造不存在或不確定的條號。`
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
4. 可能適用的法源依據；若可高度確認，請盡量提供法規名稱、條號及項次；若不確定條號，請寫「需人工確認法規條號」
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
      "legal_basis": "可能適用的法源依據，例如：職業安全衛生設施規則第○○條第○項；若不確定條號時寫：需人工確認法規條號",
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
