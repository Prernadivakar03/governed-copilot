# Failure analysis

## V2 status

No v2 result file was produced. The frozen protocol is available in
`eval/frozen.json`, but the configured PostgreSQL and Ollama services were
unreachable and Docker Desktop access was denied. Because there are no v2
records, this document does not claim v2 failure categories or invent example
questions, SQL, or counts. Re-run the uncached full evaluation before writing
the v2 examples and analysis.

## Before evidence

The historical v1 files remain under `eval/results/`. They are not v2 failure
evidence. In particular, the designated v1 full run used the old prompt and
recorded caching as enabled, so its latency is not suitable for comparison.
The v2 paired comparison tool is `eval/compare.py`.
