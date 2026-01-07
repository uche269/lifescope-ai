import { GoogleGenAI, Type } from "@google/genai";

// Helper to initialize AI with dynamic key
const getAI = () => {
    const storedKey = localStorage.getItem('ls_gemini_key');
    const apiKey = storedKey || process.env.API_KEY || '';
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
    const model = 'gemini-3-flash-preview';
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
    const model = 'gemini-3-pro-preview'; 
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

export const chatWithAI = async (history: {role: string, parts: {text: string}[]}[], message: string) => {
    try {
        const ai = getAI();
        const model = 'gemini-3-flash-preview';
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
        const model = 'gemini-2.5-flash-native-audio-preview-12-2025';
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
    const model = 'gemini-3-pro-preview'; // Using Pro for deeper reasoning
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
    const model = 'gemini-2.5-flash-preview-09-2025';
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
    const model = 'gemini-3-pro-preview';
    
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
        const model = 'gemini-3-pro-preview'; // High reasoning model for strategy

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
            model,
            contents: prompt,
            config: {
                // High thinking budget for deep analysis
                thinkingConfig: { thinkingBudget: 1024 } 
            }
        });

        return response.text;
    } catch (error) {
        console.error("Annual Report Error:", error);
        return "Unable to generate report. Please try again later.";
    }
}

// --- Health & Nutrition Services ---

export const analyzeFoodImage = async (base64Image: string) => {
  try {
    const ai = getAI();
    // Use gemini-3-flash-preview for vision/multimodal capabilities
    const model = 'gemini-3-flash-preview';
    
    const prompt = `
      Analyze the food in this image.
      Estimate the calories, protein (g), carbs (g), and fat (g).
      Return ONLY a JSON object in this format:
      {
        "name": "Description of food",
        "calories": 0,
        "protein": 0,
        "carbs": 0,
        "fat": 0
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
    
    // Clean potential markdown just in case (though responseMimeType should handle it)
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
    const model = 'gemini-3-pro-preview';

    const prompt = `
      Create a 1-day meal plan (Breakfast, Lunch, Dinner, Snack) based on these preferences:
      Goal: ${preferences.goal}
      Diet Type: ${preferences.dietType}
      Calories Target: ${preferences.caloriesPerDay}
      Allergies/Dislikes: ${preferences.allergies}

      Format the output as a clean list without Markdown symbols (*, #).
      Include calorie counts for each meal.
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
        const model = 'gemini-3-pro-preview';
        
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