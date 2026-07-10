import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const buildRoot = path.resolve(process.argv[2] || "");
const allowlistPath = process.argv[3] ? path.resolve(process.argv[3]) : null;

if (!process.argv[2] || !fs.existsSync(buildRoot)) {
  console.error("Usage: node check-generated-site.mjs <build-directory> [allowlist]");
  process.exit(2);
}

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const entryPath = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(entryPath) : [entryPath];
});

const allowlist = new Set(
  allowlistPath && fs.existsSync(allowlistPath)
    ? fs.readFileSync(allowlistPath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
    : []
);

const outputFiles = walk(buildRoot);
const sourceFiles = outputFiles.filter((file) => [".html", ".css", ".xml"].includes(path.extname(file)));
const references = [];

for (const sourceFile of sourceFiles) {
  const source = fs.readFileSync(sourceFile, "utf8");
  const attributePattern = /\b(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  const cssPattern = /url\(\s*["']?([^"')]+)["']?\s*\)/gi;

  for (const pattern of [attributePattern, cssPattern]) {
    for (const match of source.matchAll(pattern)) {
      references.push({ sourceFile, reference: match[1] });
    }
  }
}

const isExternal = (reference) => /^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(reference);

const resolveReference = (sourceFile, reference) => {
  const withoutFragment = reference.split("#", 1)[0].split("?", 1)[0];

  if (!withoutFragment || isExternal(withoutFragment)) {
    return null;
  }

  let decoded;
  try {
    decoded = decodeURIComponent(withoutFragment);
  } catch {
    decoded = withoutFragment;
  }

  const candidate = decoded.startsWith("/")
    ? path.join(buildRoot, decoded)
    : path.resolve(path.dirname(sourceFile), decoded);

  if (!candidate.startsWith(buildRoot)) {
    return null;
  }

  return candidate;
};

const existsAsOutput = (candidate) => {
  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return true;
  }

  return fs.existsSync(path.join(candidate, "index.html"))
    || fs.existsSync(`${candidate}.html`);
};

const failures = [];

for (const { sourceFile, reference } of references) {
  const candidate = resolveReference(sourceFile, reference);

  if (!candidate || existsAsOutput(candidate) || allowlist.has(reference)) {
    continue;
  }

  failures.push({
    source: path.relative(buildRoot, sourceFile),
    reference
  });
}

const uniqueFailures = [...new Map(failures.map((failure) => [
  `${failure.source}\0${failure.reference}`,
  failure
])).values()];

if (uniqueFailures.length > 0) {
  console.error("Missing generated link or asset targets:");
  uniqueFailures.forEach(({ source, reference }) => console.error(`  ${source}: ${reference}`));
  console.error("Fix the target or add a documented temporary entry to scripts/site-check-allowlist.txt.");
  process.exit(1);
}

const photoFeedPath = path.join(buildRoot, "photos", "rss.xml");
const desktopContextPath = path.join(buildRoot, "window.html");

if (!fs.existsSync(photoFeedPath) || !/<item>/.test(fs.readFileSync(photoFeedPath, "utf8"))) {
  console.error("The generated Photos RSS feed is missing or empty.");
  process.exit(1);
}

if (!fs.existsSync(desktopContextPath)
  || !/data-feed-label="Photos"[^>]+data-feed-url="[^"]*\/photos\/rss\.xml"/.test(fs.readFileSync(desktopContextPath, "utf8"))) {
  console.error("RSS Setup does not reference the generated Photos RSS feed.");
  process.exit(1);
}

console.log(`Checked ${sourceFiles.length} generated documents and stylesheets.`);
