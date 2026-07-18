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
const homePagePath = path.join(buildRoot, "index.html");

if (!fs.existsSync(photoFeedPath) || !/<item>/.test(fs.readFileSync(photoFeedPath, "utf8"))) {
  console.error("The generated Photos RSS feed is missing or empty.");
  process.exit(1);
}

if (!fs.existsSync(desktopContextPath)
  || !/data-feed-label="Photos"[^>]+data-feed-url="[^"]*\/photos\/rss\.xml"/.test(fs.readFileSync(desktopContextPath, "utf8"))) {
  console.error("RSS Setup does not reference the generated Photos RSS feed.");
  process.exit(1);
}

const homePage = fs.existsSync(homePagePath) ? fs.readFileSync(homePagePath, "utf8") : "";
const requiredHomePatterns = [
  /rel="indieauth-metadata" href="https:\/\/talos\.michael-mckenna\.com\/\.well-known\/oauth-authorization-server"/,
  /rel="authorization_endpoint" href="https:\/\/talos\.michael-mckenna\.com\/auth"/,
  /rel="token_endpoint" href="https:\/\/talos\.michael-mckenna\.com\/token"/,
  /class="indieweb-profile h-card visually-hidden"/,
  /href="https:\/\/github\.com\/myquay" rel="me authn"/
];

if (requiredHomePatterns.some((pattern) => !pattern.test(homePage))) {
  console.error("The generated homepage is missing required IndieAuth or h-card metadata.");
  process.exit(1);
}

const entryPage = outputFiles.find((file) => {
  const relativePath = path.relative(buildRoot, file);
  return /^(?:blog|notes)\/[^/]+\/index\.html$/.test(relativePath);
});
const entryHtml = entryPage ? fs.readFileSync(entryPage, "utf8") : "";
const requiredEntryPatterns = [
  /rel="canonical" href="https:\/\/michael-mckenna\.com\//,
  /rel="webmention" href="https:\/\/lilpub\.michael-mckenna\.com\/webmention"/,
  /class="document-content h-entry"/,
  /class="p-name"/,
  /class="document-author h-card u-author"/,
  /class="dt-published"/,
  /class="document-body e-content"/
];

if (!entryPage || requiredEntryPatterns.some((pattern) => !pattern.test(entryHtml))) {
  console.error("A generated article or note is missing required h-entry metadata.");
  process.exit(1);
}

const entryDescription = entryHtml.match(/<meta name="description" content="([^"]+)"/)?.[1] || "";
if (!entryDescription || entryDescription === "All my Keystrokes That&#39;s Fit to Print") {
  console.error("A generated article or note is missing a page-specific meta description.");
  process.exit(1);
}

const entryWindowPath = entryPage ? path.join(path.dirname(entryPage), "window.html") : "";
if (!entryWindowPath || !fs.existsSync(entryWindowPath)) {
  console.error("A generated article or note is missing its window fragment.");
  process.exit(1);
}

const activityPagePath = path.join(buildRoot, "activity", "index.html");
const activityWindowPath = path.join(buildRoot, "activity", "window.html");
const activityFeedPath = path.join(buildRoot, "activity", "rss.xml");
for (const file of [activityPagePath, activityWindowPath]) {
  const html = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  if (!/class="activity-stream h-feed"/.test(html) || !/class="activity-entry h-entry/.test(html) || !/class="p-name"/.test(html) || !/class="dt-published"/.test(html)) {
    console.error(`Generated Activity output is missing h-feed/h-entry metadata: ${path.relative(buildRoot, file)}`);
    process.exit(1);
  }
}
if (!fs.existsSync(activityFeedPath) || !/<item>/.test(fs.readFileSync(activityFeedPath, "utf8"))) {
  console.error("The generated Activity RSS feed is missing or empty.");
  process.exit(1);
}

const windowFragments = outputFiles.filter((file) => path.basename(file) === "window.html");
const incompatibleWindowFragments = windowFragments.filter((file) => {
  const source = fs.readFileSync(file, "utf8");
  return source.includes("data-window-id=") && !source.includes('data-window-contract-version="2"');
});

if (incompatibleWindowFragments.length > 0) {
  console.error("Generated window fragments are missing the current window contract version:");
  incompatibleWindowFragments.forEach((file) => console.error(`  ${path.relative(buildRoot, file)}`));
  process.exit(1);
}

const explorerFragments = windowFragments.filter((file) => fs.readFileSync(file, "utf8").includes("data-explorer-tree"));
const inconsistentExplorerFragments = explorerFragments.filter((file) => {
  const source = fs.readFileSync(file, "utf8");
  return source.includes("tree-floppy-a-children")
    || !/data-tree-node-id="floppy-a"[\s\S]*?<img src="\/images\/win95-icons\/w95_8\.ico"/.test(source)
    || !/data-tree-node-id="site-drive"[\s\S]*?<img src="\/images\/win95-icons\/w95_9\.ico"/.test(source);
});

if (inconsistentExplorerFragments.length > 0) {
  console.error("Generated Explorer fragments disagree with the canonical drive tree:");
  inconsistentExplorerFragments.forEach((file) => console.error(`  ${path.relative(buildRoot, file)}`));
  process.exit(1);
}

console.log(`Checked ${sourceFiles.length} generated documents and stylesheets.`);
