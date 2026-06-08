import { defineConfig } from "tinacms";

const branch =
  process.env.GITHUB_BRANCH ||
  process.env.VERCEL_GIT_COMMIT_REF ||
  process.env.HEAD ||
  "main";

// Tina Cloud (https://tina.io/docs/tina-cloud/overview) — optional for local-only `tinacms dev --local`
const clientId = process.env.NEXT_PUBLIC_TINA_CLIENT_ID;
const token = process.env.TINA_TOKEN;

export default defineConfig({
  branch,

  clientId: clientId ?? "",
  token: token ?? "",

  build: {
    outputFolder: "admin",
    publicFolder: "public",
  },

  media: {
    tina: {
      publicFolder: "public",
      mediaRoot: "",
    },
  },

  schema: {
    collections: [
      {
        name: "blog",
        label: "Blog posts",
        path: "content/blog",
        format: "mdx",
        fields: [
          {
            type: "string",
            name: "title",
            label: "Title",
            isTitle: true,
            required: true,
          },
          {
            type: "string",
            name: "description",
            label: "Description",
            ui: { component: "textarea" },
          },
          {
            type: "datetime",
            name: "date",
            label: "Date",
            required: true,
          },
          {
            type: "string",
            name: "tags",
            label: "Tags",
            list: true,
            ui: {
              description: "Topics for this post (e.g. AI, engineering).",
            },
          },
          {
            type: "boolean",
            name: "published",
            label: "Published",
            ui: {
              description: "Only published posts appear on the site.",
            },
          },
          {
            type: "rich-text",
            name: "body",
            label: "Body",
            isBody: true,
            templates: [],
          },
        ],
      },
    ],
  },
});
