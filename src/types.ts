export type ResourceKind = "html" | "file";
export type ChangeType = "added" | "changed" | "removed";

export interface StorageConfig {
  dataDir: string;
  snapshotsDir: string;
  reportsDir: string;
}

export interface CrawlConfig {
  maxDepth: number;
  maxUrls: number;
  timeoutMs: number;
  userAgent: string;
}

export interface SmtpProfileConfig {
  host: string;
  port: number;
  secure: boolean;
  userEnv: string;
  passEnv: string;
  passKeychainService?: string;
}

export interface EmailConfig {
  enabled: boolean;
  defaultProfile: string;
  fromEnv: string;
  toEnv: string;
  subjectPrefix: string;
  profiles: Record<string, SmtpProfileConfig>;
}

export interface IgnoredIssueRule {
  status?: number;
  message?: string;
  urlIncludes?: string;
  urlPattern?: string;
  urlPatternRegex?: RegExp;
  reason: string;
}

export interface SiteConfig {
  id: string;
  name: string;
  enabled: boolean;
  sitemapUrls: string[];
  roots: string[];
  emailProfile?: string;
  crawl: CrawlConfig;
  includeFileExtensions: string[];
  trackingParams: string[];
  ignoredIssues: IgnoredIssueRule[];
}

export interface SentinelConfig {
  version: number;
  storage: StorageConfig;
  email: EmailConfig;
  sites: SiteConfig[];
}

export interface UrlState {
  url: string;
  kind: ResourceKind;
  firstSeenAt: string;
  lastSeenAt: string;
  lastStatus: number;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: string;
  hash: string;
  title?: string;
  snapshotIds: string[];
}

export interface SiteState {
  id: string;
  name: string;
  lastScanAt?: string;
  urls: Record<string, UrlState>;
}

export interface SentinelState {
  version: number;
  sites: Record<string, SiteState>;
}

export interface FetchedResource {
  url: string;
  sourceUrl?: string;
  depth: number;
  kind: ResourceKind;
  status: number;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: string;
  hash: string;
  title?: string;
  normalizedText?: string;
  discoveredUrls: string[];
  fetchedAt: string;
}

export interface SnapshotDocument {
  id: string;
  capturedAt: string;
  url: string;
  kind: ResourceKind;
  status: number;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: string;
  hash: string;
  title?: string;
  normalizedText?: string;
}

export interface ScanChange {
  type: ChangeType;
  url: string;
  kind: ResourceKind;
  previousHash?: string;
  currentHash?: string;
  title?: string;
}

export interface ScanIssue {
  url: string;
  message: string;
  fatal: boolean;
  ignored?: boolean;
  ignoredReason?: string;
}

export interface ScanResult {
  siteId: string;
  siteName: string;
  scannedAt: string;
  baseline: boolean;
  dryRun: boolean;
  scannedCount: number;
  skippedCount: number;
  changes: ScanChange[];
  issues: ScanIssue[];
  reportPath?: string;
  emailSent: boolean;
  emailRequired: boolean;
}

export interface QueuedUrl {
  url: string;
  depth: number;
  sourceUrl?: string;
}
