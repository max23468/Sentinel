import { createRequire } from "node:module";
import type { SiteConfig } from "./types.js";

interface RobotRules {
  isAllowed(url: string, userAgent?: string): boolean | undefined;
  getSitemaps(): string[];
}

const require = createRequire(import.meta.url);
const robotsParser = require("robots-parser") as (url: string, robotstxt: string) => RobotRules;

export class RobotsGuard {
  private readonly cache = new Map<string, Promise<RobotRules>>();

  constructor(private readonly site: SiteConfig) {}

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
    const response = await fetch(robotsUrl, {
      headers: { "user-agent": this.site.crawl.userAgent },
      signal: AbortSignal.timeout(this.site.crawl.timeoutMs)
    });

    if (response.status === 404) return robotsParser(robotsUrl, "");
    if (!response.ok) {
      throw new Error(`robots.txt non leggibile (${response.status}) per ${origin}`);
    }

    return robotsParser(robotsUrl, await response.text());
  }
}
