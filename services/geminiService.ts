import api from './api';
import { logError } from '../utils/debugLogger';

// Helper to pass dynamic key if user set it
const getHeaders = () => {
  const storedKey = localStorage.getItem('ls_gemini_key');
  return storedKey ? { 'x-gemini-key': storedKey } : {};
};

export const getAIRecommendation = async (goalTitle: string, currentStatus: string) => {
  try {
    const res = await api.post('/ai/recommendation', { goalTitle, currentStatus }, { headers: getHeaders() });
    return res.data.text;
  } catch (error) {
    console.error("AI Recommendation Error:", error);
    return "Unable to generate recommendations. Please check your AI Quota or API Key.";
  }
};

export const generateScenarioScript = async (scenario: string, level: 'Beginner' | 'Advanced') => {
  try {
    const res = await api.post('/ai/scenario', { scenario, level }, { headers: getHeaders() });
    return res.data.text;
  } catch (error) {
    console.error("Scenario Gen Error:", error);
    return "Error generating scenario. Please check your AI Quota or API Key.";
  }
};

export const chatWithAI = async (history: { role: string, parts: { text: string }[] }[], message: string) => {
  try {
    const res = await api.post('/ai/chat', { history, message }, { headers: getHeaders() });
    return res.data.text;
  } catch (error) {
    return "I'm having trouble connecting. Please check your AI Quota or API Key.";
  }
}

export const analyzeVoice = async (audioBase64: string) => {
  try {
    const res = await api.post('/ai/voice', { audioBase64 }, { headers: getHeaders() });
    return res.data.text;
  } catch (error) {
    console.error("Voice Analysis Error", error);
    return "Could not analyze audio. Please ensure you have a valid Gemini API Key or enough Quota.";
  }
}

export const getWeeklyBriefing = async (topic: 'Sports' | 'History' | 'Finance') => {
  try {
    const res = await api.post('/ai/briefing', { topic }, { headers: getHeaders() });
    return res.data.text;
  } catch (error) {
    console.error("Briefing Error:", error);
    return "Unable to fetch briefing data. Please check your Quota or API Key.";
  }
};

export const analyzeDocument = async (base64Data: string, mimeType: string) => {
  try {
    const res = await api.post('/ai/document', { base64Data, mimeType }, { headers: getHeaders() });
    return res.data.text;
  } catch (error) {
    console.error("Doc Analysis Error:", error);
    return "Error analyzing document. Please check your Quota or API Key.";
  }
};

export const analyzeUrl = async (url: string) => {
  try {
    const res = await api.post('/ai/url', { url }, { headers: getHeaders() });
    return res.data.text;
  } catch (error) {
    console.error("URL Analysis Error:", error);
    return "Unable to analyze website. Please ensure your Quota is not exceeded or your key supports grounding.";
  }
};

// --- Annual Report Service ---

export const generateAnnualReport = async (userData: any) => {
  try {
    const res = await api.post('/ai/annual-report', { userData }, { headers: getHeaders() });
    return res.data.text;
  } catch (error: any) {
    logError("API / Quota Error generating Report", { message: error.message, details: error });
    return `AI Error: Unable to generate report. Max Quota reached?`;
  }
}

// --- Health & Nutrition Services ---

export const analyzeFoodImage = async (base64Image: string) => {
  try {
    const res = await api.post('/ai/food-image', { base64Image }, { headers: getHeaders() });
    return res.data;
  } catch (error) {
    console.error("Food Analysis Error:", error);
    return null;
  }
};

export const generateMealPlan = async (preferences: any) => {
  try {
    const res = await api.post('/ai/meal-plan', { preferences }, { headers: getHeaders() });
    return res.data.text;
  } catch (error) {
    console.error("Meal Plan Error:", error);
    return "Unable to generate meal plan at this time.";
  }
};

