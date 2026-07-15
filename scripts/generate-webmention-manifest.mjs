import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { parse, serialize } from "parse5";

const buildRoot = path.resolve(process.argv[2] || "");
const outputPath = path.resolve(process.argv[3] || "webmention-manifest.json");
const commitSha = process.argv[4] || process.env.GITHUB_SHA || "local";
const repository = process.env.GITHUB_REPOSITORY || "myquay/michael-mckenna.com";
const siteOrigin = "https://michael-mckenna.com";

if (!process.argv[2] || !fs.existsSync(buildRoot)) {
  console.error("Usage: node generate-webmention-manifest.mjs <build-directory> [output-file] [commit-sha]");
  process.exit(2);
}

const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(file) : [file];
});
const attrs = (node) => Object.fromEntries((node.attrs || []).map((x) => [x.name, x.value]));
const classes = (node) => (attrs(node).class || "").split(/\s+/).filter(Boolean);
const children = (node) => node.childNodes || [];
const descendants = function* (node) { for (const child of children(node)) { yield child; yield* descendants(child); } };
const findOne = (node, predicate) => [...descendants(node)].find(predicate);
const findAll = (node, predicate) => [...descendants(node)].filter(predicate);
const text = (node) => [node.value || "", ...children(node).map(text)].join("").replace(/\s+/g, " ").trim();
const hasRel = (node, rel) => (attrs(node).rel || "").split(/\s+/).includes(rel);
const contextFor = (value) => value.length <= 240 ? value : `${value.slice(0, 239).trimEnd()}…`;

const pages = [];
for (const file of walk(buildRoot).filter((x) => path.basename(x) === "index.html")) {
  const relative = path.relative(buildRoot, file).split(path.sep).join("/");
  const html = fs.readFileSync(file, "utf8");
  const document = parse(html);
  const canonicalNode = findOne(document, (node) => node.nodeName === "link" && hasRel(node, "canonical"));
  const endpointNode = findOne(document, (node) => node.nodeName === "link" && hasRel(node, "webmention"));
  const entry = findOne(document, (node) => classes(node).includes("h-entry"));
  if (!canonicalNode || !endpointNode || !entry) continue;
  const canonical = new URL(attrs(canonicalNode).href, siteOrigin).href;
  if (new URL(canonical).origin !== siteOrigin) continue;
  const content = findOne(entry, (node) => classes(node).includes("e-content"));
  if (!content) continue;
  const repositoryContentPath = attrs(entry)["data-repository-content-path"] || null;
  const titleNode = findOne(entry, (node) => classes(node).includes("p-name"));
  const candidates = [
    ...findAll(content, (node) => node.nodeName === "a" && attrs(node).href).map((node) => ({ node, relationship: "mention" })),
    ...findAll(entry, (node) => node.nodeName === "a" && attrs(node).href && classes(node).includes("u-like-of")).map((node) => ({ node, relationship: "like" })),
    ...findAll(entry, (node) => node.nodeName === "a" && attrs(node).href && classes(node).includes("u-in-reply-to")).map((node) => ({ node, relationship: "reply" }))
  ];
  const outgoingLinks = [];
  const seen = new Set();
  for (const { node, relationship } of candidates) {
    let target;
    try { target = new URL(attrs(node).href, canonical); } catch { continue; }
    if (!['http:', 'https:'].includes(target.protocol) || target.origin === siteOrigin) continue;
    const key = target.href;
    if (seen.has(key)) {
      const existing = outgoingLinks.find((x) => x.targetUrl === key);
      if (existing && relationship !== "mention") existing.relationship = relationship;
      continue;
    }
    seen.add(key);
    outgoingLinks.push({ targetUrl: key, relationship, anchorText: contextFor(text(node)), context: contextFor(text(node.parentNode || node)) });
  }
  const authoredProjection = serialize(entry);
  pages.push({
    sourceUrl: canonical,
    sourcePath: relative,
    repositoryContentPath,
    title: text(titleNode || entry),
    contentHash: `sha256:${crypto.createHash("sha256").update(authoredProjection).digest("hex")}`,
    acceptsWebmentions: true,
    outgoingLinks
  });
}

pages.sort((a, b) => a.sourceUrl.localeCompare(b.sourceUrl));
const manifest = { schemaVersion: 1, site: `${siteOrigin}/`, repository, commitSha, generatedUtc: new Date().toISOString(), pages };
const body = `${JSON.stringify(manifest, null, 2)}\n`;
if (Buffer.byteLength(body) > 5 * 1024 * 1024) throw new Error("Webmention manifest exceeds the 5 MiB limit.");
fs.writeFileSync(outputPath, body);
console.log(`Wrote ${pages.length} Webmention-enabled pages to ${outputPath}.`);
