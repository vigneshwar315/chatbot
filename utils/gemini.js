const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set in environment variables.');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const getEmbeddingModel = () => {
    // text-embedding-004 is a good general-purpose embedding model
    // gemini-embedding-exp-03-07 might also be an option if available and suited for your region/needs
    return genAI.get  ;
};

const getGenerativeModel = () => {
    // gemini-1.5-flash is a fast and cost-effective model, good for many chat applications
    // gemini-1.5-pro offers higher quality for more complex tasks
    return genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
};

module.exports = {
    getEmbeddingModel,
    getGenerativeModel,
};