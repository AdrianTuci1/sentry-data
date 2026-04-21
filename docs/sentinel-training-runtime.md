# Sentinel Training And Modal Runtime

Sentinel is split into two responsibilities:

- `ml-lab/` is only the training lab: synthetic data generation and Sentinel model training.
- `modal_apps/sentinel_service/` is the runtime package sent to Modal for inference, policy checks, and health.

PNE and Sentinel should communicate through the backend interlocutor in normal runtime flows. The backend owns tenant auth, request state, artifact URIs, retries, SSE events, user overrides, and final persistence. Direct PNE-to-Sentinel calls are useful only for internal service diagnostics; they should not become the product control path because they bypass audit state and frontend progress.

## Generate Synthetic Data

Deterministic multi-domain bundle:

```bash
python3 ml-lab/datasets/generate_bundle.py \
  --output-dir ml-lab/.generated/training_bundle \
  --rows-per-source 320 \
  --seed 42
```

Optional LLM-generated variety bundle:

```bash
GEMINI_API_KEY=... python3 ml-lab/datasets/generator/gemini_synthetic.py \
  --domain omnichannel_commerce \
  --sources orders,web_sessions,ad_spend,support_tickets \
  --rows-per-source 80 \
  --variety stress \
  --model gemini-3.1-flash \
  --output-dir ml-lab/.generated/gemini_synthetic/commerce_stress
```

If `gemini-3.1-flash` is not enabled in the account, pass the currently enabled Gemini Flash model through `--model` or `GEMINI_MODEL`.

Upload the generated bundle to R2:

```bash
python3 ml-lab/datasets/upload_bundle_to_r2.py \
  --bundle-dir ml-lab/.generated/training_bundle
```

Default training data path:

```text
s3://$R2_BUCKET_DATA/system/r2-system/training/sentinel/generated/latest
```

## Train Locally

```bash
python3 ml-lab/sentinel_training.py \
  --bundle-dir ml-lab/.generated/training_bundle \
  --output-dir ml-lab/checkpoints/sentinel \
  --epochs 40 \
  --learning-rate 0.001 \
  --hidden-size 32 \
  --sequence-length 10
```

Train locally from an R2 bundle:

```bash
python3 ml-lab/sentinel_training.py \
  --bundle-r2-uri "s3://$R2_BUCKET_DATA/system/r2-system/training/sentinel/synthetic-v1" \
  --bundle-dir ml-lab/.generated/r2-training-bundle \
  --output-dir ml-lab/checkpoints/sentinel \
  --epochs 40
```

Upload trained artifacts to R2:

```bash
python3 ml-lab/sentinel_training.py \
  --bundle-dir ml-lab/.generated/training_bundle \
  --output-dir ml-lab/checkpoints/sentinel \
  --epochs 40 \
  --upload-r2 \
  --r2-bucket "$R2_BUCKET_DATA" \
  --r2-prefix system/r2-system/models/sentinel
```

The trainer writes:

- `coverage_ranker.pkl`
- `drift_lstm.pth`
- `query_risk_model.pkl`
- `interaction_policy_model.pkl`
- `sentinel_model_manifest.json`
- `latest/` copy for local smoke tests

Model training inputs:

- `CoverageRanker`: trained from generated `metadata/source_registry.json` and schema coverage labels.
- `DriftClassifier`: trained from generated numeric CSV windows and drift labels.
- `QueryRiskModel`: trained from generated `metadata/query_generation_scenarios.jsonl` plus safe/risky SQL augmentations.
- `InteractionPolicyModel`: trained from generated `metadata/rl_feedback_events.jsonl`.

`ml-lab/datasets/training_bundle/` is intentionally ignored and should not be committed. It is only a generated working directory.

## Train On Modal

CPU executor for smoke tests:

```bash
modal run ml-lab/modal_training.py \
  --executor cpu-large \
  --epochs 5 \
  --rows-per-source 120 \
  --upload-r2 false
```

GPU executor for full training:

```bash
modal run ml-lab/modal_training.py \
  --executor gpu-a10g \
  --epochs 40 \
  --lr 0.001 \
  --hidden-size 32 \
  --sequence-length 10 \
  --rows-per-source 320 \
  --upload-r2 true
```

If `--bundle-r2-uri` is omitted, Modal uses `SENTINEL_TRAINING_BUNDLE_URI` or the default training data path above. Model artifacts are uploaded by default under:

```text
s3://$R2_BUCKET_DATA/system/r2-system/models/sentinel/<version>
```

Executor profiles live in `ml-lab/modal_training.py`:

- `cpu-large`: 8 CPU, 32 GB RAM, no GPU, 2 hour timeout.
- `gpu-a10g`: 8 CPU, 32 GB RAM, A10G GPU, 2 hour timeout.

Both write versioned checkpoints into the Modal Volume `sentinel-ml-checkpoints` under `/checkpoints/sentinel/<version>`, update `/checkpoints/sentinel/latest`, and can publish the same artifacts to R2.

## Run Sentinel Inference On Modal

Serve locally through Modal:

```bash
modal serve modal_sentinel.py
```

Deploy:

```bash
modal deploy modal_sentinel.py
```

Runtime model loading order:

1. `SENTINEL_MODEL_BUNDLE_URI`, for example `s3://bucket/system/r2-system/models/sentinel/<version>`.
2. `SENTINEL_MODEL_MANIFEST_URI` and optional `SENTINEL_MODEL_CHECKPOINT_URI` from R2.
3. `SENTINEL_MODEL_DIR`.
4. Modal Volume path `/sentinel-models/sentinel/latest`.
5. Fallback statistics if no checkpoint exists.

Health check:

```bash
curl "$SENTINEL_API_URL/health"
```

Runtime policy check:

```bash
curl -X POST "$SENTINEL_API_URL/api/v1/evaluate_runtime" \
  -H "Content-Type: application/json" \
  -H "x-internal-secret: $INTERNAL_API_SECRET" \
  -d '{"tenant_id":"demo","project_id":"demo","source_profiles":[]}'
```

## End-To-End Flow

1. Upload a dataset into R2.
2. Backend starts the Parrot runtime.
3. PNE discovers source layout and projection candidates.
4. Backend asks Sentinel to score coverage, drift, query risk, and ML recommendation priors.
5. Backend compiles projections and query specs, saves registries, and emits SSE progress.
6. Modal executor runs query/ML scaffolds; cached artifacts are invalidated by source fingerprint and Sentinel hints.
7. Frontend receives runtime progress and partial mindmap payloads, then fetches final discovery state after `discovery_updated`.

The frontend should treat partial mindmap events as progressive UI state. The durable source of truth remains the final project discovery saved by the backend.
