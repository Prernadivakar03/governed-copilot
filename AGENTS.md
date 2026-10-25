# Standing project rules

- This is an MSc capstone: Governed Analytics Copilot. Never commit secrets, `.env` files, datasets, or personal data.
- Never weaken the SQL validator, DB role permissions, approval gates, or the tool allow-list to make a test pass.
- Every behavior change needs a test. Before finishing any task, run `python -m pytest` from `backend/` and `python -m ruff check .`.
- Use LF line endings. Commit small, one commit per task, with messages that explain why.
- Never claim something works unless you ran it. In summaries, list what you could not verify.
- Use only numbers from real eval runs; never invent results or citations.
- Ask before making design decisions that are ambiguous.
