const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const getGenerativeModel = (modelName = 'gemini-1.5-flash') => {
    return genAI.getGenerativeModel({ 
        model: modelName,
        generationConfig: {
            temperature: 0.9,
            topP: 1,
            topK: 32,
            maxOutputTokens: 4096,
        }
    });
};

module.exports = {
    getGenerativeModel
};