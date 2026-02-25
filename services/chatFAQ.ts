// FAQ-first pattern matching for chat widget
// This avoids AI API calls for common questions

interface FAQEntry {
    patterns: string[];
    answer: string;
}

const FAQ_DATABASE: FAQEntry[] = [
    {
        patterns: ['upload statement', 'bank statement', 'csv upload', 'upload csv', 'financial statement'],
        answer: "To upload your bank statement, go to Finance Manager from the sidebar, then click the 'Upload Statement' button. We support CSV files from most major banks."
    },
    {
        patterns: ['set goal', 'create goal', 'add goal', 'new goal'],
        answer: "To create a new goal, go to Goals from the sidebar and click the '+ New Goal' button. You can set a title, category, priority, and add activities to track."
    },
    {
        patterns: ['track weight', 'log weight', 'weight tracking', 'body measurement'],
        answer: "Go to Health & Wellness from the sidebar. Under the Metrics tab, you can log your weight, body measurements (arm, stomach, waist), and track changes over time with charts."
    },
    {
        patterns: ['meal plan', 'diet plan', 'nutrition plan', 'generate meal'],
        answer: "In Health & Wellness, go to the Diet Plan tab. Set your preferences (goal, diet type, calories, allergies) and click 'Generate Plan' to get an AI-powered meal plan."
    },
    {
        patterns: ['scan food', 'food photo', 'food image', 'photograph food', 'food camera'],
        answer: "In Health & Wellness, you can either take a photo with your camera or upload a food image. The AI will analyze it and estimate calories, protein, carbs, and fat."
    },
    {
        patterns: ['sign pdf', 'pdf signature', 'sign document', 'digital signature'],
        answer: "Go to Document Tools from the sidebar. Upload a PDF, then use the Sign tab to draw your signature and apply it to the document. You can then download the signed PDF."
    },
    {
        patterns: ['merge pdf', 'combine pdf', 'join pdf'],
        answer: "In Document Tools, go to the Merge tab. Upload multiple PDF files and click 'Merge' to combine them into a single document."
    },
    {
        patterns: ['summarize document', 'analyze pdf', 'pdf summary', 'document analysis'],
        answer: "In Document Tools, go to the AI Summary tab. Upload a PDF or paste a URL, and the AI will generate a comprehensive summary for you."
    },
    {
        patterns: ['upgrade', 'subscription', 'pro plan', 'premium plan', 'pricing', 'payment'],
        answer: "To upgrade your plan, go to Settings and look at your Profile card. You can click 'Upgrade Now' to unlock the Premium tier (₦5,000) for unlimited AI features."
    },
    {
        patterns: ['trial', 'free trial', 'trial period', 'trial ending'],
        answer: "Currently, you are on the Free plan, which has limited daily AI interactions. To remove limits and access the most advanced Gemini models, you can upgrade to Premium from your Settings page."
    },
    {
        patterns: ['delete account', 'remove account', 'close account'],
        answer: "To delete your account, go to Settings, scroll to the bottom, and click 'Delete Account'. This will permanently remove all your data. This action cannot be undone."
    },
    {
        patterns: ['health test', 'lab results', 'blood test', 'test results', 'medical test'],
        answer: "In Health & Wellness, go to the Health Consultant tab. You can enter your lab test results (blood work, lipid panel, etc.) and the AI will explain them in plain language and track trends."
    },
    {
        patterns: ['budget', 'spending', 'expenses', 'savings goal'],
        answer: "In Finance Manager, after uploading a statement, you'll see your spending breakdown by category. Click 'AI Analysis' for budget recommendations. You can also set savings goals and the AI will suggest areas to cut back."
    },
    {
        patterns: ['how does it work', 'what can you do', 'features', 'what is lifescope'],
        answer: "LifeScope AI is your personal life management platform. It includes: Goal tracking, Finance Manager (upload statements, track spending, AI budgets), Health & Wellness (weight tracking, meal plans, health consultant), and Document Tools (PDF viewer, signing, annotation). How can I help you today?"
    },
    {
        patterns: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'],
        answer: "Hello! I'm your LifeScope assistant. I can help you navigate the app, answer questions about your data, or explain any features. What would you like to know?"
    }
];

export function chatFAQ(query: string): string | null {
    const normalized = query.toLowerCase().trim();

    let bestMatch: FAQEntry | null = null;
    let bestScore = 0;

    for (const entry of FAQ_DATABASE) {
        for (const pattern of entry.patterns) {
            if (normalized.includes(pattern)) {
                const score = pattern.length / normalized.length;
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = entry;
                }
            }
        }
    }

    // Only return FAQ answer if we have a reasonably confident match
    return bestScore > 0.2 ? bestMatch?.answer || null : null;
}
