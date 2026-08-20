from pathlib import Path

from ocrolus_takehome.models import PayStubCandidate
from ocrolus_takehome.routing import RoutingAction, route_candidate

ROOT = Path(__file__).resolve().parents[1]


def test_clean_extraction_auto_accepts(clean_data):
    decision = route_candidate(PayStubCandidate.from_dict(clean_data))

    assert decision.action == RoutingAction.AUTO_ACCEPT


def test_suspicious_ytd_value_triggers_field_review():
    candidate = PayStubCandidate.from_json_file(
        ROOT / "fixtures" / "edge_cases" / "suspicious_ytd_candidate.json"
    )

    decision = route_candidate(candidate)

    assert decision.action == RoutingAction.FIELD_REVIEW
    assert "deductions[0].year_to_date_amount" in decision.review_fields


def test_supplied_paystub_routes_to_full_review_for_four_suspicious_fields():
    candidate = PayStubCandidate.from_json_file(
        ROOT / "fixtures" / "supplied_paystub_candidate.json"
    )

    decision = route_candidate(candidate)

    assert decision.action == RoutingAction.FULL_REVIEW
    assert "TOO_MANY_FIELDS_REQUIRE_REVIEW" in decision.reasons
    assert "deductions[1].year_to_date_amount" in decision.review_fields
    assert "deductions[6].year_to_date_amount" in decision.review_fields


def test_gross_net_mismatch_triggers_full_review():
    candidate = PayStubCandidate.from_json_file(
        ROOT / "fixtures" / "edge_cases" / "gross_net_mismatch_candidate.json"
    )

    assert route_candidate(candidate).action == RoutingAction.FULL_REVIEW


def test_missing_critical_field_triggers_full_review(copy_clean_data):
    copy_clean_data["totals"]["net_pay"]["value"] = None

    decision = route_candidate(PayStubCandidate.from_dict(copy_clean_data))

    assert decision.action == RoutingAction.FULL_REVIEW
    assert "totals.net_pay" in decision.review_fields


def test_isolated_uncertain_noncritical_field_triggers_field_review(copy_clean_data):
    copy_clean_data["deductions"][0]["label"]["confidence"] = 0.82

    decision = route_candidate(PayStubCandidate.from_dict(copy_clean_data))

    assert decision.action == RoutingAction.FIELD_REVIEW
    assert decision.review_fields == ("deductions[0].label",)


def test_unreadable_input_is_rejected(copy_clean_data):
    copy_clean_data["document_readability"] = 0.20

    decision = route_candidate(PayStubCandidate.from_dict(copy_clean_data))

    assert decision.action == RoutingAction.REJECT
    assert decision.reasons == ("DOCUMENT_UNREADABLE",)


def test_weak_critical_confidence_triggers_full_review(copy_clean_data):
    copy_clean_data["totals"]["net_pay"]["confidence"] = 0.40

    decision = route_candidate(PayStubCandidate.from_dict(copy_clean_data))

    assert decision.action == RoutingAction.FULL_REVIEW
    assert "CRITICAL_FIELD_CONFIDENCE_TOO_LOW" in decision.reasons


def test_unknown_deduction_label_is_preserved(copy_clean_data):
    copy_clean_data["deductions"][0]["label"]["value"] = "Union Local 17"
    candidate = PayStubCandidate.from_dict(copy_clean_data)

    assert candidate.deductions[0].label.value == "Union Local 17"


def test_nonzero_totals_with_no_line_items_trigger_full_review(copy_clean_data):
    copy_clean_data["earnings"] = []
    copy_clean_data["deductions"] = []

    decision = route_candidate(PayStubCandidate.from_dict(copy_clean_data))

    assert decision.action == RoutingAction.FULL_REVIEW
    assert "DETERMINISTIC_VALIDATION_FAILED" in decision.reasons


def test_employee_id_is_preserved(copy_clean_data):
    candidate = PayStubCandidate.from_dict(copy_clean_data)

    assert candidate.employee.employee_id.value == "EMP-4821"


def test_optional_null_fields_are_not_guessed(copy_clean_data):
    copy_clean_data["earnings"][0]["year_to_date_amount"] = {
        "value": None,
        "confidence": 0.0,
    }

    candidate = PayStubCandidate.from_dict(copy_clean_data)

    assert candidate.earnings[0].year_to_date_amount.value is None
    assert candidate.to_dict()["earnings"][0]["year_to_date_amount"]["value"] is None
