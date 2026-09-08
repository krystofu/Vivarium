# GPT Vivarium Lab — Phone-First Operating Contract

The Lab is intentionally designed so Krys can operate it from an Android phone.

## Required mobile capabilities

From ChatGPT or a mobile browser, the operator must be able to:

- inspect current Lab status and next actions
- trigger static checks and live evaluation workflows
- review pass/fail summaries and regression reports
- approve or reject releases
- inspect characters, plugins, and visual DNA records
- connect provider accounts through normal OAuth flows
- add secrets through provider/repository settings when required
- review Runway visual outputs and reusable references
- access bulky artifacts through Google Drive or workflow artifacts

## Forbidden dependencies

No core workflow may require:

- a local terminal
- locally installed Node, Python, Docker, Git, or Promptfoo
- a desktop-only IDE
- manually editing YAML or JSON on the phone
- keeping API keys in chat transcripts, Notion pages, or committed files

## Execution placement

- GitHub Actions: validators, regression jobs, scheduled/manual evaluations, release gates.
- Hosted app/runtime: future Vivarium Lab dashboard and long-running test orchestration.
- ChatGPT connectors: Notion, GitHub, Drive, Runway, and other supported integrations.
- Provider secret stores: external API credentials.

## Human-only actions

Some operations must remain user-controlled: billing acceptance, OAuth authorization, account creation, and secret creation/copying when a service requires it.

The design goal is to make each human-only action a short mobile step, then return control to the Lab automation.

## Cost safety

Paid model evaluation must be manual by default during Bootstrap. Static CI may run automatically. Nightly or scheduled paid evaluations require an explicit later decision and documented spend limit.

## Mobile release rule

A release summary should fit on one phone screen before linking to detailed artifacts. At minimum it must show:

- artifact/version
- test suite version
- pass/fail
- protected-dimension regressions
- major score deltas
- known limitations
- canonical artifact link

Phone-first is a product requirement, not a convenience.