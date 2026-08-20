"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import backendShowcase from "./backend-showcase.json";
import fullReviewTask from "./full-review-task.json";
import reviewTask from "./review-task.json";

type ActiveView = "instructions" | "review" | "backend";
type BackendScenario = (typeof backendShowcase.routes)[number];
type IssueKey = "benefitYtd" | "taxTreatment";
type FullIssueKey = "grossPay" | "deductions" | "netPay";
type ReviewAction = "confirm" | "correct" | "unsupported";
type Highlight = { left: string; top: string; width: string; height: string };

const candidate = reviewTask.candidate;
const fullCandidate = fullReviewTask.candidate;
const observations = Object.fromEntries(
  reviewTask.field_observations.map((observation) => [observation.path, observation]),
);

const ytdPath = "/deductions/items/0/year_to_date_amount";
const taxPath = "/deductions/items/0/tax_treatment";
const ytdObservation = observations[ytdPath];
const taxObservation = observations[taxPath];
const validationIssue = reviewTask.routing.validation_issues[0];

const issues = {
  benefitYtd: {
    title: "Mystery Benefit current / YTD",
    path: ytdPath,
    code: validationIssue.code,
    reason: validationIssue.message,
    evidence: ytdObservation.evidence[0]?.text ?? "No source text supplied",
    proposed: `$${ytdObservation.value}`,
    input: String(ytdObservation.value),
    confidence: `${Math.round((ytdObservation.confidence ?? 0) * 100)}%`,
    target: "sourceBenefitYtd",
  },
  taxTreatment: {
    title: "Mystery Benefit tax treatment",
    path: taxPath,
    code: "FIELD_CONFIDENCE_BELOW_AUTO_ACCEPT_THRESHOLD",
    reason:
      "The proposed tax treatment is below the auto-accept confidence gate and needs document support.",
    evidence: taxObservation.evidence[0]?.text ?? "No source text supplied",
    proposed: titleCase(String(taxObservation.value)),
    input: String(taxObservation.value),
    confidence: `${Math.round((taxObservation.confidence ?? 0) * 100)}%`,
    target: "sourceBenefitType",
  },
} satisfies Record<IssueKey, Record<string, string>>;

