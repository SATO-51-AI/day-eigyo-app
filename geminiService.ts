import { GoogleGenAI, Type } from "@google/genai";
import { Facility } from "./types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * 画像・PDF・テキストから施設データを高精度に抽出します。
 */
export const parseContentToFacilities = async (
  inputs: (string | { data: string; mimeType: string })[]
): Promise<Facility[]> => {
  const parts = inputs.map(input => {
    if (typeof input === 'string') {
      return { text: `データソース(テキスト):\n${input}` };
    } else {
      return { 
        inlineData: { 
          data: input.data, 
          mimeType: input.mimeType 
        } 
      };
    }
  });

  const promptPart = {
    text: `あなたは訪問計画のスペシャリストです。
    提供された全ての画像、PDF、テキストを詳細にスキャンし、施設リストを作成してください。

    【重要：Googleマップ検索の最適化】
    - address欄には「施設名を含まない純粋な住所」のみを入力してください。
    - 施設名（name）と住所（address）を厳格に分けてください。

    【抽出データ項目】
    - id: 各施設に一意のID
    - name: 施設名
    - address: 住所（マップ検索用）
    - phone: 電話番号（あれば）
    - lastVisitDate: 最終訪問日
    - lastComment: 状況メモ

    必ず指定されたJSON形式で出力してください。`
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{ parts: [...parts, promptPart] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              address: { type: Type.STRING },
              phone: { type: Type.STRING },
              lastVisitDate: { type: Type.STRING },
              lastComment: { type: Type.STRING }
            },
            required: ["id", "name", "address", "lastVisitDate", "lastComment"]
          }
        }
      }
    });

    const text = response.text;
    return text ? JSON.parse(text.trim()) : [];
  } catch (e) {
    console.error("Parse Error:", e);
    return [];
  }
};

/**
 * 現在地を起点として、車で最も効率的な巡回ルートを計算します。
 */
export const optimizeRoute = async (
  facilities: Facility[], 
  currentLocation: string, 
  timeLimitMinutes: number
): Promise<{ orderedIds: string[]; reasoning: string }> => {
  const facilityData = facilities.map(f => `ID:${f.id}, 施設名:${f.name}, 住所:${f.address}`).join('\n');
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [{
        parts: [{
          text: `
            【物流・ルート最適化エキスパートとして回答してください】

            出発地点（現在地）: ${currentLocation}
            
            【依頼内容】
            現在地を起点として、提供された施設リストを「車で最も効率的に巡回する順番（最短走行ルート）」に並び替えてください。
            総走行距離と移動時間を最小限に抑える一筆書きのようなルートを提案してください。
            
            【ルール】
            1. リストが9件以下の場合は、全件を含めて最適な訪問順序を決定してください。
            2. リストが9件より多い場合は、地理的に近い順に「最大9件」を厳選し、その中での最短ルートを作成してください。
            
            施設リスト:
            ${facilityData}
            
            返答は以下のJSON形式のみで行ってください。
          `
        }]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            orderedIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "最短経路で並べ替えられた施設IDの配列（最大9件）"
            },
            reasoning: {
              type: Type.STRING,
              description: "この順番がなぜ最短なのか（例：北から順に効率よく回るルート、など）の簡潔な解説"
            }
          },
          required: ["orderedIds", "reasoning"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Empty response");
    return JSON.parse(text.trim());
  } catch (e) {
    console.error("Optimize Error:", e);
    throw e;
  }
};