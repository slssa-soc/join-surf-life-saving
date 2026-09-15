# Join SLSSA dashboard

Azure Functions dashboard using the existing Join Function app, Azure Tables, Application Insights and Cost Management. The public page is a sign-in shell; every dashboard API request validates an SLSSA-issued access token, audience and Dashboard.Access scope. All SLSSA directory users have read/write access as requested.

## Deployment

Install with `npm ci` in `azure-functions`. Copy `node_modules/@azure/msal-browser/lib/msal-browser.min.js` to `public/msal-browser.min.js` after dependency upgrades. Publish the `azure-functions` folder with Azure Functions Core Tools, Node 22. This package includes the original lead handler with per-request delivery settings.

Dashboard URL: https://func-join-slssa-prod-d3hwbvgygng2cdeh.australiasoutheast-01.azurewebsites.net/api/dashboard

Required settings: DASHBOARD_TENANT_ID, DASHBOARD_CLIENT_ID. Existing AzureWebJobsStorage, lead routing/storage and mail configuration are reused. DASHBOARD_SUBSCRIPTION_ID and DASHBOARD_INSIGHTS_APP_ID have defaults for Join System. The Function managed identity needs Monitoring Reader on Application Insights and Cost Management Reader on the subscription.

## Delivery

JoinDashboardSettings/settings/delivery overrides LEAD_API_MODE, LEAD_TEST_RECIPIENT and LEAD_EMAIL_ENABLED. If the row is absent, existing environment settings apply. A settings read failure stops new submissions before sending. One snapshot is used throughout each request; requests already in flight can finish with their prior settings. Updates use entity versions to avoid overwriting another user's edits. JoinDashboardAudit records requested and completed changes; a requested record without completion needs investigation and does not prove a change succeeded.

No replay/resend is implemented, so changing modes cannot resend historical test leads. Microsoft Graph 202 acceptance does not prove inbox delivery. Existing statuses are displayed accordingly.

## Website integration

`node integration/install-website.cjs <existing Join repo>` adds the Microsoft SDK, PII-free page/form event tracking and a `/dashboard` redirect. Publish those website changes via the existing GitHub Pages workflow. The SDK collects browser-based visitors and sessions using analytics cookies; page URLs are stripped of queries and fragments, and no lead field content is tracked. Source is referrer hostname only. Tracking starts at deployment; no historical traffic is invented.

## Validation

`node --test tests/security.test.cjs`. Validate production APIs without a token return 401. Sign in as an SLSSA user to validate actual data and settings. Do not submit test enquiries in production unless expressly intended. The dashboard deliberately has no development authentication bypass.

Billing uses Azure ActualCost month-to-date, independent of the enquiry date selector. Projections use completed UTC calendar days this month, extending the average rate to month-end and 6/12 months. Azure reporting delay can understate projections; values are labelled estimates.

## Source continuity

The patched lead handler and shared settings helper must also be retained in the original Join API repository, otherwise a future publish from that repository could overwrite this dashboard and revert mode control.

## Club page editor

Club pages supports visual text editing, summaries, names, photos, image descriptions and supporting location/program information for the 23 existing clubs. Browse taxonomy, map coordinates and email routing are separate. Editors preview and select Review and publish, then enter mandatory change notes (including the requester where relevant). The server validates/sanitises content, independently decodes JPEG/PNG photos and re-encodes them without metadata. Client uploads are limited to 5 MB and resized to at most 2,000 pixels; the server rejects images over 12 megapixels. Node >=22.12 is required by the sanitiser.

`JoinClubPages` stores current content and immutable revisions in each club's partition. One transaction writes the current page, revision (before/after, editor identity, timestamp and notes), and publication marker for any image. ETags reject stale editors; request IDs make retries idempotent. Revisions appear under Change history and in Activity log. Earlier content can be loaded as an unpublished draft; publishing a restoration requires new notes. No deletion or history-edit endpoint exists.

Images are held in the private `join-club-images` blob container. The public image route serves only JPEGs with a publication marker, using immutable content-addressed URLs. Failed saves can leave unreferenced private blobs; they are not publicly served. Historical published images remain readable for revision previews. `AzureWebJobsStorage` supplies the existing connection; no additional public storage permissions are needed.

`azure-functions/data/club-pages.json` is the baseline imported from the repository's Markdown files. The website loads public-only content through `/api/club-pages`, and applies it to club profiles and browse-card text/images. Private notes, identities and revision history require dashboard authentication and never appear in this response. Updates appear on new page visits/reloads without rebuilding GitHub Pages. Original static pages remain as a fallback if JavaScript is unavailable or the content API fails; such fallback/HTML-only crawler content can be older than editor content. Repository rebuilds do not overwrite saved editor changes. Back up both the content table and image container for recovery.

`node integration/import-club-pages.cjs <repo>` regenerates the baseline; `node integration/install-club-editor.cjs <repo>` installs the website reader. The bundled Quill and DOMPurify browser assets must be refreshed from their installed packages after dependency upgrades. The local fixture and Azurite tests are never deployed.

## Live reporting and campaign links

Campaign links has a dedicated navigation section with a UTM builder and usage guidance. Generated links are not persisted in a shared register. Reporting includes traffic sources, channels, campaign sessions and saved enquiries; it does not confirm membership outcomes or club follow-up. Google Search Console and advertising spend are not connected. Test activity is excluded by default, with an explicit reporting-only disclosure control; unclassified historical activity remains included.

The dashboard uses authenticated fetch/SSE at `/api/dashboard-live`, with bearer tokens in headers. Streams last up to 180 seconds and reconnect with a fresh access token, below the hosting HTTP timeout. They read only the selected view's data: enquiries/settings/contacts about every 20 seconds, analytics about every 90 seconds. Only changed snapshots are sent. Billing retains its six-hour shared cache and throttling backoff. This is a persistent connection with source reads, not a database change feed; processing delays still apply. Hidden tabs disconnect. Client reconnection, offline status and report errors retain the last available reports. Live updates preserve reporting inputs and never replace editable settings/contact forms; stale-version saves remain rejected.

Streaming checks: `node --test tests/live-stream.test.cjs tests/live-client.test.cjs`. The local preview fixture is not deployed and contains synthetic data only.

The Club pages editor uses a searchable club sidebar (collapsible on mobile). Facility switches control gym, club restaurant, accessible facilities and accessible beach access. These are validated booleans, recorded in before/after history and supplied to public pages and browse-card facility filters. Existing saved pages inherit their original facility flags until edited. Switches do not rewrite prose; editors must update descriptions and opening/access details where needed.
