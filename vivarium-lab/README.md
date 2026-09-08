# GPT Vivarium Lab

GPT Vivarium Lab is the implementation, automation, evaluation, and systems-engineering branch of Vivarium R&D.

Its purpose is to turn character creation, plugin development, visual identity, model comparison, regression testing, and release management into repeatable infrastructure instead of one-off prompt work.

## Operating principle

Observe -> authoritative state -> arbitrate -> compile expression -> generate -> observe outcome.

Use AI for meaning, state for truth, arbitration for salience, and generation for expression.

## Phone-first requirement

The Lab must be operable from an Android phone without local development tooling. Krys should be able to inspect status, trigger tests, approve releases, review results, and manage assets from ChatGPT or mobile-friendly cloud interfaces. Heavy execution belongs in GitHub Actions, hosted runtimes, connected services, or APIs.

## Initial workstreams

- Lab Core: architecture, schemas, release gates, manifests, CI.
- Character QA: ASTRA structural validation and behavioral certification.
- Plugin QA: triggers, state, boundaries, long-run drift, and stack collisions.
- Model Arena: cross-model generation, judging, repair, and compression benchmarks.
- Visual DNA: Runway multi-reference identity and Lustreheat consistency tests.
- WEAVE / SYNAPSE: arbitration for competing runtime signals.
- Live Tester: multi-turn and multi-plugin behavioral testing beyond single-plugin isolation.
- Observability: traces, scores, failure taxonomy, and regression reports.

## Bootstrap status

Phase 0 is infrastructure. No external API secret is committed to this repository. Live model evaluation is manually triggered and remains dormant until the required repository secrets are configured.

See `ARCHITECTURE.md` for the canonical Lab design and `PHONE_FIRST.md` for operator constraints.