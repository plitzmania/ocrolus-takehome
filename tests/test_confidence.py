from ocrolus_takehome.confidence import assess_confidence
from ocrolus_takehome.models import PayStubCandidate


def test_weak_critical_field_cannot_hide_in_high_average(copy_clean_data):
    copy_clean_data["totals"]["net_pay"]["confidence"] = 0.40
    candidate = PayStubCandidate.from_dict(copy_clean_data)

    assessment = assess_confidence(candidate)

    assert assessment.average_confidence > 0.90
    assert assessment.weak_critical_fields == ("totals.net_pay",)


def test_isolated_uncertain_noncritical_field_is_targeted(copy_clean_data):
    copy_clean_data["deductions"][0]["label"]["confidence"] = 0.82
    candidate = PayStubCandidate.from_dict(copy_clean_data)

    assessment = assess_confidence(candidate)

    assert assessment.review_fields == ("deductions[0].label",)
    assert assessment.weak_critical_fields == ()
