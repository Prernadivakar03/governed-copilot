# Failure analysis

Examples below are from `eval/results/run_full_20261025_171332.json`; questions are joined by ID from `eval/gold.jsonl`. “Failed” means the harness did not match the reference result or the model asked for clarification on an answerable item. No generated SQL is shown when the result file records `sql: null`.

## Incorrect SQL or result semantics

1. **q04 — “Which 5 states have the most customer records?”** SQL: `SELECT c.customer_state, COUNT(DISTINCT c.customer_unique_id) AS customer_count FROM customers AS c GROUP BY c.customer_state ORDER BY customer_count DESC LIMIT 5`. It counts unique customers, while the gold reference counts customer records; duplicate records make those measures differ.
2. **q25 — “What is the average order value?”** SQL: `SELECT avg_order_value FROM (SELECT SUM(order_items.price) AS avg_order_value FROM order_items GROUP BY order_items.order_id) AS avg_order_value_subquery LIMIT 1000`. It returns one sum per order instead of the average across orders, so result shape and values differ from the scalar reference.
3. **q37 — “What is the average delivery time in days for delivered orders?”** SQL: `SELECT AVG(CAST(EXTRACT(epoch FROM CAST(orders.order_delivered_customer_date AS TIMESTAMP) - CAST(orders.order_purchase_timestamp AS TIMESTAMP)) / 86400 AS BIGINT)) AS avg_delivery_time FROM orders WHERE orders.order_status = 'delivered' LIMIT 1000`. Casting each duration to `BIGINT` before averaging discards fractional days and changes the aggregate.

## Clarification on answerable questions

1. **q02 — “How many delivered orders are there?”** Generated SQL: none (`sql: null`). The model returned `CLARIFY` because it believed a column name might be wrong, although the gold SQL is a straightforward count filtered by `order_status`.
2. **q03 — “What is the total revenue?”** Generated SQL: none (`sql: null`). The model returned `CLARIFY`, claiming the query lacked an `orders` FROM entry; the gold reference is the revenue metric over order items.
3. **q28 — “How many orders have more than one payment?”** Generated SQL: none (`sql: null`). The model returned `CLARIFY` after claiming a payment column reference was invalid; the gold reference groups payment rows by order and counts orders with multiple payments.

## Limitations

The gold set has 56 items, and pilots sample 19. Pilot comparisons have wide uncertainty and cannot establish stable ablation effects. Full local-model latency was high (full system p50 17.8s, p95 51.6s; b0 elapsed 13m25.7s and b1 elapsed 15m06.4s). Cache was enabled, making the report's p95 acceptance gate invalid. Four ablations are pilot-only due to measured runtime and the submission deadline; these results should be rerun on the full set before drawing conclusions.
