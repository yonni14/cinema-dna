#!/usr/bin/env python3
"""Prepare numbered posters and upload to R2 with an existing Wrangler login.
Default is dry-run. Upload may replace existing posters/<id>.webp keys.
No delete, bucket creation, or public-access changes. No secrets in this script.
"""
import argparse, csv, os, re, shutil, subprocess, sys, unicodedata
from pathlib import Path

p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--bucket', required=True)
p.add_argument('--account-id', required=True)
p.add_argument('--source', type=Path, required=True, help='Original posters directory')
p.add_argument('--map', type=Path, required=True, help='posters_rename_map.csv')
p.add_argument('--output', type=Path, default=Path('posters_out'))
p.add_argument('--apply', action='store_true', help='Actually upload; overwrites matching keys')
a = p.parse_args()
if not re.fullmatch(r'[a-z0-9][a-z0-9-]{1,61}[a-z0-9]', a.bucket): p.error('Invalid bucket name')
if not re.fullmatch(r'[a-fA-F0-9]{32}', a.account_id): p.error('Expected a 32-character account ID')
if not a.source.is_dir(): p.error('Source directory missing')
files = {unicodedata.normalize('NFC', f.name): f for f in a.source.glob('*.webp')}
with a.map.open(encoding='utf-8-sig', newline='') as f: rows = list(csv.DictReader(f))
if len(rows) != 1051: p.error(f'Expected 1051 mapping rows, found {len(rows)}')
prepared = []
seen = set()
for row in rows:
    key = row['new_filename']
    if not re.fullmatch(r'posters/\d+\.webp', key) or key in seen: p.error(f'Invalid/duplicate key: {key}')
    seen.add(key)
    original = files.get(unicodedata.normalize('NFC', Path(row['old_filename']).name))
    if original is None: p.error(f'Missing original: {row["old_filename"]}')
    prepared.append((original, key))
# Validate everything before preparing or uploading any file.
for original, key in prepared:
    dest = a.output / key
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(original, dest)
print(f'Prepared {len(prepared)} numbered posters. Destination: {a.bucket}/posters/')
if not a.apply:
    print('Dry-run only. No Cloudflare changes. Add --apply after checking account and bucket.')
    sys.exit(0)
if shutil.which('npx') is None: p.error('Node.js/npx is required')
env = dict(os.environ, CLOUDFLARE_ACCOUNT_ID=a.account_id)
# Use existing OAuth login; missing login may require browser sign-in through Wrangler.
for i, (_, key) in enumerate(prepared, 1):
    result = subprocess.run(['npx', '--yes', 'wrangler@4', 'r2', 'object', 'put',
        f'{a.bucket}/{key}', '--file', str((a.output / key).resolve()), '--remote',
        '--content-type', 'image/webp', '--cache-control', 'public, max-age=86400'], env=env)
    if result.returncode:
        print(f'Stopped at {key}. {i-1} objects uploaded this run. No deletion performed.', file=sys.stderr)
        sys.exit(result.returncode)
    print(f'{i}/{len(prepared)} uploaded', flush=True)
print('Upload complete. Verify public URLs before deploying the app.')
