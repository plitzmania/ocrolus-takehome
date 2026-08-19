import json

from ocrolus_takehome.demo import main


def test_summary_mode_reports_the_decision(capsys):
    main(["fixtures/clean_candidate.json", "--summary"])

    output = json.loads(capsys.readouterr().out)
    assert output == {
        "document_id": "synthetic-clean-001",
        "processing_status": "COMPLETED_AUTO",
        "decision": "AUTO_ACCEPT",
        "reasons": ["ALL_CHECKS_PASSED"],
        "review_fields": [],
    }
