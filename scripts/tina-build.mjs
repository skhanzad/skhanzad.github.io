import { execSync } from "node:child_process";

const hasCloud =
  process.env.NEXT_PUBLIC_TINA_CLIENT_ID?.trim() &&
  process.env.TINA_TOKEN?.trim();

const cmd = hasCloud
  ? "tinacms build --skip-cloud-checks --noTelemetry"
  : "tinacms build --local --skip-cloud-checks --noTelemetry";

console.log(
  hasCloud
    ? "[tina-build] Using Tina Cloud credentials for GraphQL client."
    : "[tina-build] No Tina Cloud env — local GraphQL client (admin needs `npm run dev` or set NEXT_PUBLIC_TINA_CLIENT_ID + TINA_TOKEN for production admin)."
);

execSync(cmd, { stdio: "inherit" });
