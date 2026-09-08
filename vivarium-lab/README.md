# GPT Vivarium Lab

GPT Vivarium Lab is the implementation, automation, evaluation, and systems-engineering branch of Vivarium R&D.

Its purpose is to turn character creation, plugin development, visual identity, model comparison, regression testing, and release management into repeatable infrastructure instead of one-off prompt work.

## Primary operating model

**ChatGPT is the Lab control plane.** Krys should be able to operate the Lab by talking to GPT rather than opening a separate dashboard.

External services are spokes:

- GitHub owns versioned technical source, schemas, workflows, datasets, run requests, and release artifacts.
- Notion owns R&D tracking, decisions, experiments, evidence summaries, and roadmap state.
- Google Drive owns bulky exports and media.
- Runway owns specialized visual execution for Visual DNA work.
- Model providers execute arena jobs when secure provider credentials are configured.
- LoreBary remains the deployment and behavioral-validation environment.

GPT reads, writes, coordinates, triggers, inspects, summarizes, and records work across those systems through connected tools.

See `control/GPT_HUB_OPERATING_MODEL_v1.0.md` for the canonical orchestration contract.

## Operating principle

Observe -> authoritative state -> arbitrate -> compile expression -> generate -> observe outcome.

Use AI for meaning, state for truth, arbitration for salience, and generation for expression.

## Phone-first requirement

The Lab must be operable from an Android phone without local development tooling. Krys should be able to ask GPT for status, trigger tests, approve releases, review results, and manage assets conversationally. Heavy execution belongs in GitHub Actions, connected services, secure model-provider APIs, or other durable executors.

A separate Replit or hosted dashboard is **not required**. Replit may be used later only as an optional backend if a specific experiment benefits from it.

## GPT-operable execution

Where GPT cannot directly press a provider's workflow-dispatch control, the Lab uses versioned control-request files. GPT updates the relevant request file in GitHub; a path-triggered GitHub Action runs automatically; GPT then inspects the result and records the verdict.

The first control request is:

- `control/character-arena-request.json` -> ASTRA Character Arena

Paid model calls are disabled unless the request explicitly enables them and the required repository secret exists.

## Natural-language operations

Examples:

- `Lab status`
- `Run ASTRA smoke`
- `Run ASTRA full`
- `Test Tavi`
- `Test VEIL`
- `Compare models for character drafting`
- `Build WEAVE v0.2`
- `Visual DNA Lainey`
- `Release ASTRA v1.1`

Strict command syntax is not required.

## Initial workstreams

- Lab Core: architecture, schemas, release gates, manifests, CI, GPT Hub orchestration.
- Character QA: ASTRA structural validation and behavioral certification.
- Plugin QA: triggers, state, boundaries, long-run drift, and stack collisions.
- Model Arena: cross-model generation, judging, repair, and compression benchmarks.
- Visual DNA: Runway multi-reference identity and Lustreheat consistency tests.
- WEAVE / SYNAPSE: arbitration for competing runtime signals.
- Live Tester: multi-turn and multi-plugin behavioral testing beyond single-plugin isolation.
- Observability: traces, scores, failure taxonomy, and regression reports.

## Bootstrap status

Phase 0 infrastructure is active. Static CI is operational. GPT Hub orchestration is now the required control model. No external API secret is committed to this repository.

Live model evaluation remains dormant until the required repository secret is configured. Once configured, GPT can trigger the first arena run by updating the control request rather than requiring Krys to navigate GitHub Actions.

See `ARCHITECTURE.md` for the canonical Lab design, `PHONE_FIRST.md` for operator constraints, and `control/GPT_HUB_OPERATING_MODEL_v1.0.md` for GPT orchestration.