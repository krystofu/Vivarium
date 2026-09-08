# GPT HUB OPERATING MODEL v1.0

Status: Active design
Date: 2026-09-08
Owner: GPT + Krys

## Purpose

ChatGPT is the primary operator interface and orchestration hub for GPT Vivarium Lab.

Krys should not need to open a separate dashboard to operate the Lab. The normal control surface is the Vivarium ChatGPT project. External services are execution or storage spokes that GPT reads from, writes to, and coordinates when their capabilities are needed.

## Control-plane topology

Krys -> GPT Hub -> GitHub / Notion / Google Drive / Runway / model providers / LoreBary

GPT owns orchestration. External systems own durable state, execution, or specialized media work.

### GPT Hub

Primary responsibilities:

- interpret natural-language Lab requests;
- inspect current canonical state before acting;
- choose the correct workstream and test depth;
- modify versioned source through GitHub;
- trigger cloud execution through GPT-operable mechanisms;
- inspect workflow results and artifacts;
- summarize verdicts in mobile-friendly form;
- update Notion with decisions, evidence, and next actions;
- coordinate visual work through connected media tools;
- preserve provenance between source, test, and release.

## External spokes

### GitHub

The executable backbone. Stores canonical Lab source, schemas, datasets, control requests, workflows, evaluation configuration, and release manifests.

A GPT-triggerable run must not require the user to open GitHub. When direct workflow dispatch is unavailable to GPT, a versioned control-request file may be updated by GPT; a path-triggered GitHub Action then executes the requested job.

### Notion

Durable R&D memory and human-readable tracker. Notion is not the control plane. GPT keeps it synchronized after meaningful architecture, experiment, test, or release changes.

### Google Drive

Large artifact and binary storage for images, videos, PDFs, long transcripts, exported bundles, and reference packs.

### Runway

Specialized visual execution for Visual DNA and image/video experiments. GPT remains the operator and records results elsewhere.

### Model providers

Execution backends for arena tests, generation, judging, repair, or compression. Provider credentials stay in secure secret stores. GPT never asks Krys to paste API secrets into source files or Notion.

### LoreBary

Deployment and behavioral-validation environment. GPT prepares artifacts, test plans, expected evidence, and records the resulting observations. Browser-only steps remain an integration boundary until a connected browser path can execute them directly.

## Natural-language control protocol

Krys may operate the Lab conversationally. No strict command syntax is required.

Canonical intents include:

- `Lab status` — inspect GitHub, Notion, current workstreams, recent CI, and blockers.
- `Run ASTRA smoke` — trigger the small character-certification suite.
- `Run ASTRA full` — trigger the full character-certification suite.
- `Test <character>` — assemble the exact artifact and appropriate character suite.
- `Test <plugin>` — run structural, positive, negative, boundary, and interaction checks available for that plugin.
- `Compare models for <job>` — run or prepare the Model Arena for the requested role.
- `Build <system>` — create a versioned branch or candidate, validate it, and return the review result.
- `Release <artifact>` — verify gates, present evidence, and only promote after explicit approval when promotion is consequential.
- `Visual DNA <character>` — prepare or run the connected visual-consistency workflow.

Free-form requests remain valid. GPT maps them to the closest Lab intent.

## GPT execution loop

1. Read current canonical source and tracker state when the answer depends on them.
2. Restate the requested outcome internally as a Lab job.
3. Select the smallest sufficient test or build path.
4. Make versioned changes through connected tools.
5. Trigger cloud execution through a GPT-operable route.
6. Inspect results rather than assuming success.
7. Diagnose failures by layer.
8. Repair and rerun when appropriate.
9. Summarize the result for phone review.
10. Record durable evidence and next action in Notion/GitHub.

## Phone-first requirement

The user-facing operating model is conversation-first. Routine Lab operation must not require a terminal, desktop IDE, Replit dashboard, local Node/Python installation, or hand-editing YAML.

When an external service requires an account-owner action such as OAuth, billing approval, or secret creation, GPT reduces it to one small explicit step and resumes orchestration immediately afterward.

## Replit policy

Replit is not part of the required GPT Vivarium Lab architecture. It may be used later as an optional execution backend if a specific experiment benefits from it, but the Lab must remain fully operable without Replit.

## Background-work boundary

GPT does not claim to stay active indefinitely after a chat turn. Long-running or recurring work must use GitHub Actions, scheduled automation, or another durable executor. GPT can trigger, inspect, interpret, and record those jobs through connected tools.

## Source-of-truth rule

ChatGPT is the control plane, not the only storage layer.

- GitHub is canonical for versioned technical artifacts.
- Notion is canonical for R&D tracking and decisions.
- Drive is canonical for bulky media and exports.
- GPT is canonical for orchestration during the active interaction.

This separation lets the Lab remain recoverable even if a single chat thread ends.