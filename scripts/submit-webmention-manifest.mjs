import crypto from "node:crypto";
import fs from "node:fs";
import process from "node:process";

const [manifestPath] = process.argv.slice(2);
const endpoint = process.env.LITTLEPUBLISHER_DEPLOYMENT_ENDPOINT;
const secret = process.env.LITTLEPUBLISHER_DEPLOYMENT_SECRET;
if (!manifestPath || !endpoint || !secret || secret.length < 32) {
  console.error("Manifest path, LITTLEPUBLISHER_DEPLOYMENT_ENDPOINT, and a 32+ character LITTLEPUBLISHER_DEPLOYMENT_SECRET are required.");
  process.exit(2);
}
const body = fs.readFileSync(manifestPath, "utf8");
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-littlepublisher-timestamp": timestamp, "x-littlepublisher-signature": `sha256=${signature}` }, body });
if (!response.ok) {
  console.error(`LittlePublisher rejected the deployment manifest with HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
  process.exit(1);
}
console.log(`LittlePublisher accepted the deployment manifest (${response.status}).`);
