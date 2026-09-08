# VIVARIUM PULSE 0.1.1 — Security Compatibility Repair

## Observed LoreBary result

The first PULSE 0.1.0 Test Chamber import succeeded far enough to expose the full 126-variable state and all four switches, but runtime execution was blocked before behavioral testing with:

`Security Threat Detected → Obfuscated code detected`

## Diagnosis

The importable plugin contains no `eval()`, Function constructor, base64-decoded executable payload, `atob`/`btoa`, `fromCharCode`, or encoded script loader.

The strongest structural difference from already-proven Vivarium plugins such as VEIL and SOVEREIGN was code presentation:

- PULSE 0.1.0 advanced scripts: 39
- effectively one-line/minified scripts: 30
- total advanced-script lines: 119
- average advanced-script line length: ~368 characters

By contrast, the working Vivarium samples use readable multi-line scripting. The first repair therefore treats the LoreBary result as a likely false positive caused by code compression/minified structure rather than a capability failure.

## 0.1.1 repair

The 0.1.1 SECURITY-COMPAT LAB BUILD preserves PULSE behavior and 4.1 scope while reformatting every advanced script into readable multi-line JavaScript.

- advanced scripts: 39
- one-line/minified scripts: 0
- total advanced-script lines: 1081
- average line length: ~45 characters
- Node syntax validation: PASS for all 39 scripts

No PULSE subsystem was cut to satisfy the scanner.

**0.1.1 SHA-256:** `e0368c2613ab92e3cf372c5f7a3d476f9124d07373035d915451c126b266bbe6`

## Next gate

Import 0.1.1 into LoreBary Test Chamber. If LoreBary still reports obfuscation, isolate script groups by bisection and identify the exact scanner trigger rather than weakening PULSE conceptually.
