const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const { ClientSecretCredential } = require("@azure/identity");
const crypto = require("crypto");

const { AsyncLocalStorage } = require('node:async_hooks');
const { readSettings } = require('../lib/settings');
const deliveryContext = new AsyncLocalStorage();

const REQUIRED_FIELDS = ["clubSlug", "name", "email", "consent"];
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";

function getAllowedOrigins() {
  return String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function buildCorsHeaders(request) {
  const requestOrigin = request.headers.get("origin");
  const allowedOrigins = getAllowedOrigins();

  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    return {};
  }

  return {
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function jsonResponse(request, status, body) {
  return {
    status,
    headers: {
      "Content-Type": "application/json",
      ...buildCorsHeaders(request)
    },
    jsonBody: body
  };
}

function optionsResponse(request) {
  return {
    status: 204,
    headers: buildCorsHeaders(request)
  };
}

function cleanString(value, maxLength) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanMultiline(value, maxLength) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    String(value || "").trim()
  );
}

function normaliseFilters(filters) {
  if (!Array.isArray(filters)) {
    return [];
  }

  return filters
    .slice(0, 30)
    .map((filter) => {
      if (filter && typeof filter === "object") {
        return {
          name: cleanString(
            filter.name || filter.label || "Selection",
            120
          ),
          value: cleanString(
            filter.value || filter.text || "",
            250
          )
        };
      }

      return {
        name: "Selection",
        value: cleanString(filter, 250)
      };
    })
    .filter((filter) => filter.value);
}

function normalisePayload(payload) {
  return {
    clubSlug: cleanString(payload.clubSlug, 120),
    name: cleanString(payload.name, 120),
    email: cleanString(payload.email, 180),
    phone: cleanString(payload.phone, 40),
    suburb: cleanString(payload.suburb, 120),
    about: cleanMultiline(payload.about, 2000),
    filters: normaliseFilters(payload.filters),
    consent: Boolean(payload.consent),
    sourcePage: cleanString(payload.sourcePage, 500),
    submittedAt: cleanString(payload.submittedAt, 80)
  };
}

function validateLead(payload) {
  const errors = [];

  REQUIRED_FIELDS.forEach((field) => {
    if (field === "consent") {
      if (payload.consent !== true) {
        errors.push("Consent is required.");
      }

      return;
    }

    if (!payload[field]) {
      errors.push(`${field} is required.`);
    }
  });

  if (payload.email && !isValidEmail(payload.email)) {
    errors.push("A valid email address is required.");
  }

  return errors;
}

function getStorageConnectionString() {
  const connectionString = process.env.AzureWebJobsStorage;

  if (!connectionString) {
    throw new Error("AzureWebJobsStorage is not configured.");
  }

  return connectionString;
}

function getLeadTableName() {
  return process.env.LEAD_TABLE_NAME || "LeadSubmissions";
}

function getRoutingTableName() {
  return process.env.LEAD_ROUTE_TABLE_NAME || "ClubLeadRouting";
}

function getApiMode() {
  if (deliveryContext.getStore()) return deliveryContext.getStore().mode;
  const value = String(process.env.LEAD_API_MODE || "test")
    .trim()
    .toLowerCase();

  return value === "production"
    ? "production"
    : "test";
}

function isEmailEnabled() {
  if (deliveryContext.getStore()) return deliveryContext.getStore().emailEnabled;
  return (
    String(process.env.LEAD_EMAIL_ENABLED || "")
      .trim()
      .toLowerCase() === "true"
  );
}

function getRequiredSetting(name) {
  const value = String(process.env[name] || "").trim();

  if (!value) {
    throw new Error(
      `Required environment variable ${name} is not configured.`
    );
  }

  return value;
}

function createRowKey() {
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-");

  return `${timestamp}-${crypto.randomUUID()}`;
}

function hashValue(value) {
  return crypto
    .createHash("sha256")
    .update(
      String(value || "")
        .toLowerCase()
        .trim()
    )
    .digest("hex");
}

function safeJson(value) {
  return JSON.stringify(value || []);
}

