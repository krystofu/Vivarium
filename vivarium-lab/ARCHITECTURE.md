# VIVARIUM_LAB_ARCHITECTURE_v1.0

Status: Bootstrap architecture
Date: 2026-09-08
Owner: GPT + Krys

## 1. Mission

GPT Vivarium Lab is the measurable development environment for Vivarium characters, plugins, visual identity, model selection, and releases.

The Lab exists to answer five questions with evidence:

1. Did the new build improve the intended behavior?
2. Did it create a new regression elsewhere?
3. Which model is best for each job?
4. Does the behavior survive long sessions and stacked systems?
5. Is the exact artifact ready to ship?

A release is not promoted because it feels better. It is promoted because its artifact, version, test evidence, and regression comparison are recorded.

## 2. Canon and storage responsibilities

### GitHub
Canonical home for versioned source, prompt/runtime artifacts, schemas, evaluation datasets, scripts, CI workflows, and release manifests.

### Notion
Research memory, experiment design, decisions, workstream status, test summaries, roadmap, and release notes.

### Google Drive
Bulky assets, exported bundles, long transcripts, PDFs, images, videos, and visual reference packs that do not belong in Git.

### LoreBary
Deployment and behavioral test environment for character and plugin behavior.

### Runway
Connected visual R&D workspace for reusable reference assets, multi-reference character consistency, image/video experimentation, and Visual DNA tests.

## 3. Core execution loop

Input / current artifact
-> generate or modify
-> structural checks
-> scenario tests
-> model arena
-> judge and score
-> compare with baseline
-> repair failed layer
-> rerun failed and adjacent tests
-> release candidate
-> human approval
-> canonical release

## 4. Four-layer runtime doctrine

Vivarium runtime systems should use four separated concerns whenever the feature requires real state.

### Layer A: Observation
Detectors and after-reply observers answer what actually happened.

Examples: embarrassment observer, repetition observer, consequence observer, trait-fixation observer, relationship-event observer.

### Layer B: Authoritative state
Variables, switches, and bounded tables store what later logic must treat as true.

Examples: trust score, first-confession switch, consequence ledger, open threads, relationship events.

### Layer C: Arbitration
WEAVE / SYNAPSE decides which signals deserve foreground steering this turn.

No module receives unlimited prompt presence. Competing signals are ranked, suppressed, or reduced to background influence.

### Layer D: Expression
Lenses, patches, directors, HUDs, and small behavioral instructions determine how the selected truth appears in prose.

The primary roleplay model should not be asked to perceive, remember, calculate, arbitrate, and present every subsystem simultaneously.

## 5. Lab engines

### ASTRA Core
Creates and compiles character packages.

Required package concepts include foundational laws, decision DNA, emotional trigger maps, voice anchors, independent life, social graph, relationship progression, adult sexuality, user-agency contract, embodied continuity, scenario baseline, continuity/memory, and portrayal directives.

### Character QA Core
Runs structural validation plus behavioral certification. The canonical behavioral matrix is derived from the current ASTRA Foundry package and includes quiet initiative, nonsexual identity, competence pressure, vulnerability, conflict, slow intimacy, explicit initiation, continuity, hesitation, refusal or stop, equality redirect, aftermath, callback, repetition pressure, and multi-plugin collision.

Structural validation and live behavioral evidence are separate certification layers.

### Plugin QA Core
Tests positive activation, negative activation, thresholds, state transitions, caps, persistence, semantic interpretation, long-run drift, interaction conflicts, and UX leakage.

### Model Arena
Tests multiple models against the same tasks. Different models may own different jobs, including architecture, drafting, compression, judging, repair, or roleplay simulation.

The arena must preserve model ID, provider, parameters, cost where available, latency where available, scenario, artifact version, and result.

### Visual DNA Core
Builds reusable identity packs from canonical references and tests identity, face, body proportions, expression diversity, pose diversity, outfit diversity, style fidelity, and scene variation.

Runway is the first connected visual backend. Visual DNA remains a character-identity system; Lustreheat remains the default Vivarium house style unless explicitly overridden.

### WEAVE / SYNAPSE
Arbitrates runtime salience. Input contracts should be compact and inspectable. A module should eventually expose at minimum:

- module ID
- salience 0-10
- steering need: NONE, LIGHT, STRONG
- state delta or observation
- conflicts or exclusions
- optional display fields

