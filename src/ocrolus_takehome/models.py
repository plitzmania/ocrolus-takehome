"""Typed input models for simulated upstream pay-stub extraction output."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any, Callable, Dict, Iterable, Mapping, Optional, Tuple

Parser = Callable[[Any], Any]


def _identity(value: Any) -> Any:
    return value


def _parse_string(value: Any) -> str:
    if not isinstance(value, str):
        raise ValueError("expected a string")
    return value.strip()


def _parse_decimal(value: Any) -> Decimal:
    if isinstance(value, bool):
        raise ValueError("expected a monetary value, not a boolean")
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError("expected a monetary value") from exc


def _parse_money(value: Any) -> Decimal:
    parsed = _parse_decimal(value)
    if parsed.as_tuple().exponent < -2:
        raise ValueError("monetary values may have at most two decimal places")
    return parsed


def _parse_date(value: Any) -> date:
    if isinstance(value, date):
        return value
    if not isinstance(value, str):
        raise ValueError("expected an ISO date string")
    try:
        return date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError("expected an ISO date in YYYY-MM-DD format") from exc


def _serialize_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, date):
        return value.isoformat()
    return value


@dataclass(frozen=True)
class Evidence:
    """Optional location and source text for a field observation."""

    page: Optional[int] = None
    text: Optional[str] = None
    bounding_box: Optional[Tuple[float, float, float, float]] = None

    @classmethod
    def from_dict(cls, data: Optional[Mapping[str, Any]]) -> Optional["Evidence"]:
        if data is None:
            return None
        box = data.get("bounding_box")
        parsed_box = None
        if box is not None:
            if not isinstance(box, list) or len(box) != 4:
                raise ValueError("bounding_box must contain four numbers")
            parsed_box = tuple(float(number) for number in box)
            if any(number < 0.0 or number > 1.0 for number in parsed_box):
                raise ValueError("bounding_box values must be between 0 and 1")
            left, top, right, bottom = parsed_box
            if left > right or top > bottom:
                raise ValueError("bounding_box coordinates are out of order")
        page = data.get("page")
        parsed_page = int(page) if page is not None else None
        if parsed_page is not None and parsed_page < 1:
            raise ValueError("evidence page must be at least 1")
        return cls(
            page=parsed_page,
            text=str(data["text"]) if data.get("text") is not None else None,
            bounding_box=parsed_box,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "page": self.page,
            "text": self.text,
            "bounding_box": list(self.bounding_box) if self.bounding_box else None,
        }


@dataclass(frozen=True)
class ObservedValue:
    """A parsed field together with the extractor's confidence and evidence."""

    value: Any
    confidence: float
    evidence: Optional[Evidence] = None

    @classmethod
    def from_dict(
        cls,
        data: Optional[Mapping[str, Any]],
        parser: Parser = _identity,
    ) -> "ObservedValue":
        if data is None:
            return cls(value=None, confidence=0.0, evidence=None)
        if not isinstance(data, Mapping):
            raise ValueError("observed fields must be JSON objects")

        confidence = float(data.get("confidence", 0.0))
        if not 0.0 <= confidence <= 1.0:
            raise ValueError("confidence must be between 0 and 1")

        raw_value = data.get("value")
        value = parser(raw_value) if raw_value is not None else None
        return cls(
            value=value,
            confidence=confidence,
            evidence=Evidence.from_dict(data.get("evidence")),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "value": _serialize_value(self.value),
            "confidence": self.confidence,
            "evidence": self.evidence.to_dict() if self.evidence else None,
        }


@dataclass(frozen=True)
class Employee:
    name: ObservedValue
    employee_id: ObservedValue

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "Employee":
        return cls(
            name=ObservedValue.from_dict(data.get("name"), _parse_string),
            employee_id=ObservedValue.from_dict(data.get("id"), _parse_string),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name.to_dict(),
            "id": self.employee_id.to_dict(),
        }


@dataclass(frozen=True)
class Employer:
    name: ObservedValue

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "Employer":
        return cls(name=ObservedValue.from_dict(data.get("name"), _parse_string))

    def to_dict(self) -> Dict[str, Any]:
        return {"name": self.name.to_dict()}


