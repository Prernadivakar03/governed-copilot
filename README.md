# Governed Analytics Copilot

An analytics copilot for governed, read-only querying of the Olist dataset.

## Local model latency

Queries can take up to a minute on a local model. Ollama may take longer on the
first request while the model loads; set `OLLAMA_KEEP_ALIVE=-1` on the Ollama
server to keep it loaded.
