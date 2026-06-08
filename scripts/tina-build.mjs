import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const bin = path.join(root, "node_modules", ".bin");

const hasCloud =
  process.env.NEXT_PUBLIC_TINA_CLIENT_ID?.trim() &&
  process.env.TINA_TOKEN?.trim();

/** Ports 4001/9000 are used by `tinacms dev`; local build uses others so build can run alongside dev. */
const localArgs =
  " build --local --skip-cloud-checks --noTelemetry -p 14001 --datalayer-port 19000";

const cmd = hasCloud
  ? "tinacms build --skip-cloud-checks --noTelemetry"
  : `tinacms${localArgs}`;

console.log(
  hasCloud
    ? "[tina-build] Using Tina Cloud credentials for GraphQL client."
    : "[tina-build] No Tina Cloud env — local GraphQL client (build uses :14001 / :19000 so `npm run dev` can keep :4001 / :9000). Set NEXT_PUBLIC_TINA_CLIENT_ID + TINA_TOKEN for production admin."
);

const env = {
  ...process.env,
  PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
};

execSync(cmd, { stdio: "inherit", cwd: root, env });
