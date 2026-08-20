import json
from pathlib import Path

import pytest

from ocrolus_takehome.models import PayStubCandidate
from ocrolus_takehome.review import build_review_task

ROOT = Path(__file__).resolve().parents[1]


def test_field_review_task_matches_the_ui_fixture():
    candidate = PayStubCandidate.from_json_file(
        ROOT / "fixtures" / "edge_cases" / "suspicious_ytd_candidate.json"
    )
    expected = json.loads(
        (ROOT / "review-desk-site" / "app" / "review-task.json").read_text(
            encoding="utf-8"
        )
    )

    task = build_review_task(
        candidate,
        state="CLAIMED",
        reviewer_id="demo-reviewer",
    )

    assert task == expected


def test_full_review_task_matches_the_ui_fixture():
    candidate = PayStubCandidate.from_json_file(
        ROOT / "fixtures" / "edge_cases" / "gross_net_mismatch_candidate.json"
    )
    expected = json.loads(
        (ROOT / "review-desk-site" / "app" / "full-review-task.json").read_text(
            encoding="utf-8"
        )
    )

    task = build_review_task(
        candidate,
        state="CLAIMED",
        reviewer_id="demo-reviewer",
    )

    assert task == expected


def test_review_task_uses_public_json_pointers():
    candidate = PayStubCandidate.from_json_file(
        ROOT / "fixtures" / "edge_cases" / "suspicious_ytd_candidate.json"
    )

    task = build_review_task(candidate)

    assert task["routing"]["fields"] == [
        "/deductions/items/0/current_amount",
        "/deductions/items/0/tax_treatment",
        "/deductions/items/0/year_to_date_amount",
    ]
    assert all(
        observation["path"].startswith("/")
        for observation in task["field_observations"]
    )


@pytest.mark.parametrize(
    "fixture",
    [
        "fixtures/clean_candidate.json",
        "fixtures/edge_cases/unreadable_candidate.json",
    ],
)
def test_review_task_is_not_created_for_nonreview_routes(fixture):
    candidate = PayStubCandidate.from_json_file(ROOT / fixture)

    with pytest.raises(ValueError, match="FIELD_REVIEW or FULL_REVIEW"):
        build_review_task(candidate)


def test_claimed_review_task_requires_a_reviewer():
    candidate = PayStubCandidate.from_json_file(
        ROOT / "fixtures" / "edge_cases" / "suspicious_ytd_candidate.json"
    )

    with pytest.raises(ValueError, match="require a reviewer"):
        build_review_task(candidate, state="CLAIMED")
