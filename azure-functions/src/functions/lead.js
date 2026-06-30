const { app } = require("@azure/functions");
const { TableClient } = require("@azure/data-tables");
const crypto = require("crypto");

const REQUIRED_FIELDS = ["clubSlug", "name", "email", "consent"];

const CLUB_RECIPIENTS = {
  "glenelg-surf-life-saving-club": {
    name: "Glenelg Surf Life Saving Club",
    email: "membership@example.com"
  },
  "brighton-surf-life-saving-club": {
    name: "Brighton Surf Life Saving Club",
    email: "membership@example.com"
  },
  "port-noarlunga-surf-life-saving-club": {
    name: "Port Noarlunga Surf Life Saving Club",
    email: "membership@example.com"
  }
};

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

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function normalisePayload(payload) {
  return {
    clubSlug: cleanString(payload.clubSlug, 120),
    name: cleanString(payload.name, 120),
    email: cleanString(payload.email, 180),
    phone: cleanString(payload.phone, 40),
    suburb: cleanString(payload.suburb, 120),
    about: cleanMultiline(payload.about, 2000),
    filters: Array.isArray(payload.filters) ? payload.filters : [],
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
      errors.push(field + " is required.");
    }
  });

  if (payload.email && !isValidEmail(payload.email)) {
    errors.push("A valid email address is required.");
  }

  if (payload.clubSlug && !CLUB_RECIPIENTS[payload.clubSlug]) {
    errors.push("Selected club is not recognised.");
  }

  return errors;
}

function getStorageConnectionString() {
  return process.env.AzureWebJobsStorage;
}

function getLeadTableName() {
  return process.env.LEAD_TABLE_NAME || "LeadSubmissions";
}

function createRowKey() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const random = crypto.randomUUID();

  return `${timestamp}-${random}`;
}

function hashValue(value) {
  return crypto
    .createHash("sha256")
    .update(String(value || "").toLowerCase().trim())
    .digest("hex");
}

function safeJson(value) {
  return JSON.stringify(value || []);
}

async function getLeadTableClient() {
  const connectionString = getStorageConnectionString();

  if (!connectionString) {
    throw new Error("AzureWebJobsStorage is not configured.");
  }

  const tableClient = TableClient.fromConnectionString(
    connectionString,
    getLeadTableName()
  );

  try {
    await tableClient.createTable();
  } catch (error) {
    if (error.statusCode !== 409) {
      throw error;
    }
  }

  return tableClient;
}

async function storeLeadSubmission(payload, club) {
  const tableClient = await getLeadTableClient();
  const submittedAt = payload.submittedAt || new Date().toISOString();

  const entity = {
    partitionKey: payload.clubSlug,
    rowKey: createRowKey(),
    clubSlug: payload.clubSlug,
    clubName: club.name,
    name: payload.name,
    email: payload.email,
    emailHash: hashValue(payload.email),
    phone: payload.phone,
    suburb: payload.suburb,
    about: payload.about,
    filtersJson: safeJson(payload.filters),
    consent: payload.consent,
    sourcePage: payload.sourcePage,
    submittedAt,
    createdAt: new Date().toISOString(),
    leadApiMode: process.env.LEAD_API_MODE || "local"
  };

  await tableClient.createEntity(entity);

  return {
    partitionKey: entity.partitionKey,
    rowKey: entity.rowKey
  };
}

function buildLeadSummary(payload, club, storageResult) {
  const filterLines = payload.filters.length
    ? payload.filters.map((filter) => `- ${filter.name}: ${filter.value}`).join("\n")
    : "- No filters selected";

  return [
    `New membership enquiry`,
    ``,
    `Selected club: ${club.name}`,
    ``,
    `Name: ${payload.name}`,
    `Email: ${payload.email}`,
    `Phone: ${payload.phone || "Not provided"}`,
    `Suburb: ${payload.suburb || "Not provided"}`,
    ``,
    `Interests from filters:`,
    filterLines,
    ``,
    `Message:`,
    payload.about || "Not provided",
    ``,
    `Source page: ${payload.sourcePage || "Not provided"}`,
    `Submitted at: ${payload.submittedAt || new Date().toISOString()}`,
    ``,
    `Stored lead record: ${storageResult.partitionKey}/${storageResult.rowKey}`
  ].join("\n");
}

app.http("lead", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "lead",
  handler: async (request, context) => {
    if (request.method === "OPTIONS") {
      return optionsResponse(request);
    }

    let rawPayload;

    try {
      rawPayload = await request.json();
    } catch (error) {
      return jsonResponse(request, 400, {
        ok: false,
        message: "Invalid JSON payload."
      });
    }

    const payload = normalisePayload(rawPayload);
    const errors = validateLead(payload);

    if (errors.length > 0) {
      return jsonResponse(request, 400, {
        ok: false,
        message: "The enquiry could not be submitted.",
        errors
      });
    }

    const club = CLUB_RECIPIENTS[payload.clubSlug];

    try {
      const storageResult = await storeLeadSubmission(payload, club);
      const leadSummary = buildLeadSummary(payload, club, storageResult);

      context.log("Lead enquiry received and stored:");
      context.log(leadSummary);

      return jsonResponse(request, 200, {
        ok: true,
        mode: process.env.LEAD_API_MODE || "local",
        message: "Lead captured successfully.",
        clubName: club.name,
        leadId: storageResult.rowKey
      });
    } catch (error) {
      context.error("Failed to store lead submission.", error);

      return jsonResponse(request, 500, {
        ok: false,
        message: "The enquiry could not be stored. Please try again."
      });
    }
  }
});