import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: 'AIzaSyA_DUMMY_KEY_XYZ_1234567890' });

async function testModel(modelName) {
    try {
        console.log(`Testing model: ${modelName}...`);
        const response = await ai.models.generateContent({
            model: modelName,
            contents: 'Say hi',
        });
        console.log(`Success with ${modelName}:`, response.text);
    } catch (err) {
        console.error(`Error with ${modelName}:`, err.message);
    }
}

async function run() {
    await testModel('gemini-2.5-flash');
    await testModel('gemini-2.5-pro');
    await testModel('gemini-3.1-pro');
}

run();
