"""Build the internal review task consumed by the reviewer UI."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from .models import Evidence, PayStubCandidate
from .result import PIPELINE_VERSION, SCHEMA_VERSION, build_business_data
from .routing import RoutingAction, RoutingDecision, route_candidate
from .validation import ValidationIssue

RULES_VERSION = "validation-v1"
ROUTING_POLICY_VERSION = "confidence-v1"

_ROUTING_MESSAGES = {
    "DETERMINISTIC_VALIDATION_FAILED": "One or more deterministic checks failed.",
    "CRITICAL_FIELD_CONFIDENCE_TOO_LOW": (
        "A critical field is below the full-review confidence threshold."
    ),
    "FIELD_CONFIDENCE_TOO_LOW": (
        "A field is below the minimum confidence for targeted review."
    ),
    "TOO_MANY_FIELDS_REQUIRE_REVIEW": "Too many fields require targeted review.",
    "VALIDATION_WARNING": "A deterministic check requires targeted review.",
    "FIELD_CONFIDENCE_BELOW_AUTO_ACCEPT_THRESHOLD": (
        "One or more fields are below the auto-accept confidence threshold."
    ),
}

_DIRECT_POINTERS = {
    "currency": "/currency",
    "employee.name": "/employee/name",
    "employee.id": "/employee/id",
    "employer.name": "/employer/name",
    "pay_period.start": "/pay_period/start",
    "pay_period.end": "/pay_period/end",
    "pay_period.pay_date": "/pay_period/pay_date",
    "pay_period.frequency": "/pay_period/frequency",
    "compensation_rate.basis": "/compensation_rate/basis",
    "compensation_rate.amount": "/compensation_rate/amount",
    "compensation_rate.unit": "/compensation_rate/unit",
    "earnings": "/earnings/items",
    "deductions": "/deductions/items",
    "totals.gross_pay": "/earnings/gross/current",
    "totals.gross_pay_ytd": "/earnings/gross/year_to_date",
    "totals.total_deductions": "/deductions/total/current",
    "totals.total_deductions_ytd": "/deductions/total/year_to_date",
    "totals.net_pay": "/net_pay/current",
    "totals.net_pay_ytd": "/net_pay/year_to_date",
}
_ITEM_PATH = re.compile(r"^(earnings|deductions)\[(\d+)\]\.(.+)$")


def candidate_path_to_pointer(path: str) -> str:
    """Translate an internal dotted path to the canonical review-task pointer."""

    direct = _DIRECT_POINTERS.get(path)
    if direct is not None:
        return direct

    match = _ITEM_PATH.match(path)
    if match:
        collection, index, field = match.groups()
        return "/{}/items/{}/{}".format(collection, index, field)

    raise ValueError("unmapped candidate path: {}".format(path))


def _evidence(evidence: Optional[Evidence]) -> List[Dict[str, Any]]:
    if evidence is None:
        return []
    return [
        {
            "page": evidence.page,
            "text": evidence.text,
            "bounding_box": (
                list(evidence.bounding_box) if evidence.bounding_box else None
            ),
        }
    ]


def _validation_issue(issue: ValidationIssue) -> Dict[str, Any]:
    return {
        "code": issue.code,
        "severity": issue.severity.value,
        "message": issue.message,
        "fields": [candidate_path_to_pointer(path) for path in issue.fields],
    }


def _review_reasons(decision: RoutingDecision) -> List[Dict[str, Any]]:
    review_fields = [candidate_path_to_pointer(path) for path in decision.review_fields]
    reasons = [
        {
            "code": code,
            "message": _ROUTING_MESSAGES[code],
            "fields": review_fields,
        }
        for code in decision.reasons
    ]
    reasons.extend(
        {
            "code": issue.code,
            "message": issue.message,
            "fields": [candidate_path_to_pointer(path) for path in issue.fields],
        }
        for issue in decision.validation_issues
    )
    return reasons


def build_review_task(
    candidate: PayStubCandidate,
    decision: Optional[RoutingDecision] = None,
    task_version: int = 1,
    state: str = "QUEUED",
    reviewer_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Return an internal A9 task for field or full review."""

    decision = decision or route_candidate(candidate)
    if decision.action not in {
        RoutingAction.FIELD_REVIEW,
        RoutingAction.FULL_REVIEW,
    }:
        raise ValueError("review tasks require FIELD_REVIEW or FULL_REVIEW")
    if task_version < 1:
        raise ValueError("task_version must be at least 1")
    if state not in {"QUEUED", "CLAIMED"}:
        raise ValueError("initial review task state must be QUEUED or CLAIMED")
    if state == "QUEUED" and reviewer_id is not None:
        raise ValueError("queued review tasks cannot have a reviewer")
    if state == "CLAIMED" and not reviewer_id:
        raise ValueError("claimed review tasks require a reviewer")

    review_paths = set(decision.review_fields)
    observations = []
    for path, field in candidate.iter_fields():
        if decision.action == RoutingAction.FIELD_REVIEW and path not in review_paths:
            continue
        if field.value is None and path not in review_paths:
            continue
        observations.append(
            {
                "path": candidate_path_to_pointer(path),
                "value": field.to_dict()["value"],
                "confidence": field.confidence if field.value is not None else None,
                "source": {
                    "simulated_upstream_output": "simulated",
                    "manual_transcription_of_supplied_paystub": "manual",
                }.get(candidate.source, "model"),
                "review_required": path in review_paths,
                "evidence": _evidence(field.evidence),
            }
        )

    return {
        "schema_version": SCHEMA_VERSION,
        "task_id": "review-{}-v{}".format(candidate.document_id, task_version),
        "task_version": task_version,
        "state": state,
        "reviewer_id": reviewer_id,
        "document_id": candidate.document_id,
        "document_type": "pay_stub",
        "review_type": decision.action.value,
        "candidate": build_business_data(candidate),
        "routing": {
            "average_confidence": (
                round(decision.confidence.average_confidence, 6)
                if decision.confidence.average_confidence is not None
                else None
            ),
            "fields": [
                candidate_path_to_pointer(path) for path in decision.review_fields
            ],
            "reasons": _review_reasons(decision),
            "validation_issues": [
                _validation_issue(issue) for issue in decision.validation_issues
            ],
        },
        "field_observations": observations,
        "provenance": {
            "extraction_source": candidate.source,
            "rules_version": RULES_VERSION,
            "routing_policy_version": ROUTING_POLICY_VERSION,
            "pipeline_version": PIPELINE_VERSION,
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build the internal review task for a simulated candidate."
    )
    parser.add_argument("fixture", type=Path, help="Path to a candidate JSON file")
    parser.add_argument(
        "--state",
        choices=("QUEUED", "CLAIMED"),
        default="QUEUED",
        help="Initial task state",
    )
    parser.add_argument("--reviewer-id", help="Required when state is CLAIMED")
    args = parser.parse_args()

    candidate = PayStubCandidate.from_json_file(args.fixture)
    task = build_review_task(
        candidate,
        state=args.state,
        reviewer_id=args.reviewer_id,
    )
    print(json.dumps(task, indent=2))


if __name__ == "__main__":
    main()
