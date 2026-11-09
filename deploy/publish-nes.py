#!/usr/bin/env python3
"""Refresh generated browser manifests after the ROM startup audit."""
import importlib.util
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('import_nes', root / 'deploy/import-nes.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
module.publish_catalog(json.loads((root / 'games/nes/catalog.json').read_text()))
