import { GoogleGenAI, Type } from "@google/genai";
import { logError } from '../utils/debugLogger';

// Helper to initialize AI with dynamic key
const getAI = () => {
  const storedKey = localStorage.getItem('ls_gemini_key');
  // vite.config.ts exposes GEMINI_API_KEY as process.env.GEMINI_API_KEY (no VITE_ prefix needed)
  const apiKey = storedKey || (process.env as any).GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY || '';
  return new GoogleGenAI({ apiKey });
};

// System instruction to maintain persona
const SYSTEM_INSTRUCTION = `
You are a personal AI Goal Tracker and Life Management Assistant. 
Your output should be clear, concise, and action-oriented.
IMPORTANT: Do NOT use Markdown formatting (no bolding **, no headers #, no bullet points *, no dashes -). 
Write in clean, plain text paragraphs or simple numbered lists (1. 2. 3.) only if absolutely necessary.
Always end responses by asking "What do you want to add, review, or improve today?".
`;

export const getAIRecommendation = async (goalTitle: string, currentStatus: string) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';
    const prompt = `
      I have a goal: "${goalTitle}". 
      Current status: ${currentStatus}.
      Please provide 3 specific, actionable activities to help me achieve this, and 1 potential pitfall to avoid.
      Format as a concise list (1. 2. 3. 4.). Do not use bold characters.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    return response.text;
  } catch (error) {
    console.error("AI Recommendation Error:", error);
    return "Unable to generate recommendations. Please check your API Key in Settings.";
  }
};

export const generateScenarioScript = async (scenario: string, level: 'Beginner' | 'Advanced') => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';
    const prompt = `
      Scenario: ${scenario}
      Level: ${level}
      
      Generate a role-play script for me to practice. 
      Format it as a script (Me: ... You: ...).
      Do NOT use any markdown formatting like ** or ## or ---.
      Include actionable tone tips at the end.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      }
    });

    return response.text;
  } catch (error) {
    console.error("Scenario Gen Error:", error);
    return "Error generating scenario. Please check your API Key in Settings.";
  }
};

export const chatWithAI = async (history: { role: string, parts: { text: string }[] }[], message: string) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';
    const chat = ai.chats.create({
      model,
      history: history,
      config: {
        systemInstruction: "You are a role-play partner helping the user practice a specific social scenario. Stay in character. Keep responses brief and conversational. Do not use Markdown."
      }
    });

    const result = await chat.sendMessage({ message });
    return result.text;
  } catch (error) {
    return "I'm having trouble connecting. Please check your API Key in Settings.";
  }
}

export const analyzeVoice = async (audioBase64: string) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'audio/wav', data: audioBase64 } },
          { text: "Analyze this voice recording. Give feedback on 1) Confidence, 2) Clarity, 3) Tone. Do not use Markdown." }
        ]
      }
    });
    return response.text;
  } catch (error) {
    console.error("Voice Analysis Error", error);
    return "Could not analyze audio. Please ensure you have a valid Gemini API Key set in Settings.";
  }
}

export const getWeeklyBriefing = async (topic: 'Sports' | 'History' | 'Finance') => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash'; // Using Flash with Google Search grounding
    let prompt = "";

    if (topic === 'Sports') {
      prompt = "Write a detailed report on trending talking points in Football, Boxing, and MMA. Write in full paragraphs. Do not use bullet points or markdown symbols.";
    } else if (topic === 'History') {
      prompt = `
        Write a two-part historical report.
        
        PART 1: NIGERIA
        Write a deep dive (approx 150 words) about a specific, interesting event in Nigerian history or culture. Explain the context, the event, and its significance.

        PART 2: GLOBAL
        Write a deep dive (approx 150 words) about a significant historical event from Europe, America, or Canada.
        
        Formatting:
        Do not use Markdown symbols (*, #).
        Use clear ALL CAPS headings for the sections (e.g. NIGERIAN HISTORY, GLOBAL HISTORY).
        Write in an engaging, storytelling format.
      `;
    } else if (topic === 'Finance') {
      prompt = "Provide a robust financial report on the Nigerian Market. Include specific current metrics for Nigeria (GDP, Inflation, FX Rates). Analyze key moves by top Asset Management firms and Stock Brokers in Nigeria. Mention recent awards or major market shifts. Write in full paragraphs with a professional tone. Do not use bullet points.";
    }

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are an expert analyst. Output plain text only. No markdown formatting.",
        tools: [{ googleSearch: {} }]
      }
    });

    return response.text;
  } catch (error) {
    console.error("Briefing Error:", error);
    return "Unable to fetch briefing data. Please check your API Key in Settings.";
  }
};

