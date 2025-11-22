import { GoogleGenAI, Type } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is missing. AI features will be disabled.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const generateMetadataForFile = async (filename: string): Promise<{ tags: string[]; description: string }> => {
  const client = getClient();
  if (!client) {
    return {
      tags: ['manual', 'pending'],
      description: 'AI generation unavailable (no API key).',
    };
  }

  try {
    const prompt = `Analyze the filename "${filename}" of a 3D model (STL/STEP). 
    Generate 5-8 relevant SEO tags and a short, 2-sentence description describing what this object likely is.
    Return JSON.`;

    const response = await client.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            description: { type: Type.STRING },
          },
          required: ["tags", "description"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini Metadata Error:", error);
    return {
      tags: ['error', 'retry'],
      description: 'Could not generate metadata at this time.',
    };
  }
};