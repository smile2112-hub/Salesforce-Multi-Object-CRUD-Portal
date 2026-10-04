# Salesforce CRUD Dashboard

This project is a beginner-friendly web application that connects to Salesforce using OAuth 2.0 and allows CRUD operations on the standard Salesforce objects Account, Opportunity, Lead, Contact, and Case.

## Assignment compliance summary

This app includes:

- Salesforce login button
- object selector dropdown with 5 standard objects
- dynamic field loading for each object
- create, read, update, and delete flows
- pagination with 20 records per batch
- scroll-based loading for the next records
- React frontend and Node.js backend
- OAuth 2.0 authentication using a Salesforce Connected App / External Client App

## Tech stack

- React 18
- Vite
- Express.js
- Salesforce REST API
- OAuth 2.0

## Final setup instructions for submission

### 1. Create the Salesforce Developer Org

1. Go to Salesforce Developer signup.
2. Create a fresh Developer Edition org.
3. Sign in to the org.
4. Open Setup.

### 2. Create the Connected App / External Client App

1. In Salesforce Setup, search for Connected Apps.
2. Create a new Connected App.
3. Enable OAuth settings.
4. Add callback URL:
   - local testing: `http://localhost:5000/api/auth/callback`
   - production: `https://your-deployed-url/api/auth/callback`
5. Add OAuth scopes such as:
   - `api`
   - `refresh_token`
   - `full`
6. Save the app.
7. Copy the Consumer Key and Consumer Secret.

### 3. Configure local environment

Rename `.env.example` to `.env` and fill in the values:

```env
PORT=5000
CLIENT_URL=http://localhost:5173
SF_LOGIN_URL=https://login.salesforce.com
SF_CLIENT_ID=your_salesforce_client_id
SF_CLIENT_SECRET=your_salesforce_client_secret
SF_CALLBACK_URL=http://localhost:5000/api/auth/callback
```

### 4. Install dependencies

```bash
npm install
```

### 5. Run the app locally

```bash
npm run dev
```

Then open:

```text
http://localhost:5173
```

### 6. Verify live behavior locally

Before deployment, test:

- login button works
- object dropdown loads all 5 objects
- object fields display dynamically
- records appear
- create a record works
- update a record works
- delete a record works
- scroll loads the next 20 records

## Production deployment instructions

Use a free hosting service such as Render or Railway.

### Option: Render

1. Push the project to GitHub.
2. Create a new Web Service on Render.
3. Connect the repository.
4. Set Build Command:

```bash
npm install && npm run build
```

5. Set Start Command:

```bash
npm start
```

6. Add environment variables in Render:

```env
PORT=10000
CLIENT_URL=https://your-render-app.onrender.com
SF_LOGIN_URL=https://login.salesforce.com
SF_CLIENT_ID=your_salesforce_client_id
SF_CLIENT_SECRET=your_salesforce_client_secret
SF_CALLBACK_URL=https://your-render-app.onrender.com/api/auth/callback
```

> The Salesforce callback URL must exactly match the deployed callback URL. If the callback URL does not match, OAuth login fails.

### Important deployment note

The app is built as a single Express backend + Vite frontend project. The backend serves the frontend build when it is deployed in production.

## Submission checklist

Before sending the assignment, confirm you have:

- [ ] Salesforce Developer Org created
- [ ] Connected App created
- [ ] OAuth 2.0 working
- [ ] CRUD working for Account, Opportunity, Lead, Contact, and Case
- [ ] 20-record pagination working
- [ ] GitHub repository link ready
- [ ] public deployment link ready
- [ ] resume updated
- [ ] final email prepared to careers@cloudvandana.com

## Final submission email contents

Send:

- deployed application link
- GitHub repository link
- updated resume
- email to: careers@cloudvandana.com

## Notes

This project is intentionally simple and beginner-friendly. It is designed for a fresher-level assignment and avoids unnecessary complexity. The real Salesforce credentials and public deployment link are required for the final submission to be valid.
