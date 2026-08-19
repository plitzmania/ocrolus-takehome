import pytest

from ocrolus_takehome.models import Evidence, PayStubCandidate


def test_evidence_rejects_out_of_range_bounding_box():
    with pytest.raises(ValueError, match="between 0 and 1"):
        Evidence.from_dict(
            {"page": 1, "text": "value", "bounding_box": [-0.1, 0.2, 0.3, 0.4]}
        )


def test_evidence_rejects_reversed_bounding_box():
    with pytest.raises(ValueError, match="out of order"):
        Evidence.from_dict(
            {"page": 1, "text": "value", "bounding_box": [0.5, 0.2, 0.3, 0.4]}
        )


def test_money_rejects_more_than_two_decimal_places(copy_clean_data):
    copy_clean_data["totals"]["net_pay"]["value"] = "2000.001"

    with pytest.raises(ValueError, match="at most two decimal places"):
        PayStubCandidate.from_dict(copy_clean_data)
