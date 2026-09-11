#!/usr/bin/env python3
"""Reconstruct the exact LoreBary-importable PULSE 0.1.0 LAB JSON snapshot.

Usage from this directory:
    python reconstruct_pulse_export.py

The output SHA-256 must be:
1c808124d0688e43749b0ce88c09365cffaba683bba2061b8be8f9c9fea95861
"""
from pathlib import Path
import base64
import gzip
import hashlib

HERE = Path(__file__).resolve().parent
SOURCE = HERE / "VIVARIUM_PULSE_0.1.0_LAB_BUILD.json.gz.b64"
OUTPUT = HERE / "VIVARIUM_PULSE_0.1.0_LAB_BUILD.json"
EXPECTED = "1c808124d0688e43749b0ce88c09365cffaba683bba2061b8be8f9c9fea95861"

encoded = SOURCE.read_text(encoding="utf-8").strip()
raw = gzip.decompress(base64.b64decode(encoded))
actual = hashlib.sha256(raw).hexdigest()
if actual != EXPECTED:
    raise SystemExit(f"Hash mismatch: expected {EXPECTED}, got {actual}")
OUTPUT.write_bytes(raw)
print(f"Wrote {OUTPUT.name} ({len(raw)} bytes) SHA256={actual}")
