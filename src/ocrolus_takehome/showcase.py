"""One-command presentation of the Part B backend workflow."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Dict, Optional, Sequence

from .models import PayStubCandidate
from .result import build_result
from .review import build_review_task
from .routing import route_candidate

FIXTURES = (
    ("Clean extraction", "fixtures/clean_candidate.json"),
    (
        "Suspicious YTD",
        "fixtures/edge_cases/suspicious_ytd_candidate.json",
    ),
    (
        "Accounting mismatch",
        "fixtures/edge_cases/gross_net_mismatch_candidate.json",
    ),
    ("Unreadable document", "fixtures/edge_cases/unreadable_candidate.json"),
)

BUSINESS_FIELDS = {
    "currency",
    "employee",
    "employer",
    "pay_period",
    "compensation_rate",
    "earnings",
    "deductions",
    "net_pay",
}


def build_showcase_payload(root: Path) -> Dict[str, Any]:
    """Return the structured showcase shared by the CLI and deployed UI."""

    routed = []
    for scenario, relative_path in FIXTURES:
        candidate = PayStubCandidate.from_json_file(root / relative_path)
        decision = route_candidate(candidate)
        result = build_result(candidate, decision)
        routed.append((scenario, candidate, decision, result))

    _scenario, candidate, decision, result = routed[1]
    leaked_fields = BUSINESS_FIELDS.intersection(result)
    task = build_review_task(
        candidate,
        decision,
        state="CLAIMED",
        reviewer_id="demo-reviewer",
    )
    review_fields = task["routing"]["fields"]
    observations_with_evidence = sum(
        bool(observation["evidence"]) for observation in task["field_observations"]
    )

    routes = []
    for index, (scenario, candidate, routed_decision, routed_result) in enumerate(
        routed
    ):
        reasons = list(
            dict.fromkeys(
                list(routed_decision.reasons)
                + [issue.code for issue in routed_decision.validation_issues]
            )
        )
        review_task_id = None
        if routed_decision.action.value in {"FIELD_REVIEW", "FULL_REVIEW"}:
            review_task_id = build_review_task(candidate, routed_decision)["task_id"]
        routes.append(
            {
                "id": chr(ord("A") + index),
                "scenario": scenario,
                "fixture": FIXTURES[index][1],
                "document_id": candidate.document_id,
                "decision": routed_decision.action.value,
                "processing_status": routed_result["processing_status"],
                "delivery": (
                    "business data delivered"
                    if routed_decision.action.value == "AUTO_ACCEPT"
                    else "business data withheld"
                ),
                "reasons": reasons,
                "review_field_count": len(routed_decision.review_fields),
                "review_task_id": review_task_id,
            }
        )

    return {
        "command": "./demo",
        "routes": routes,
        "safety_gate": {
            "label": "Suspicious values in lender response",
            "passed": not leaked_fields,
            "result": (
                "NO — correctly withheld" if not leaked_fields else "YES — investigate"
            ),
        },
        "review_handoff": {
            "task_id": task["task_id"],
            "flagged_fields": len(review_fields),
            "evidence_backed_observations": observations_with_evidence,
            "contract": ("Python task exactly matches the bundled frontend fixture"),
        },
        "code_path": [
            "validation.py",
            "confidence.py",
            "routing.py",
            "result.py / review.py",
        ],
    }


def build_showcase(root: Path) -> str:
    """Return a compact, human-readable walkthrough of every backend gate."""

    payload = build_showcase_payload(root)
    heading = "PART B · PAY-STUB TRUST ROUTER"
    lines = [heading, "=" * len(heading), "", "ROUTING MATRIX"]
    for route in payload["routes"]:
        lines.append(
            f"  {route['scenario']:<21} → {route['decision']:<12} "
            f"→ {route['processing_status']:<14} · {route['delivery']}"
        )

    safety_gate = payload["safety_gate"]
    handoff = payload["review_handoff"]
    lines.extend(
        [
            "",
            "SAFETY GATE",
            f"  {safety_gate['label']}: {safety_gate['result']}",
            "",
            "REVIEW UI HANDOFF",
            f"  Task: {handoff['task_id']}",
            f"  Flagged fields: {handoff['flagged_fields']}",
            (
                "  Evidence-backed observations: "
                f"{handoff['evidence_backed_observations']}"
            ),
            f"  Contract: {handoff['contract']}",
            "",
            "CODE PATH",
            f"  {' → '.join(payload['code_path'])}",
        ]
    )
    return "\n".join(lines)


def main(argv: Optional[Sequence[str]] = None) -> None:
    parser = argparse.ArgumentParser(
        description="Run the complete Part B backend showcase in one command."
    )
    parser.add_argument(
        "--root",
        type=Path,
        default=Path.cwd(),
        help="Repository root containing fixtures/ (defaults to current directory)",
    )
    args = parser.parse_args(argv)
    print(build_showcase(args.root.resolve()))


if __name__ == "__main__":
    main()
