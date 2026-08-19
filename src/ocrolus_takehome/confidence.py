"""Configurable field-level confidence policy."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple

from .models import PayStubCandidate
from .validation import REQUIRED_FIELDS


@dataclass(frozen=True)
class ConfidencePolicy:
    """Provisional values that must be calibrated before production use."""

    auto_accept_threshold: float = 0.95
    critical_full_review_threshold: float = 0.90
    reviewable_field_floor: float = 0.70
    unreadable_reject_threshold: float = 0.40
    max_targeted_review_fields: int = 3
    critical_fields: frozenset = REQUIRED_FIELDS


@dataclass(frozen=True)
class ConfidenceAssessment:
    average_confidence: Optional[float]
    minimum_critical_confidence: Optional[float]
    review_fields: Tuple[str, ...]
    weak_critical_fields: Tuple[str, ...]
    below_reviewable_floor: Tuple[str, ...]

    def to_dict(self) -> Dict[str, object]:
        return {
            "average_confidence": self.average_confidence,
            "minimum_critical_confidence": self.minimum_critical_confidence,
            "review_fields": list(self.review_fields),
            "weak_critical_fields": list(self.weak_critical_fields),
            "below_reviewable_floor": list(self.below_reviewable_floor),
        }


def assess_confidence(
    candidate: PayStubCandidate,
    policy: Optional[ConfidencePolicy] = None,
) -> ConfidenceAssessment:
    policy = policy or ConfidencePolicy()
    observed = [
        (path, field.confidence)
        for path, field in candidate.iter_fields()
        if field.value is not None
    ]
    average = (
        sum(confidence for _, confidence in observed) / len(observed)
        if observed
        else None
    )

    critical = [
        (path, confidence)
        for path, confidence in observed
        if path in policy.critical_fields
    ]
    minimum_critical = min((confidence for _, confidence in critical), default=None)

    review_fields = sorted(
        path
        for path, confidence in observed
        if confidence < policy.auto_accept_threshold
    )
    weak_critical = sorted(
        path
        for path, confidence in critical
        if confidence < policy.critical_full_review_threshold
    )
    below_floor = sorted(
        path
        for path, confidence in observed
        if confidence < policy.reviewable_field_floor
    )

    return ConfidenceAssessment(
        average_confidence=average,
        minimum_critical_confidence=minimum_critical,
        review_fields=tuple(review_fields),
        weak_critical_fields=tuple(weak_critical),
        below_reviewable_floor=tuple(below_floor),
    )
