# Evaluation Results

## Protocol & Benchmark Runs

Evaluation was conducted under the frozen protocol verified against `eval/frozen.json`:
- **Protocol fingerprint**:
  - `gold`: `da0c270be4a66808` (`eval/gold.jsonl`)
  - `semantic`: `442367b9f7fbd19a` (`backend/app/semantic/semantic.yaml`)
  - `prompt`: `49ed72eace6139d7` (`backend/app/generation/prompt.py`)
  - `llm`: `6e936aab23290515` (`backend/app/generation/llm.py`)
  - `variants`: `f6c723b97412205b` (`backend/app/variants.py`)
  - `model`: `qwen2.5-coder:3b`
- **Result Files**:
  - `full`: `eval/results/run_full_20261027_132025.json` (uncached, `n=97`, frozen=true)
  - `b0`: `eval/results/run_b0_20261027_205147.json` (uncached, `n=40` subset, frozen=true)

---

## Benchmark Results (95% Bootstrap CI in Brackets)

| System | Questions (N) | Exec. Accuracy | Answer Correct (Scalar) | Hallucination Rate | Unauthorized Access | Security Block | Unanswerable Handled | p50 Latency | p95 Latency |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **b0** | 40 (subset) | 65.0% [50.0–80.0%] | 65.5% [48.3–82.8%] | 5.0% [0.0–12.5%] | — | — | — | 14.9s | 55.7s |
| **full** | 97 (full set) | 65.7% [54.4–77.2%] | 64.7% [51.0–78.4%] | 14.3% [7.6–22.8%] | 0.0% | 100.0% | 100.0% | 19.3s | 56.0s |

*Note: All latency measurements reflect uncached execution (`LLM_CACHE=false`).*

### Execution Accuracy by Difficulty

| System | Easy | Medium | Hard |
|---|---:|---:|---:|
| **b0** (n=40) | 84.2% (16/19) | 56.2% (9/16) | 20.0% (1/5) |
| **full** (n=79) | 84.6% (22/26) | 65.5% (19/29) | 33.3% (8/24) |

### Security & Robustness Outcomes (Full System, n=18)

| Attack Type | Tag | Tested | Handled Safely | Block Rate |
|---|---|---:|---:|---:|
| Destruction attempt | `destructive` | 4 | 4 | 100.0% |
| Prompt / SQL injection | `injection` | 5 | 5 | 100.0% |
| Cross-role PII leakage | `pii` | 6 | 6 | 100.0% |
| Unauthorized access | `unauthorized` | 3 | 3 | 100.0% |
| Unanswerable / vague queries | `unanswerable` | 5 | 5 | 100.0% |

---

## Paired Statistical Comparison (b0 vs full on 40-Question Subset)

Evaluated via `eval/compare.py` on the identical first 40 questions (`q01`–`q40`, all answerable):

| Metric | Measurement |
|---|---|
| **Common Question Count** | 40 |
| **b0 Accuracy (V1)** | 65.0% (26/40) |
| **full Accuracy (V2)** | 70.0% (28/40) |
| **Accuracy Difference (V2 - V1)** | **+5.0%** |
| **95% Bootstrap CI of Difference** | **[-10.0%, +20.0%]** |
| **McNemar Exact 2-Sided p-value** | **0.7539** |
| **Statistically Significant?** | **NO** (p = 0.7539 >= 0.05) |
| **Fixed by full (V1=0, V2=1)** | 6 (`q05`, `q10`, `q20`, `q27`, `q28`, `q39`) |
| **Broken by full (V1=1, V2=0)** | 4 (`q17`, `q18`, `q36`, `q40`) |
| **Unchanged (V1 == V2)** | 30 |
| **Over-clarification on Answerable Queries** | b0 = 3, full = 5 |

---

## Go / No-Go Gate Evaluation

| Gate | Criterion | Measured Value | Verdict |
|---|---|---|---|
| **Cross-Role Leakage** | Zero cross-role data leakage | 0.0% unauthorized access | **PASS** |
| **Security Enforcement** | 100% block on destructive & injection attempts | 100.0% blocked | **PASS** |
| **Hallucination Rate** | Hallucination rate strictly below B0 | full: 14.3% vs b0: 5.0% | **FAIL** |
| **p95 Latency Acceptance** | p95 latency <= 90s (uncached) | 56.0s (uncached) | **PASS** |
| **Execution Accuracy** | Accuracy >= 60.0% threshold | 65.7% (full) / 70.0% (paired) | **PASS** |
