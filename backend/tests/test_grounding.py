from app.validation.grounding import sanity_flags, ungrounded_numbers

COLS, ROWS = ["n"], [[3095]]


def test_exact_number_is_grounded():
    assert ungrounded_numbers("There are 3,095 sellers.", COLS, ROWS) == []


def test_invented_number_flagged():
    assert ungrounded_numbers("There are 4000 sellers.", COLS, ROWS) == [4000.0]


def test_rounded_millions_grounded():
    assert ungrounded_numbers("Revenue was 13.2 million.", ["r"], [[13221498.9]]) == []


def test_wrong_millions_flagged():
    assert ungrounded_numbers("Revenue was 15 million.", ["r"], [[13221498.9]]) != []


def test_number_from_question_is_allowed():
    assert ungrounded_numbers("Top 5 listed.", ["a"], [["x"]], question="show the top 5") == []


def test_row_count_is_allowed():
    assert ungrounded_numbers("2 rows came back.", ["a"], [["x"], ["y"]]) == []


def test_percent_form_grounded():
    assert ungrounded_numbers("About 12.3% of orders.", ["share"], [[0.123]]) == []


def test_sanity_empty_and_range():
    assert "empty result" in sanity_flags(["n"], [], False)
    assert any("outside" in f for f in sanity_flags(["avg_review_score"], [[7.2]], False))