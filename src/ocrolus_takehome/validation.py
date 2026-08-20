"""Deterministic consistency checks for a typed pay-stub candidate."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from enum import Enum
from typing import List, Sequence, Tuple

from .models import LineItem, PayStubCandidate

MONEY_TOLERANCE = Decimal("0.01")

REQUIRED_FIELDS = frozenset(
    {
        "employee.name",
        "employer.name",
        "pay_period.start",
        "pay_period.end",
        "pay_period.pay_date",
        "totals.gross_pay",
        "totals.total_deductions",
        "totals.net_pay",
    }
)


class Severity(str, Enum):
    WARNING = "WARNING"
    ERROR = "ERROR"


@dataclass(frozen=True)
class ValidationIssue:
    code: str
    severity: Severity
    message: str
    fields: Tuple[str, ...]

    def to_dict(self):
        return {
            "code": self.code,
            "severity": self.severity.value,
            "message": self.message,
            "fields": list(self.fields),
        }


def _missing(value) -> bool:
    return value is None or (isinstance(value, str) and not value.strip())


def _sum_current(items: Sequence[LineItem]):
    amounts = [item.current_amount.value for item in items]
    if not items or any(amount is None for amount in amounts):
        return None
    return sum(amounts, Decimal("0"))


def _sum_year_to_date(items: Sequence[LineItem]):
    amounts = [item.year_to_date_amount.value for item in items]
    if not items or any(amount is None for amount in amounts):
        return None
    return sum(amounts, Decimal("0"))


def _line_item_issues(
    items: Sequence[LineItem], collection_name: str
) -> List[ValidationIssue]:
    issues: List[ValidationIssue] = []
    for index, item in enumerate(items):
        prefix = "{}[{}]".format(collection_name, index)
        if _missing(item.label.value):
            issues.append(
                ValidationIssue(
                    code="MISSING_LINE_ITEM_LABEL",
                    severity=Severity.WARNING,
                    message="A {} line item has no label.".format(collection_name),
                    fields=(prefix + ".label",),
                )
            )
        if item.current_amount.value is None:
            issues.append(
                ValidationIssue(
                    code="MISSING_LINE_ITEM_AMOUNT",
                    severity=Severity.WARNING,
                    message="A {} line item has no current amount.".format(
                        collection_name
                    ),
                    fields=(prefix + ".current_amount",),
                )
            )
        current = item.current_amount.value
        year_to_date = item.year_to_date_amount.value
        if (
            current is not None
            and year_to_date is not None
            and current >= 0
            and year_to_date >= 0
            and year_to_date + MONEY_TOLERANCE < current
        ):
            issues.append(
                ValidationIssue(
                    code="YTD_LESS_THAN_CURRENT",
                    severity=Severity.WARNING,
                    message=(
                        "The year-to-date amount is smaller than the current-period "
                        "amount."
                    ),
                    fields=(
                        prefix + ".current_amount",
                        prefix + ".year_to_date_amount",
                    ),
                )
            )
    return issues


def validate_candidate(candidate: PayStubCandidate) -> List[ValidationIssue]:
    """Return every deterministic issue found; never silently repair values."""

    issues: List[ValidationIssue] = []
    fields = candidate.field_map()

    for path in sorted(REQUIRED_FIELDS):
        if _missing(fields[path].value):
            issues.append(
                ValidationIssue(
                    code="MISSING_REQUIRED_FIELD",
                    severity=Severity.ERROR,
                    message="A required pay-stub field is missing.",
                    fields=(path,),
                )
            )

    start = candidate.pay_period.start.value
    end = candidate.pay_period.end.value
    pay_date = candidate.pay_period.pay_date.value
    if start is not None and end is not None and start > end:
        issues.append(
            ValidationIssue(
                code="INVALID_PAY_PERIOD",
                severity=Severity.ERROR,
                message="The pay-period start date is after the end date.",
                fields=("pay_period.start", "pay_period.end"),
            )
        )
    if start is not None and pay_date is not None and pay_date < start:
        issues.append(
            ValidationIssue(
                code="PAY_DATE_BEFORE_PERIOD",
                severity=Severity.ERROR,
                message="The pay date is before the pay period starts.",
                fields=("pay_period.start", "pay_period.pay_date"),
            )
        )

    issues.extend(_line_item_issues(candidate.earnings, "earnings"))
    issues.extend(_line_item_issues(candidate.deductions, "deductions"))

    gross = candidate.totals.gross_pay.value
    if not candidate.earnings and gross is not None and gross != 0:
        issues.append(
            ValidationIssue(
                code="MISSING_EARNINGS_LINE_ITEMS",
                severity=Severity.ERROR,
                message=(
                    "Gross pay is nonzero but no earnings line items were extracted."
                ),
                fields=("earnings", "totals.gross_pay"),
            )
        )

    total_deductions = candidate.totals.total_deductions.value
    if (
        not candidate.deductions
        and total_deductions is not None
        and total_deductions != 0
    ):
        issues.append(
            ValidationIssue(
                code="MISSING_DEDUCTION_LINE_ITEMS",
                severity=Severity.ERROR,
                message=(
                    "Total deductions are nonzero but no deduction line items "
                    "were extracted."
                ),
                fields=("deductions", "totals.total_deductions"),
            )
        )

    earnings_sum = _sum_current(candidate.earnings)
    if (
        earnings_sum is not None
        and gross is not None
        and abs(earnings_sum - gross) > MONEY_TOLERANCE
    ):
        issues.append(
            ValidationIssue(
                code="EARNINGS_TOTAL_MISMATCH",
                severity=Severity.ERROR,
                message="Earnings line items do not add up to gross pay.",
                fields=("earnings", "totals.gross_pay"),
            )
        )

    earnings_ytd_sum = _sum_year_to_date(candidate.earnings)
    gross_ytd = candidate.totals.gross_pay_ytd.value
    if (
        earnings_ytd_sum is not None
        and gross_ytd is not None
        and abs(earnings_ytd_sum - gross_ytd) > MONEY_TOLERANCE
    ):
        issues.append(
            ValidationIssue(
                code="EARNINGS_YTD_TOTAL_MISMATCH",
                severity=Severity.ERROR,
                message="Earnings line items do not add up to YTD gross pay.",
                fields=("earnings", "totals.gross_pay_ytd"),
            )
        )

    deductions_sum = _sum_current(candidate.deductions)
    if (
        deductions_sum is not None
        and total_deductions is not None
        and abs(deductions_sum - total_deductions) > MONEY_TOLERANCE
    ):
        issues.append(
            ValidationIssue(
                code="DEDUCTIONS_TOTAL_MISMATCH",
                severity=Severity.ERROR,
                message="Deduction line items do not add up to total deductions.",
                fields=("deductions", "totals.total_deductions"),
            )
        )

    deductions_ytd_sum = _sum_year_to_date(candidate.deductions)
    total_deductions_ytd = candidate.totals.total_deductions_ytd.value
    if (
        deductions_ytd_sum is not None
        and total_deductions_ytd is not None
        and abs(deductions_ytd_sum - total_deductions_ytd) > MONEY_TOLERANCE
    ):
        issues.append(
            ValidationIssue(
                code="DEDUCTIONS_YTD_TOTAL_MISMATCH",
                severity=Severity.ERROR,
                message=("Deduction line items do not add up to total YTD deductions."),
                fields=("deductions", "totals.total_deductions_ytd"),
            )
        )

    net = candidate.totals.net_pay.value
    if (
        gross is not None
        and total_deductions is not None
        and net is not None
        and abs((gross - total_deductions) - net) > MONEY_TOLERANCE
    ):
        issues.append(
            ValidationIssue(
                code="GROSS_NET_MISMATCH",
                severity=Severity.ERROR,
                message="Gross pay minus total deductions does not equal net pay.",
                fields=(
                    "totals.gross_pay",
                    "totals.total_deductions",
                    "totals.net_pay",
                ),
            )
        )

    net_ytd = candidate.totals.net_pay_ytd.value
    if (
        gross_ytd is not None
        and total_deductions_ytd is not None
        and net_ytd is not None
        and abs((gross_ytd - total_deductions_ytd) - net_ytd) > MONEY_TOLERANCE
    ):
        issues.append(
            ValidationIssue(
                code="GROSS_NET_YTD_MISMATCH",
                severity=Severity.ERROR,
                message=(
                    "YTD gross pay minus YTD deductions does not equal YTD net pay."
                ),
                fields=(
                    "totals.gross_pay_ytd",
                    "totals.total_deductions_ytd",
                    "totals.net_pay_ytd",
                ),
            )
        )

    return issues
