"""Combine deterministic validation and confidence into a review decision."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Tuple

from .confidence import ConfidenceAssessment, ConfidencePolicy, assess_confidence
from .models import PayStubCandidate
from .validation import Severity, ValidationIssue, validate_candidate


class RoutingAction(str, Enum):
    AUTO_ACCEPT = "AUTO_ACCEPT"
    FIELD_REVIEW = "FIELD_REVIEW"
    FULL_REVIEW = "FULL_REVIEW"
    REJECT = "REJECT"


@dataclass(frozen=True)
class RoutingDecision:
    action: RoutingAction
    reasons: Tuple[str, ...]
    review_fields: Tuple[str, ...]
    validation_issues: Tuple[ValidationIssue, ...]
    confidence: ConfidenceAssessment

    def to_dict(self) -> Dict[str, object]:
        return {
            "action": self.action.value,
            "reasons": list(self.reasons),
            "review_fields": list(self.review_fields),
            "validation_issues": [issue.to_dict() for issue in self.validation_issues],
            "confidence": self.confidence.to_dict(),
        }


def _review_fields(
    issues: List[ValidationIssue], assessment: ConfidenceAssessment
) -> Tuple[str, ...]:
    fields = set(assessment.review_fields)
    for issue in issues:
        fields.update(issue.fields)
    return tuple(sorted(fields))


def route_candidate(
    candidate: PayStubCandidate,
    policy: Optional[ConfidencePolicy] = None,
) -> RoutingDecision:
    policy = policy or ConfidencePolicy()
    issues = validate_candidate(candidate)
    assessment = assess_confidence(candidate, policy)
    review_fields = _review_fields(issues, assessment)

    if candidate.document_readability < policy.unreadable_reject_threshold:
        return RoutingDecision(
            action=RoutingAction.REJECT,
            reasons=("DOCUMENT_UNREADABLE",),
            review_fields=(),
            validation_issues=tuple(issues),
            confidence=assessment,
        )

    errors = [issue for issue in issues if issue.severity == Severity.ERROR]
    warnings = [issue for issue in issues if issue.severity == Severity.WARNING]

    full_review_reasons: List[str] = []
    if errors:
        full_review_reasons.append("DETERMINISTIC_VALIDATION_FAILED")
    if assessment.weak_critical_fields:
        full_review_reasons.append("CRITICAL_FIELD_CONFIDENCE_TOO_LOW")
    if assessment.below_reviewable_floor:
        full_review_reasons.append("FIELD_CONFIDENCE_TOO_LOW")
    if len(review_fields) > policy.max_targeted_review_fields:
        full_review_reasons.append("TOO_MANY_FIELDS_REQUIRE_REVIEW")

    if full_review_reasons:
        action = RoutingAction.FULL_REVIEW
        reasons = tuple(full_review_reasons)
    elif warnings or assessment.review_fields:
        action = RoutingAction.FIELD_REVIEW
        reasons_list = []
        if warnings:
            reasons_list.append("VALIDATION_WARNING")
        if assessment.review_fields:
            reasons_list.append("FIELD_CONFIDENCE_BELOW_AUTO_ACCEPT_THRESHOLD")
        reasons = tuple(reasons_list)
    else:
        action = RoutingAction.AUTO_ACCEPT
        reasons = ("ALL_CHECKS_PASSED",)

    return RoutingDecision(
        action=action,
        reasons=reasons,
        review_fields=review_fields,
        validation_issues=tuple(issues),
        confidence=assessment,
    )
