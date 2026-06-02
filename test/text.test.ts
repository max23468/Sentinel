import { describe, expect, it } from "vitest";
import { extractNormalizedText, removeVolatileText } from "../src/text.js";

describe("HTML text extraction", () => {
  it("estrae titolo, testo normalizzato, link e asset senza script", () => {
    const result = extractNormalizedText(`
      <html>
        <head><title> Test Ortix </title><script>ignored()</script></head>
        <body>
          <h1> Titolo </h1>
          <p>Testo    con spazi</p>
          <a href="/pagina">pagina</a>
          <img src="/immagine.png" />
        </body>
      </html>
    `);

    expect(result.title).toBe("Test Ortix");
    expect(result.text).toBe("Titolo Testo con spazi pagina");
    expect(result.links).toEqual(["/pagina"]);
    expect(result.assets).toEqual(["/immagine.png"]);
  });

  it("rimuove i conteggi dinamici del widget Instagram Ortix", () => {
    expect(
      removeVolatileText(
        "Testo OUR INSTAGRAM 1046 406 8725 717 6127 506 6756 6 3674 715 2246 176 9731 111 1036 824 1613 917 Recent Comments"
      )
    ).toBe("Testo OUR INSTAGRAM Recent Comments");
  });

  it("estrae anche asset da srcset e gestisce pagine senza title", () => {
    const result = extractNormalizedText(`
      <div>
        Testo semplice
        <img srcset="/hero-small.jpg 1x, /hero-large.jpg 2x" />
        <source srcset="/video.mp4 1x" />
      </div>
    `);

    expect(result.title).toBeUndefined();
    expect(result.text).toBe("Testo semplice");
    expect(result.links).toEqual([]);
    expect(result.assets).toEqual(["/hero-small.jpg", "/hero-large.jpg", "/video.mp4"]);
  });
});
