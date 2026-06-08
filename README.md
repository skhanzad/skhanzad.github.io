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

- **Config:** `tina/config.ts` — collection **Blog posts** → `content/blog` (`.mdx`), fields: title, description, date, tags, published, body.
- **Admin UI:** [http://localhost:3000/admin](http://localhost:3000/admin) (redirects to `/admin/index.html`) after `npm run dev` or `npm run build`.
- **Dev:** `npm run dev` runs `tinacms dev` plus Next.js (Tina GraphQL on port **4001** by default).
- **Production:** Create a project on [Tina Cloud](https://tina.io/docs/tina-cloud/overview), then set **`NEXT_PUBLIC_TINA_CLIENT_ID`** and **`TINA_TOKEN`** on your host. With those set, `npm run build` uses a cloud-backed client so the deployed admin can load and save content. Without them, the build still succeeds using a **local** client (fine for the public site; the hosted admin will not connect until Cloud is configured).
- Generated output (`public/admin/`, `tina/__generated__/`) is gitignored and recreated on each dev/build.

Copy `.env.example` to `.env.local` and fill in values as needed.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
