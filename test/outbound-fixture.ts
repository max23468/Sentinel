import { OutboundClient } from "../src/outbound.js";
import type { SiteConfig } from "../src/types.js";

export function testOutboundClient(site: SiteConfig, fetchImpl: typeof fetch): OutboundClient {
  return new OutboundClient(site, {
    fetch: fetchImpl,
    resolve: async () => [{ address: "93.184.216.34", family: 4 }]
  });
}
