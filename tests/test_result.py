import json
from copy import deepcopy
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, FormatChecker

from ocrolus_takehome.models import PayStubCandidate
from ocrolus_takehome.result import build_result
from ocrolus_takehome.routing import route_candidate

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def result_validator():
    with (ROOT / "schemas" / "pay_stub_result.schema.json").open(
        encoding="utf-8"
    ) as handle:
        schema = json.load(handle)
    return Draft202012Validator(schema, format_checker=FormatChecker())


@pytest.mark.parametrize(
    ("fixture", "expected_decision", "expected_status"),
    [
        ("fixtures/clean_candidate.json", "AUTO_ACCEPT", "COMPLETED_AUTO"),
        (
            "fixtures/edge_cases/suspicious_ytd_candidate.json",
            "FIELD_REVIEW",
            "NEEDS_REVIEW",
        ),
        (
            "fixtures/edge_cases/gross_net_mismatch_candidate.json",
            "FULL_REVIEW",
            "NEEDS_REVIEW",
        ),
        (
            "fixtures/edge_cases/unreadable_candidate.json",
            "REJECT",
            "NEEDS_REVIEW",
        ),
        (
            "fixtures/supplied_paystub_candidate.json",
            "FULL_REVIEW",
            "NEEDS_REVIEW",
        ),
    ],
)
def test_fixture_builds_schema_valid_result(
    result_validator, fixture, expected_decision, expected_status
):
    candidate = PayStubCandidate.from_json_file(ROOT / fixture)
    decision = route_candidate(candidate)

    result = build_result(candidate, decision)

    assert decision.action.value == expected_decision
    assert result["processing_status"] == expected_status
    assert list(result_validator.iter_errors(result)) == []


@pytest.mark.parametrize(
    "fixture",
    [
        "fixtures/edge_cases/suspicious_ytd_candidate.json",
        "fixtures/edge_cases/gross_net_mismatch_candidate.json",
        "fixtures/edge_cases/unreadable_candidate.json",
    ],
)
def test_noncompleted_response_withholds_business_data(result_validator, fixture):
    candidate = PayStubCandidate.from_json_file(ROOT / fixture)

    result = build_result(candidate)

    business_fields = {
        "currency",
        "employee",
        "employer",
        "pay_period",
        "compensation_rate",
        "earnings",
        "deductions",
        "net_pay",
    }
    assert business_fields.isdisjoint(result)
    assert result["confidence_score"] is None
    assert result["flagged_for_review"] is True
    result_validator.validate(result)


def test_schema_rejects_business_data_on_needs_review(result_validator):
    candidate = PayStubCandidate.from_json_file(
        ROOT / "fixtures" / "edge_cases" / "suspicious_ytd_candidate.json"
    )

    result = build_result(candidate)
    result["currency"] = "USD"

    assert list(result_validator.iter_errors(result))


def test_optional_values_remain_explicit_nulls(result_validator):
    candidate = PayStubCandidate.from_json_file(ROOT / "fixtures/clean_candidate.json")

    result = build_result(candidate)

    assert result["earnings"]["items"][1]["rate"] is None
    assert result["earnings"]["items"][1]["hours"] is None
    result_validator.validate(result)


def test_auto_completed_confidence_is_rounded(result_validator):
    candidate = PayStubCandidate.from_json_file(ROOT / "fixtures/clean_candidate.json")

    result = build_result(candidate)

    assert result["confidence_score"] == round(result["confidence_score"], 6)
    result_validator.validate(result)


def test_human_verified_result_uses_null_confidence(result_validator):
    candidate = PayStubCandidate.from_json_file(ROOT / "fixtures/clean_candidate.json")
    result = deepcopy(build_result(candidate))
    result["processing_status"] = "COMPLETED_HUMAN_VERIFIED"
    result["confidence_score"] = None
    result["result_revision"] = 2

    result_validator.validate(result)


def test_schema_rejects_model_confidence_on_human_verified_result(result_validator):
    candidate = PayStubCandidate.from_json_file(ROOT / "fixtures/clean_candidate.json")
    result = deepcopy(build_result(candidate))
    result["processing_status"] = "COMPLETED_HUMAN_VERIFIED"
    result["result_revision"] = 2

    assert list(result_validator.iter_errors(result))


def test_unprocessable_response_is_status_only(result_validator):
    candidate = PayStubCandidate.from_json_file(
        ROOT / "fixtures" / "edge_cases" / "unreadable_candidate.json"
    )
    result = build_result(candidate)
    result["processing_status"] = "UNPROCESSABLE"
    result["flagged_for_review"] = False

    result_validator.validate(result)


def test_schema_requires_business_data_for_completed_result(result_validator):
    candidate = PayStubCandidate.from_json_file(ROOT / "fixtures/clean_candidate.json")
    result = build_result(candidate)
    del result["net_pay"]

    assert list(result_validator.iter_errors(result))


def test_revision_must_be_positive():
    candidate = PayStubCandidate.from_json_file(ROOT / "fixtures/clean_candidate.json")

    with pytest.raises(ValueError, match="result_revision"):
        build_result(candidate, result_revision=0)
