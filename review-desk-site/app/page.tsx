"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import reviewTask from "./review-task.json";

type IssueKey = "benefitYtd" | "taxTreatment";
type ReviewAction = "confirm" | "correct" | "unsupported";
type Highlight = { left: string; top: string; width: string; height: string };

const candidate = reviewTask.candidate;
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
    target: "sourceBenefitLabel",
  },
} satisfies Record<IssueKey, Record<string, string>>;

export default function Home() {
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
          <span className="rd-status">{titleCase(reviewTask.state)}</span>
          <span className="rd-reviewer">Reviewer: Demo reviewer</span>
        </div>
      </header>

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

      <section className="rd-workspace">
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
                <SourceDocument />
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
    </main>
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

function SourceDocument() {
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
              <td id="sourceBenefitLabel">{item.label}</td>
              <td>—</td>
              <td />
              <td>{money(item.current_amount)}</td>
              <td id="sourceBenefitYtd">{money(item.year_to_date_amount)}</td>
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