function getLeadTableClient() {
  return TableClient.fromConnectionString(
    getStorageConnectionString(),
    getLeadTableName()
  );
}

function getRoutingTableClient() {
  return TableClient.fromConnectionString(
    getStorageConnectionString(),
    getRoutingTableName()
  );
}

async function ensureLeadTableExists() {
  const tableClient = getLeadTableClient();

  try {
    await tableClient.createTable();
  } catch (error) {
    if (error.statusCode !== 409) {
      throw error;
    }
  }

  return tableClient;
}

async function getClubRouting(clubSlug) {
  const tableClient = getRoutingTableClient();

  try {
    const entity = await tableClient.getEntity(
      "club",
      clubSlug
    );

    return {
      slug: entity.rowKey,
      clubName: cleanString(entity.clubName, 180),
      recipientEmail: cleanString(
        entity.recipientEmail,
        180
      ),
      enabled: entity.enabled === true
    };
  } catch (error) {
    if (error.statusCode === 404) {
      return null;
    }

    throw error;
  }
}

async function storeLeadSubmission(payload, club) {
  const tableClient = await ensureLeadTableExists();
  const createdAt = new Date().toISOString();
  const apiMode = getApiMode();

  const entity = {
    partitionKey: payload.clubSlug,
    rowKey: createRowKey(),

    clubSlug: payload.clubSlug,
    clubName: club.clubName,

    name: payload.name,
    email: payload.email,
    emailHash: hashValue(payload.email),
    phone: payload.phone,
    suburb: payload.suburb,
    about: payload.about,

    filtersJson: safeJson(payload.filters),

    consent: payload.consent,

    sourcePage: payload.sourcePage,

    clientSubmittedAt: payload.submittedAt,
    submittedAt: createdAt,
    createdAt,

    leadApiMode: apiMode,

    emailDeliveryStatus: isEmailEnabled()
      ? "pending"
      : "disabled"
  };

  await tableClient.createEntity(entity);

  return {
    partitionKey: entity.partitionKey,
    rowKey: entity.rowKey
  };
}

async function updateLeadDeliveryStatus(
  storageResult,
  status,
  details = {}
) {
  const tableClient = getLeadTableClient();

  const entity = {
    partitionKey: storageResult.partitionKey,
    rowKey: storageResult.rowKey,
    emailDeliveryStatus: status,
    emailDeliveryUpdatedAt: new Date().toISOString(),
    ...details
  };

  await tableClient.updateEntity(
    entity,
    "Merge"
  );
}

function getFilterValues(payload, filterName) {
  const values = payload.filters
    .filter((filter) => filter.name === filterName)
    .map((filter) => filter.value)
    .filter(Boolean);

  return Array.from(
    new Set(values)
  );
}

function getOtherPreferenceGroups(payload) {
  const groups = new Map();

  payload.filters.forEach((filter) => {
    if (
      !filter.name ||
      !filter.value ||
      filter.name === "Interest"
    ) {
      return;
    }

    if (!groups.has(filter.name)) {
      groups.set(
        filter.name,
        []
      );
    }

    const values = groups.get(filter.name);

    if (!values.includes(filter.value)) {
      values.push(filter.value);
    }
  });

  return Array.from(groups.entries());
}

function buildInterestHtml(payload) {
  const interests = getFilterValues(
    payload,
    "Interest"
  );

  if (interests.length === 0) {
    return `
      <span
        style="
          display:inline-block;
          padding:8px 12px;
          border-radius:999px;
          background:#f1f5f9;
          color:#5f6b7a;
          font-size:14px;
        "
      >
        No specific interests selected
      </span>
    `;
  }

  return interests
    .map((interest) => {
      return `
        <span
          style="
            display:inline-block;
            margin:0 6px 7px 0;
            padding:8px 12px;
            border:1px solid #cfe0f6;
            border-radius:999px;
            background:#eef5ff;
            color:#0046ad;
            font-size:14px;
            font-weight:600;
          "
        >
          ${escapeHtml(interest)}
        </span>
      `;
    })
    .join("");
}

