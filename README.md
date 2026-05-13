# JAMStack E-commerce & Blog Project

A modern JAMStack website built with Eleventy, featuring a landing page, blog, and e-commerce functionality with integrated payment processing and email services.

## Architecture Overview

This project follows the JAMStack (JavaScript, APIs, Markup) architecture pattern:
- **JavaScript**: Client-side functionality and API integrations
- **APIs**: Headless services for content management, payments, and email
- **Markup**: Pre-built HTML generated at build time

## Technology Stack

### Core Framework
- **[Eleventy (11ty)](https://www.11ty.dev/)** - Static site generator
- **Nunjucks** - Templating engine
- **Sass/SCSS** - CSS preprocessing
- **PostCSS** - CSS post-processing with autoprefixer

### Content Management
- **[TinaCMS](https://tina.io/)** - Git-based headless CMS
- **Markdown** - Content format for blog posts
- **JSON** - Data files for products and configuration

### Hosting & Deployment
- **[GitHub](https://github.com)** - Code repository and version control
- **[Netlify](https://netlify.com)** - Hosting and continuous deployment
- **[Cloudflare](https://cloudflare.com)** - CDN and performance optimization

### Services & APIs
- **[RedSys](https://www.redsys.es/)** - Spanish payment gateway integration
- **[Brevo](https://www.brevo.com/)** - Email delivery service
- **[Supabase](https://supabase.com/)** - Low-cost order storage for guest checkout
- **Netlify Functions** - Serverless functions for API endpoints

### Development Tools
- **npm/Node.js** - Package management and build tools
- **Webpack** - Asset bundling
- **ESLint** - JavaScript linting
- **Prettier** - Code formatting

## 📁 Project Structure

```
project-root/
├── src/
│   ├── _data/
│   │   ├── site.json
│   │   ├── products.json
│   │   └── navigation.json
│   ├── _includes/
│   │   ├── layouts/
│   │   │   ├── base.njk
│   │   │   ├── page.njk
│   │   │   ├── blog.njk
│   │   │   └── product.njk
│   │   ├── components/
│   │   │   ├── header.njk
│   │   │   ├── footer.njk
│   │   │   ├── product-card.njk
│   │   │   └── contact-form.njk
│   │   └── partials/
│   │       ├── head.njk
│   │       └── scripts.njk
│   ├── assets/
│   │   ├── css/
│   │   │   ├── main.scss
│   │   │   └── components/
│   │   ├── js/
│   │   │   ├── main.js
│   │   │   ├── cart.js
│   │   │   └── payment.js
│   │   └── images/
│   ├── blog/
│   │   ├── index.njk
│   │   └── posts/
│   │       └── *.md
│   ├── shop/
│   │   ├── index.njk
│   │   ├── product.njk
│   │   └── cart.njk
│   ├── admin/
│   │   └── index.html
│   ├── pages/
│   │   ├── about.njk
│   │   └── contact.njk
│   └── index.njk
├── netlify/
│   └── functions/
│       ├── payment-process.js
│       ├── send-email.js
│       └── webhook-handler.js
├── tina/
│   ├── config.ts
│   └── __generated__/
├── .eleventy.js
├── .tina/
├── package.json
├── netlify.toml
├── _redirects
└── README.md
```

## Features

### Landing Page
- Hero section with call-to-action
- Featured products showcase
- Latest blog posts preview
- Contact form with Brevo integration
- Responsive design with mobile-first approach

### Blog System
- Markdown-based content creation
- TinaCMS integration for admin editing
- Category and tag filtering
- RSS feed generation
- SEO optimization

### E-commerce
- Product catalog with categories
- Shopping cart functionality
- RedSys payment integration
- Order confirmation emails
- Inventory management

### Admin Panel
- TinaCMS-powered content management
- Live preview editing
- Media management
- User authentication

## Payment Flow, Source of Truth, and Failure Modes

This repo integrates RedSys via Netlify Functions.

### Endpoints

- `POST /.netlify/functions/create-order`: Validates cart + customer, stores `orders` and `order_items` in Supabase.
- `POST /.netlify/functions/payment-process`: Prepares RedSys parameters for an existing order, updates the order to `pending` and sets `payment_reference`.
- `POST /.netlify/functions/payment-callback`: RedSys server-to-server callback; verifies signature and finalizes `payment_status` in Supabase.

### Source of truth

- The only authoritative payment result is `/.netlify/functions/payment-callback` (signed payload + server-side update in Supabase).
- Browser redirects (`Ds_Merchant_UrlOK` / `Ds_Merchant_UrlKO`) are UX only and can be missed due to network/browser issues.

### Order state transitions (current implementation)

- On initiation (`payment-process`): `status = pending_payment`, `payment_status = pending`, `payment_reference` is set.
- On callback success (`Ds_Response 0..99`): `status = processed`, `payment_status = paid`, `fulfillment_status = delivered`.
- On callback failure (`Ds_Response > 99`): `status = pending_payment`, `payment_status = failed`.

### Cart behavior

- Cart persistence/clearing is client-side.
- Recommendation: clear the cart only after confirming the order is `paid` (do not rely solely on a user landing on `/payment/success`).

### Lost connection scenarios

1. Client loses connection before calling `payment-process`.
2. Client pays but never returns to the site.
3. Callback arrives but our callback handler fails (Supabase down, etc.).

In scenarios 2 and 3, payment may be captured without the user seeing the success page. The callback handler is responsible for recording the final payment status; the redirect is not.

### Payment unit tests

This repo includes simple payment unit tests using Node's built-in test runner.

Run them with:

```bash
npm test
```

Current coverage is split into two groups:

- `test/payment-process.test.js`: tests payment initiation helpers and handler behavior such as missing orders, invalid totals, already-paid orders, valid payment payload generation, and missing payment configuration.
- `test/payment-callback.test.js`: tests callback signature verification, body parsing, payment snapshot merging, successful and failed callback flows, missing callback payloads, missing secret-key configuration, and idempotent handling of already-paid orders.

These tests are unit-level and mock external services such as Supabase. They do not exercise the browser cart flow or live RedSys/Brevo integrations.

## Setup & Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn
- Git
- Netlify account
- GitHub account
- Cloudflare account

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/campossrg/web_castanya.git
   cd your-project
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment variables**
   Create `.env` file:
   ```env
     BREVO_API_KEY=your_brevo_api_key
     EMAIL_SENDING_ENABLED=true
     FROM_EMAIL=no-reply@example.com
     FROM_NAME=Castanya de Viladrau
     ORDER_NOTIFICATION_EMAIL=orders@example.com
    REDSYS_MERCHANT_CODE=your_merchant_code
    REDSYS_SECRET_KEY=your_secret_key
    SUPABASE_URL=your_supabase_project_url
    SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
    TINA_TOKEN=your_tina_token
   ```

4. **Start development server**
    ```bash
    npm run dev
    ```

    Notes:
    - `npm run dev` runs Eleventy only.
    - To run Netlify Functions locally (so `/.netlify/functions/*` works), use `npm run netlify:dev`.

    ```bash
    npm run netlify:dev
    ```

5. **Start TinaCMS**
   ```bash
   npm run tina:dev
   ```

### Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Initial commit"
   git push origin main
   ```

2. **Connect to Netlify**
   - Link GitHub repository
   - Set build command: `npm run build`
   - Set publish directory: `_site`
   - Add environment variables

3. **Configure Cloudflare**
   - Add your Netlify domain to Cloudflare
   - Configure DNS settings
   - Enable CDN and optimization features

## Scripts

```json
{
  "dev": "eleventy --serve",
  "build": "eleventy",
  "tina:dev": "tinacms dev -c \"npm run dev\"",
  "tina:build": "tinacms build",
  "lint": "eslint src/assets/js",
  "format": "prettier --write ."
}
```

## Configuration Files

### Eleventy Configuration (`.eleventy.js`)
- Template engine setup
- Collections configuration
- Plugin integrations
- Asset pipeline

### Netlify Configuration (`netlify.toml`)
- Build settings
- Functions configuration
- Headers and redirects
- Environment variables

## Supabase Orders Schema

For the low-cost guest checkout flow, this repo now includes a minimal schema for orders only:

- `public.orders`
- `public.order_items`

Run `supabase/schema-orders.sql` in the Supabase SQL Editor before implementing the backend checkout steps.

This schema is intentionally small:

- cart state stays in the browser with `localStorage`
- customer accounts are not required
- orders are created through Netlify Functions using the service role key
- Supabase Table Editor can be used as the initial admin interface

## Create Order Function

Step 6 uses `netlify/functions/create-order.js` to create guest checkout orders in Supabase.

Request body shape:

```json
{
  "items": [
    {
      "sku": "castanya-viladrau-torrada-250",
      "quantity": 2
    }
  ],
  "customer": {
    "name": "Nom Client",
    "email": "client@example.com",
    "phone": "+34 600 000 000",
    "country": "Espanya",
    "address": "Carrer Exemple 12",
    "city": "Barcelona",
    "postalCode": "08001",
    "notes": "Trucar abans d'entregar"
  }
}
```

Important behavior:

- prices are recalculated on the backend
- browser totals are ignored
- Product slugs + variant labels are validated against `src/_data/products.json`
- the function inserts one row in `orders` and many rows in `order_items`

## Payment Initiation Function

Step 7 updates `netlify/functions/payment-process.js` so payment starts from the stored Supabase order instead of browser totals.

Request body shape:

```json
{
  "orderId": "supabase-order-uuid"
}
```

You can also send:

```json
{
  "publicOrderCode": "CV-12345678-ABCD"
}
```

Important behavior:

- the function loads the order from Supabase
- the charged amount comes from `orders.total_amount`
- a 12-digit `payment_reference` is generated and stored for RedSys callback matching
- if RedSys env vars are missing, the function returns a controlled `Payment provider not configured` error
- `REDSYS_URL` is optional and defaults to the RedSys test URL

## Payment Callback Function

Step 8 updates `netlify/functions/payment-callback.js` to resolve the order from the stored `payment_reference` and update Supabase after the RedSys response.

Important behavior:

- the callback verifies the RedSys signature before updating anything
- the order is resolved by `orders.payment_reference`
- successful callbacks set:
  - `status = paid`
  - `payment_status = paid`
- failed callbacks set:
  - `payment_status = failed`
- the raw callback payload is stored in `payment_raw_response`
- already-paid callbacks return `OK` without duplicating work

## Order Confirmation Email

Step 9 sends the order confirmation email after a verified successful payment callback.

Important behavior:

- payment success is written to Supabase first
- confirmation email is attempted afterwards as a best-effort action
- set `EMAIL_SENDING_ENABLED=false` to disable all outgoing emails from `.env`
- if `BREVO_API_KEY` or `FROM_EMAIL` is missing, payment still remains `paid`
- missing Brevo configuration is treated like RedSys configuration: code is ready, activation depends on environment variables

### TinaCMS Configuration (`tina/config.ts`)
- Content schema definition
- Collection setup
- Field configurations
- Authentication

## Security & Best Practices

- Environment variables for sensitive data
- HTTPS enforcement via Netlify/Cloudflare
- CSP headers configuration
- Input validation and sanitization
- Secure payment processing with RedSys

## Performance Optimization

- Static site generation for fast loading
- Image optimization and lazy loading
- CSS and JS minification
- Cloudflare CDN integration
- Service worker for offline functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Check the documentation
- Open an issue on GitHub
- Contact the development team [campos.srg](campos.srg@gmail.com) or follow the next link: [campossrg.io](https://campossrg.github.io/)

---

Built with ❤️ using the JAMStack architecture
