
import OpenAI from 'openai';

const getOpenAI = () => {
    const apiKey = localStorage.getItem('ls_openai_key') || import.meta.env.VITE_OPENAI_API_KEY || '';
    if (!apiKey) throw new Error("OpenAI API Key not found");

    return new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Required for client-side usage if not using a proxy
    });
};

export const generateAnnualReportOpenAI = async (userData: any) => {
    try {
        const openai = getOpenAI();

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

        const response = await openai.chat.completions.create({
            model: "gpt-4-turbo-preview",
            messages: [
                { role: "system", content: "You are a professional strategic coach. Output plain text only. No markdown formatting." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
        });

        return response.choices[0].message.content || "No report generated.";

    } catch (error: any) {
        console.error("OpenAI Report Error:", error);
        return `Unable to generate report with OpenAI. Error: ${error.message || 'Unknown error'}. Please check your API Key in Settings.`;
    }
}
