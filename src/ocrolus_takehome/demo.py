"""Command-line demo for routing a candidate JSON fixture."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Optional, Sequence

from .models import PayStubCandidate
from .result import build_result
from .routing import route_candidate


def main(argv: Optional[Sequence[str]] = None) -> None:
    parser = argparse.ArgumentParser(
        description="Validate and route simulated pay-stub extraction JSON."
    )
    parser.add_argument("fixture", type=Path, help="Path to a candidate JSON file")
    parser.add_argument(
        "--summary",
        action="store_true",
        help="Print only the routing decision instead of the complete result",
    )
    args = parser.parse_args(argv)

    candidate = PayStubCandidate.from_json_file(args.fixture)
    decision = route_candidate(candidate)
    result = build_result(candidate, decision)
    if args.summary:
        result = {
            "document_id": result["document_id"],
            "processing_status": result["processing_status"],
            "decision": decision.action.value,
            "reasons": list(
                dict.fromkeys(
                    list(decision.reasons)
                    + [issue.code for issue in decision.validation_issues]
                )
            ),
            "review_fields": list(decision.review_fields),
        }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
