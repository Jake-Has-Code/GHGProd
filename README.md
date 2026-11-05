# Grey Hat Goods

A responsive print-on-demand tee shop and cybersecurity/tech blog for **GreyHatGoods.com**. Uses your original SVG artwork, its blue (#00A2FD / #0074DD), silver, charcoal, and black palette. Includes a core collection, individual product URLs, S–3XL selection, quantity controls, saved bag, blog index and articles, and a server-side Stripe Checkout → Prodigi v5 integration.

The storefront is complete as a preview. Checkout is intentionally closed until real product mappings and service credentials are configured. The three designs, retail prices, and articles are editable starter content. Garment mockups are illustrations, not photographs or approved production proofs.

## Run in Docker

Requires Docker Engine with Compose. From this directory:

```sh
cp .env.example .env
docker compose up --build -d
```

Visit http://localhost:3000. The app runs as a non-root user. The `orders` volume preserves order snapshots across restarts. Keep the volume when upgrading; `docker compose down -v` removes it.

For GreyHatGoods.com, point the domain's A record (and www record) to your server, allow ports 80 and 443, set `APP_URL=https://greyhatgoods.com`, and run:

```sh
docker compose --profile production up --build -d
```

Caddy terminates TLS and redirects www to the primary domain. If using an existing reverse proxy, keep the app bound to loopback port 3000 and forward HTTPS requests to it. Domain/DNS access and a hosting server have not been supplied; these changes have not been performed.

## Configure Stripe and Prodigi

1. **Approve the products.** Choose a Prodigi shirt blank and verify every catalogue SKU, size, color attribute, print area, and country availability. Set each product/size entry in `config/variants.json`. The current empty values are placeholders and cannot open checkout. All 18 visible selections must be mapped.
2. **Prepare artwork.** Use production-ready PNG/PDF artwork on a publicly accessible HTTPS URL for every print area. The supplied vectors are used on the website; they are not automatically submitted as print files. Check Prodigi's required resolution and print dimensions for the chosen blank, then obtain a sample. Map `assets` per variant to the approved file, not the website mockup.
3. **Add test credentials to `.env`.** `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`, and `PRODIGI_API_KEY=sandbox_…`. No browser/public keys are required for Stripe-hosted checkout. Never commit `.env`.
4. **Configure Stripe Tax and receipt emails.** The integration enables automatic tax and uses Stripe's Clothing & Footwear tax code `txcd_30011000`. Set the business address and applicable registrations in Stripe, and enable successful payment receipt emails in the Dashboard. Confirm your treatment of tax and shipping with your business requirements.
5. **Confirm prices and regions.** Edit `lib/catalog.mjs` for retail prices in USD cents, and `.env` for `SHIPPING_COUNTRIES` and `SHIPPING_CENTS`. The default $5.99 shipping is an example flat retail fee, not a live Prodigi quote. Test multi-shirt costs and shipping destinations before selling. This first version uses one standard shipping method.
6. **Register Stripe's webhook** at `https://greyhatgoods.com/api/webhooks/stripe`. Subscribe to snapshot events `checkout.session.completed` and `checkout.session.async_payment_succeeded`, API version `2026-10-28.endive`. Copy its signing secret into `.env`. For local testing use Stripe CLI forwarding: `stripe listen --forward-to localhost:3000/api/webhooks/stripe` and use the secret printed by that local listener.
7. **Open test checkout** by setting `CHECKOUT_ENABLED=true`, rebuild, and complete a Stripe test payment. Verify the saved order record and sandbox order in Prodigi. Prodigi's response is acceptance for asynchronous submission; inspect its subsequent status and issues in the Prodigi Dashboard. No actual payments or print orders were placed during development.
8. **Finish launch content.** Publish the actual support email, garment details/measurements, delivery estimates, return/defect policy, and full privacy notice. Replace the preview notices on the shop/product/shipping/privacy pages.
9. **Go live deliberately.** Pair `sk_live_…` with the actual `live_…` Prodigi key, use the production Stripe webhook signing secret, and keep the HTTPS APP_URL. Test keys cannot be paired with live print keys. Changing a key's prefix does not convert it to another mode. Recreate containers to apply configuration changes.

A `PRODIGI_VARIANTS_JSON` environment override is available if you prefer deployment configuration over editing the mapping file. Its shape is identical to `config/variants.json`.

## Order behavior and operations

The browser sends only product IDs, sizes, and quantities. The server validates them and calculates prices from its own catalog. It creates a Stripe-hosted checkout session, snapshots the print SKUs/artwork in the persistent order volume, and returns the hosted checkout URL. No card details pass through this app.

Stripe's signed webhook triggers fulfillment only after retrieving the session from Stripe and confirming it is paid. Each print request uses `Idempotency-Key: ghg-<stripe-session-id>`. Prodigi v5 guarantees that concurrent/retried requests with the same key resolve to the same order. Accepted submissions are persisted; provider/storage failures return HTTP 500 to request a Stripe retry. The browser's success page does not trigger printing.

Inspect pending submissions with `docker compose logs shop`, Stripe Workbench's webhook delivery log, and Prodigi Dashboard. Prodigi can accept an order that later moves to `on_hold` or back to `draft`; monitor the Dashboard for production exceptions and shipment tracking. This version does not send custom shipping emails or automate refunds/cancellations. Manage those in Stripe and Prodigi, coordinating both before a print enters production.

The optional CLI in `server/manage-orders.mjs` supports `list`, `status <session_id>`, and `retry <session_id>` from a local source checkout with `.env` loaded and `DOCKER_RUNTIME=true`, `ORDER_STORE_DIR` pointed at the mounted order data. A simpler container workflow is to resend a failed event in Stripe Workbench; the same idempotency key prevents duplicate prints. Back up the named order volume and monitor failures. Keep the single instance/volume deployment, or replace this local store with a shared durable database before horizontal scaling.

## Edit and develop

- `lib/catalog.mjs`: designs, names, descriptions, prices. `lib/catalog.ts` supplies frontend types.
- `lib/articles.ts`: personal blog posts; add an object to publish another post.
- `public/brand/`: original vector artwork, with Adobe metadata removed; paths/gradients preserved.
- `app/globals.css`: all site styling and responsive breakpoints.
- `config/variants.json`: Prodigi mapping per product and size.
- `lib/commerce.mjs` and `server/orders.mjs`: payment and fulfillment functions.

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run build:container
```

The Sites preview is owner-private and uses the supplied Vinext/Workers adapter. The production container builds the same app with Next.js standalone output in `.next-container/`, separately from the Sites build. Checkout requires `DOCKER_RUNTIME=true` and durable storage, so it remains closed on the hosted design preview.

## API references

- [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create)
- [Stripe webhook signature verification](https://docs.stripe.com/webhooks)
- [Stripe tax codes](https://docs.stripe.com/tax/tax-codes)
- [Prodigi v5 documentation and schema](https://www.prodigi.com/print-api/docs/)

The provider integration was checked against these official API documents on November 5, 2026. Automated tests mock the providers; live integration requires the account credentials and approved garment mappings above.