export const analyzeDocument = async (base64Data: string, mimeType: string) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';
    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Data
            }
          },
          {
            text: "Summarize this document. Provide 3 key takeaways and actionable insights. Output as plain text only, no bolding or markdown symbols."
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION
      }
    });
    return response.text;
  } catch (error) {
    console.error("Doc Analysis Error:", error);
    return "Error analyzing document. Please check your API Key in Settings.";
  }
};

export const analyzeUrl = async (url: string) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';

    const prompt = `
      Access and analyze the content of this website: ${url}
      
      Provide a comprehensive summary of the page's content.
      List 3-5 key takeaways or actionable insights found on the page.
      
      Format:
      SUMMARY:
      [Summary text]
      
      KEY TAKEAWAYS:
      1. [Takeaway 1]
      2. [Takeaway 2]
      ...
      
      Do not use markdown formatting like bolding (**) or headers (##).
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    return response.text;
  } catch (error) {
    console.error("URL Analysis Error:", error);
    return "Unable to analyze website. Please ensure your API key is valid and supports Google Search grounding.";
  }
};

// --- Annual Report Service ---

export const generateAnnualReport = async (userData: any) => {
  try {
    const ai = getAI();
    const MODEL_NAME = 'gemini-2.0-flash';

    const prompt = `
            You are a Senior Strategic Life Coach. Generate a comprehensive "Year-in-Review" Report for the user based on the following data:
            
            USER DATA:
            ${JSON.stringify(userData, null, 2)}

            REQUIREMENTS:
            1. Analyze the completion rates, health trends, and project progress.
            2. Identify patterns (e.g., "You consistently hit health goals but struggled with financial ones").
            3. Provide specific, brutally honest (but constructive) feedback.
            4. Recommend 3-5 MAJOR GOALS for the upcoming year based on this trajectory.

            FORMAT:
            Use these EXACT headers (in ALL CAPS):
            EXECUTIVE SUMMARY
            PERFORMANCE ANALYSIS
            KEY ACHIEVEMENTS
            CRITICAL FEEDBACK
            STRATEGIC GOALS FOR NEXT YEAR

            Do NOT use bolding, italics, or markdown symbols (*, #).
            Write in clear, professional paragraphs.
        `;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {}
    });

    return response.text;
  } catch (error: any) {
    if (error.message?.includes('404')) {
      console.warn("Gemini 1.5-flash not found, falling back to pro-vision");
    }
    logError("Gemini API Error", { message: error.message, details: error });
    // Return a user-friendly error string instead of crashing
    return `AI Error: Unable to generate report. Details: ${error.message || 'Unknown error'}`;
  }
}

// --- Health & Nutrition Services ---

export const analyzeFoodImage = async (base64Image: string) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';

    const prompt = `
      Analyze the food in this image carefully.

      RULES:
      1. If you cannot clearly identify the food, set "confidence" to "low" and explain in "notes" why it's hard to determine.
      2. If you can identify the food, provide your best calorie and macro estimates.
      3. Break down each identifiable item separately in the "items" array.
      4. Always be honest about uncertainty — these are estimates, not exact values.

      Return ONLY a JSON object in this exact format:
      {
        "name": "Overall description of the meal",
        "confidence": "high" | "medium" | "low",
        "items": [
          { "name": "Item 1", "calories": 0, "protein": 0, "carbs": 0, "fat": 0, "portion": "estimated portion size" }
        ],
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0,
        "notes": "Any caveats or observations about accuracy",
        "suggestions": ["Foods that work well for photo calorie tracking"]
      }
      Do not include any other text or markdown code blocks.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");

    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Food Analysis Error:", error);
    return null;
  }
};

