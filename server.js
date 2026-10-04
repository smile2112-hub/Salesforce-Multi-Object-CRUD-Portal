const express = require('express');
const axios = require('axios');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const LOGIN_URL = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
const SALESFORCE_SCOPE = encodeURIComponent('api refresh_token full');

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const tokenStore = {
  accessToken: '',
  refreshToken: '',
  instanceUrl: '',
};

const isConfigured = Boolean(
  process.env.SF_CLIENT_ID &&
    process.env.SF_CLIENT_SECRET &&
    process.env.SF_CALLBACK_URL
);

function buildAuthUrl() {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.SF_CLIENT_ID,
    redirect_uri: process.env.SF_CALLBACK_URL,
    scope: SALESFORCE_SCOPE,
  });

  return `${LOGIN_URL}/services/oauth2/authorize?${params.toString()}`;
}

function requireSalesforceToken(req, res, next) {
  if (!tokenStore.accessToken || !tokenStore.instanceUrl) {
    return res.status(401).json({
      success: false,
      message: 'Salesforce login is required before performing CRUD operations.',
    });
  }

  return next();
}

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Salesforce CRUD backend is running.' });
});

app.get('/api/auth/login', (req, res) => {
  if (!isConfigured) {
    return res.status(400).json({
      success: false,
      error: 'Salesforce credentials are not configured. Add SF_CLIENT_ID, SF_CLIENT_SECRET and SF_CALLBACK_URL in the .env file.',
    });
  }

  return res.json({ success: true, url: buildAuthUrl() });
});

app.get('/api/auth/callback', async (req, res) => {
  const { code } = req.query;

  if (!code) {
    return res.status(400).send('Authentication failed: no authorization code was returned by Salesforce.');
  }

  try {
    const response = await axios.post(
      `${LOGIN_URL}/services/oauth2/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.SF_CLIENT_ID,
        client_secret: process.env.SF_CLIENT_SECRET,
        redirect_uri: process.env.SF_CALLBACK_URL,
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      }
    );

    tokenStore.accessToken = response.data.access_token;
    tokenStore.refreshToken = response.data.refresh_token || '';
    tokenStore.instanceUrl = response.data.instance_url;

    return res.redirect(`${CLIENT_URL}/?oauth=success`);
  } catch (error) {
    console.error('OAuth exchange failed:', error.response?.data || error.message);
    return res.status(500).send('Authentication failed while exchanging the authorization code for a Salesforce token.');
  }
});

app.get('/api/auth/status', (req, res) => {
  res.json({
    success: true,
    loggedIn: Boolean(tokenStore.accessToken),
    instanceUrl: tokenStore.instanceUrl,
  });
});

app.get('/api/metadata/:objectName', requireSalesforceToken, async (req, res) => {
  try {
    const objectName = req.params.objectName;
    const describeUrl = `${tokenStore.instanceUrl}/services/data/v60.0/sobjects/${objectName}/describe`;

    const response = await axios.get(describeUrl, {
      headers: {
        Authorization: `Bearer ${tokenStore.accessToken}`,
      },
    });

    const fields = response.data.fields
      .filter((field) => field && field.name && field.createable && field.name !== 'Id')
      .slice(0, 10)
      .map((field) => ({
        name: field.name,
        label: field.label,
        type: field.type,
      }));

    res.json({ success: true, objectName, fields });
  } catch (error) {
    console.error('Metadata fetch failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Unable to load object metadata from Salesforce.',
    });
  }
});

app.get('/api/records/:objectName', requireSalesforceToken, async (req, res) => {
  try {
    const { objectName } = req.params;
    const offset = Number(req.query.offset || 0);
    const limit = Math.min(Number(req.query.limit || 20), 20);
    const fieldsParam = req.query.fields || 'Name';

    const fieldNames = fieldsParam
      .split(',')
      .map((field) => field.trim())
      .filter(Boolean)
      .slice(0, 10);

    const selectFields = fieldNames.includes('Id') ? fieldNames : ['Id', ...fieldNames];
    const query = `SELECT ${selectFields.join(', ')} FROM ${objectName} ORDER BY LastModifiedDate DESC LIMIT ${limit} OFFSET ${offset}`;
    const queryUrl = `${tokenStore.instanceUrl}/services/data/v60.0/query?q=${encodeURIComponent(query)}`;

    const response = await axios.get(queryUrl, {
      headers: {
        Authorization: `Bearer ${tokenStore.accessToken}`,
      },
    });

    res.json({
      success: true,
      records: response.data.records || [],
      totalSize: response.data.totalSize || 0,
      done: response.data.done || false,
    });
  } catch (error) {
    console.error('Record query failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Unable to fetch records from Salesforce.',
    });
  }
});

app.post('/api/records/:objectName', requireSalesforceToken, async (req, res) => {
  try {
    const { objectName } = req.params;
    const payload = req.body || {};

    const response = await axios.post(
      `${tokenStore.instanceUrl}/services/data/v60.0/sobjects/${objectName}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${tokenStore.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ success: true, id: response.data.id });
  } catch (error) {
    console.error('Create record failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Record creation failed. Please check the required Salesforce object fields.',
    });
  }
});

app.patch('/api/records/:objectName/:recordId', requireSalesforceToken, async (req, res) => {
  try {
    const { objectName, recordId } = req.params;
    const payload = req.body || {};

    await axios.patch(
      `${tokenStore.instanceUrl}/services/data/v60.0/sobjects/${objectName}/${recordId}`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${tokenStore.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ success: true, message: 'Record updated successfully.' });
  } catch (error) {
    console.error('Update record failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Record update failed.',
    });
  }
});

app.delete('/api/records/:objectName/:recordId', requireSalesforceToken, async (req, res) => {
  try {
    const { objectName, recordId } = req.params;

    await axios.delete(`${tokenStore.instanceUrl}/services/data/v60.0/sobjects/${objectName}/${recordId}`, {
      headers: {
        Authorization: `Bearer ${tokenStore.accessToken}`,
      },
    });

    res.json({ success: true, message: 'Record deleted successfully.' });
  } catch (error) {
    console.error('Delete record failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({
      success: false,
      message: 'Record deletion failed.',
    });
  }
});

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Salesforce CRUD backend running on http://localhost:${PORT}`);
});
