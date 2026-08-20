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
  assert.match(html, /Instructions/);
  assert.match(html, /Backend demo/);
  assert.match(html, /See the decision, then review the evidence/);
  assert.match(html, /Start with the backend demo/);
  assert.match(html, /Open the reviewer workflow/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("wires the interface to the Python review and showcase fixtures", async () => {
  const [page, layout, packageJson, task, fullTask, showcase] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
    readFile(new URL("app/review-task.json", root), "utf8"),
    readFile(new URL("app/full-review-task.json", root), "utf8"),
    readFile(new URL("app/backend-showcase.json", root), "utf8"),
  ]);

  assert.match(page, /from "\.\/review-task\.json"/);
  assert.match(page, /from "\.\/full-review-task\.json"/);
  assert.match(page, /from "\.\/backend-showcase\.json"/);
  assert.match(page, /useState<ActiveView>\("instructions"\)/);
  assert.match(page, /activeScenarioIndex/);
  assert.match(page, /onScenarioChange={selectScenario}/);
  assert.match(page, /No reviewer action is needed\./);
  assert.match(page, /Document auto-accepted/);
  assert.match(page, /All trust checks passed/);
  assert.match(page, /Data delivered/);
  assert.match(page, /Full document review required/);
  assert.match(page, /Gross pay minus total deductions should equal net pay/);
  assert.match(page, /Issue: YTD is below current/);
  assert.match(page, /3 accounting totals/);
  assert.match(page, /Critical document failure/);
  assert.match(page, /Document rejected/);
  assert.match(page, /Request a clearer replacement document/);
  assert.match(page, /No task created/);
  assert.match(page, /Watch the trust router make its decision\./);
  assert.match(page, /Run a scenario/);
  assert.doesNotMatch(page, /randomly selects|Run random scenario/);
  assert.match(page, /Math\.random/);
  assert.match(page, /Production would create candidate v2/);
  assert.ok(page.indexOf("Instructions") < page.indexOf("Backend demo"));
  assert.ok(page.indexOf("Backend demo") < page.indexOf("Reviewer workflow"));
  assert.match(task, /"review_type": "FIELD_REVIEW"/);
  assert.match(task, /"routing_policy_version": "confidence-v1"/);
  assert.match(fullTask, /"review_type": "FULL_REVIEW"/);
  assert.match(fullTask, /"code": "GROSS_NET_MISMATCH"/);
  assert.match(showcase, /"decision": "AUTO_ACCEPT"/);
  assert.match(showcase, /"decision": "FIELD_REVIEW"/);
  assert.match(showcase, /"decision": "FULL_REVIEW"/);
  assert.match(showcase, /"decision": "REJECT"/);
  assert.match(showcase, /"id": "A"/);
  assert.match(showcase, /"id": "D"/);
  assert.match(layout, /public|og\.png|OpenGraph|openGraph/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  await assert.rejects(access(new URL("app/_sites-preview", root)));
});
