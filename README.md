# ReachInbox-AI
# Email Categorization and Automated Response System

This project implements a backend system that integrates Gmail and Gemini API to:
1. **Fetch the most recent email**.
2. **Categorize the email** based on its content into one of three categories: `Interested`, `Not Interested`, or `More Information`.
3. **Label the email** accordingly within Gmail.
4. **Send an automated reply** to the sender based on the categorized content.

## Features
- **Email Fetching**: Retrieves the latest email received in the user's Gmail account.
- **Email Categorization**: Uses the Gemini API to understand the context of the email and assigns one of the three labels:
  - `Interested`
  - `Not Interested`
  - `More Information`
- **Email Labeling**: Automatically assigns labels to emails, creating new labels if necessary.
- **Automated Reply**: Sends pre-defined responses based on the categorized label.

## API Endpoints

### 1. Fetch, Categorize, and Respond to the Latest Email
- **Endpoint**: `/fetch-latest-email`
- **Method**: `GET`
- **Description**: 
    - Fetches the most recent email from the inbox.
    - Uses the Gemini API to categorize the email based on its content.
    - Labels the email with one of the categories (`Interested`, `Not Interested`, or `More Information`).
    - Sends an automated reply based on the assigned label.

### Sample Response
```json
{
  "message": "Email categorized as 'More Information', labeled and replied to successfully."
}


### Requirements

- **Node.js**: Ensure that Node.js is installed on your machine.
- **Gmail API OAuth 2.0 credentials**: Set up a project in the Google Developer Console and enable the Gmail API.
- **Gemini API Key**: Obtain an API key from the Gemini API provider to access the categorization functionality.

## Setup and Installation

### Clone the repository:
```bash
git clone https://github.com/your-repo/email-categorization-system.git
