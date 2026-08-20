"""Build the lender-facing, delivery-gated pay-stub result."""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Any, Dict, Optional, Set

from .models import LineItem, PayStubCandidate
from .routing import RoutingAction, RoutingDecision, route_candidate

SCHEMA_VERSION = "1.0"
PIPELINE_VERSION = "prototype-v1"


def _money(value: Optional[Decimal]) -> Optional[str]:
    if value is None:
        return None
    return format(value.quantize(Decimal("0.01")), "f")


def _decimal(value: Optional[Decimal]) -> Optional[str]:
    return format(value, "f") if value is not None else None


def _date(value: Optional[date]) -> Optional[str]:
    return value.isoformat() if value is not None else None


def _enum(value: Any, allowed: Set[str], fallback: Optional[str]) -> Optional[str]:
    return value if value in allowed else fallback


def _earning_item(item: LineItem) -> Dict[str, Any]:
    return {
        "label": item.label.value,
        "type": _enum(
            item.item_type.value,
            {
                "regular",
                "overtime",
                "bonus",
                "commission",
                "tips",
                "shift_differential",
                "holiday",
                "vacation",
                "sick",
                "reimbursement",
                "other",
            },
            "other",
        ),
        "current_amount": _money(item.current_amount.value),
        "year_to_date_amount": _money(item.year_to_date_amount.value),
        "rate": _money(item.rate.value),
        "hours": _decimal(item.hours.value),
    }


def _deduction_item(item: LineItem) -> Dict[str, Any]:
    return {
        "label": item.label.value,
        "type": _enum(
            item.item_type.value,
            {
                "federal_tax",
                "state_tax",
                "local_tax",
                "social_security",
                "medicare",
                "health_insurance",
                "dental_insurance",
                "vision_insurance",
                "retirement",
                "garnishment",
                "union_dues",
                "other",
            },
            "other",
        ),
        "tax_treatment": _enum(
            item.tax_treatment.value,
            {"pre_tax", "post_tax", "unknown"},
            None,
        ),
        "current_amount": _money(item.current_amount.value),
        "year_to_date_amount": _money(item.year_to_date_amount.value),
    }


def build_business_data(candidate: PayStubCandidate) -> Dict[str, Any]:
    """Return normalized pay-stub facts shared by delivery and internal review."""

    return {
        "currency": candidate.currency.value,
        "employee": {
            "name": candidate.employee.name.value,
            "id": candidate.employee.employee_id.value,
        },
        "employer": {"name": candidate.employer.name.value},
        "pay_period": {
            "start": _date(candidate.pay_period.start.value),
            "end": _date(candidate.pay_period.end.value),
            "pay_date": _date(candidate.pay_period.pay_date.value),
            "frequency": _enum(
                candidate.pay_period.frequency.value,
                {"weekly", "bi_weekly", "semi_monthly", "monthly", "other"},
                None,
            ),
        },
        "compensation_rate": {
            "basis": _enum(
                candidate.compensation_rate.basis.value,
                {"salary", "hourly", "other"},
                None,
            ),
            "amount": _money(candidate.compensation_rate.amount.value),
            "unit": _enum(
                candidate.compensation_rate.unit.value,
                {"hour", "week", "month", "year", "pay_period", "other"},
                None,
            ),
        },
        "earnings": {
            "gross": {
                "current": _money(candidate.totals.gross_pay.value),
                "year_to_date": _money(candidate.totals.gross_pay_ytd.value),
            },
            "items": [_earning_item(item) for item in candidate.earnings],
        },
        "deductions": {
            "total": {
                "current": _money(candidate.totals.total_deductions.value),
                "year_to_date": _money(candidate.totals.total_deductions_ytd.value),
            },
            "items": [_deduction_item(item) for item in candidate.deductions],
        },
        "net_pay": {
            "current": _money(candidate.totals.net_pay.value),
            "year_to_date": _money(candidate.totals.net_pay_ytd.value),
        },
    }


def build_result(
    candidate: PayStubCandidate,
    decision: Optional[RoutingDecision] = None,
    result_revision: int = 1,
) -> Dict[str, Any]:
    """Return a public result without exposing data that still needs review."""

    decision = decision or route_candidate(candidate)
    if result_revision < 1:
        raise ValueError("result_revision must be at least 1")

    status = {
        RoutingAction.AUTO_ACCEPT: "COMPLETED_AUTO",
        RoutingAction.FIELD_REVIEW: "NEEDS_REVIEW",
        RoutingAction.FULL_REVIEW: "NEEDS_REVIEW",
        RoutingAction.REJECT: "NEEDS_REVIEW",
    }[decision.action]

    result = {
        "schema_version": SCHEMA_VERSION,
        "document_id": candidate.document_id,
        "result_revision": result_revision,
        "document_type": "pay_stub",
        "processing_status": status,
        "confidence_score": (
            round(decision.confidence.average_confidence, 6)
            if decision.action == RoutingAction.AUTO_ACCEPT
            and decision.confidence.average_confidence is not None
            else None
        ),
        "extraction_method": candidate.source,
        "flagged_for_review": decision.action != RoutingAction.AUTO_ACCEPT,
        "provenance": {
            "pipeline_version": PIPELINE_VERSION,
            "status_updated_at": None,
        },
    }

    # A status-only response is intentional: lender systems must not receive
    # candidate business values until all automatic or human gates have passed.
    if decision.action != RoutingAction.AUTO_ACCEPT:
        return result

    result.update(build_business_data(candidate))
    return result
