const { TableClient } = require('@azure/data-tables');
const TABLE = 'JoinDashboardSettings';
function client() { return TableClient.fromConnectionString(process.env.AzureWebJobsStorage, TABLE); }
function fallback() {
  return { mode: process.env.LEAD_API_MODE === 'production' ? 'production' : 'test', testRecipient: process.env.LEAD_TEST_RECIPIENT || 'soc.manager@surflifesavingsa.com.au', emailEnabled: process.env.LEAD_EMAIL_ENABLED === 'true' };
}
async function readSettings() {
  try { const row = await client().getEntity('settings', 'delivery'); return { ...row, ...validateSettings(row) }; }
  catch (e) { if (e.statusCode === 404) return { ...fallback(), etag: null }; throw e; }
}
function validateSettings(body) {
  if (!['test', 'production'].includes(body.mode)) throw new Error('Choose test or production mode.');
  if (typeof body.testRecipient !== 'string' || body.testRecipient.length > 180 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.testRecipient)) throw new Error('Enter a valid test email address.');
  if (typeof body.emailEnabled !== 'boolean') throw new Error('Email enabled must be true or false.');
  return { mode: body.mode, testRecipient: body.testRecipient.trim(), emailEnabled: body.emailEnabled };
}
module.exports = { client, readSettings, validateSettings };