WEAVE outputs one coherent priority order or compiled instruction rather than stacking every subsystem's full guidance.

### Live Tester
Exercises long sessions and multi-plugin combinations. The first target is controlled scripted sessions; direct LoreBary automation is an integration milestone, not assumed in Bootstrap.

### Observability
Stores traces, raw outputs, scores, failure categories, comparisons, and release evidence. Failures must be diagnosable by layer rather than collapsed into a generic quality score.

## 6. Character certification

The current ASTRA behavioral score dimensions are:

- Identity fidelity
- Causal coherence
- Character initiative
- Voice specificity
- User agency
- Consent and boundary handling
- Explicit competence
- Physical continuity
- Relationship continuity
- Variety
- Consequence and payoff
- Anti-leak behavior

Each dimension is scored 0-3.

Automatic certification failures include age ambiguity, invented user consent, refusal override, or persistent system leakage. Identity fidelity, user agency, and consent handling must each score 3. Current ASTRA guidance treats 2.4 average as a live-candidate target and 2.7 average as a live-certification target across completed trials.

The Lab must record whether evidence is local, simulated, or live. Local checks may never be presented as live certification.

## 7. Plugin certification

Every plugin or internal module should receive at least four test families:

- Positive: activates when it should.
- Negative: remains quiet when it should.
- Boundary: caps, gates, one-time events, thresholds, and empty-state behavior.
- Interaction: coexists with adjacent modules without contradictory steering.

Advanced suites add persistence, 50-100 turn drift, false-director rate, state contradiction rate, agency violation rate, novel-information rate, trigger precision/recall, and context footprint.

## 8. Release states

### DRAFT
Artifact exists but has not passed structural validation.

### LOCAL PASS
Static validator and local reasoning review pass.

### EVAL CANDIDATE
Automated scenario suite can run against the exact artifact.

### LIVE CANDIDATE
Exact artifact is prepared or imported into the intended target but is not yet behaviorally proven.

### LIVE CERTIFIED
Exact final artifact passed representative live trials and the evidence is recorded.

### CANONICAL
Approved release is merged/tagged and cross-linked in Notion.

## 9. Regression policy

Every material change must identify the behavior it intends to improve. Before/after comparison should retain the same test dataset where possible.

Repair the layer that caused the failure. After a targeted repair, rerun the failed test and at least one adjacent test. Rerun the full suite when shared architecture changed.

A release can be blocked even when the headline metric improves if a protected dimension regresses beyond its allowed threshold.

Protected dimensions initially include identity fidelity, user agency, consent/boundary handling, continuity, anti-leak behavior, and structural validity.

## 10. Phone-first operating contract

Krys must be able to operate the Lab from an Android phone.

Therefore:

- No required local terminal, Node installation, Python installation, Docker, or desktop IDE.
- Automated checks run in GitHub Actions or hosted runtimes.
- Live evaluation runs are manually triggerable from a mobile browser or ChatGPT-driven workflow.
- API keys live only in provider/repository secret stores, never in committed files or Notion prose.
- Notion exposes current work, next action, evidence, and status.
- Long reports are saved as artifacts so mobile review can use summaries first and drill down only when needed.
- Any step requiring account ownership, billing, OAuth consent, or secret creation is reduced to the smallest possible user action, after which GPT resumes setup.

## 11. Bootstrap implementation order

P0 sequence:

1. Repository architecture and static CI.
2. Machine-readable ASTRA certification dataset.
3. Character and plugin result schemas.
4. Manual live-eval workflow scaffold.
5. OpenRouter or equivalent arena credentials.
6. Automated scoring and regression gates.
7. Visual DNA Pack v2 specification and first Runway trial.
8. WEAVE / SYNAPSE v0.1 contract.
9. Live Tester prototype.
10. Mobile dashboard / hosted control plane.

## 12. Secrets policy

Never commit API keys. The first expected live-evaluation secret is `OPENROUTER_API_KEY`. Additional provider keys may be added only when the corresponding integration is intentionally enabled.

CI must pass static checks without any external provider secret. Paid model calls must never run merely because a documentation file changed.

## 13. Definition of a successful Lab

A successful Vivarium Lab can take an existing character or plugin, run the same versioned scenarios against a candidate build, identify improvements and regressions, preserve the evidence, and make the release decision inspectable from a phone.

The long-term target is a development nervous system: Observers understand, state remembers, WEAVE decides, expression acts, QA measures, and release tooling remembers what actually worked.