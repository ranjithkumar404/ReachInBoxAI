require('dotenv').config();
const express = require('express');
const { google } = require('googleapis');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const app = express();
app.use(cors());

const OAuth2 = google.auth.OAuth2;
const oauth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
// Route to initiate OAuth2 flow
app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.modify'
      ]
  });
  res.redirect(authUrl);
});

// OAuth2 callback route
app.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Store tokens and other user data as needed
    res.status(200).json({ message: 'Authentication successful', tokens });
  } catch (error) {
    res.status(500).json({ message: 'Error during authentication', error });
  }
});

// Route to fetch emails
app.get('/fetch-emails', async (req, res) => {
  try {
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.list({ userId: 'me', maxResults: 10 });
    const messages = response.data.messages || [];

    const emailData = await Promise.all(messages.map(async (message) => {
      const msg = await gmail.users.messages.get({ userId: 'me', id: message.id });
      return msg.data;
    }));

    res.status(200).json(emailData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching emails', error });
  }
});

const createLabel = async (gmail, labelName) => {
    try {
      const response = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show'
        }
      });
      return response.data.id;
    } catch (error) {
      if (error.code === 409) {
        // Label already exists
        console.log(`Label "${labelName}" already exists.`);
        return null;
      }
      throw error;
    }
  };
  
  const getLabelId = async (gmail, labelName) => {
    try {
      const labelList = await gmail.users.labels.list({ userId: 'me' });
      const labels = labelList.data.labels || [];
  
      // Check if the label already exists
      const existingLabel = labels.find(label => label.name === labelName);
  
      if (existingLabel) {
        return existingLabel.id; // Return existing label ID
      }
  
      // If label doesn't exist, create a new one
      const response = await gmail.users.labels.create({
        userId: 'me',
        requestBody: {
          name: labelName,
          labelListVisibility: 'labelShow',
          messageListVisibility: 'show',
        },
      });
      return response.data.id;
    } catch (error) {
      throw new Error(`Error fetching or creating label: ${error.message}`);
    }
  };
  
  const sendReply = async (gmail, messageId, recipientEmail, subject, replyText) => {
    try {
      const rawMessage = [
        `From: me`,
        `To: ${recipientEmail}`,
        `Subject: Re: ${subject}`,
        '',
        replyText,
      ].join('\n');
  
      const encodedMessage = Buffer.from(rawMessage).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: messageId, // Sends the reply in the same thread as the original email
        },
      });
  
      console.log(`Reply sent to ${recipientEmail}`);
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };
  
  app.get('/fetch-latest-email', async (req, res) => {
    try {
      const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
      // Fetch the latest email (limit to 1 email, regardless of read status)
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 1,
        q: '', // No filter, fetches the most recent email
      });
  
      const messages = response.data.messages || [];
      if (messages.length === 0) {
        return res.status(200).json({ message: 'No emails found' });
      }
  
      // Get the latest email's details
      const latestMessage = messages[0];
      const msg = await gmail.users.messages.get({ userId: 'me', id: latestMessage.id });
  
      // Extract the email body
      const emailContent = msg.data.payload.parts
        ? msg.data.payload.parts.map(part => Buffer.from(part.body.data, 'base64').toString()).join('')
        : Buffer.from(msg.data.payload.body.data, 'base64').toString();
  
      const recipientEmail = msg.data.payload.headers.find(header => header.name === 'From').value;
      const subject = msg.data.payload.headers.find(header => header.name === 'Subject').value;
  
      // Analyze email content using Gemini API
      const prompt = `Categorize the following email content: "${emailContent}"`;
      const result = await model.generateContent(prompt);
      const category = categorizeEmail(result.response.text());
  
      // Determine the label and the reply based on the category
      let labelName, replyText;
      if (category === 'Interested') {
        labelName = 'Interested';
        replyText = 'Thank you for your interest! We will get back to you with more details shortly.';
      } else if (category === 'Not Interested') {
        labelName = 'Not Interested';
        replyText = 'Thank you for your message, but we are not interested at the moment.';
      } else if (category === 'More Information') {
        labelName = 'More Information';
        replyText = 'Thank you for reaching out! Can you please provide more information or clarify your request?';
      }
  
      // Fetch or create the label and get its ID
      const labelId = await getLabelId(gmail, labelName);
  
      // Apply label to the latest email, checking if the label is already applied
      const currentLabels = msg.data.labelIds || [];
      if (!currentLabels.includes(labelId)) {
        await gmail.users.messages.modify({
          userId: 'me',
          id: latestMessage.id,
          resource: {
            addLabelIds: [labelId],
          },
        });
      }
  
      // Send an automated reply based on the email category
      await sendReply(gmail, latestMessage.threadId, recipientEmail, subject, replyText);
  
      res.status(200).json({ message: `Email categorized as ${category}, labeled and replied to successfully.` });
    } catch (error) {
      console.log('Error:', error.message);
      res.status(500).json({ message: 'Error fetching, categorizing, and replying to the latest email', error: error.message });
    }
  });
  
  
  function categorizeEmail(responseText) {
    // Example categorization logic based on response text
    if (responseText.includes('interested')) return 'Interested';
    if (responseText.includes('not interested')) return 'Not Interested';
    return 'More Information';
  }

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});