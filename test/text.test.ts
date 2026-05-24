import { describe, expect, it } from "vitest";
import { extractNormalizedText } from "../src/text.js";

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
});
