const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid'); // For unique IDs for Chroma collections

require('dotenv').config(); // Load environment variables

// Import utility functions
const { getGenerativeModel } = require('./utils/gemini');
const { createAndStoreEmbeddings, retrieveSimilarDocuments, deleteChromaCollection } = require('./utils/vectorStore');
const { extractTextFromFile } = require('./utils/documentProcessor');

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors()); // Enable CORS for your frontend
app.use(express.json()); // Body parser for JSON requests

// Multer setup for file uploads
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        // Use a unique filename to avoid collisions
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/pdf',
            'text/plain',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only PDF, TXT, and DOCX files are allowed.'));
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB file size limit
});

// --- API Routes ---

/**
 * POST /api/upload-document
 * Uploads a document, extracts text, chunks it, generates embeddings,
 * and stores them in a new ChromaDB collection.
 * Returns a unique documentId (which is the Chroma collection name).
 */
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    const { path: filePath, mimetype, originalname } = req.file;
    const documentId = `doc-${uuidv4()}`; // Unique ID for this document's Chroma collection

    try {
        console.log(`Processing document: ${originalname}`);
        const textContent = await extractTextFromFile(filePath, mimetype);

        if (!textContent || textContent.trim().length === 0) {
            fs.unlink(filePath, (err) => { // Clean up temp file
                if (err) console.error('Error deleting temp file:', err);
            });
            return res.status(400).json({ message: 'Could not extract text from document or document is empty.' });
        }

        // Store embeddings in ChromaDB using the generated documentId as collection name
        await createAndStoreEmbeddings(textContent, documentId);

        // Respond with the unique ID that frontend can use for chat queries
        res.status(200).json({
            message: 'Document processed and ready for chat.',
            documentId: documentId,
            originalName: originalname,
        });

    } catch (error) {
        console.error('Error in /api/upload-document:', error);
        // Clean up temporary file and respond with error
        fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting temp file:', err);
        });
        res.status(500).json({ message: 'Failed to process document.', error: error.message });
    }
});

/**
 * POST /api/chat
 * Receives a user query and a documentId, retrieves relevant context from ChromaDB,
 * and generates a response using Gemini LLM.
 */
app.post('/api/chat', async (req, res) => {
    const { message, documentId } = req.body;

    if (!message || message.trim() === '') {
        return res.status(400).json({ message: 'Message cannot be empty.' });
    }
    if (!documentId) {
        return res.status(400).json({ message: 'documentId is required to chat with a specific document.' });
    }

    try {
        console.log(`Received chat query for document ${documentId}: "${message}"`);
        // 1. Retrieve relevant chunks from ChromaDB
        const relevantDocs = await retrieveSimilarDocuments(message, documentId);
        const context = relevantDocs.map(doc => doc.pageContent).join('\n\n');

        if (!context) {
            console.warn(`No relevant context found for document ${documentId} with query: "${message}"`);
            // If no context, provide a generic polite response
            return res.status(200).json({
                response: "I couldn't find relevant information in the provided document to answer your question. Could you please rephrase or ask about something else in the document?",
                sourceDocuments: []
            });
        }

        // 2. Prepare prompt for LLM
        const prompt = `You are a helpful AI assistant. Answer the user's question based *only* on the provided context.
        If the answer cannot be found in the context, politely state that you don't have enough information.

        Context:
        ${context}

        Question: ${message}`;

        // 3. Get response from Gemini LLM
        const generativeModel = getGenerativeModel();
        const result = await generativeModel.generateContent(prompt);
        const geminiResponse = result.response.text();

        res.status(200).json({
            response: geminiResponse,
            sourceDocuments: relevantDocs.map(doc => ({ content: doc.pageContent, metadata: doc.metadata })) // Optional: send source for transparency
        });

    } catch (error) {
        console.error('Error in /api/chat:', error);
        res.status(500).json({ message: 'Failed to get a response from the chatbot.', error: error.message });
    }
});

/**
 * DELETE /api/delete-document/:documentId
 * Deletes a ChromaDB collection associated with a document.
 */
app.delete('/api/delete-document/:documentId', async (req, res) => {
    const { documentId } = req.params;

    if (!documentId) {
        return res.status(400).json({ message: 'documentId is required to delete a document.' });
    }

    try {
        const success = await deleteChromaCollection(documentId);
        if (success) {
            res.status(200).json({ message: `Document (Chroma collection: ${documentId}) deleted successfully.` });
        } else {
            res.status(500).json({ message: `Failed to delete document (Chroma collection: ${documentId}). It might not exist.` });
        }
    } catch (error) {
        console.error(`Error deleting document ${documentId}:`, error);
        res.status(500).json({ message: 'Failed to delete document.', error: error.message });
    }
});


// Basic route for testing server
app.get('/', (req, res) => {
    res.send('RAG Chatbot Backend (Minimal) is running!');
});

// --- Start the server ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Ensure ChromaDB is running on', process.env.CHROMA_URL);
});