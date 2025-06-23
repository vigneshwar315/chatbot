// server.js
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

// Import utils
const { getGenerativeModel } = require('./utils/gemini');
const {
  createAndStoreEmbeddings,
  retrieveSimilarDocuments,
} = require('./utils/vectorStore');
const { extractTextFromFile } = require('./utils/documentProcessor');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, and DOCX files are allowed.'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ===================================================
// Route: Upload a Document
// ===================================================
app.post('/api/upload-document', upload.single('document'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const { path: filePath, mimetype, originalname } = req.file;
  const documentId = `doc-${uuidv4()}`;

  try {
    const textContent = await extractTextFromFile(filePath, mimetype);
    if (!textContent || textContent.trim().length === 0) {
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting temp file:', err);
      });
      return res
        .status(400)
        .json({ message: 'Could not extract text from the document.' });
    }

    await createAndStoreEmbeddings(textContent, documentId);
    res.status(200).json({
      message: 'Document processed and embeddings stored in Pinecone',
      documentId,
      originalName: originalname,
    });
  } catch (error) {
    fs.unlink(filePath, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });
    res.status(500).json({ message: 'Failed to process document.', error: error.message });
  }
});

// ===================================================
// Route: Chat (With or Without Document)
// ===================================================
app.post('/api/chat', async (req, res) => {
  const { message, documentId } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ message: 'Message cannot be empty.' });
  }

  try {
    if (documentId) {
      // Chat within uploaded Document
      const relevantDocs = await retrieveSimilarDocuments(message, documentId);
      const context = relevantDocs.map((doc) => doc.pageContent).join('\n\n');

      if (!context) {
        return res.status(200).json({
          response:
            "I couldn't find relevant information in this document.",
          sourceDocuments: [],
        });
      }

      const prompt = `You are a helpful AI assistant. Answer the user's question based *only* on the context.
Context:
${context}
Question: ${message}`;

      const generativeModel = getGenerativeModel();
      const result = await generativeModel.generateContent(prompt);
      const geminiResponse = result.response.text();

      res.status(200).json({
        response: geminiResponse,
        sourceDocuments: relevantDocs.map((doc) => ({
          content: doc.pageContent,
          metadata: doc.metadata,
        })),
      });
    } else {
      // Chat Normally (without Document Context)
      const prompt = `You are a helpful AI assistant. Answer the following question:
Question: ${message}`;

      const generativeModel = getGenerativeModel();
      const result = await generativeModel.generateContent(prompt);
      const geminiResponse = result.response.text();

      res.status(200).json({ response: geminiResponse });
    }
  } catch (error) {
    res.status(500).json({ message: 'Failed to get a response from the chatbot.', error: error.message });
  }
});

// ===================================================
// Route: Delete a Document
// ===================================================
app.delete('/api/delete-document/:documentId', async (req, res) => {
  const { documentId } = req.params;

  if (!documentId) {
    return res.status(400).json({ message: 'documentId is required.' });
  }

  try {
    // You can implement actual delete logic here if needed
    res
      .status(200)
      .json({ message: `Document ${documentId} delete request received.` });
  } catch (error) {
    res
      .status(500)
      .json({ message: 'Failed to delete the document.', error: error.message });
  }
});

// ===================================================
// Route: Root Route
// ===================================================
app.get('/', (req, res) => {
  res.send('RAG Chatbot Backend with Pinecone is running!');
});

// ===================================================
// Start the Server
// ===================================================
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
