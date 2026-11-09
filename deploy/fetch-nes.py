#!/usr/bin/env python3
"""Fetch only NES files at a pinned source revision, verifying Git blob hashes."""
import argparse
import concurrent.futures
import hashlib
import json
from pathlib import Path
import time
import urllib.parse
import urllib.request
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('destination', type=Path)
parser.add_argument('--revision', default='8f7abad7996f8ec98c798dee5b69456603a82dd0')
args = parser.parse_args()
repo = 'mengfei523060/nesrom'
tree = json.load(urllib.request.urlopen(f'https://api.github.com/repos/{repo}/git/trees/{args.revision}?recursive=1', timeout=60))
if tree.get('truncated'):
    raise RuntimeError('GitHub returned an incomplete tree')
files = [f for f in tree['tree'] if f['path'].lower().endswith('.nes') and f['type'] == 'blob']
cache = args.destination.with_suffix('.files')
cache.mkdir(parents=True, exist_ok=True)


def get(item):
    target = cache / item['sha']
    for attempt in range(4):
        try:
            raw = target.read_bytes() if target.exists() else urllib.request.urlopen(
                f'https://raw.githubusercontent.com/{repo}/{args.revision}/' + urllib.parse.quote(item['path']), timeout=90).read()
            blob = b'blob ' + str(len(raw)).encode() + b'\0' + raw
            if hashlib.sha1(blob).hexdigest() != item['sha']:
                target.unlink(missing_ok=True)
                raise ValueError('Git blob checksum mismatch: ' + item['path'])
            target.write_bytes(raw)
            return item['path'], target
        except Exception:
            if attempt == 3:
                raise
            time.sleep(attempt + 1)


with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool, zipfile.ZipFile(args.destination, 'w', compression=zipfile.ZIP_DEFLATED) as archive:
    futures = [pool.submit(get, f) for f in files]
    for count, future in enumerate(concurrent.futures.as_completed(futures), 1):
        name, target = future.result()
        archive.write(target, 'nesrom/' + name)
        if count % 50 == 0:
            print(f'Fetched and verified {count}/{len(files)}', flush=True)
print('Complete:', len(files), args.destination)
