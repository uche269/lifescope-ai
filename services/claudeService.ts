import Anthropic from '@anthropic-ai/sdk';

const getClaude = () => {
    const apiKey = localStorage.getItem('ls_anthropic_key') || '';
    if (!apiKey) throw new Error("Anthropic API Key not found");

    return new Anthropic({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true // Required for client-side usage if not using a proxy
    });
};

export const generateAnnualReportClaude = async (userData: any) => {
    try {
        const anthropic = getClaude();

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

        const msg = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 2000,
            temperature: 0.7,
            system: "You are a professional strategic coach. Output plain text only. No markdown formatting.",
            messages: [
                { role: "user", content: prompt }
            ]
        });

        // Helper to extract text from ContentBlock
        const getText = (block: Anthropic.ContentBlock): string => {
            if (block.type === 'text') {
                return block.text;
            }
            return '';
        };

        return msg.content.map(getText).join('\n');

    } catch (error: any) {
        console.error("Claude Report Error:", error);
        return `Unable to generate report with Claude. Error: ${error.message || 'Unknown error'}. Please check your API Key in Settings.`;
    }
}