export const generateMealPlan = async (preferences: any) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';
    const duration = preferences.duration || '7';
    const countryLine = preferences.country ? `Country/Cuisine Preference: ${preferences.country}` : '';
    const ethnicLine = preferences.ethnicGroup ? `Ethnic/Cultural Food Preferences: ${preferences.ethnicGroup}` : '';

    const prompt = `
      Create a detailed ${duration}-day meal plan (Breakfast, Lunch, Dinner, and 1-2 Snacks per day) based on these preferences:
      Goal: ${preferences.goal}
      Diet Type: ${preferences.dietType}
      Calories Target: ${preferences.caloriesPerDay} per day
      Allergies/Dislikes: ${preferences.allergies || 'None'}
      ${countryLine}
      ${ethnicLine}

      REQUIREMENTS:
      - Provide variety — do NOT repeat the same meals across different days
      - Include estimated calorie counts for each meal and a daily total
      - If a country or ethnic cuisine is specified, tailor meals to that cuisine
      - Use realistic, easy-to-prepare meals
      - Format as a clean, readable text plan organized by Day (Day 1, Day 2, etc.)
      - Do NOT use markdown symbols (*, #, **) — use plain text with line breaks
      - End with a brief "Shopping Essentials" section listing key ingredients needed
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION
      }
    });

    return response.text;
  } catch (error) {
    console.error("Meal Plan Error:", error);
    return "Unable to generate meal plan at this time.";
  }
};

export const improveDietPlan = async (currentPlan: string, goal: string) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';

    const prompt = `
            I have this meal plan: 
            """
            ${currentPlan}
            """
            My goal is: ${goal}.

            Please analyze this plan. 
            1. Provide a short critique (what is good, what is missing).
            2. Provide a REVISED version of the plan that implements your improvements.

            Return ONLY a JSON object with this structure:
            {
                "critique": "string",
                "revisedPlan": "string"
            }
        `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const text = response.text;
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Diet Improvement Error", error);
    return null;
  }
}

// --- Chat Support Service ---

export const chatWithSupport = async (
  message: string,
  userContext: { userName: string; plan: string; trialActive: boolean; trialDaysLeft: number; weightLogs?: string },
  chatHistory: { role: string; text: string }[]
) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';

    const historyFormatted = chatHistory.slice(-6).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const systemPrompt = `You are the LifeScope AI assistant. You help users navigate the LifeScope app and answer questions about their data and features.

User Info: Name is ${userContext.userName}, Plan: ${userContext.plan}, Trial Active: ${userContext.trialActive}, Trial Days Left: ${userContext.trialDaysLeft}.
${userContext.weightLogs ? `Recent Weight Logs: ${userContext.weightLogs}` : ''}

App Features:
- Dashboard: Overview of goals and progress
- Goals: Create and track personal goals with activities
- Finance Manager: Upload bank statements (CSV), view spending charts, AI budget analysis
- Health & Wellness: Weight tracking, food logging, meal plans, health consultant
- Document Tools: PDF signing, annotation, merging, AI summarization
- Settings: Profile, plan management, account deletion

