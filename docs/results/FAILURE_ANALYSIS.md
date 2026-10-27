# Failure Analysis & Regression Findings

This document records failure analysis and observed regressions from the frozen protocol comparison between `b0` (`eval/results/run_b0_20261027_205147.json`) and `full` (`eval/results/run_full_20261027_132025.json`) on the 40-question paired subset (`q01`–`q40`).

Per the non-negotiable evaluation ground rules, these regressions are reported as findings and have **not** been retroactively tuned in pipeline prompts or code.

---

## 1. Observed Regressions (Broken by `full` where `b0` Passed)

Across the paired 40-question subset, `b0` answered 26 correctly and `full` answered 28 correctly. While `full` fixed 6 questions that `b0` failed, `full` broke 4 questions that `b0` answered correctly:

### Finding 1: Metric Template Over-Firing (`q17`)
- **Question**: *"What is the average freight value per order item?"*
- **b0 Outcome**: `PASS` (Status: `COMPLETED`)
  - Generated SQL: `SELECT AVG(freight_value) FROM order_items LIMIT 1000`
- **full Outcome**: `FAIL` (Status: `COMPLETED`)
  - Generated SQL: `SELECT SUM(order_items.price) FROM order_items JOIN orders ON orders.order_id = order_items.order_id WHERE orders.order_status = 'delivered' LIMIT 1000`
- **Root Cause Analysis**: The semantic layer retrieval retrieved the metric `revenue` or order item templates. The prompt / semantic guidance over-prioritized the standard revenue metric and replaced the user's explicit request for `AVG(freight_value)` with the delivered revenue expression.

### Finding 2: Aggregation / Measure Confusion (`q18`)
- **Question**: *"How many reviews have a score of 5?"*
- **b0 Outcome**: `PASS` (Status: `COMPLETED`)
  - Generated SQL: `SELECT COUNT(*) FROM order_reviews WHERE review_score = 5 LIMIT 1000`
- **full Outcome**: `FAIL` (Status: `COMPLETED`)
  - Generated SQL: `SELECT AVG(review_score) FROM order_reviews WHERE review_score = 5 LIMIT 1000`
- **Root Cause Analysis**: The model substituted `AVG(review_score)` for the counting aggregation when evaluating a specific review score condition. The baseline schema prompt preserved the direct mapping between "How many reviews" and `COUNT(*)`, whereas the retrieved metric definitions introduced an attractor towards `AVG(review_score)`.

### Finding 3: Over-Clarification on Language Specification (`q36`)
- **Question**: *"Which product category has the most products? Use the Portuguese category name."*
- **b0 Outcome**: `PASS` (Status: `COMPLETED`)
  - Generated SQL: `SELECT product_category_name FROM products GROUP BY product_category_name ORDER BY COUNT(*) DESC LIMIT 1`
- **full Outcome**: `FAIL` (Status: `CLARIFY`)
  - System Message: *"The question asks for the most used product category in English, but the CONTEXT only provides the Portuguese category names. To answer this question, we need to join the products table with the category_translation table to get the English category names."*
- **Root Cause Analysis**: The ambiguity detection instructions in `prompt.py` prompted the LLM to seek clarification when translation mappings might be needed. The LLM inverted the instruction ("Use the Portuguese category name") and falsely claimed it needed English translations.

### Finding 4: Over-Clarification on Aggregate Grouping (`q40`)
- **Question**: *"Which review score is the most common?"*
- **b0 Outcome**: `PASS` (Status: `COMPLETED`)
  - Generated SQL: `SELECT review_score FROM order_reviews GROUP BY review_score ORDER BY COUNT(*) DESC LIMIT 1`
- **full Outcome**: `FAIL` (Status: `CLARIFY`)
  - System Message: *"The question asks for the most common review score, but the provided context does not define a metric for this. The context only provides metrics for average review score, most used payment type, and average order value."*
- **Root Cause Analysis**: When semantic metrics are presented in context, the LLM develops an over-reliance on pre-defined metrics. In `full`, it concluded that because "most common review score" was not an explicit named metric in the semantic layer, it could not answer the question, whereas `b0` simply wrote standard SQL `GROUP BY review_score ORDER BY COUNT(*) DESC LIMIT 1`.

---

## 2. Improvements (Fixed by `full` where `b0` Failed)

`full` succeeded on 6 questions that `b0` failed, demonstrating the value of governance and semantic layer grounding:
- **`q05` (Average review score)**: `b0` failed due to syntax/column issues; `full` correctly retrieved and compiled the `average_review_score` metric.
- **`q10` (Unique customer count)**: `b0` counted customer records (`COUNT(*)`); `full` correctly applied `COUNT(DISTINCT customer_unique_id)`.
- **`q20` (Average payment installments)**: `full` applied proper join semantics between orders and order payments.
- **`q27` (Total amount paid by credit card)**: `full` filtered by payment type correctly with proper payment aggregation.
- **`q28` (Orders with more than one payment)**: `full` constructed the proper `HAVING COUNT(*) > 1` subquery.
- **`q39` (Total revenue from sellers in state SP)**: `b0` failed with DB error on joins; `full` used correct multi-hop join paths between orders, order items, and sellers.

---

## 3. Summary of Failure Findings

1. **Semantic Metric Attractors**: Pre-defined metrics in the prompt can inadvertently attract the model away from straightforward queries (e.g., freight value replaced by order revenue).
2. **Clarification Sensitivity**: Ambiguity prompts without strict thresholds increase false-positive `CLARIFY` responses on answerable questions (over-clarification increased from 3 in `b0` to 5 in `full`).
3. **Hallucination Rate Tradeoff**: Because `full` subjects SQL to schema validation and rejection, invalid column attempts in intermediate retries trigger hallucination flags, resulting in a higher measured hallucination rate (14.3%) compared to `b0` (5.0%).
