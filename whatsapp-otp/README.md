# WhatsApp booking verification

The Worker keeps the Wasender API key and Firebase signing key off the website. Never put either secret in `js/`, `index.html`, or source control.

## Deploy the free-tier backend

1. Create/sign in to a Cloudflare account and install Wrangler locally with `npm install --save-dev wrangler` (run from the repository root).
2. Create a D1 database:

   ```powershell
   npx wrangler d1 create nissi-whatsapp-otp
   ```

   Copy the returned database ID into `whatsapp-otp/wrangler.jsonc`, replacing `REPLACE_WITH_D1_DATABASE_ID`.
3. Create the tables:

   ```powershell
   npx wrangler d1 execute nissi-whatsapp-otp --remote --file=whatsapp-otp/migrations/0001_create_otp_tables.sql --config whatsapp-otp/wrangler.jsonc
   ```
4. In Google Cloud Console, create a service-account key for the `nissi-c1b25` Firebase project. Use the service-account email in `whatsapp-otp/wrangler.jsonc`. Keep the JSON key private; do not add it to this repository.
5. Set Worker secrets interactively. Use the Wasender session key and the private key from the service-account JSON:

   ```powershell
   npx wrangler secret put WASENDER_API_KEY --config whatsapp-otp/wrangler.jsonc
   npx wrangler secret put OTP_HASH_SECRET --config whatsapp-otp/wrangler.jsonc
   npx wrangler secret put FIREBASE_SERVICE_ACCOUNT_PRIVATE_KEY --config whatsapp-otp/wrangler.jsonc
   ```

   Use a long random value (at least 32 characters) for `OTP_HASH_SECRET`. Paste the private key including its PEM header and footer when prompted.
6. Deploy:

   ```powershell
   npx wrangler deploy --config whatsapp-otp/wrangler.jsonc
   ```
7. Copy the deployed `workers.dev` URL into `otpApiBaseUrl` in `js/otp-config.js`. If the site uses a custom domain, add its exact `https://` origin to `ALLOWED_ORIGINS` in `whatsapp-otp/wrangler.jsonc` and deploy again.
8. Ensure Firebase Authentication is enabled for the project, then deploy Hosting and the updated Firestore rules from the repository root:

   ```powershell
   npx firebase-tools deploy --only hosting,firestore:rules --project nissi-c1b25
   ```

The Worker expires codes after five minutes, permits five code attempts, enforces a one-minute resend cooldown, and limits sends to three per phone and twenty per IP per day. These controls reduce abuse but do not make the Wasender trial permanent; review Wasender's trial limits and WhatsApp account policies before launch. Customers should request the code themselves and have WhatsApp enabled for the number they enter.