@dataclass(frozen=True)
class PayPeriod:
    start: ObservedValue
    end: ObservedValue
    pay_date: ObservedValue
    frequency: ObservedValue

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "PayPeriod":
        return cls(
            start=ObservedValue.from_dict(data.get("start"), _parse_date),
            end=ObservedValue.from_dict(data.get("end"), _parse_date),
            pay_date=ObservedValue.from_dict(data.get("pay_date"), _parse_date),
            frequency=ObservedValue.from_dict(data.get("frequency"), _parse_string),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "start": self.start.to_dict(),
            "end": self.end.to_dict(),
            "pay_date": self.pay_date.to_dict(),
            "frequency": self.frequency.to_dict(),
        }


@dataclass(frozen=True)
class CompensationRate:
    basis: ObservedValue
    amount: ObservedValue
    unit: ObservedValue

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "CompensationRate":
        return cls(
            basis=ObservedValue.from_dict(data.get("basis"), _parse_string),
            amount=ObservedValue.from_dict(data.get("amount"), _parse_money),
            unit=ObservedValue.from_dict(data.get("unit"), _parse_string),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "basis": self.basis.to_dict(),
            "amount": self.amount.to_dict(),
            "unit": self.unit.to_dict(),
        }


@dataclass(frozen=True)
class LineItem:
    label: ObservedValue
    item_type: ObservedValue
    current_amount: ObservedValue
    year_to_date_amount: ObservedValue
    rate: ObservedValue
    hours: ObservedValue
    tax_treatment: ObservedValue

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "LineItem":
        return cls(
            label=ObservedValue.from_dict(data.get("label"), _parse_string),
            item_type=ObservedValue.from_dict(data.get("type"), _parse_string),
            current_amount=ObservedValue.from_dict(
                data.get("current_amount"), _parse_money
            ),
            year_to_date_amount=ObservedValue.from_dict(
                data.get("year_to_date_amount"), _parse_money
            ),
            rate=ObservedValue.from_dict(data.get("rate"), _parse_money),
            hours=ObservedValue.from_dict(data.get("hours"), _parse_decimal),
            tax_treatment=ObservedValue.from_dict(
                data.get("tax_treatment"), _parse_string
            ),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "label": self.label.to_dict(),
            "type": self.item_type.to_dict(),
            "current_amount": self.current_amount.to_dict(),
            "year_to_date_amount": self.year_to_date_amount.to_dict(),
            "rate": self.rate.to_dict(),
            "hours": self.hours.to_dict(),
            "tax_treatment": self.tax_treatment.to_dict(),
        }


@dataclass(frozen=True)
class Totals:
    gross_pay: ObservedValue
    gross_pay_ytd: ObservedValue
    total_deductions: ObservedValue
    total_deductions_ytd: ObservedValue
    net_pay: ObservedValue
    net_pay_ytd: ObservedValue

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "Totals":
        return cls(
            gross_pay=ObservedValue.from_dict(data.get("gross_pay"), _parse_money),
            gross_pay_ytd=ObservedValue.from_dict(
                data.get("gross_pay_ytd"), _parse_money
            ),
            total_deductions=ObservedValue.from_dict(
                data.get("total_deductions"), _parse_money
            ),
            total_deductions_ytd=ObservedValue.from_dict(
                data.get("total_deductions_ytd"), _parse_money
            ),
            net_pay=ObservedValue.from_dict(data.get("net_pay"), _parse_money),
            net_pay_ytd=ObservedValue.from_dict(data.get("net_pay_ytd"), _parse_money),
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "gross_pay": self.gross_pay.to_dict(),
            "gross_pay_ytd": self.gross_pay_ytd.to_dict(),
            "total_deductions": self.total_deductions.to_dict(),
            "total_deductions_ytd": self.total_deductions_ytd.to_dict(),
            "net_pay": self.net_pay.to_dict(),
            "net_pay_ytd": self.net_pay_ytd.to_dict(),
        }


