const fs = require('fs');
const util = require('util');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

const readFileAsync = util.promisify(fs.readFile);

// Extracts text content from a given file path based on its MIME type.
async function extractTextFromFile(filePath, mimeType) {
    let textContent = '';
    try {
        if (mimeType === 'application/pdf') {
            const dataBuffer = await readFileAsync(filePath);
            const data = await pdf(dataBuffer);
            textContent = data.text;
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { // .docx
            const { value } = await mammoth.extractRawText({ path: filePath });
            textContent = value;
        } else if (mimeType === 'text/plain') {
            textContent = await readFileAsync(filePath, 'utf8');
        } else {
            throw new Error(`Unsupported file type: ${mimeType}`);
        }
        return textContent;
    } catch (error) {
        console.error(`Error extracting text from file ${filePath}:`, error);
        throw error;
    }
}

module.exports = {
    extractTextFromFile,
};