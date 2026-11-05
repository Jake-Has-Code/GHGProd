# Grey Hat Goods

A responsive print-on-demand tee shop and cybersecurity/tech blog for **GreyHatGoods.com**. Uses the original Grey Hat Goods SVG artwork and its blue (#00A2FD / #0074DD), silver, charcoal, and black palette. Includes individual product URLs, S–3XL selection, quantities, a saved bag, blog articles, and **Stripe Checkout → Printify fulfillment**.

Checkout stays closed until credentials and real Printify product mappings are configured. The three designs, retail prices, and articles are editable starter content. Shirt mockups illustrate the designs; replace them with approved Printify mockups after selecting the garments.

## Run in Docker

Requires Docker Engine with Compose. From this directory:

```sh
cp .env.example .env
docker compose up --build -d
```

Visit http://localhost:3000. The app runs as a non-root user. The `orders` volume preserves checkout snapshots and fulfillment records across restarts. Keep this volume when upgrading; `docker compose down -v` deletes it.

For GreyHatGoods.com, point the domain and www DNS records to your server, allow ports 80 and 443, set `APP_URL=https://greyhatgoods.com`, then run:

```sh
docker compose --profile production up --build -d
```

Caddy provides HTTPS and redirects www to the main domain. With an existing reverse proxy, forward HTTPS traffic to the app's loopback port 3000 instead. Public hosting and domain DNS have not been configured.

## Configure Stripe and Printify

1. **Create an API-connected Printify store.** Generate a personal access token with the shop/order scopes needed by the integration. Save it as `PRINTIFY_API_TOKEN` and put the API store's numeric ID in `PRINTIFY_SHOP_ID`. Shop IDs are available from `GET https://api.printify.com/v1/shops.json`. Keep tokens in `.env`; never use a `NEXT_PUBLIC_` prefix or commit secrets.
2. **Create and approve the three shirts in Printify.** Choose the garment and print provider, upload the artwork, position it, enable the black S–3XL variants, and approve the print files and product details. Artwork belongs to the saved Printify products. The website sends existing product/variant references rather than creating products or uploading artwork during checkout.
3. **Map the collection.** Replace every placeholder in `config/variants.json` with its Printify **product ID** and numeric **variant ID**. Product IDs come from the API store's product resources; variant IDs identify the exact garment/color/size combination. All 18 visible selections must be mapped before checkout can open. `PRINTIFY_VARIANTS_JSON` can override this file at deployment.

   ```json
   {
     "ghost-protocol": {
       "L": { "product_id": "YOUR_PRINTIFY_PRODUCT_ID", "variant_id": 12345 }
     }
   }
   ```

   The example is illustrative; copy actual IDs from your store. Keep existing Printify product designs stable while paid orders reference them, and use a new product ID for a new design revision.
4. **Configure Stripe.** Add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` to `.env`. Set the business address and applicable tax registrations in Stripe Tax, and enable successful payment receipt emails. The app uses Stripe-hosted checkout, automatic tax, and the Clothing & Footwear code `txcd_30011000`; no browser payment key is needed.
5. **Confirm prices, countries and shipping.** Edit `lib/catalog.mjs` for USD retail prices and `.env` for `SHIPPING_COUNTRIES` and `SHIPPING_CENTS`. The sample $5.99 fee is a flat retail shipping charge, not a Printify quote. Confirm product availability and costs for every destination and multi-shirt combination. This version offers standard shipping (`shipping_method: 1`).
6. **Configure the Stripe webhook** at `https://greyhatgoods.com/api/webhooks/stripe`. Subscribe to snapshot events `checkout.session.completed` and `checkout.session.async_payment_succeeded`, using API version `2026-10-28.endive`. Save its signing secret in `.env`. Locally, run `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use that listener's secret.
7. **Test Stripe first.** Use `sk_test_…`, set `CHECKOUT_ENABLED=true`, rebuild, and complete a test checkout. The signed payment event is saved as `test_paid` in the order volume. **Stripe test payments never call Printify**, so they cannot create or print a real order. These local test records are not Printify orders. Automated provider tests also use mocks; no provider account is required to run them.
8. **Choose Printify's order approval settings.** New API orders follow the Printify store's approval settings. Use Manual while inspecting provider setup, then choose the automatic approval timing you want for live sales. The app creates the paid order once; Printify controls when it enters production and charges your linked payment method or balance. Shipment tracking and production exceptions are managed in Printify Dashboard.
9. **Complete launch content and go live.** Publish actual garment measurements/materials, approved mockups, delivery estimates, support contact, returns/defect policy, and privacy details. Switch to `sk_live_…` with the production Stripe webhook secret and the HTTPS `APP_URL`. Recreate containers to apply environment changes. Live paid sessions create real Printify orders using your configured store.

## Payment and fulfillment behavior

The browser sends product IDs, sizes and quantities. The server validates them and calculates prices from its own catalog. It creates a Stripe Checkout Session and saves an immutable snapshot of the selected Printify product/variant IDs and shop ID in the persistent order volume before redirecting the customer.

Only a verified Stripe webhook triggers fulfillment. The server retrieves the session from Stripe, checks that it is paid and belongs to this store, and checks its live/test mode against the server credentials. The browser's success page never creates a print order. Test payments are recorded locally; live payments create a Printify order with the Stripe session ID as the external order reference and label. Shipping names, address, email and phone (when present) map to Printify's `address_to` fields. Payment card details remain with Stripe.

Printify orders reference your preconfigured product artwork. The application does not upload images or change a product design when someone buys a tee. Printify's store approval settings control production. Custom shipping notifications, automated refunds/cancellations and a customer tracking portal are outside this first version; manage fulfillment and exceptions in Printify Dashboard and coordinate refunds in Stripe.

### Retries and lost responses

The order store records the accepted Printify ID and serializes simultaneous webhook events. An atomic attempt file also survives process/container restarts. Once a creation request has an uncertain outcome (timeout, dropped response, provider 5xx, or unreadable success), subsequent events **do not send another create request**. The record becomes `submission_unknown`; reconcile its external reference in Printify before linking the existing order. No undocumented provider idempotency header is assumed.

Explicit rejection responses (400, 401, 403, 404, 422 or 429) leave the order retryable after correction. Provider/storage failures return HTTP 500 so Stripe requests another delivery. Stripe retries cannot recreate an accepted or uncertain order. If a webhook arrives before its checkout snapshot is saved, it also returns 500 for retry.

From a local source checkout with `.env` loaded and `DOCKER_RUNTIME=true`, point `ORDER_STORE_DIR` at your order data and use:

```sh
node --env-file=.env server/manage-orders.mjs list
node --env-file=.env server/manage-orders.mjs status STRIPE_SESSION_ID
node --env-file=.env server/manage-orders.mjs retry STRIPE_SESSION_ID
node --env-file=.env server/manage-orders.mjs link STRIPE_SESSION_ID PRINTIFY_ORDER_ID
```

`link` makes a read-only Printify lookup, verifies the external reference and exact products/variants/quantities, then stores the existing provider ID locally. It does not create or submit another order. If an uncertain request produced no order, investigate with Printify before clearing its attempt record; deleting one without reconciliation can create duplicates.

Watch `docker compose logs shop`, Stripe Workbench's delivery log and Printify Dashboard. Back up the named volume. Older checkout snapshots without a Printify mapping are rejected for review rather than sent using unrelated new IDs. Use one application instance with this volume; replace the local store with a shared durable database before horizontal scaling.

## Edit and develop

- `lib/catalog.mjs`: design names, descriptions and prices. `lib/catalog.ts` supplies frontend types.
- `lib/articles.ts`: blog content.
- `public/brand/`: supplied SVG artwork with Adobe metadata removed; artwork paths and gradients preserved.
- `app/globals.css`: layout, colors and responsive styling.
- `config/variants.json`: Printify product/variant mapping per size.
- `lib/commerce.mjs`: server pricing, Stripe verification and Printify API/payload helpers.
- `server/orders.mjs`: durable order snapshots, deduplication and recovery.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build:container
```

The owner-private Sites preview uses the supplied Vinext/Workers adapter. Docker builds the same app with Next.js standalone output in `.next-container/`. Checkout requires the container runtime and persistent storage, so it remains closed on the hosted design preview.

## Official API references

- [Printify API: authentication, products and orders](https://developers.printify.com/)
- [Printify store order approval settings](https://help.printify.com/hc/en-us/articles/4483625253265-How-do-I-set-up-store-details-and-order-approval-settings)
- [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe webhook signature verification](https://docs.stripe.com/webhooks)
- [Stripe product tax codes](https://docs.stripe.com/tax/tax-codes)

Checked against official documentation on November 5, 2026. No live payment or Printify order has been placed during development. Live account verification still requires your credentials, approved products and chosen order approval settings.
