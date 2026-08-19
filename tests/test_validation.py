from pathlib import Path

from ocrolus_takehome.models import PayStubCandidate
from ocrolus_takehome.validation import Severity, validate_candidate

ROOT = Path(__file__).resolve().parents[1]


def test_clean_candidate_has_no_validation_issues(clean_data):
    assert validate_candidate(PayStubCandidate.from_dict(clean_data)) == []


def test_suspicious_ytd_value_is_targeted_for_review():
    candidate = PayStubCandidate.from_json_file(
        ROOT / "fixtures" / "edge_cases" / "suspicious_ytd_candidate.json"
    )

    issues = validate_candidate(candidate)

    assert [issue.code for issue in issues] == ["YTD_LESS_THAN_CURRENT"]
    assert issues[0].severity == Severity.WARNING
    assert "deductions[0].year_to_date_amount" in issues[0].fields


def test_gross_net_mismatch_is_an_error():
    candidate = PayStubCandidate.from_json_file(
        ROOT / "fixtures" / "edge_cases" / "gross_net_mismatch_candidate.json"
    )

    issues = validate_candidate(candidate)

    assert "GROSS_NET_MISMATCH" in {issue.code for issue in issues}
    assert all(
        issue.severity == Severity.ERROR
        for issue in issues
        if issue.code == "GROSS_NET_MISMATCH"
    )


def test_missing_critical_field_is_an_error(copy_clean_data):
    copy_clean_data["totals"]["net_pay"]["value"] = None
    candidate = PayStubCandidate.from_dict(copy_clean_data)

    issues = validate_candidate(candidate)

    missing = [issue for issue in issues if issue.code == "MISSING_REQUIRED_FIELD"]
    assert any(issue.fields == ("totals.net_pay",) for issue in missing)


def test_invalid_date_order_is_an_error(copy_clean_data):
    copy_clean_data["pay_period"]["start"]["value"] = "2026-07-20"
    candidate = PayStubCandidate.from_dict(copy_clean_data)

    codes = {issue.code for issue in validate_candidate(candidate)}

    assert "INVALID_PAY_PERIOD" in codes


def test_ytd_line_items_must_match_ytd_totals(copy_clean_data):
    copy_clean_data["totals"]["gross_pay_ytd"]["value"] = "99999.00"
    candidate = PayStubCandidate.from_dict(copy_clean_data)

    codes = {issue.code for issue in validate_candidate(candidate)}

    assert "EARNINGS_YTD_TOTAL_MISMATCH" in codes
    assert "GROSS_NET_YTD_MISMATCH" in codes
