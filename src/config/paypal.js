const paypal = require('@paypal/checkout-server-sdk');

// Creating an environment
const clientId = process.env.PAYPAL_CLIENT_ID || 'sb';
const clientSecret = process.env.PAYPAL_CLIENT_SECRET || 'sb_secret';

// Use Sandbox environment for testing
const environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
const client = new paypal.core.PayPalHttpClient(environment);

module.exports = { client };
