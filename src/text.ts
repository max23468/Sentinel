import * as cheerio from "cheerio";

export function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function removeVolatileText(input: string): string {
  return input.replace(/\bOUR INSTAGRAM(?: \d{1,5}){10,}(?= Recent Comments| ©| Close|$)/g, "OUR INSTAGRAM");
}

export function extractNormalizedText(html: string): { title?: string; text: string; links: string[]; assets: string[] } {
  const $ = cheerio.load(html);

  $("script, style, noscript, template, svg").remove();

  const title = normalizeWhitespace($("title").first().text()) || undefined;
  const text = normalizeWhitespace(removeVolatileText(normalizeWhitespace($("body").text() || $.root().text())));

  const links = new Set<string>();
  $("a[href]").each((_, element) => {
    const href = $(element).attr("href");
    if (href) links.add(href);
  });

  const assets = new Set<string>();
  $("img[src], source[src], video[src], audio[src], embed[src]").each((_, element) => {
    const src = $(element).attr("src");
    if (src) assets.add(src);
  });
  $("source[srcset], img[srcset]").each((_, element) => {
    const srcset = $(element).attr("srcset");
    if (!srcset) return;
    for (const candidate of srcset.split(",")) {
      const src = candidate.trim().split(/\s+/)[0];
      if (src) assets.add(src);
    }
  });

  return { title, text, links: [...links], assets: [...assets] };
}
