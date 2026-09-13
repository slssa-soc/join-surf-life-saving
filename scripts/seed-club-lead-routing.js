const { TableClient } = require("@azure/data-tables");

const TABLE_NAME =
  process.env.LEAD_ROUTE_TABLE_NAME ||
  "ClubLeadRouting";

/*
 * Production routing addresses supplied by the clubs.
 *
 * IMPORTANT:
 * These addresses are stored now, but while:
 *
 *   LEAD_API_MODE=test
 *
 * lead.js will continue sending every actual email to:
 *
 *   soc.manager@surflifesavingsa.com.au
 *
 * The recipientEmail values below are only used for delivery
 * when LEAD_API_MODE=production.
 */

const CLUBS = [
  {
    slug: "aldinga-bay-slsc",
    clubName: "Aldinga Bay SLSC",
    recipientEmail: "secretary@aldingabayslsc.onmicrosoft.com",
    enabled: true
  },
  {
    slug: "beachport-slsc",
    clubName: "Beachport SLSC",
    recipientEmail: "beachportslssa@gmail.com",
    enabled: true
  },
  {
    slug: "brighton-slsc",
    clubName: "Brighton SLSC",
    recipientEmail: "registrarinfo@brightonsurfclub.com",
    enabled: true
  },
  {
    slug: "chiton-rocks-slsc",
    clubName: "Chiton Rocks SLSC",
    recipientEmail: "membership@chitonrocks.com",
    enabled: true
  },
  {
    slug: "christies-beach-slsc",
    clubName: "Christies Beach SLSC",
    recipientEmail: "join@christiesbeachslsc.com.au",
    enabled: true
  },
  {
    slug: "elizabeth-lsc",
    clubName: "Elizabeth LSC",
    recipientEmail: "",
    enabled: true
  },
  {
    slug: "glenelg-slsc",
    clubName: "Glenelg SLSC",
    recipientEmail: "secretary@glenelgslsc.com.au",
    enabled: true
  },
  {
    slug: "goolwa-slsc",
    clubName: "Goolwa SLSC",
    recipientEmail: "info@goolwaslsc.com.au",
    enabled: true
  },
  {
    slug: "grange-slsc",
    clubName: "Grange SLSC",
    recipientEmail: "mail@grangeslsc.asn.au",
    enabled: true
  },
  {
    slug: "henley-slsc",
    clubName: "Henley SLSC",
    recipientEmail: "info@henleyslsc.com.au",
    enabled: true
  },
  {
    slug: "moana-slsc",
    clubName: "Moana SLSC",
    recipientEmail: "president@moanaslsc.com.au",
    enabled: true
  },
  {
    slug: "murray-bridge-lsc",
    clubName: "Murray Bridge LSC",
    recipientEmail: "murraybridgelifesavingclub@gmail.com",
    enabled: true
  },
  {
    slug: "normanville-slsc",
    clubName: "Normanville SLSC",
    recipientEmail: "registrar@normanvilleslsc.org.au",
    enabled: true
  },
  {
    slug: "port-elliot-slsc",
    clubName: "Port Elliot SLSC",
    recipientEmail: "info@portelliotslsc.com.au",
    enabled: true
  },
  {
    slug: "port-noarlunga-slsc",
    clubName: "Port Noarlunga SLSC",
    recipientEmail: "secretary@pnslsc.com.au",
    enabled: true
  },
  {
    slug: "robe-slsc",
    clubName: "Robe SLSC",
    recipientEmail: "contact@robesls.club",
    enabled: true
  },
  {
    slug: "seacliff-slsc",
    clubName: "Seacliff SLSC",
    recipientEmail: "secretary@seacliffslsc.com.au",
    enabled: true
  },
  {
    slug: "semaphore-slsc",
    clubName: "Semaphore SLSC",
    recipientEmail: "registrar@semaphoreslsc.com.au",
    enabled: true
  },
  {
    slug: "somerton-slsc",
    clubName: "Somerton SLSC",
    recipientEmail: "secretary@somertonsurfclub.com.au",
    enabled: true
  },
  {
    slug: "south-port-slsc",
    clubName: "South Port SLSC",
    recipientEmail: "mail@southportslsc.org.au",
    enabled: true
  },
  {
    slug: "west-beach-slsc",
    clubName: "West Beach SLSC",
    recipientEmail: "admin@westbeachslsc.com.au",
    enabled: true
  },
  {
    slug: "whyalla-slsc",
    clubName: "Whyalla SLSC",
    recipientEmail: "su49344@bigpond.net.au",
    enabled: true
  }
];

function getStorageConnectionString() {
  const connectionString =
    process.env.AzureWebJobsStorage ||
    process.env.AZURE_STORAGE_CONNECTION_STRING;

  if (!connectionString) {
    throw new Error(
      "No Azure Storage connection string was found.\n\n" +
      "Set either:\n" +
      "  AzureWebJobsStorage\n" +
      "or:\n" +
      "  AZURE_STORAGE_CONNECTION_STRING"
    );
  }

  return connectionString;
}

function getTableClient() {
  return TableClient.fromConnectionString(
    getStorageConnectionString(),
    TABLE_NAME
  );
}

async function seedClubRouting() {
  const tableClient = getTableClient();

  console.log("");
  console.log("ClubLeadRouting seed");
  console.log("--------------------");
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`Clubs: ${CLUBS.length}`);
  console.log("");

  let createdOrUpdated = 0;
  let withoutRecipient = 0;
  let failed = 0;

  for (const club of CLUBS) {
    const entity = {
      partitionKey: "club",
      rowKey: club.slug,

      clubName: club.clubName,
      recipientEmail: club.recipientEmail,
      enabled: club.enabled,

      updatedAt: new Date().toISOString()
    };

    try {
      /*
       * Replace means the table row will exactly reflect
       * the configuration in this script each time it is run.
       *
       * This makes the script safe to run again if an email
       * address changes before launch.
       */
      await tableClient.upsertEntity(
        entity,
        "Replace"
      );

      createdOrUpdated += 1;

      if (!club.recipientEmail) {
        withoutRecipient += 1;

        console.log(
          `⚠ ${club.slug.padEnd(25)} ${club.clubName} – NO PRODUCTION EMAIL`
        );
      } else {
        console.log(
          `✓ ${club.slug.padEnd(25)} ${club.recipientEmail}`
        );
      }
    } catch (error) {
      failed += 1;

      console.error(
        `✗ ${club.slug} – ${error.message}`
      );
    }
  }

  console.log("");
  console.log("--------------------");
  console.log(`Created/updated: ${createdOrUpdated}`);
  console.log(`Missing email:   ${withoutRecipient}`);
  console.log(`Failed:          ${failed}`);
  console.log("");

  if (withoutRecipient > 0) {
    console.log(
      "NOTE: Clubs without a production recipient will still work while " +
      "LEAD_API_MODE=test because test enquiries are routed to the test mailbox."
    );

    console.log(
      "They will NOT be able to receive enquiries in production until a " +
      "recipientEmail is configured."
    );

    console.log("");
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

seedClubRouting().catch((error) => {
  console.error("");
  console.error("Seed failed.");
  console.error(error);
  process.exitCode = 1;
});