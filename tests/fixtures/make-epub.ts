import JSZip from "jszip";

export interface MakeEpubOptions {
  title?: string;
  author?: string;
  language?: string;
  description?: string;
  withCover?: boolean;
  chapters?: { title: string; paragraphs: string[] }[];
}

// A 1x1 transparent PNG.
const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

/**
 * Build a minimal but structurally valid EPUB 3 document in memory.
 * Used by unit tests and to produce the E2E upload fixture.
 */
export async function createEpub(opts: MakeEpubOptions = {}): Promise<Buffer> {
  const title = opts.title ?? "The Test Chronicle";
  const author = opts.author ?? "Ada Tester";
  const language = opts.language ?? "en";
  const description = opts.description ?? "A book made for testing.";
  const withCover = opts.withCover ?? true;
  const chapters =
    opts.chapters ??
    [
      {
        title: "Chapter One",
        paragraphs: [
          "It was the best of tests, it was the worst of tests.",
          "The quick brown fox jumps over the lazy dog, again and again.",
        ],
      },
      {
        title: "Chapter Two",
        paragraphs: [
          "In the second chapter, our heroes refactor everything.",
          "And lo, the suite did pass, and there was much rejoicing.",
        ],
      },
    ];

  const zip = new JSZip();

  // mimetype must be first and uncompressed.
  zip.file("mimetype", "application/epub+zip", {
    compression: "STORE",
  });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  // Chapters
  const chapterFiles = chapters.map((c, i) => {
    const name = `chapter${i + 1}.xhtml`;
    const body = c.paragraphs.map((p) => `<p>${p}</p>`).join("\n      ");
    const html = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="${language}">
  <head><title>${c.title}</title></head>
  <body>
    <section>
      <h1>${c.title}</h1>
      ${body}
    </section>
  </body>
</html>`;
    zip.file(`OEBPS/${name}`, html);
    return { name, title: c.title, id: `chap${i + 1}` };
  });

  // Cover image
  if (withCover) {
    zip.file("OEBPS/cover.png", PNG_1PX);
  }

  // Navigation document (EPUB 3)
  const navList = chapterFiles
    .map((c) => `<li><a href="${c.name}">${c.title}</a></li>`)
    .join("\n        ");
  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
  <head><title>Contents</title></head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Contents</h1>
      <ol>
        ${navList}
      </ol>
    </nav>
  </body>
</html>`,
  );

  // OPF package
  const manifestItems = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    ...chapterFiles.map(
      (c) =>
        `<item id="${c.id}" href="${c.name}" media-type="application/xhtml+xml"/>`,
    ),
    withCover
      ? `<item id="cover-img" href="cover.png" media-type="image/png" properties="cover-image"/>`
      : "",
  ]
    .filter(Boolean)
    .join("\n    ");

  const spineItems = chapterFiles
    .map((c) => `<itemref idref="${c.id}"/>`)
    .join("\n    ");

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:test-${Date.now()}</dc:identifier>
    <dc:title>${title}</dc:title>
    <dc:creator>${author}</dc:creator>
    <dc:language>${language}</dc:language>
    <dc:description>${description}</dc:description>
    <meta property="dcterms:modified">2024-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    ${manifestItems}
  </manifest>
  <spine>
    ${spineItems}
  </spine>
</package>`,
  );

  return zip.generateAsync({ type: "nodebuffer" });
}
