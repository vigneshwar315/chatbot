// utils/vectorStore.js
const { Pinecone } = require('@pinecone-database/pinecone');
const { PineconeStore } = require('@langchain/pinecone');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
require('dotenv').config();

// ✅ Init Gemini Embeddings
const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY,
  modelName: 'text-embedding-004',
  taskType: 'RETRIEVAL_DOCUMENT',
});

// ✅ Init Pinecone Client
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

// ⚡️ Store Embeddings for Specific Document (namespace = documentId)
async function createAndStoreEmbeddings(documentText, documentId) {
  const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 200 });
  const docs = await splitter.createDocuments([documentText]);

  console.log(`Storing embeddings in namespace "${documentId}"...`);
  await PineconeStore.fromDocuments(docs, embeddings, {
    pineconeIndex: index,
    namespace: documentId,
  });
}

// ⚡️ Retrieve Similar Documents from Specific Namespace
async function retrieveSimilarDocuments(query, namespace, k = 4) {
  const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
    pineconeIndex: index,
    namespace: namespace,
  });
  const results = await vectorStore.similaritySearch(query, k);
  return results;
}

module.exports = {
  createAndStoreEmbeddings,
  retrieveSimilarDocuments,
};
