import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { LookupFunction } from "node:net";
import { Agent } from "undici";
import type { SiteConfig } from "./types.js";
import { isSameSite } from "./url.js";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_HTML_BYTES = 5 * 1024 * 1024;
export const MAX_ROBOTS_BYTES = 512 * 1024;
export const MAX_SITEMAP_BYTES = 5 * 1024 * 1024;

const MAX_REDIRECTS = 5;
const MAX_SCAN_BYTES = 100 * 1024 * 1024;
const EXTRA_SCAN_REQUESTS = 64;
const blockedAddresses = createBlockedAddresses();

interface OutboundDependencies {
  fetch?: typeof fetch;
  resolve?: (hostname: string) => Promise<Array<{ address: string; family: 4 | 6 }>>;
}

interface OutboundOptions {
  headers?: HeadersInit;
  maxBytes: number | ((url: string, headers: Headers) => number);
}

export interface OutboundResponse {
  body: Uint8Array;
  headers: Headers;
  status: number;
  url: string;
}

export class OutboundBudgetError extends Error {}

export class OutboundClient {
  private remainingBytes = MAX_SCAN_BYTES;
  private remainingRequests: number;
  private readonly fetchImpl: typeof fetch;
  private readonly resolve: NonNullable<OutboundDependencies["resolve"]>;

  constructor(
    private readonly site: SiteConfig,
    dependencies: OutboundDependencies = {}
  ) {
    this.remainingRequests = site.crawl.maxUrls + EXTRA_SCAN_REQUESTS;
    this.fetchImpl = dependencies.fetch ?? fetch;
    this.resolve = dependencies.resolve ?? resolveAddresses;
  }

  async get(rawUrl: string, options: OutboundOptions): Promise<OutboundResponse> {
    let currentUrl = this.authorize(rawUrl);

    for (let redirects = 0; ; redirects += 1) {
      if (this.remainingRequests-- <= 0) {
        throw new OutboundBudgetError("Budget richieste dello scan esaurito.");
      }

      const addresses = await this.resolvePinnedAddresses(currentUrl);
      const dispatcher = new Agent({
        connect: { lookup: pinnedLookup(addresses) }
      });

      try {
        const response = await this.fetchImpl(currentUrl, {
          dispatcher,
          headers: options.headers,
          redirect: "manual",
          signal: AbortSignal.timeout(this.site.crawl.timeoutMs)
        } as RequestInit);

        const location = response.headers.get("location");
        if (location && isRedirect(response.status)) {
          await response.body?.cancel();
          if (redirects >= MAX_REDIRECTS) throw new Error(`Troppi redirect: ${rawUrl}`);
          currentUrl = this.authorize(new URL(location, currentUrl).toString());
          continue;
        }

        if (response.status < 200 || response.status >= 300) {
          await response.body?.cancel();
          return {
            body: new Uint8Array(),
            headers: response.headers,
            status: response.status,
            url: currentUrl
          };
        }

        const maxBytes =
          typeof options.maxBytes === "function"
            ? options.maxBytes(currentUrl, response.headers)
            : options.maxBytes;
        const body = await this.readBody(response, maxBytes);
        return { body, headers: response.headers, status: response.status, url: currentUrl };
      } finally {
        await dispatcher.close();
      }
    }
  }

  private authorize(rawUrl: string): string {
    let url: URL;
    try {
      url = new URL(rawUrl);
    } catch {
      throw new Error(`Destinazione non valida: ${rawUrl}`);
    }
    if (!isSameSite(url.toString(), this.site)) {
      throw new Error(`Destinazione non autorizzata: ${rawUrl}`);
    }
    return url.toString();
  }

  private async resolvePinnedAddresses(url: string): Promise<Array<{ address: string; family: 4 | 6 }>> {
    const rawHostname = new URL(url).hostname;
    const hostname = rawHostname.startsWith("[") ? rawHostname.slice(1, -1) : rawHostname;
    const addresses = await this.resolve(hostname);
    if (addresses.length === 0) throw new Error(`DNS senza indirizzi per ${hostname}`);
    if (addresses.some(({ address, family }) => !isPublicAddress(address, family))) {
      throw new Error(`Destinazione privata o riservata bloccata: ${hostname}`);
    }
    return addresses;
  }

  private async readBody(response: Response, maxBytes: number): Promise<Uint8Array> {
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      await response.body?.cancel();
      throw new Error(`Risposta oltre il limite di ${maxBytes} byte.`);
    }

    const reader = response.body?.getReader();
    if (!reader) return new Uint8Array();

    const chunks: Uint8Array[] = [];
    let responseBytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        responseBytes += value.byteLength;
        if (responseBytes > maxBytes) throw new Error(`Risposta oltre il limite di ${maxBytes} byte.`);
        if (value.byteLength > this.remainingBytes) {
          throw new OutboundBudgetError("Budget byte dello scan esaurito.");
        }
        this.remainingBytes -= value.byteLength;
        chunks.push(value);
      }
    } catch (error) {
      await reader.cancel();
      throw error;
    }

    const body = new Uint8Array(responseBytes);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return body;
  }
}

export function isPublicAddress(address: string, family = isIP(address)): boolean {
  if (family !== 4 && family !== 6) return false;
  if (family === 6 && address.toLowerCase().startsWith("::ffff:")) return false;
  return !blockedAddresses.check(address, family === 4 ? "ipv4" : "ipv6");
}

export function pinnedLookup(addresses: Array<{ address: string; family: 4 | 6 }>): LookupFunction {
  return (_hostname, options, callback) =>
    callback(null, options.all ? addresses : addresses[0].address, addresses[0].family);
}

async function resolveAddresses(hostname: string): Promise<Array<{ address: string; family: 4 | 6 }>> {
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  return addresses.map(({ address, family }) => {
    if (family !== 4 && family !== 6) throw new Error(`Famiglia DNS non supportata per ${hostname}`);
    return { address, family };
  });
}

function isRedirect(status: number): boolean {
  return [301, 302, 303, 307, 308].includes(status);
}

function createBlockedAddresses(): BlockList {
  const list = new BlockList();
  for (const [network, prefix] of [
    ["0.0.0.0", 8],
    ["10.0.0.0", 8],
    ["100.64.0.0", 10],
    ["127.0.0.0", 8],
    ["169.254.0.0", 16],
    ["172.16.0.0", 12],
    ["192.0.0.0", 24],
    ["192.0.2.0", 24],
    ["192.168.0.0", 16],
    ["198.18.0.0", 15],
    ["198.51.100.0", 24],
    ["203.0.113.0", 24],
    ["224.0.0.0", 4],
    ["240.0.0.0", 4]
  ] as const) {
    list.addSubnet(network, prefix, "ipv4");
  }
  for (const [network, prefix] of [
    ["::", 128],
    ["::1", 128],
    ["64:ff9b:1::", 48],
    ["100::", 64],
    ["2001:2::", 48],
    ["2001:db8::", 32],
    ["fc00::", 7],
    ["fe80::", 10],
    ["ff00::", 8]
  ] as const) {
    list.addSubnet(network, prefix, "ipv6");
  }
  return list;
}
