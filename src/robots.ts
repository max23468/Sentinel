import { createRequire } from "node:module";
import { MAX_ROBOTS_BYTES, type OutboundClient } from "./outbound.js";
import type { SiteConfig } from "./types.js";

interface RobotRules {
  isAllowed(url: string, userAgent?: string): boolean | undefined;
  getSitemaps(): string[];
}

const require = createRequire(import.meta.url);
const robotsParser = require("robots-parser") as (url: string, robotstxt: string) => RobotRules;

export class RobotsGuard {
  private readonly cache = new Map<string, Promise<RobotRules>>();

  constructor(
    private readonly site: SiteConfig,
    private readonly client: OutboundClient
  ) {}

  async canFetch(url: string): Promise<boolean> {
    const rules = await this.rulesFor(url);
    return rules.isAllowed(url, this.site.crawl.userAgent) !== false;
  }

  async sitemapsForRoot(rootUrl: string): Promise<string[]> {
    const rules = await this.rulesFor(rootUrl);
    return rules.getSitemaps();
  }

  private async rulesFor(url: string): Promise<RobotRules> {
    const origin = new URL(url).origin;
    const cached = this.cache.get(origin);
    if (cached) return cached;

    const promise = this.fetchRules(origin);
    this.cache.set(origin, promise);
    return promise;
  }

  private async fetchRules(origin: string): Promise<RobotRules> {
    const robotsUrl = `${origin}/robots.txt`;
    const response = await this.client.get(robotsUrl, {
      headers: { "user-agent": this.site.crawl.userAgent },
      maxBytes: MAX_ROBOTS_BYTES
    });

    // RFC 9309 §2.3.1: robots.txt "unavailable" (4xx) significa nessuna
    // restrizione; "unreachable" (5xx o errore di rete) resta fail closed e
    // ferma la scansione. Alcuni WAF rispondono 403/415 invece di 404.
    if (response.status >= 400 && response.status < 500) return robotsParser(robotsUrl, "");
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`robots.txt non leggibile (${response.status}) per ${origin}`);
    }

    return robotsParser(response.url, new TextDecoder().decode(response.body));
  }
}
