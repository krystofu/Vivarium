# VIVARIUM WEAVE / SYNAPSE Contract v0.1

Status: Bootstrap specification

## Purpose

WEAVE does not simulate a psychological dimension itself. It arbitrates competing Vivarium signals and compiles the smallest coherent steering package for the next roleplay response.

## Input contract

Each participating module should expose a compact record:

- `module_id`
- `salience` from 0 to 10
- `steering_need`: `NONE`, `LIGHT`, or `STRONG`
- `observation`: concise statement of what the module believes is currently relevant
- `state`: optional authoritative values needed for the decision
- `proposed_effect`: concise behavior or expression request
- `conflicts_with`: zero or more module IDs or effect classes
- `exclusive`: whether foregrounding this effect should suppress competing expression layers
- `ttl_turns`: optional number of turns the signal remains eligible without renewal

## Arbitration rules

1. Safety, explicit user boundaries, and direct scene constraints outrank flavor systems.
2. Authoritative scene facts outrank speculative interpretations.
3. High salience does not automatically mean maximum prose presence.
4. Only one module should normally receive STRONG foreground steering.
5. A second module may receive LIGHT steering when it adds compatible behavioral texture.
6. Other active modules remain background context or are suppressed for the turn.
7. Perceptual lenses are budgeted separately. Normally no more than two receive foreground expression.
8. If two modules demand contradictory actions, WEAVE must choose one priority order and never inject both full directives.
9. A module with no meaningful current effect should output `NONE` rather than generic advice.
10. Debug explanations are never injected into roleplay unless an explicit debug mode is enabled.

## Suggested priority classes

- P0: user boundary / refusal / safety / direct hard constraint
- P1: immediate physical threat or causal world requirement
- P2: authoritative relationship or emotional state with strong current consequences
- P3: active motive / dominance / intimacy / disclosure pressure
- P4: director intervention for stalled scenes
- P5: perceptual lenses, style accents, ambient flavor

These classes are defaults, not universal truth. A scene-specific causal requirement may promote or suppress a signal.

## Output contract

WEAVE should emit:

- `dominant_module`
- `secondary_module` or `NONE`
- `suppressed_modules`
- `compiled_steering`
- `lens_budget`
- `reason_code`
- `debug_summary` only when debug mode is enabled

`compiled_steering` should normally be one concise instruction, not a concatenation of source prompts.

## Example

Inputs:

- threat: salience 9, STRONG
- embarrassment: salience 8, LIGHT
- jealousy: salience 3, LIGHT
- body_lens: salience 5, LIGHT
- microexpression_lens: salience 5, LIGHT

Output:

- dominant: threat
- secondary: embarrassment
- suppressed: jealousy, microexpression_lens
- lens budget: body_lens = 1 relevant detail
- compiled steering: threat controls action and pacing; embarrassment may narrow speech and eye contact without being named; jealousy receives no explicit steering this turn.

## v0.1 success criteria

- Reduces contradictory stacked instructions.
- Preserves character identity while prioritizing scene causality.
- Can explain which modules were suppressed in debug mode.
- Does not become a new flavor prompt.
- Adds less active context than the full source instructions it replaces.