@dataclass(frozen=True)
class PayStubCandidate:
    document_id: str
    source: str
    document_readability: float
    currency: ObservedValue
    employee: Employee
    employer: Employer
    pay_period: PayPeriod
    compensation_rate: CompensationRate
    earnings: Tuple[LineItem, ...]
    deductions: Tuple[LineItem, ...]
    totals: Totals

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "PayStubCandidate":
        readability = float(data.get("document_readability", 0.0))
        if not 0.0 <= readability <= 1.0:
            raise ValueError("document_readability must be between 0 and 1")

        return cls(
            document_id=_parse_string(data.get("document_id", "")),
            source=_parse_string(data.get("source", "simulated_upstream_output")),
            document_readability=readability,
            currency=ObservedValue.from_dict(data.get("currency"), _parse_string),
            employee=Employee.from_dict(data.get("employee", {})),
            employer=Employer.from_dict(data.get("employer", {})),
            pay_period=PayPeriod.from_dict(data.get("pay_period", {})),
            compensation_rate=CompensationRate.from_dict(
                data.get("compensation_rate", {})
            ),
            earnings=tuple(
                LineItem.from_dict(item) for item in data.get("earnings", [])
            ),
            deductions=tuple(
                LineItem.from_dict(item) for item in data.get("deductions", [])
            ),
            totals=Totals.from_dict(data.get("totals", {})),
        )

    @classmethod
    def from_json_file(cls, path: Path) -> "PayStubCandidate":
        with path.open(encoding="utf-8") as handle:
            return cls.from_dict(json.load(handle))

    def iter_fields(self) -> Iterable[Tuple[str, ObservedValue]]:
        yield "currency", self.currency
        yield "employee.name", self.employee.name
        yield "employee.id", self.employee.employee_id
        yield "employer.name", self.employer.name
        yield "pay_period.start", self.pay_period.start
        yield "pay_period.end", self.pay_period.end
        yield "pay_period.pay_date", self.pay_period.pay_date
        yield "pay_period.frequency", self.pay_period.frequency
        yield "compensation_rate.basis", self.compensation_rate.basis
        yield "compensation_rate.amount", self.compensation_rate.amount
        yield "compensation_rate.unit", self.compensation_rate.unit
        for index, item in enumerate(self.earnings):
            prefix = "earnings[{}]".format(index)
            yield prefix + ".label", item.label
            yield prefix + ".type", item.item_type
            yield prefix + ".current_amount", item.current_amount
            yield prefix + ".year_to_date_amount", item.year_to_date_amount
            yield prefix + ".rate", item.rate
            yield prefix + ".hours", item.hours
        for index, item in enumerate(self.deductions):
            prefix = "deductions[{}]".format(index)
            yield prefix + ".label", item.label
            yield prefix + ".type", item.item_type
            yield prefix + ".tax_treatment", item.tax_treatment
            yield prefix + ".current_amount", item.current_amount
            yield prefix + ".year_to_date_amount", item.year_to_date_amount
        yield "totals.gross_pay", self.totals.gross_pay
        yield "totals.gross_pay_ytd", self.totals.gross_pay_ytd
        yield "totals.total_deductions", self.totals.total_deductions
        yield "totals.total_deductions_ytd", self.totals.total_deductions_ytd
        yield "totals.net_pay", self.totals.net_pay
        yield "totals.net_pay_ytd", self.totals.net_pay_ytd

    def field_map(self) -> Dict[str, ObservedValue]:
        return dict(self.iter_fields())

    def to_dict(self) -> Dict[str, Any]:
        return {
            "document_id": self.document_id,
            "source": self.source,
            "document_readability": self.document_readability,
            "currency": self.currency.to_dict(),
            "employee": self.employee.to_dict(),
            "employer": self.employer.to_dict(),
            "pay_period": self.pay_period.to_dict(),
            "compensation_rate": self.compensation_rate.to_dict(),
            "earnings": [item.to_dict() for item in self.earnings],
            "deductions": [item.to_dict() for item in self.deductions],
            "totals": self.totals.to_dict(),
        }