function buildOtherPreferencesHtml(payload) {
  const groups = getOtherPreferenceGroups(payload);

  if (groups.length === 0) {
    return "";
  }

  const rows = groups
    .map(([name, values]) => {
      return `
        <tr>
          <td
            style="
              width:150px;
              padding:7px 10px 7px 0;
              vertical-align:top;
              color:#667085;
              font-size:14px;
              font-weight:600;
            "
          >
            ${escapeHtml(name)}
          </td>

          <td
            style="
              padding:7px 0;
              vertical-align:top;
              color:#152033;
              font-size:14px;
              font-weight:600;
            "
          >
            ${escapeHtml(values.join(", "))}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <tr>
      <td
        style="
          padding:0 34px 26px;
        "
      >
        <h2
          style="
            margin:0 0 10px;
            color:#152033;
            font-family:Arial,Helvetica,sans-serif;
            font-size:17px;
            line-height:1.3;
          "
        >
          Other preferences
        </h2>

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
        >
          ${rows}
        </table>
      </td>
    </tr>
  `;
}

function buildEmailContent(
  payload,
  club,
  storageResult,
  apiMode
) {
  const isTest =
    apiMode === "test";

  const subject =
    `${isTest ? "[TEST] " : ""}` +
    `New membership enquiry – ${club.clubName}`;

  const safeName = escapeHtml(payload.name);
  const safeEmail = escapeHtml(payload.email);
  const safePhone = escapeHtml(
    payload.phone || "Not provided"
  );
  const safeSuburb = escapeHtml(
    payload.suburb || "Not provided"
  );
  const safeClub = escapeHtml(club.clubName);
  const safeMessage = escapeHtml(
    payload.about ||
      "No additional message provided."
  );
  const safeReference = escapeHtml(
    storageResult.rowKey
  );

  const phoneHref = payload.phone
    ? escapeHtml(
        payload.phone.replace(
          /[^\d+]/g,
          ""
        )
      )
    : "";

  const phoneHtml = payload.phone
    ? `
      <a
        href="tel:${phoneHref}"
        style="
          color:#0046ad;
          text-decoration:none;
          font-weight:700;
        "
      >
        ${safePhone}
      </a>
    `
    : "Not provided";

  const testBanner = isTest
    ? `
      <tr>
        <td
          style="
            padding:10px 34px;
            background:#fff4e5;
            color:#9a5b00;
            font-family:Arial,Helvetica,sans-serif;
            font-size:13px;
            font-weight:700;
            text-align:center;
          "
        >
          TEST MESSAGE – this enquiry has not been sent to the selected club
        </td>
      </tr>
    `
    : "";

  const htmlBody = `
<!doctype html>
<html>
  <body
    style="
      margin:0;
      padding:0;
      background:#f3f6fa;
      color:#152033;
      font-family:Arial,Helvetica,sans-serif;
    "
  >
    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="
        width:100%;
        background:#f3f6fa;
      "
    >
      <tr>
        <td
          align="center"
          style="
            padding:28px 14px;
          "
        >
          <table
            role="presentation"
            width="640"
            cellpadding="0"
            cellspacing="0"
            border="0"
            style="
              width:100%;
              max-width:640px;
              border:1px solid #dfe6ee;
              background:#ffffff;
            "
          >
            <tr>
              <td
                style="
                  height:8px;
                  background:#ed1b2f;
                  font-size:1px;
                  line-height:1px;
                "
              >
                &nbsp;
              </td>
            </tr>

            ${testBanner}

            <tr>
              <td
                style="
                  padding:30px 34px 18px;
                "
              >
                <div
                  style="
                    margin-bottom:8px;
                    color:#0046ad;
                    font-size:13px;
                    font-weight:800;
                    letter-spacing:0.06em;
                    text-transform:uppercase;
                  "
                >
                  Surf Life Saving SA
                </div>

                <h1
                  style="
                    margin:0;
                    color:#152033;
                    font-size:28px;
                    line-height:1.18;
                  "
                >
                  New membership enquiry
                </h1>

                <p
                  style="
                    margin:10px 0 0;
                    color:#5f6b7a;
                    font-size:16px;
                    line-height:1.55;
                  "
                >
                  A prospective member has asked to connect with your club through the Surf Life Saving SA Join website.
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:0 34px 26px;
                "
              >
                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    border:1px solid #cfe0f6;
                    background:#eef5ff;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding:17px 20px;
                      "
                    >
                      <div
                        style="
                          margin-bottom:4px;
                          color:#5f6b7a;
                          font-size:11px;
                          font-weight:800;
                          letter-spacing:0.06em;
                          text-transform:uppercase;
                        "
                      >
                        Selected club
                      </div>

                      <div
                        style="
                          color:#0046ad;
                          font-size:20px;
                          font-weight:800;
                          line-height:1.3;
                        "
                      >
                        ${safeClub}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:0 34px 26px;
                "
              >
                <h2
                  style="
                    margin:0 0 12px;
                    color:#152033;
                    font-size:17px;
                    line-height:1.3;
                  "
                >
                  Contact details
                </h2>

                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    border-collapse:collapse;
                  "
                >
                  <tr>
                    <td
                      style="
                        width:110px;
                        padding:8px 10px 8px 0;
                        border-bottom:1px solid #edf0f4;
                        color:#667085;
                        font-size:14px;
                        font-weight:600;
                      "
                    >
                      Name
                    </td>

                    <td
                      style="
                        padding:8px 0;
                        border-bottom:1px solid #edf0f4;
                        color:#152033;
                        font-size:15px;
                        font-weight:700;
                      "
                    >
                      ${safeName}
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        width:110px;
                        padding:8px 10px 8px 0;
                        border-bottom:1px solid #edf0f4;
                        color:#667085;
                        font-size:14px;
                        font-weight:600;
                      "
                    >
                      Email
                    </td>

                    <td
                      style="
                        padding:8px 0;
                        border-bottom:1px solid #edf0f4;
                        font-size:15px;
                      "
                    >
                      <a
                        href="mailto:${safeEmail}"
                        style="
                          color:#0046ad;
                          text-decoration:none;
                          font-weight:700;
                        "
                      >
                        ${safeEmail}
                      </a>
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        width:110px;
                        padding:8px 10px 8px 0;
                        border-bottom:1px solid #edf0f4;
                        color:#667085;
                        font-size:14px;
                        font-weight:600;
                      "
                    >
                      Phone
                    </td>

                    <td
                      style="
                        padding:8px 0;
                        border-bottom:1px solid #edf0f4;
                        color:#152033;
                        font-size:15px;
                        font-weight:700;
                      "
                    >
                      ${phoneHtml}
                    </td>
                  </tr>

                  <tr>
                    <td
                      style="
                        width:110px;
                        padding:8px 10px 8px 0;
                        color:#667085;
                        font-size:14px;
                        font-weight:600;
                      "
                    >
                      Suburb
                    </td>

                    <td
                      style="
                        padding:8px 0;
                        color:#152033;
                        font-size:15px;
                        font-weight:700;
                      "
                    >
                      ${safeSuburb}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:0 34px 24px;
                "
              >
                <h2
                  style="
                    margin:0 0 12px;
                    color:#152033;
                    font-size:17px;
                    line-height:1.3;
                  "
                >
                  Interests
                </h2>

                <div>
                  ${buildInterestHtml(payload)}
                </div>
              </td>
            </tr>

            ${buildOtherPreferencesHtml(payload)}

            <tr>
              <td
                style="
                  padding:0 34px 28px;
                "
              >
                <h2
                  style="
                    margin:0 0 12px;
                    color:#152033;
                    font-size:17px;
                    line-height:1.3;
                  "
                >
                  Message
                </h2>

                <table
                  role="presentation"
                  width="100%"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                  style="
                    background:#f8fafc;
                  "
                >
                  <tr>
                    <td
                      style="
                        padding:17px 18px;
                        border-left:4px solid #ed1b2f;
                        color:#344054;
                        font-size:15px;
                        line-height:1.55;
                        white-space:pre-wrap;
                      "
                    >${safeMessage}</td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:0 34px 30px;
                "
              >
                <table
                  role="presentation"
                  cellpadding="0"
                  cellspacing="0"
                  border="0"
                >
                  <tr>
                    <td
                      style="
                        background:#ed1b2f;
                      "
                    >
                      <a
                        href="mailto:${safeEmail}"
                        style="
                          display:inline-block;
                          padding:13px 20px;
                          color:#ffffff;
                          font-size:15px;
                          font-weight:800;
                          text-decoration:none;
                        "
                      >
                        Reply to ${safeName}
                      </a>
                    </td>
                  </tr>
                </table>

                <p
                  style="
                    margin:12px 0 0;
                    color:#667085;
                    font-size:13px;
                    line-height:1.45;
                  "
                >
                  You can also use Reply in your email application. Replies will be addressed directly to the prospective member.
                </p>
              </td>
            </tr>

            <tr>
              <td
                style="
                  padding:20px 34px;
                  border-top:1px solid #e4e9ef;
                  background:#f8fafc;
                  color:#667085;
                  font-size:12px;
                  line-height:1.5;
                "
              >
                This enquiry was submitted through
                <strong>join.surflifesavingsa.com.au</strong>.

                <br>

                Reference:
                ${safeReference}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `;

  return {
    subject,
    htmlBody
  };
}

function getDeliveryRecipient(club, apiMode) {
  if (apiMode === "production") {
    if (!club.recipientEmail) {
      throw new Error(
        `No production recipient is configured for ${club.clubName}.`
      );
    }

    if (!isValidEmail(club.recipientEmail)) {
      throw new Error(
        `The production recipient configured for ${club.clubName} is invalid.`
      );
    }

    return club.recipientEmail;
  }

  const testRecipient = deliveryContext.getStore()?.testRecipient || getRequiredSetting('LEAD_TEST_RECIPIENT');

  if (!isValidEmail(testRecipient)) {
    throw new Error(
      "LEAD_TEST_RECIPIENT is not a valid email address."
    );
  }

  return testRecipient;
}

async function getGraphAccessToken() {
  const tenantId = getRequiredSetting(
    "JOIN_MAIL_TENANT_ID"
  );

  const clientId = getRequiredSetting(
    "JOIN_MAIL_CLIENT_ID"
  );

  const clientSecret = getRequiredSetting(
    "JOIN_MAIL_CLIENT_SECRET"
  );

  const credential = new ClientSecretCredential(
    tenantId,
    clientId,
    clientSecret
  );

  const token = await credential.getToken(
    GRAPH_SCOPE
  );

  if (!token || !token.token) {
    throw new Error(
      "Microsoft Graph access token could not be obtained."
    );
  }

  return token.token;
}

async function sendLeadEmail(
  payload,
  club,
  storageResult
) {
  if (!isEmailEnabled()) {
    return {
      status: "disabled"
    };
  }

  if (typeof fetch !== "function") {
    throw new Error(
      "This Azure Function runtime does not provide the Fetch API."
    );
  }

  const apiMode = getApiMode();

  const recipientEmail = getDeliveryRecipient(
    club,
    apiMode
  );

  const senderEmail = getRequiredSetting(
    "JOIN_MAIL_SENDER"
  );

  if (!isValidEmail(senderEmail)) {
    throw new Error(
      "JOIN_MAIL_SENDER is not a valid email address."
    );
  }

  const accessToken =
    await getGraphAccessToken();

  const email = buildEmailContent(
    payload,
    club,
    storageResult,
    apiMode
  );

  const graphUrl =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(senderEmail)}/sendMail`;

  const response = await fetch(
    graphUrl,
    {
      method: "POST",

      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        message: {
          subject: email.subject,

          body: {
            contentType: "HTML",
            content: email.htmlBody
          },

          toRecipients: [
            {
              emailAddress: {
                address: recipientEmail
              }
            }
          ],

          replyTo: [
            {
              emailAddress: {
                name: payload.name,
                address: payload.email
              }
            }
          ]
        }
      })
    }
  );

  if (response.status !== 202) {
    const responseBody =
      await response.text();

    throw new Error(
      `Microsoft Graph sendMail failed with HTTP ${response.status}. ${responseBody.slice(0, 1000)}`
    );
  }

  return {
    status: "sent",
    mode: apiMode
  };
}

app.http("lead", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "lead",

  handler: async (request, context) => {
    if (request.method === "OPTIONS") {
      return optionsResponse(request);
    }

    let configuration;
    try { configuration = await readSettings(); }
    catch { return jsonResponse(request, 503, { ok: false, message: 'Enquiries are temporarily unavailable. Please try again shortly.' }); }
    return deliveryContext.run(configuration, async () => {
    let rawPayload;

    try {
      rawPayload = await request.json();
    } catch (error) {
      return jsonResponse(
        request,
        400,
        {
          ok: false,
          message: "Invalid JSON payload."
        }
      );
    }

    const payload =
      normalisePayload(rawPayload);

    const errors =
      validateLead(payload);

    if (errors.length > 0) {
      return jsonResponse(
        request,
        400,
        {
          ok: false,
          message:
            "The enquiry could not be submitted.",
          errors
        }
      );
    }

    let club;

    try {
      club = await getClubRouting(
        payload.clubSlug
      );
    } catch (error) {
      context.error(
        "Failed to read ClubLeadRouting.",
        error
      );

      return jsonResponse(
        request,
        500,
        {
          ok: false,
          message:
            "The selected club could not be checked. Please try again."
        }
      );
    }

    if (!club) {
      return jsonResponse(
        request,
        400,
        {
          ok: false,
          message:
            "Selected club is not recognised."
        }
      );
    }

    if (!club.enabled) {
      return jsonResponse(
        request,
        400,
        {
          ok: false,
          message:
            "The selected club is not currently accepting enquiries."
        }
      );
    }

    let storageResult;

    try {
      storageResult =
        await storeLeadSubmission(
          payload,
          club
        );

      context.log(
        "Lead enquiry received and stored.",
        {
          clubSlug: payload.clubSlug,
          leadId: storageResult.rowKey,
          mode: getApiMode()
        }
      );
    } catch (error) {
      context.error(
        "Failed to store lead submission.",
        error
      );

      return jsonResponse(
        request,
        500,
        {
          ok: false,
          message:
            "The enquiry could not be stored. Please try again."
        }
      );
    }

    let deliveryResult;

    try {
      deliveryResult =
        await sendLeadEmail(
          payload,
          club,
          storageResult
        );

      if (
        deliveryResult.status === "sent"
      ) {
        try {
          await updateLeadDeliveryStatus(
            storageResult,
            "sent",
            {
              emailDeliveredAt:
                new Date().toISOString()
            }
          );
        } catch (statusError) {
          context.warn(
            "Email sent but delivery status could not be updated.",
            statusError
          );
        }
      }

      if (
        deliveryResult.status === "disabled"
      ) {
        try {
          await updateLeadDeliveryStatus(
            storageResult,
            "disabled"
          );
        } catch (statusError) {
          context.warn(
            "Lead stored but disabled delivery status could not be updated.",
            statusError
          );
        }
      }
    } catch (error) {
      context.error(
        "Lead was stored but email delivery failed.",
        error
      );

      try {
        await updateLeadDeliveryStatus(
          storageResult,
          "failed",
          {
            emailDeliveryError:
              cleanString(
                error.message,
                1000
              )
          }
        );
      } catch (statusError) {
        context.error(
          "Failed to record email delivery failure.",
          statusError
        );
      }

      return jsonResponse(
        request,
        502,
        {
          ok: false,
          captured: true,
          message:
            "Your enquiry was recorded, but email delivery was unsuccessful. Please try again later.",
          clubName: club.clubName,
          leadId: storageResult.rowKey
        }
      );
    }

    return jsonResponse(
      request,
      200,
      {
        ok: true,
        mode: getApiMode(),
        message:
          deliveryResult.status === "sent"
            ? "Enquiry submitted successfully."
            : "Enquiry captured successfully.",
        clubName: club.clubName,
        leadId: storageResult.rowKey
      }
    );
    });
  }
});
