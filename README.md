This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Blog, RSS, and SEO

- Posts live in `content/blog/` (Markdown / MDX).
- **RSS:** `/feed.xml`
- **Sitemap:** `/sitemap.xml` — **Robots:** `/robots.txt`

Set **`NEXT_PUBLIC_SITE_URL`** to your canonical site origin in production (for example `https://yourdomain.com`) so RSS, sitemap, Open Graph, and `metadataBase` resolve correctly. On Netlify, the `URL` environment variable is used as a fallback when unset.

### TinaCMS (MDX admin)

- **Config:** `tina/config.ts` — collection **Blog posts** → `content/blog` (`.mdx`), fields: title, description, date, tags, published, body. **Branch** resolves from `GITHUB_BRANCH`, **`BRANCH`** (Netlify), `VERCEL_GIT_COMMIT_REF`, `HEAD`, then defaults to **`main`** — set your default branch in Git/Tina Cloud accordingly.
- **Admin UI:** [http://localhost:3000/admin](http://localhost:3000/admin) (redirects to `/admin/index.html`) after `npm run dev` or `npm run build`.
- **Scripts:** `npm run dev` / `npm run build` run **`node_modules/.bin/tinacms`** (from **`@tinacms/cli`**) so the CLI always loads **this repo’s** `tinacms` dependency when bundling `tina/config.ts`. Avoid **`npx @tinacms/cli`** alone — it can run a **cached** CLI without your `tinacms` package and fails with “Could not resolve tinacms”.
- **CLI:** Use **`npm run dev`** / **`npm run build`** so `tinacms` comes from `node_modules/.bin` (`@tinacms/cli`). Plain **`npx tinacms`** often fails (“could not determine executable to run”); use **`npx --no-install @tinacms/cli …`** only if you must invoke the CLI by hand.
- **Port 9000 / “Datalayer server is busy”:** Another `tinacms dev` is running. Stop it (**Ctrl+C**) or use **`npm run dev:alt`** (Tina on **14002** / **19002**).
- **`npm run build` while `npm run dev` runs:** Stop dev first — both use Tina’s default ports (**4001** / **9000**) and will conflict.
- **“Index version … Reindex” / `GetCollection` errors:** Tina Cloud needs a **full** `tinacms build` with your **Cloud env** so indexes update. Then **commit and push** `tina/tina-lock.json` (see below). You can also use **Tina Cloud → project → Reindex** if the dashboard offers it.
- **Production:** [Tina Cloud](https://tina.io/docs/tina-cloud/overview) — set **`NEXT_PUBLIC_TINA_CLIENT_ID`** and **`TINA_TOKEN`** on your host. Without them, `tinacms build` still runs locally for admin assets; Cloud admin stays disconnected until configured.
- **Generated (gitignored):** `public/admin/`, `tina/__generated__/` — recreated on dev/build.
- **Committed:** `tina/config.ts`, **`tina/tina-lock.json`** (schema lock for Tina Cloud — **not** gitignored).

Copy `.env.example` to `.env.local` and fill in values as needed.

## Deploy on Netlify

1. **Publish directory:** In the Netlify UI, open **Site configuration → Build & deploy** and clear **Publish directory** (leave it blank). Setting it to **`.next`** breaks [`@netlify/plugin-nextjs`](https://docs.netlify.com/frameworks/next-js/overview/) and often fails the deploy. Your logs still showed `publish: .../.next` from the UI — remove it there so `publishOrigin` is not `ui`.
2. **Build command:** `npm run build` (set in `netlify.toml`).
3. **Node / memory:** `netlify.toml` sets **`NODE_OPTIONS=--max-old-space-size=6144`** so **`tinacms build`** (with Tina Cloud indexing) is less likely to OOM.
4. **Environment:** Set `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_TINA_CLIENT_ID`, and `TINA_TOKEN` as needed.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
