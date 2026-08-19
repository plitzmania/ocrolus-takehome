import copy
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def clean_data():
    with (ROOT / "fixtures" / "clean_candidate.json").open(encoding="utf-8") as handle:
        return json.load(handle)


@pytest.fixture
def copy_clean_data(clean_data):
    return copy.deepcopy(clean_data)
