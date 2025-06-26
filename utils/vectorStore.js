const { Pinecone } = require('@pinecone-database/pinecone');
const { PineconeStore } = require('@langchain/pinecone');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
require('dotenv').config();

const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: 'text-embedding-004',
  taskType: 'RETRIEVAL_DOCUMENT',
});

const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

async function createAndStoreEmbeddings(documentText, documentId) {
  try {
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200
    });
    
    const docs = await splitter.createDocuments([documentText]);
    
    await PineconeStore.fromDocuments(docs, embeddings, {
      pineconeIndex: index,
      namespace: documentId,
    });
  } catch (error) {
    console.error('Error creating embeddings:', error);
    throw error;
  }
}

async function retrieveSimilarDocuments(query, namespace, k = 4) {
  try {
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex: index,
      namespace: namespace,
    });

    return await vectorStore.similaritySearch(query, k);
  } catch (error) {
    console.error('Error retrieving documents:', error);
    throw error;
  }
}

module.exports = {
  createAndStoreEmbeddings,
  retrieveSimilarDocuments,
};