export const improveDietPlan = async (currentPlan: string, goal: string, userComments: string = "") => {
  try {
    const res = await api.post('/ai/improve-diet', { currentPlan, goal, userComments }, { headers: getHeaders() });
    return res.data;
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
    const res = await api.post('/ai/chat-support', { message, userContext, chatHistory }, { headers: getHeaders() });
    return res.data.text;
  } catch (error) {
    console.error("Chat Support Error:", error);
    return "I'm having trouble connecting to support AI.";
  }
}

// --- Health Consultant Services ---

export const parseHealthReport = async (base64Image: string, mimeType: string = 'image/jpeg') => {
  try {
    const res = await api.post('/ai/health-parse', { base64Image, mimeType }, { headers: getHeaders() });
    return res.data.results || [];
  } catch (error) {
    console.error("Parse Report Error:", error);
    return [];
  }
};

export const interpretTestResults = async (testData: { testType: string; results: Record<string, any> }) => {
  try {
    const res = await api.post('/ai/health-interpret', { testData }, { headers: getHeaders() });
    return res.data.text;
  } catch (error) {
    console.error("Test Interpretation Error:", error);
    return "Error interpreting test results. Please try again or check your API quota.";
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
    // Reusing the chat-support endpoint but passing health Context as userContext could work, 
    // OR create a dedicated health-chat proxy. Since we already have /api/ai/chat-support, 
    // we can add a specific health chat endpoint. Let's send it to a dedicated endpoint, 
    // or just pass the full prompt to a generic chat endpoint. 
    // Actually, creating a new endpoint `ai/health-chat` in backend is better, or we can just pass the formatted history to `/api/ai/chat` 
    // and rely on backend's simple model. Let's do that for now.

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

    const systemPrompt = `You are a health and wellness consultant within the LifeScope app. You have access to the user's health data:\n${contextSummary.join('\n')}\nProvide helpful health guidance based on their data. Be supportive and encouraging.\nDo NOT use markdown formatting.\nALWAYS end your response with this disclaimer on a new line:\n"Note: This is not medical advice. Please consult a healthcare professional for medical decisions."`;

    const historyFormatted = chatHistory.slice(-6).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    // Reusing the generic chat endpoint but prepending the system instruction as the first message to simulate config 
    // (since our /api/ai/chat only takes history and message and uses a fixed system prompt).
    // Actually, we can add a systemInstruction field to /api/ai/chat
    const res = await api.post('/ai/chat', {
      history: historyFormatted,
      message,
      systemInstructionOverride: systemPrompt
    }, { headers: getHeaders() });

    return res.data.text;
  } catch (error) {
    console.error("Health Chat Error:", error);
    return "Error processing your health question. Please check your Quota.";
  }
}

export const chatWithDocument = async (
  message: string,
  documentText: string,
  chatHistory: { role: string; text: string }[]
) => {
  try {
    const truncatedDoc = documentText.slice(0, 30000);
    const historyFormatted = chatHistory.slice(-8).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    }));

    const systemPrompt = `You are a document analysis assistant. The user has uploaded a document and wants to ask questions about it.\n\nDOCUMENT CONTENT:\n---\n${truncatedDoc}\n---\n\nAnswer the user's questions based ONLY on the document content above. If the answer is not in the document, say so clearly.\nBe concise and helpful. Do not use markdown formatting.\nIf the user asks you to summarize, extract data, find specific information, or explain sections, do so based on the document.`;

    const res = await api.post('/ai/chat', {
      history: historyFormatted,
      message,
      systemInstructionOverride: systemPrompt
    }, { headers: getHeaders() });

    return res.data.text;
  } catch (error) {
    console.error("Document Chat Error:", error);
    throw error;
  }
}

export const generateReport = async (
  prompt: string,
  documentText?: string,
  format: 'pdf' | 'docx' | 'xlsx' | 'pptx' = 'pdf',
  templateText?: string
) => {
  try {
    const res = await api.post('/ai/report-gen', { prompt, documentText, format, templateText }, { headers: getHeaders() });
    return res.data.text;
  } catch (error) {
    console.error("Report Generation Error:", error);
    throw error;
  }
}
