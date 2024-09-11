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


app.get('/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    
    res.status(200).json({ message: 'Authentication successful', tokens });
  } catch (error) {
    res.status(500).json({ message: 'Error during authentication', error });
  }
});


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
  
     
      const existingLabel = labels.find(label => label.name === labelName);
  
      if (existingLabel) {
        return existingLabel.id; 
      }
  
     
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
          threadId: messageId,
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
  
      
      const response = await gmail.users.messages.list({
        userId: 'me',
        maxResults: 1,
        q: '',
      });
  
      const messages = response.data.messages || [];
      if (messages.length === 0) {
        return res.status(200).json({ message: 'No emails found' });
      }
  
    
      const latestMessage = messages[0];
      const msg = await gmail.users.messages.get({ userId: 'me', id: latestMessage.id });
  

      const emailContent = msg.data.payload.parts
        ? msg.data.payload.parts.map(part => Buffer.from(part.body.data, 'base64').toString()).join('')
        : Buffer.from(msg.data.payload.body.data, 'base64').toString();
  
      const recipientEmail = msg.data.payload.headers.find(header => header.name === 'From').value;
      const subject = msg.data.payload.headers.find(header => header.name === 'Subject').value;
  
      
      const prompt = `Categorize the following email content: "${emailContent}"`;
      const result = await model.generateContent(prompt);
      const category = categorizeEmail(result.response.text());
  
   
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
  
      
      const labelId = await getLabelId(gmail, labelName);
  
    
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

      await sendReply(gmail, latestMessage.threadId, recipientEmail, subject, replyText);
  
      res.status(200).json({ message: `Email categorized as ${category}, labeled and replied to successfully.` });
    } catch (error) {
      console.log('Error:', error.message);
      res.status(500).json({ message: 'Error fetching, categorizing, and replying to the latest email', error: error.message });
    }
  });
  
  
  function categorizeEmail(responseText) {
 
    if (responseText.includes('interested')) return 'Interested';
    if (responseText.includes('not interested')) return 'Not Interested';
    return 'More Information';
  }

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});