const fullIssues = {
  grossPay: {
    title: "Gross pay",
    path: "/earnings/gross/current",
    proposed: `$${fullCandidate.earnings.gross.current}`,
    input: String(fullCandidate.earnings.gross.current),
    target: "fullGrossPay",
    reason: "Gross pay is one side of the failed accounting equation and must be verified against the source.",
  },
  deductions: {
    title: "Total deductions",
    path: "/deductions/total/current",
    proposed: `$${fullCandidate.deductions.total.current}`,
    input: String(fullCandidate.deductions.total.current),
    target: "fullDeductions",
    reason: "Total deductions determine the expected net pay and must be checked before release.",
  },
  netPay: {
    title: "Net pay",
    path: "/net_pay/current",
    proposed: `$${fullCandidate.net_pay.current}`,
    input: String(fullCandidate.net_pay.current),
    target: "fullNetPay",
    reason: "The document reports $2,100, but gross pay minus deductions equals $2,000—a $100 mismatch.",
  },
} satisfies Record<FullIssueKey, Record<string, string>>;

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>("instructions");
  const [activeScenarioIndex, setActiveScenarioIndex] = useState(0);
  const [selectedIssue, setSelectedIssue] = useState<IssueKey>("benefitYtd");
  const [selectedAction, setSelectedAction] = useState<ReviewAction>("correct");
  const [correctedValue, setCorrectedValue] = useState(issues.benefitYtd.input);
  const [correctionReason, setCorrectionReason] = useState("source_verified");
  const [completed, setCompleted] = useState<Set<IssueKey>>(new Set());
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"success" | "warning" | "error">(
    "success",
  );
  const [zoom, setZoom] = useState(1);
  const [highlight, setHighlight] = useState<Highlight>({
    left: "0%",
    top: "0%",
    width: "0%",
    height: "0%",
  });
  const paperRef = useRef<HTMLDivElement>(null);
  const issue = issues[selectedIssue];
  const activeScenario = backendShowcase.routes[activeScenarioIndex];

  const positionHighlight = useCallback(() => {
    const paper = paperRef.current;
    const target = document.getElementById(issue.target);
    if (!paper || !target) return;
    const paperBox = paper.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    setHighlight({
      left: `${((targetBox.left - paperBox.left) / paperBox.width) * 100}%`,
      top: `${((targetBox.top - paperBox.top) / paperBox.height) * 100}%`,
      width: `${(targetBox.width / paperBox.width) * 100}%`,
      height: `${(targetBox.height / paperBox.height) * 100}%`,
    });
  }, [issue.target]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(positionHighlight);
    return () => cancelAnimationFrame(frame);
  }, [positionHighlight, zoom]);

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper) return;
    const observer = new ResizeObserver(positionHighlight);
    observer.observe(paper);
    window.addEventListener("resize", positionHighlight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", positionHighlight);
    };
  }, [positionHighlight]);

  function chooseIssue(key: IssueKey) {
    setSelectedIssue(key);
    setSelectedAction("correct");
    setCorrectedValue(issues[key].input);
    setCorrectionReason("source_verified");
    setNotice("");
  }

  function chooseAction(action: ReviewAction) {
    setSelectedAction(action);
    if (action === "unsupported") setCorrectionReason("unsupported");
    else if (correctionReason === "unsupported") setCorrectionReason("source_verified");
  }

  function submitReview() {
    if (selectedAction === "correct" && !correctedValue.trim()) {
      setNoticeTone("error");
      setNotice("Enter the supported value or mark the field unsupported.");
      return;
    }
    setCompleted((current) => new Set(current).add(selectedIssue));
    setNoticeTone("success");
    setNotice(
      "Simulation complete. Production would create candidate v2, preserve this action, and queue A7 revalidation.",
    );
  }

  function escalateReview() {
    setNoticeTone("warning");
    setNotice(
      "Simulation: the field task would escalate to full review with its evidence and audit history preserved.",
    );
  }

  function selectScenario(index: number) {
    setActiveScenarioIndex(index);
    setSelectedIssue("benefitYtd");
    setSelectedAction("correct");
    setCorrectedValue(issues.benefitYtd.input);
    setCorrectionReason("source_verified");
    setCompleted(new Set());
    setNotice("");
    setZoom(1);
  }

  const completeCount = completed.size;
  const progressLabel =
    completeCount === 2 ? "2 of 2 complete" : `${Math.min(completeCount + 1, 2)} of 2`;

  return (
    <main className="rd-app">
      <div className="rd-simulation" role="note">
        Simulation mode · bundled synthetic review task · nothing is stored
      </div>
      <header className="rd-topbar">
        <div className="rd-brand-group">
          <div className="rd-mark" aria-hidden="true">
            O
          </div>
          <div>
            <div className="rd-product-name">Ocrolus Review Desk</div>
            <div className="rd-product-subtitle">Document-supported corrections</div>
          </div>
        </div>
        <div className="rd-top-actions">
          <span
            className={`rd-status ${
              activeScenario.decision === "REJECT"
                ? "is-rejected"
                : activeScenario.decision === "AUTO_ACCEPT"
                  ? "is-accepted"
                  : ""
            }`}
          >
            {activeScenario.decision === "REJECT"
              ? "Rejected"
              : activeScenario.decision === "AUTO_ACCEPT"
                ? "Auto accepted"
              : titleCase(activeScenario.processing_status)}
          </span>
          <span className="rd-reviewer">Reviewer: Demo reviewer</span>
        </div>
      </header>

      <div className="rd-mode-tabs" role="tablist" aria-label="Prototype views">
        <button
          className="rd-mode-tab"
          type="button"
          role="tab"
          aria-selected={activeView === "instructions"}
          onClick={() => setActiveView("instructions")}
        >
          Instructions
        </button>
        <button
          className="rd-mode-tab"
          type="button"
          role="tab"
          aria-selected={activeView === "backend"}
          onClick={() => setActiveView("backend")}
        >
          Backend demo
        </button>
        <button
          className="rd-mode-tab"
          type="button"
          role="tab"
          aria-selected={activeView === "review"}
          onClick={() => setActiveView("review")}
        >
          Reviewer workflow
        </button>
      </div>

      {activeView === "instructions" ? (
        <Instructions onNavigate={setActiveView} />
      ) : activeView === "review" ? activeScenario.id === "B" ? (
        <>
          <section className="rd-contextbar" aria-label="Review task context">
        <div className="rd-doc-meta">
          <Meta label="Document" value="Pay stub" />
          <Meta label="Document ID" value={reviewTask.document_id} />
          <Meta label="Employer" value={candidate.employer.name} />
          <Meta label="Pay date" value={formatDate(candidate.pay_period.pay_date)} />
          <Meta
            label="Average confidence"
            value={`${(reviewTask.routing.average_confidence * 100).toFixed(1)}%`}
          />
        </div>
        <span className="rd-review-type">{titleCase(reviewTask.review_type)}</span>
          </section>

          <section className="rd-workspace" role="tabpanel">
        <article className="rd-viewer" aria-label="Synthetic source document viewer">
          <div className="rd-viewer-header">
            <div>
              <div className="rd-viewer-title">Synthetic source page</div>
              <div className="rd-small-muted">
                Page 1 of 1 · generated from {reviewTask.provenance.extraction_source}
              </div>
            </div>
            <div className="rd-viewer-tools" aria-label="Document zoom controls">
              <button
                className="rd-icon-button"
                type="button"
                aria-label="Zoom out"
                onClick={() => setZoom((value) => Math.max(0.8, value - 0.1))}
              >
                −
              </button>
              <button
                className="rd-icon-button rd-zoom-label"
                type="button"
                aria-label="Reset zoom"
                onClick={() => setZoom(1)}
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                className="rd-icon-button"
                type="button"
                aria-label="Zoom in"
                onClick={() => setZoom((value) => Math.min(1.2, value + 0.1))}
              >
                +
              </button>
            </div>
          </div>
          <div className="rd-viewer-stage">
            <div className="rd-page-wrap" style={{ transform: `scale(${zoom})` }}>
              <div className="rd-paper" ref={paperRef}>
                <div className="rd-paper-brand">
                  <div className="rd-paper-company">{candidate.employer.name}</div>
                  <div className="rd-paper-paystub">
                    <strong>Earnings Statement</strong>
                    Pay date: {formatNumericDate(candidate.pay_period.pay_date)}
                  </div>
                </div>
                <div className="rd-paper-grid">
                  <div className="rd-paper-box">
                    <strong>Employee</strong>
                    {candidate.employee.name}
                    <br />
                    Employee ID: {candidate.employee.id}
                  </div>
                  <div className="rd-paper-box">
                    <strong>Pay period</strong>
                    {formatNumericDate(candidate.pay_period.start)} –{" "}
                    {formatNumericDate(candidate.pay_period.end)}
                    <br />
                    Frequency: {titleCase(candidate.pay_period.frequency)}
                  </div>
                </div>
                <SourceDocument selectedIssue={selectedIssue} />
                <div className="rd-highlight" style={highlight} aria-hidden="true" />
              </div>
            </div>
          </div>
        </article>

        <aside className="rd-review-panel" aria-label="Field correction panel">
          <div className="rd-review-header">
            <div>
              <div className="rd-review-title">Fields to review</div>
              <div className="rd-small-muted">
                Task v{reviewTask.task_version} · resolve document facts only
              </div>
            </div>
            <div className="rd-progress-row">
              <span className="rd-small-muted">{progressLabel}</span>
              <div className="rd-progress-track" aria-hidden="true">
                <div
                  className="rd-progress-fill"
                  style={{ width: `${Math.max(50, completeCount * 50)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="rd-issue-list" role="list" aria-label="Review issues">
            {(Object.keys(issues) as IssueKey[]).map((key, index) => (
              <button
                className="rd-issue-item"
                type="button"
                key={key}
                onClick={() => chooseIssue(key)}
                aria-current={selectedIssue === key}
              >
                <span className="rd-issue-number">{index + 1}</span>
                <span>
                  <span className="rd-issue-name">{issues[key].title}</span>
                  <span className="rd-issue-path">{issues[key].path}</span>
                </span>
                <span className={`rd-issue-state ${completed.has(key) ? "is-done" : ""}`}>
                  {completed.has(key) ? "Done" : "Review"}
                </span>
              </button>
            ))}
          </div>

          <div className="rd-form">
            <div>
              <div className="rd-field-title">{issue.title}</div>
              <div className="rd-field-path">{issue.path}</div>
            </div>
            <div>
              <span className="rd-reason">{issue.code}</span>
              <div className="rd-reason-copy">{issue.reason}</div>
            </div>
            <div className="rd-evidence">
              <span className="rd-evidence-label">Highlighted source text</span>
              <div className="rd-evidence-text">{issue.evidence}</div>
            </div>
            <div className="rd-values">
              <ValueBlock label="Proposed value" value={issue.proposed} />
              <ValueBlock label="Field confidence" value={issue.confidence} confidence />
            </div>
            <div>
              <label className="rd-control-label" htmlFor="correctedValue">
                Supported value from document
              </label>
              <input
                className="rd-input"
                id="correctedValue"
                value={correctedValue}
                disabled={selectedAction !== "correct"}
                onChange={(event) => setCorrectedValue(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="rd-control-label" htmlFor="correctionReason">
                Correction reason
              </label>
              <select
                className="rd-select"
                id="correctionReason"
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
              >
                <option value="source_verified">Verified against highlighted source</option>
                <option value="model_misread">Model misread printed value</option>
                <option value="wrong_column">Current/YTD column mismatch</option>
                <option value="unsupported">Value not supported by document</option>
              </select>
            </div>
            <div>
              <span className="rd-control-label">Reviewer action</span>
              <div className="rd-choice-grid">
                {(
                  [
                    ["confirm", "Confirm proposed"],
                    ["correct", "Correct value"],
                    ["unsupported", "Mark unsupported"],
                  ] as [ReviewAction, string][]
                ).map(([action, label]) => (
                  <button
                    className="rd-choice-button"
                    type="button"
                    key={action}
                    aria-pressed={selectedAction === action}
                    onClick={() => chooseAction(action)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {notice ? (
            <div className={`rd-notice is-${noticeTone}`} role="status" aria-live="polite">
              {notice}
            </div>
          ) : null}

          <footer className="rd-footer">
            <div className="rd-action-row">
              <button className="rd-secondary-button" type="button" onClick={escalateReview}>
                Simulate full-review escalation
              </button>
              <button className="rd-primary-button" type="button" onClick={submitReview}>
                Simulate save + revalidate
              </button>
            </div>
            <div className="rd-footer-note">
              Demo only · production would version, audit, and revalidate every action.
            </div>
          </footer>
        </aside>
          </section>
        </>
      ) : activeScenario.id === "C" ? (
        <FullReviewWorkflow onRunAnother={() => setActiveView("backend")} />
      ) : (
        <ScenarioReviewState
          scenario={activeScenario}
          onRunAnother={() => setActiveView("backend")}
        />
      ) : (
        <BackendShowcase
          selectedIndex={activeScenarioIndex}
          onScenarioChange={selectScenario}
        />
      )}
    </main>
  );
}

function BackendShowcase({
  selectedIndex,
  onScenarioChange,
}: {
  selectedIndex: number;
  onScenarioChange: (index: number) => void;
}) {
  const [runCount, setRunCount] = useState(1);
  const [isRunning, setIsRunning] = useState(false);
  const [visibleLineCount, setVisibleLineCount] = useState(Number.MAX_SAFE_INTEGER);
  const selectedScenario = backendShowcase.routes[selectedIndex];
  const terminalLines = [
    `$ ${backendShowcase.command} --scenario ${selectedScenario.id}`,
    "",
    `[1/5] load fixture ............... ${selectedScenario.fixture}`,
    `      document ................... ${selectedScenario.document_id}`,
    "[2/5] parse + normalize .......... ok",
    `[3/5] validation signals ......... ${selectedScenario.reasons.join(", ")}`,
    `[4/5] confidence + routing ....... ${selectedScenario.decision}`,
    `[5/5] delivery gate .............. ${selectedScenario.processing_status}`,
    "",
    `decision:      ${selectedScenario.decision}`,
    `delivery:      ${selectedScenario.delivery}`,
    `review fields: ${selectedScenario.review_field_count}`,
    `review task:   ${selectedScenario.review_task_id ?? "not created"}`,
    "",
    "contract check: Python fixture → frontend payload ✓",
  ];

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setTimeout(() => {
      const nextLineCount = visibleLineCount + 1;
      setVisibleLineCount(nextLineCount);
      if (nextLineCount >= terminalLines.length) setIsRunning(false);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [isRunning, terminalLines.length, visibleLineCount]);

  function runRandomScenario() {
    const offset = 1 + Math.floor(Math.random() * (backendShowcase.routes.length - 1));
    onScenarioChange((selectedIndex + offset) % backendShowcase.routes.length);
    setRunCount((current) => current + 1);
    setVisibleLineCount(1);
    setIsRunning(true);
  }

  return (
    <section className="rd-backend" role="tabpanel" aria-label="Backend demo">
      <div className="rd-backend-intro">
        <div>
          <div className="rd-backend-eyebrow">Runnable Python contract</div>
          <h1>Watch the trust router make its decision.</h1>
          <p>
            Run a scenario to follow the backend through validation, confidence
            scoring, routing, and the final delivery gate.
          </p>
        </div>
        <button
          className="rd-primary-button rd-run-button"
          type="button"
          disabled={isRunning}
          onClick={runRandomScenario}
        >
          {isRunning ? "Running scenario…" : "Run a scenario"}
        </button>
      </div>

      <div className="rd-scenario-strip" aria-label="Available Python scenarios">
        {backendShowcase.routes.map((route, index) => (
          <div
            className={`rd-scenario-chip ${index === selectedIndex ? "is-active" : ""}`}
            key={route.id}
          >
            <span>{route.id}</span>
            <div>
              <strong>{route.scenario}</strong>
              <small>{route.decision}</small>
            </div>
          </div>
        ))}
      </div>

      <div className="rd-terminal-shell" aria-busy={isRunning}>
        <div className="rd-terminal-bar">
          <div className="rd-terminal-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <span>ocrolus-takehome — backend showcase</span>
          <span className="rd-terminal-run" aria-live="polite">
            Run #{runCount} · scenario {selectedScenario.id} ·{" "}
            {isRunning ? "running" : "completed"}
          </span>
        </div>
        <pre className="rd-terminal-output" aria-label="Backend showcase output">
          {terminalLines.slice(0, visibleLineCount).join("\n")}
          {isRunning ? <span className="rd-terminal-cursor">▋</span> : null}
        </pre>
      </div>

      <div className="rd-backend-proof">
        <article>
          <div className="rd-proof-label">Scenario {selectedScenario.id} route</div>
          <strong>{selectedScenario.decision}</strong>
          <p>{selectedScenario.reasons.join(" · ")}</p>
        </article>
        <article>
          <div className="rd-proof-label">Delivery gate</div>
          <strong>{selectedScenario.processing_status}</strong>
          <p>{titleCase(selectedScenario.delivery)}.</p>
        </article>
        <article>
          <div className="rd-proof-label">Review handoff</div>
          <strong>
            {selectedScenario.review_task_id ? "Task created" : "No task required"}
          </strong>
          <p>
            {selectedScenario.review_task_id ??
              "The document completed or stopped before human review."}
          </p>
        </article>
      </div>
    </section>
  );
}

function FullReviewWorkflow({ onRunAnother }: { onRunAnother: () => void }) {
  const [selectedIssue, setSelectedIssue] = useState<FullIssueKey>("netPay");
  const [selectedAction, setSelectedAction] = useState<ReviewAction>("correct");
  const [correctedValue, setCorrectedValue] = useState(fullIssues.netPay.input);
  const [correctionReason, setCorrectionReason] = useState("accounting_mismatch");
  const [completed, setCompleted] = useState<Set<FullIssueKey>>(new Set());
  const [notice, setNotice] = useState("");
  const issue = fullIssues[selectedIssue];

  function chooseIssue(key: FullIssueKey) {
    setSelectedIssue(key);
    setSelectedAction("correct");
    setCorrectedValue(fullIssues[key].input);
    setCorrectionReason("accounting_mismatch");
    setNotice("");
  }

  function chooseAction(action: ReviewAction) {
    setSelectedAction(action);
    if (action === "unsupported") setCorrectionReason("unsupported");
    else if (correctionReason === "unsupported") {
      setCorrectionReason("accounting_mismatch");
    }
  }

  function submitReview() {
    if (selectedAction === "correct" && !correctedValue.trim()) {
      setNotice("Enter the verified amount or mark the field unsupported.");
      return;
    }
    setCompleted((current) => new Set(current).add(selectedIssue));
    setNotice(
      "Field saved in the simulation. All three totals must reconcile before business data can be released.",
    );
  }

  return (
    <div className="rd-full-review" role="tabpanel" aria-label="Full reviewer workflow">
      <section className="rd-contextbar rd-contextbar-danger" aria-label="Review task context">
        <div className="rd-doc-meta">
          <Meta label="Document" value="Pay stub" />
          <Meta label="Document ID" value={fullReviewTask.document_id} />
          <Meta label="Employer" value={fullCandidate.employer.name} />
          <Meta label="Review fields" value="3 accounting totals" />
        </div>
        <span className="rd-review-type rd-review-type-danger">Full review</span>
      </section>

      <section className="rd-full-warning" role="alert">
        <div className="rd-warning-icon" aria-hidden="true">!</div>
        <div>
          <div className="rd-warning-kicker">Critical accounting issue</div>
          <h1>Full document review required</h1>
          <p>
            Gross pay minus total deductions should equal net pay. This document is
            off by <strong>$100.00</strong>, so all business data is blocked.
          </p>
          <div className="rd-warning-equation">
            $2,500.00 gross − $500.00 deductions = $2,000.00 expected net
            <span>Document reports $2,100.00</span>
          </div>
        </div>
        <button className="rd-warning-link" type="button" onClick={onRunAnother}>
          Run another scenario
        </button>
      </section>

      <section className="rd-workspace rd-full-workspace">
        <article className="rd-viewer" aria-label="Accounting mismatch source document">
          <div className="rd-viewer-header rd-viewer-header-danger">
            <div>
              <div className="rd-viewer-title">Source document · accounting mismatch</div>
              <div className="rd-small-muted">
                Select an issue to move the red callout on the document
              </div>
            </div>
            <span className="rd-source-warning-badge">3 issues found</span>
          </div>
          <div className="rd-viewer-stage">
            <div className="rd-page-wrap">
              <div className="rd-paper">
                <div className="rd-paper-brand">
                  <div className="rd-paper-company">{fullCandidate.employer.name}</div>
                  <div className="rd-paper-paystub">
                    <strong>Earnings Statement</strong>
                    Pay date: {formatNumericDate(fullCandidate.pay_period.pay_date)}
                  </div>
                </div>
                <div className="rd-paper-grid">
                  <div className="rd-paper-box">
                    <strong>Employee</strong>
                    {fullCandidate.employee.name}
                    <br />
                    Employee ID: {fullCandidate.employee.id}
                  </div>
                  <div className="rd-paper-box">
                    <strong>Pay period</strong>
                    {formatNumericDate(fullCandidate.pay_period.start)} –{" "}
                    {formatNumericDate(fullCandidate.pay_period.end)}
                    <br />
                    Frequency: {titleCase(fullCandidate.pay_period.frequency)}
                  </div>
                </div>
                <FullReviewDocument selectedIssue={selectedIssue} />
              </div>
            </div>
          </div>
        </article>

        <aside className="rd-review-panel rd-review-panel-danger" aria-label="Accounting fields to inspect">
          <div className="rd-review-header">
            <div>
              <div className="rd-review-title">Accounting fields to inspect</div>
              <div className="rd-small-muted">
                {completed.size} of 3 verified · resolve the failed equation
              </div>
            </div>
            <span className="rd-source-warning-badge">Blocked</span>
          </div>

          <div className="rd-issue-list" role="list" aria-label="Accounting review issues">
            {(Object.keys(fullIssues) as FullIssueKey[]).map((key, index) => (
              <button
                className="rd-issue-item rd-issue-item-danger"
                type="button"
                key={key}
                onClick={() => chooseIssue(key)}
                aria-current={selectedIssue === key}
              >
                <span className="rd-issue-number">{index + 1}</span>
                <span>
                  <span className="rd-issue-name">{fullIssues[key].title}</span>
                  <span className="rd-issue-path">{fullIssues[key].path}</span>
                </span>
                <span className={`rd-issue-state ${completed.has(key) ? "is-done" : "is-error"}`}>
                  {completed.has(key) ? "Verified" : "Issue"}
                </span>
              </button>
            ))}
          </div>

          <div className="rd-form">
            <div>
              <div className="rd-field-title">{issue.title}</div>
              <div className="rd-field-path">{issue.path}</div>
            </div>
            <div className="rd-danger-reason">
              <span>GROSS_NET_MISMATCH</span>
              <p>{issue.reason}</p>
            </div>
            <div className="rd-values">
              <ValueBlock label="Extracted value" value={issue.proposed} />
              <ValueBlock label="Field confidence" value="99%" confidence />
            </div>
            <div>
              <label className="rd-control-label" htmlFor="fullCorrectedValue">
                Verified amount from document
              </label>
              <input
                className="rd-input"
                id="fullCorrectedValue"
                value={correctedValue}
                disabled={selectedAction !== "correct"}
                onChange={(event) => setCorrectedValue(event.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="rd-control-label" htmlFor="fullCorrectionReason">
                Review reason
              </label>
              <select
                className="rd-select"
                id="fullCorrectionReason"
                value={correctionReason}
                onChange={(event) => setCorrectionReason(event.target.value)}
              >
                <option value="accounting_mismatch">Resolve accounting mismatch</option>
                <option value="source_verified">Verified against printed total</option>
                <option value="model_misread">Extraction misread printed amount</option>
                <option value="unsupported">Amount not supported by document</option>
              </select>
            </div>
            <div>
              <span className="rd-control-label">Reviewer action</span>
              <div className="rd-choice-grid">
                {(
                  [
                    ["confirm", "Confirm source"],
                    ["correct", "Correct amount"],
                    ["unsupported", "Mark unsupported"],
                  ] as [ReviewAction, string][]
                ).map(([action, label]) => (
                  <button
                    className="rd-choice-button"
                    type="button"
                    key={action}
                    aria-pressed={selectedAction === action}
                    onClick={() => chooseAction(action)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {notice ? (
            <div className="rd-notice is-warning" role="status" aria-live="polite">
              {notice}
            </div>
          ) : null}

          <footer className="rd-footer">
            <button className="rd-primary-button rd-danger-button" type="button" onClick={submitReview}>
              Simulate save + recalculate
            </button>
            <div className="rd-footer-note">Release stays blocked until the totals reconcile.</div>
          </footer>
        </aside>
      </section>
    </div>
  );
}

function ScenarioReviewState({
  scenario,
  onRunAnother,
}: {
  scenario: BackendScenario;
  onRunAnother: () => void;
}) {
  if (scenario.decision === "REJECT") {
    return <RejectedDocumentState scenario={scenario} onRunAnother={onRunAnother} />;
  }

  return <AcceptedDocumentState scenario={scenario} onRunAnother={onRunAnother} />;
}

function AcceptedDocumentState({
  scenario,
  onRunAnother,
}: {
  scenario: BackendScenario;
  onRunAnother: () => void;
}) {
  return (
    <div className="rd-full-review rd-accepted-review" role="tabpanel" aria-label="Accepted document">
      <section className="rd-accept-banner" role="status">
        <div className="rd-accept-icon" aria-hidden="true">✓</div>
        <div>
          <div className="rd-accept-kicker">All trust checks passed</div>
          <h1>Document auto-accepted</h1>
          <p>
            The extraction is internally consistent and every confidence gate passed.
            Business data was released without human review.
          </p>
          <div className="rd-accept-signals">
            VALIDATION PASS · CONFIDENCE PASS · ROUTING COMPLETE
            <span>Data delivered</span>
          </div>
        </div>
        <button className="rd-accept-link" type="button" onClick={onRunAnother}>
          Run another scenario
        </button>
      </section>

      <section className="rd-accept-body">
        <div className="rd-accept-summary">
          <div className="rd-accept-kicker">Why this passed automatically</div>
          <h2>No reviewer action is needed.</h2>
          <p>
            The router found no validation failures, no low-confidence fields, and
            no reason to hold the lender-ready output.
          </p>
        </div>

        <div className="rd-review-state-grid rd-review-state-grid-success">
          <article>
            <div className="rd-proof-label">Validation</div>
            <strong>All checks passed</strong>
            <p>Gross pay, deductions, net pay, dates, and required fields are consistent.</p>
          </article>
          <article>
            <div className="rd-proof-label">Confidence</div>
            <strong>Above threshold</strong>
            <p>No extracted field requires targeted or full-document review.</p>
          </article>
          <article>
            <div className="rd-proof-label">Review handoff</div>
            <strong>No task needed</strong>
            <p>The document completed automatically with no reviewer queue entry.</p>
          </article>
        </div>

        <aside className="rd-delivery-success">
          <div>
            <span>Final outcome</span>
            <strong>{titleCase(scenario.delivery)}</strong>
          </div>
          <p>The clean extraction safely crossed the delivery gate.</p>
        </aside>
      </section>
    </div>
  );
}

function RejectedDocumentState({
  scenario,
  onRunAnother,
}: {
  scenario: BackendScenario;
  onRunAnother: () => void;
}) {
  return (
    <div className="rd-full-review rd-rejected-review" role="tabpanel" aria-label="Rejected document">
      <section className="rd-full-warning rd-reject-warning" role="alert">
        <div className="rd-warning-icon" aria-hidden="true">!</div>
        <div>
          <div className="rd-warning-kicker">Critical document failure</div>
          <h1>Document rejected</h1>
          <p>
            The source cannot be read reliably and required payroll fields are
            missing. Processing stopped before any business data was released.
          </p>
          <div className="rd-warning-equation">
            DOCUMENT_UNREADABLE · MISSING_REQUIRED_FIELD
            <span>Replacement required</span>
          </div>
        </div>
        <button className="rd-warning-link" type="button" onClick={onRunAnother}>
          Run another scenario
        </button>
      </section>

      <section className="rd-rejection-body">
        <div className="rd-rejection-reasons">
          <div className="rd-warning-kicker">Why processing stopped</div>
          <h2>The document failed before reviewer handoff.</h2>
          <ul>
            <li>
              <strong>Unreadable source</strong>
              <span>The image quality is too low to support trustworthy extraction.</span>
            </li>
            <li>
              <strong>Required fields missing</strong>
              <span>Core pay-stub facts could not be recovered from the document.</span>
            </li>
            <li>
              <strong>No safe correction path</strong>
              <span>A reviewer cannot verify values that are not legible on the source.</span>
            </li>
          </ul>
        </div>

        <div className="rd-review-state-grid rd-review-state-grid-danger">
          <article>
            <div className="rd-proof-label">Router decision</div>
            <strong>{scenario.decision}</strong>
            <p>Safety rules stopped the document before extraction could continue.</p>
          </article>
          <article>
            <div className="rd-proof-label">Delivery gate</div>
            <strong>Business data withheld</strong>
            <p>No uncertain values leave the trust boundary.</p>
          </article>
          <article>
            <div className="rd-proof-label">Review handoff</div>
            <strong>No task created</strong>
            <p>Human review begins only after a readable replacement is supplied.</p>
          </article>
        </div>

        <aside className="rd-replacement-action">
          <div>
            <span>Required next action</span>
            <strong>Request a clearer replacement document</strong>
          </div>
          <p>Ask for a complete, uncropped pay stub with legible totals and employee details.</p>
        </aside>
      </section>
    </div>
  );
}

function Instructions({
  onNavigate,
}: {
  onNavigate: (view: ActiveView) => void;
}) {
  return (
    <section className="rd-instructions" role="tabpanel" aria-label="Instructions">
      <div className="rd-instructions-hero">
        <div className="rd-backend-eyebrow">Demo guide</div>
        <h1>See the decision, then review the evidence.</h1>
        <p>
          This prototype demonstrates how extracted pay-stub data is validated,
          routed, and handed to a reviewer when human judgment is needed.
        </p>
        <div className="rd-instructions-actions">
          <button
            className="rd-primary-button"
            type="button"
            onClick={() => onNavigate("backend")}
          >
            Start with the backend demo
          </button>
          <button
            className="rd-secondary-button"
            type="button"
            onClick={() => onNavigate("review")}
          >
            Open the reviewer workflow
          </button>
        </div>
      </div>

      <div className="rd-instructions-grid">
        <article>
          <span className="rd-instruction-number">1</span>
          <div>
            <h2>Run the backend</h2>
            <p>
              Open <strong>Backend demo</strong> and click <strong>Run a scenario</strong>.
              Watch validation signals become a route and a delivery decision.
            </p>
          </div>
        </article>
        <article>
          <span className="rd-instruction-number">2</span>
          <div>
            <h2>Inspect a review task</h2>
            <p>
              Open <strong>Reviewer workflow</strong>. Select a flagged field and compare
              its proposed value with the red callout on the source document.
            </p>
          </div>
        </article>
        <article>
          <span className="rd-instruction-number">3</span>
          <div>
            <h2>Make a reviewer decision</h2>
            <p>
              Confirm, correct, or mark the field unsupported. Then simulate saving
              the review or escalating the entire document.
            </p>
          </div>
        </article>
      </div>

      <aside className="rd-instructions-note">
        <strong>What to notice</strong>
        <span>
          Business data is withheld whenever the router requires review, and every
          reviewer action stays tied to source evidence.
        </span>
      </aside>
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rd-meta-block">
      <div className="rd-meta-label">{label}</div>
      <div className="rd-meta-value">{value}</div>
    </div>
  );
}

function ValueBlock({
  label,
  value,
  confidence = false,
}: {
  label: string;
  value: string;
  confidence?: boolean;
}) {
  return (
    <div className="rd-value-block">
      <div className="rd-value-label">{label}</div>
      <div className={`rd-value ${confidence ? "rd-confidence" : ""}`}>{value}</div>
    </div>
  );
}

function SourceDocument({ selectedIssue }: { selectedIssue: IssueKey }) {
  const earnings = candidate.earnings;
  const deductions = candidate.deductions;
  return (
    <>
      <table className="rd-pay-table">
        <caption className="rd-visually-hidden">Earnings shown on source pay stub</caption>
        <thead>
          <tr>
            <th>Earnings</th>
            <th>Rate</th>
            <th>Hours</th>
            <th>Current</th>
            <th>YTD</th>
          </tr>
        </thead>
        <tbody>
          {earnings.items.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{item.rate ?? "—"}</td>
              <td>{item.hours ?? "—"}</td>
              <td>{money(item.current_amount)}</td>
              <td>{money(item.year_to_date_amount)}</td>
            </tr>
          ))}
          <tr className="rd-total">
            <td>Gross Pay</td>
            <td />
            <td />
            <td>{money(earnings.gross.current)}</td>
            <td>{money(earnings.gross.year_to_date)}</td>
          </tr>
        </tbody>
      </table>
      <table className="rd-pay-table">
        <caption className="rd-visually-hidden">Deductions shown on source pay stub</caption>
        <thead>
          <tr>
            <th>Deductions</th>
            <th>Type</th>
            <th />
            <th>Current</th>
            <th>YTD</th>
          </tr>
        </thead>
        <tbody>
          {deductions.items.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td
                id="sourceBenefitType"
                className={
                  selectedIssue === "taxTreatment" ? "rd-document-issue is-active" : ""
                }
              >
                —
                {selectedIssue === "taxTreatment" ? (
                  <span className="rd-document-callout">Issue: tax treatment is missing</span>
                ) : null}
              </td>
              <td />
              <td
                className={
                  selectedIssue === "benefitYtd" ? "rd-document-reference" : ""
                }
              >
                {money(item.current_amount)}
              </td>
              <td
                id="sourceBenefitYtd"
                className={
                  selectedIssue === "benefitYtd" ? "rd-document-issue is-active" : ""
                }
              >
                {money(item.year_to_date_amount)}
                {selectedIssue === "benefitYtd" ? (
                  <span className="rd-document-callout">Issue: YTD is below current</span>
                ) : null}
              </td>
            </tr>
          ))}
          <tr className="rd-total">
            <td>Total Deductions</td>
            <td />
            <td />
            <td>{money(deductions.total.current)}</td>
            <td>{money(deductions.total.year_to_date)}</td>
          </tr>
        </tbody>
      </table>
      <table className="rd-pay-table">
        <caption className="rd-visually-hidden">Net pay shown on source pay stub</caption>
        <tbody>
          <tr className="rd-total">
            <td>Net Pay</td>
            <td />
            <td />
            <td>{money(candidate.net_pay.current)}</td>
            <td>{money(candidate.net_pay.year_to_date)}</td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function FullReviewDocument({ selectedIssue }: { selectedIssue: FullIssueKey }) {
  const earnings = fullCandidate.earnings;
  const deductions = fullCandidate.deductions;
  const issueClass = (key: FullIssueKey) =>
    `rd-document-issue ${selectedIssue === key ? "is-active" : "is-related"}`;

  return (
    <>
      <table className="rd-pay-table">
        <caption className="rd-visually-hidden">Earnings shown on source pay stub</caption>
        <thead>
          <tr>
            <th>Earnings</th>
            <th>Rate</th>
            <th>Hours</th>
            <th>Current</th>
            <th>YTD</th>
          </tr>
        </thead>
        <tbody>
          {earnings.items.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{item.rate ?? "—"}</td>
              <td>{item.hours ?? "—"}</td>
              <td>{money(item.current_amount)}</td>
              <td>{money(item.year_to_date_amount)}</td>
            </tr>
          ))}
          <tr className="rd-total">
            <td>Gross Pay</td>
            <td />
            <td />
            <td id="fullGrossPay" className={issueClass("grossPay")}>
              {money(earnings.gross.current)}
              {selectedIssue === "grossPay" ? (
                <span className="rd-document-callout">Check 1: verify gross pay</span>
              ) : null}
            </td>
            <td>{money(earnings.gross.year_to_date)}</td>
          </tr>
        </tbody>
      </table>
      <table className="rd-pay-table">
        <caption className="rd-visually-hidden">Deductions shown on source pay stub</caption>
        <thead>
          <tr>
            <th>Deductions</th>
            <th>Type</th>
            <th />
            <th>Current</th>
            <th>YTD</th>
          </tr>
        </thead>
        <tbody>
          {deductions.items.map((item) => (
            <tr key={item.label}>
              <td>{item.label}</td>
              <td>{titleCase(item.type)}</td>
              <td />
              <td>{money(item.current_amount)}</td>
              <td>{money(item.year_to_date_amount)}</td>
            </tr>
          ))}
          <tr className="rd-total">
            <td>Total Deductions</td>
            <td />
            <td />
            <td id="fullDeductions" className={issueClass("deductions")}>
              {money(deductions.total.current)}
              {selectedIssue === "deductions" ? (
                <span className="rd-document-callout">Check 2: verify deductions</span>
              ) : null}
            </td>
            <td>{money(deductions.total.year_to_date)}</td>
          </tr>
        </tbody>
      </table>
      <table className="rd-pay-table">
        <caption className="rd-visually-hidden">Net pay shown on source pay stub</caption>
        <tbody>
          <tr className="rd-total">
            <td>Net Pay</td>
            <td />
            <td />
            <td id="fullNetPay" className={issueClass("netPay")}>
              {money(fullCandidate.net_pay.current)}
              {selectedIssue === "netPay" ? (
                <span className="rd-document-callout">Error: $100 above expected net</span>
              ) : null}
            </td>
            <td>{money(fullCandidate.net_pay.year_to_date)}</td>
          </tr>
        </tbody>
      </table>
      <div className="rd-document-equation">
        <strong>Failed check</strong>
        $2,500.00 − $500.00 = $2,000.00, not $2,100.00
      </div>
    </>
  );
}

function money(value: string | null) {
  return value === null ? "—" : Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 });
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}

function formatNumericDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00Z`));
}
