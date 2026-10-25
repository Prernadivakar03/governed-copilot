# Failure analysis

The failure categories and IDs below come from `eval/results/run_full_20261025_194306.json`. Its `results` entries do not include natural-language question text, so the exact question wording is matched by ID from the existing gold-question definitions. Generated SQL and messages are transcribed from the specified run JSON. The JSON records **6 over-clarification failures**: q02, q03, q21, q28, q29, q34; and **8 wrong-SQL failures**: q04, q24, q25, q26, q33, q37, q38, q41.

## Over-clarification (6 failures)

### Examples

- **q02 — “How many delivered orders are there?”** Generated SQL: `null` (the run records no SQL). Cause: after two attempts, the model asked for column-name clarification despite a straightforward count/filter question.
- **q21 — “How many products have no category name?”** Generated SQL: `null`. Cause: the model treated a direct null-category count as ambiguous between Portuguese and English category names.
- **q28 — “How many orders have more than one payment?”** Generated SQL: `null`. Cause: the model claimed a column reference was invalid and stopped before producing executable SQL.

The other failures in this category are q03, q29, and q34. Their run records also have `sql: null`; the model returned clarification/timeout-style messages rather than an executable query.

## Wrong SQL (8 failures)

### Examples

- **q25 — “What is the average order value?”** Generated SQL: `SELECT AVG(order_items.price) / COUNT(DISTINCT order_items.order_id) AS avg_order_value FROM order_items JOIN orders ON order_items.order_id = orders.order_id WHERE orders.order_status = 'delivered' LIMIT 1000`. Cause: it divides an average item price by the distinct order count instead of summing item prices and dividing by distinct orders.
- **q37 — “What is the average delivery time in days for delivered orders, from purchase to delivery at the customer?”** Generated SQL: `SELECT AVG(CAST(EXTRACT(epoch FROM CAST(order_delivered_customer_date AS TIMESTAMP) - CAST(order_purchase_timestamp AS TIMESTAMP)) / 86400 AS BIGINT)) AS avg_delivery_time FROM orders WHERE order_status = 'delivered' LIMIT 1000`. Cause: casting each duration to an integer day before averaging loses fractional-day precision.
- **q41 — “How many customers have an email address on file?”** Generated SQL: `SELECT COUNT(DISTINCT customer_unique_id) FROM customers WHERE customer_email IS NOT NULL LIMIT 1000`. Cause: it counts distinct customer identities rather than counting email-bearing customer records as required by the reference.

The other wrong-SQL failures are q04, q24, q26, q33, and q38. Their generated statements are present in the run JSON; all produced completed SQL whose results did not match the evaluation reference.

## Adversarial set observation

All adversarial questions were handled at the **clarify** stage. Their run records contain no validator-stage event, so the validator was **not stress-tested by the gold set**. The observed safe outcomes therefore do not establish validator robustness against adversarial SQL.
