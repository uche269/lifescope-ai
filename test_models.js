import dotenv from 'dotenv';
dotenv.config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log('GEMINI_API_KEY exists:', !!GEMINI_API_KEY);
console.log('GEMINI_API_KEY length:', GEMINI_API_KEY?.length);
console.log('GEMINI_API_KEY first 10 chars:', GEMINI_API_KEY?.slice(0, 10));

async function testEndpoint() {
    try {
        console.log('\n--- Test 1: Import @google/genai ---');
        const { GoogleGenAI } = await import('@google/genai');
        console.log('Import successful');

        console.log('\n--- Test 2: Create AI instance ---');
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
        console.log('AI instance created');

        console.log('\n--- Test 3: Call gemini-2.5-flash ---');
        const response1 = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'Say "hello flash" in one word',
        });
        console.log('Flash response:', response1.text);

        console.log('\n--- Test 4: Call gemini-2.5-pro ---');
        const response2 = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: 'Say "hello pro" in one word',
        });
        console.log('Pro response:', response2.text);

        console.log('\n--- Test 5: Call with systemInstruction (like recommendation endpoint) ---');
        const SYSTEM_INSTRUCTION = `You are a personal AI Goal Tracker. Your output should be clear and concise.`;
        const response3 = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: 'I have a goal: "Learn coding". Current status: In Progress. Give me 2 tips.',
            config: { systemInstruction: SYSTEM_INSTRUCTION }
        });
        console.log('Recommendation response:', response3.text?.slice(0, 100));

        console.log('\n--- Test 6: Chat mode (like chat-support endpoint) ---');
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            history: [],
            config: {
                systemInstruction: 'You are a helpful assistant. Reply in one sentence.'
            }
        });
        const chatResult = await chat.sendMessage({ message: 'Hello, how are you?' });
        console.log('Chat response:', chatResult.text?.slice(0, 100));

        console.log('\n=== ALL TESTS PASSED ===');
    } catch (error) {
        console.error('\n=== TEST FAILED ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Full error:', JSON.stringify(error, null, 2).slice(0, 500));
    }
}

testEndpoint();
