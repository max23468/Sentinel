import { createHash } from "node:crypto";

export function sha256(input: string | Uint8Array): string {
  return createHash("sha256").update(input).digest("hex");
}

export function urlId(url: string): string {
  return sha256(url).slice(0, 16);
}
