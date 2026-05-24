import { readFile } from "node:fs/promises";
import YAML from "yaml";
import type { CrawlConfig, EmailConfig, SentinelConfig, SiteConfig, SmtpProfileConfig, StorageConfig } from "./types.js";
import { resolveFromCwd } from "./fs.js";

const DEFAULT_TRACKING_PARAMS = [
  "fbclid",
  "gclid",
  "msclkid",
  "yclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "source"
];

const DEFAULT_FILE_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "zip",
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "avif",
  "svg"
];

const DEFAULT_CRAWL: CrawlConfig = {
  maxDepth: 3,
  maxUrls: 500,
  timeoutMs: 30000,
  userAgent: "Sentinel/0.1 (+https://github.com/max23468/Sentinel)"
};

const DEFAULT_STORAGE: StorageConfig = {
  dataDir: "data",
  snapshotsDir: "snapshots",
  reportsDir: "reports"
};

const DEFAULT_EMAIL: EmailConfig = {
  enabled: true,
  defaultProfile: "gmail",
  fromEnv: "SENTINEL_EMAIL_FROM",
  toEnv: "SENTINEL_EMAIL_TO",
  subjectPrefix: "[Sentinel]",
  profiles: {
    gmail: {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      userEnv: "SENTINEL_GMAIL_USER",
      passEnv: "SENTINEL_GMAIL_APP_PASSWORD"
    },
    icloud: {
      host: "smtp.mail.me.com",
      port: 587,
      secure: false,
      userEnv: "SENTINEL_ICLOUD_USER",
      passEnv: "SENTINEL_ICLOUD_APP_PASSWORD"
    }
  }
};

export async function loadConfig(configPath = "sentinel.config.yml"): Promise<SentinelConfig> {
  const absolutePath = resolveFromCwd(configPath);
  const raw = await readFile(absolutePath, "utf8");
  const parsed = YAML.parse(raw) as Partial<SentinelConfig>;

  const config: SentinelConfig = {
    version: parsed.version ?? 1,
    storage: { ...DEFAULT_STORAGE, ...(parsed.storage ?? {}) },
    email: mergeEmailConfig(parsed.email),
    sites: (parsed.sites ?? []).map(normalizeSiteConfig)
  };

  validateConfig(config);
  return config;
}

function mergeEmailConfig(email?: Partial<EmailConfig>): EmailConfig {
  const profiles = { ...DEFAULT_EMAIL.profiles, ...(email?.profiles ?? {}) };
  return {
    ...DEFAULT_EMAIL,
    ...(email ?? {}),
    profiles: Object.fromEntries(
      Object.entries(profiles).map(([name, profile]) => [name, normalizeSmtpProfile(profile)])
    )
  };
}

function normalizeSmtpProfile(profile: Partial<SmtpProfileConfig>): SmtpProfileConfig {
  if (!profile.host || !profile.port || profile.secure === undefined || !profile.userEnv || !profile.passEnv) {
    throw new Error("Profilo SMTP incompleto nella configurazione.");
  }
  return {
    host: profile.host,
    port: Number(profile.port),
    secure: Boolean(profile.secure),
    userEnv: profile.userEnv,
    passEnv: profile.passEnv,
    passKeychainService: profile.passKeychainService
  };
}

function normalizeSiteConfig(site: Partial<SiteConfig>): SiteConfig {
  if (!site.id || !site.name) {
    throw new Error("Ogni sito deve avere id e name.");
  }
  return {
    id: site.id,
    name: site.name,
    enabled: site.enabled ?? true,
    sitemapUrls: site.sitemapUrls ?? [],
    roots: site.roots ?? [],
    emailProfile: site.emailProfile,
    crawl: { ...DEFAULT_CRAWL, ...(site.crawl ?? {}) },
    includeFileExtensions: site.includeFileExtensions ?? DEFAULT_FILE_EXTENSIONS,
    trackingParams: site.trackingParams ?? DEFAULT_TRACKING_PARAMS
  };
}

function validateConfig(config: SentinelConfig): void {
  if (config.version !== 1) throw new Error(`Versione config non supportata: ${config.version}`);
  if (config.sites.length === 0) throw new Error("Config senza siti: aggiungi almeno un sito.");

  const ids = new Set<string>();
  for (const site of config.sites) {
    if (ids.has(site.id)) throw new Error(`Site id duplicato: ${site.id}`);
    ids.add(site.id);
    if (site.roots.length === 0) throw new Error(`Il sito ${site.id} non ha roots configurati.`);
    if (site.sitemapUrls.length === 0) throw new Error(`Il sito ${site.id} non ha sitemapUrls configurati.`);
    for (const root of site.roots) new URL(root);
    for (const sitemapUrl of site.sitemapUrls) new URL(sitemapUrl);
  }
}
