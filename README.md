# JSON to DTO Generator

Nuxt 4 app for turning JSON into strongly typed DTO classes.

## Setup

Install dependencies with Bun:

```bash
bun install
```

## Local Development

Start the regular Nuxt dev server:

```bash
bun run dev
```

## Local Cloudflare Preview

Build the Cloudflare Pages output and run it through Wrangler:

```bash
bun run build:cf
bun run preview:cf
```

Wrangler serves the app on `http://localhost:8788` by default, so this is the closest local check to the Cloudflare Pages runtime.

If you need local Cloudflare vars for preview, add them to `.dev.vars`. Keep that file uncommitted.

## Deploy

Deploy the same Pages build with Wrangler:

```bash
bun run build:cf
wrangler pages deploy dist
```

## Tests

```bash
bun run test
```
