import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the review desk", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /Ocrolus Review Desk/);
  assert.match(html, /Document-supported corrections/);
  assert.match(html, /Simulation mode/);
  assert.match(html, /synthetic-suspicious-ytd-001/);
  assert.match(html, /YTD_LESS_THAN_CURRENT/);
  assert.match(html, /Simulate save \+ revalidate/);
  assert.match(html, /Simulate full-review escalation/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("wires the final interface to the Python review-task fixture", async () => {
  const [page, layout, packageJson, task] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("app/review-task.json", root), "utf8"),
  ]);

  assert.match(page, /from "\.\/review-task\.json"/);
  assert.match(page, /Production would create candidate v2/);
  assert.match(task, /"review_type": "FIELD_REVIEW"/);
  assert.match(task, /"routing_policy_version": "confidence-v1"/);
  assert.match(layout, /public|og\.png|OpenGraph|openGraph/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