Keep responses concise and helpful. Do not use markdown formatting. If you cannot help with an issue, suggest the user clicks "Send to Support" to escalate.`;

    const chat = ai.chats.create({
      model,
      history: historyFormatted,
      config: {
        systemInstruction: systemPrompt
      }
    });

    const result = await chat.sendMessage({ message });
    return result.text || "I'm not sure about that. Would you like me to send your question to our support team?";
  } catch (error) {
    console.error("Chat Support Error:", error);
    throw error;
  }
}

// --- Health Consultant Services ---

export const parseHealthReport = async (base64Image: string) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';

    const prompt = `
      You are an expert medical data extractor. 
      Read the following health/lab report image carefully.
      Extract the test parameters and their values.
      
      Return ONLY a JSON array of objects in this exact format:
      [
        { "key": "Parameter Name (e.g. WBC, Cholesterol)", "value": "Value (e.g. 5.2)" }
      ]
      
      RULES:
      1. ONLY return the JSON array. No markdown blocks, no other text.
      2. If you cannot read the image or it is not a health report, return an empty array: []
    `;

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return [];

    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Parse Report Error:", error);
    return [];
  }
};

export const interpretTestResults = async (testData: { testType: string; results: Record<string, any> }) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';

    const prompt = `
      Interpret these medical test results in plain language:
      
      Test Type: ${testData.testType}
      Results: ${JSON.stringify(testData.results)}
      
      For each value:
      1. Explain what it measures
      2. Whether the value is normal, low, or high
      3. What this means for the patient's health
      4. Simple lifestyle recommendations if values are abnormal
      
      Use plain language a non-medical person can understand.
      Do NOT use markdown formatting.
      Write in clear paragraphs.
    `;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: "You are a health information assistant. Explain test results clearly. Always include the disclaimer at the end."
      }
    });

    const disclaimer = "\n\nDISCLAIMER: This is not medical advice. The information provided is for educational purposes only. Always consult a qualified healthcare provider for medical decisions.";
    return (response.text || "Unable to interpret results.") + disclaimer;
  } catch (error) {
    console.error("Test Interpretation Error:", error);
    return "Error interpreting test results. Please try again.";
  }
}

export const healthChat = async (
  message: string,
  healthContext: {
    weightLogs?: any[];
    foodLogs?: any[];
    measurements?: any[];
    testResults?: any[];
  },
  chatHistory: { role: string; text: string }[]
) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';

    const contextSummary = [];
    if (healthContext.weightLogs?.length) {
      const latest = healthContext.weightLogs[0];
      contextSummary.push(`Latest weight: ${latest.weight_kg}kg on ${latest.date}`);
    }
    if (healthContext.measurements?.length) {
      const latest = healthContext.measurements[0];
      contextSummary.push(`Latest measurements: Arm ${latest.arm_cm}cm, Waist ${latest.waist_cm}cm`);
    }
    if (healthContext.testResults?.length) {
      contextSummary.push(`Recent test: ${healthContext.testResults[0].test_type} on ${healthContext.testResults[0].test_date}`);
    }

    const historyFormatted = chatHistory.slice(-6).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const systemPrompt = `You are a health and wellness consultant within the LifeScope app. You have access to the user's health data:
${contextSummary.join('\n')}

Provide helpful health guidance based on their data. Be supportive and encouraging.
Do NOT use markdown formatting.
ALWAYS end your response with this disclaimer on a new line:
"Note: This is not medical advice. Please consult a healthcare professional for medical decisions."`;

    const chat = ai.chats.create({
      model,
      history: historyFormatted,
      config: {
        systemInstruction: systemPrompt
      }
    });

    const result = await chat.sendMessage({ message });
    return result.text || "I'm not sure about that. Please consult a healthcare professional.";
  } catch (error) {
    console.error("Health Chat Error:", error);
    return "Error processing your health question. Please try again.";
  }
}

export const chatWithDocument = async (
  message: string,
  documentText: string,
  chatHistory: { role: string; text: string }[]
) => {
  try {
    const ai = getAI();
    const model = 'gemini-2.0-flash';

    // Truncate document text to avoid token limits
    const truncatedDoc = documentText.slice(0, 30000);

    const historyFormatted = chatHistory.slice(-8).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const systemPrompt = `You are a document analysis assistant. The user has uploaded a document and wants to ask questions about it.

DOCUMENT CONTENT:
---
${truncatedDoc}
---

Answer the user's questions based ONLY on the document content above. If the answer is not in the document, say so clearly.
Be concise and helpful. Do not use markdown formatting.
If the user asks you to summarize, extract data, find specific information, or explain sections, do so based on the document.`;

    const chat = ai.chats.create({
      model,
      history: historyFormatted,
      config: {
        systemInstruction: systemPrompt
      }
    });

    const result = await chat.sendMessage({ message });
    return result.text || "I couldn't process that question. Please try again.";
  } catch (error) {
    console.error("Document Chat Error:", error);
    throw error;
  }
}
