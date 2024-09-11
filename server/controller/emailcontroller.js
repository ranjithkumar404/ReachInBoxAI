// /server/controllers/emailController.js
const { oauth2Client } = require('../utils/gconfig');
const axios = require('axios');
const { google } = require('googleapis');
const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
const geminiApiKey = process.env.GEMINI_API_KEY;
const geminiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${geminiApiKey}`;

async function fetchEmails() {
    try {
        const res = await gmail.users.messages.list({
            userId: 'me',
            maxResults: 10, // Adjust as needed
        });

        const messages = res.data.messages || [];
        for (const message of messages) {
            const email = await getMessage(message.id);
            await processEmail(email);
        }
    } catch (error) {
        console.error('Error fetching messages:', error);
    }
}

async function getMessage(messageId) {
    const res = await gmail.users.messages.get({
        userId: 'me',
        id: messageId,
    });

    return res.data;
}

async function processEmail(email) {
    try {
        const response = await axios.post(geminiEndpoint, {
            content: email.snippet // or email.payload.parts[0].body.data for full content
        }, {
            headers: { 'Authorization': `Bearer ${geminiApiKey}` }
        });

        const context = response.data.generatedContent; // Extracted content from Gemini API
        const label = categorizeEmail(context);
        await labelEmail(email.id, label);
        const reply = generateReply(context);
        await sendReply(email.threadId, reply);
    } catch (error) {
        console.error('Error processing email:', error);
    }
}

function categorizeEmail(context) {
    // Implement your logic for categorizing the email based on context
    if (context.includes('interested')) return 'Interested';
    if (context.includes('not interested')) return 'Not Interested';
    return 'More Information';
}

async function labelEmail(messageId, label) {
    // Add the label ID you created in Gmail API console
    await gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        resource: {
            addLabelIds: [label], // Add your label ID here
        },
    });
}

function generateReply(context) {
    // Implement your logic to generate a reply based on the email context
    if (context.includes('interested')) {
        return 'Thank you for your interest! Would you be available for a demo call? Please suggest a time.';
    }
    return 'Thank you for your email. We will get back to you shortly.';
}

async function sendReply(threadId, reply) {
    await gmail.users.messages.send({
        userId: 'me',
        resource: {
            threadId,
            raw: Buffer.from(reply).toString('base64'),
        },
    });
}

module.exports = {
    fetchEmails,
};
