import json
from pathlib import Path

from ocrolus_takehome.showcase import build_showcase, build_showcase_payload

ROOT = Path(__file__).resolve().parents[1]


def test_showcase_summarizes_routes_safety_and_ui_handoff():
    output = build_showcase(ROOT)

    assert "Clean extraction      → AUTO_ACCEPT" in output
    assert "Suspicious YTD        → FIELD_REVIEW" in output
    assert "Accounting mismatch   → FULL_REVIEW" in output
    assert "Unreadable document   → REJECT" in output
    assert "Suspicious values in lender response: NO — correctly withheld" in output
    assert "Flagged fields: 3" in output
    assert "Contract: Python task exactly matches" in output
    assert "ocrolus-review-desk.benteplitzky15.chatgpt.site" in output


def test_showcase_payload_matches_the_frontend_fixture():
    expected = json.loads(
        (ROOT / "review-desk-site" / "app" / "backend-showcase.json").read_text(
            encoding="utf-8"
        )
    )

    assert build_showcase_payload(ROOT) == expected
