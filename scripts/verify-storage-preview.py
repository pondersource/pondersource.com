#!/usr/bin/env python3
"""Verify the deployed storage bytes and their pinned source provenance."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--site', type=Path, default=Path(__file__).resolve().parents[1])
parser.add_argument('--rs', type=Path, required=True)
parser.add_argument('--widget', type=Path, required=True)
args = parser.parse_args()
manifest = json.loads((args.site / 'storage-preview.json').read_text())
expected = {
    'dependencies/remotestoragejs/remotestorage.js',
    'dependencies/remotestoragejs/remotestorage-all.js.map',
    'dependencies/remotestoragejs/remotestorage-all.js.LICENSE.txt',
    'dependencies/remotestorage-widget/widget.js',
    'dependencies/remotestorage-widget/widget.js.map',
    'dependencies/remotestorage-widget/widget.js.LICENSE.txt',
}
if set(manifest['artifacts']) != expected:
    parser.error('the manifest must identify all six deployed storage artifacts')
for name, digest in manifest['artifacts'].items():
    if hashlib.sha256((args.site / name).read_bytes()).hexdigest() != digest:
        parser.error('artifact hash mismatch: ' + name)

for key, checkout in [('remotestorage', args.rs), ('widget', args.widget)]:
    checkout = checkout.resolve()
    commit = subprocess.check_output(['git', '-C', str(checkout), 'rev-parse', 'HEAD'], text=True).strip()
    if commit != manifest[key]['baseCommit']:
        parser.error('source revision mismatch: ' + key)
    inputs = sorted(path for path in checkout.glob('src/**/*') if path.is_file())
    inputs += [checkout / name for name in ['package.json', 'package-lock.json', 'tsconfig.json',
               'webpack.config.js', 'scripts/nextgraph-csp-loader.cjs'] if (checkout / name).is_file()]
    digest = hashlib.sha256()
    for path in inputs:
        digest.update(str(path.relative_to(checkout)).encode() + b'\0' + path.read_bytes())
    if digest.hexdigest() != manifest[key]['sourceSha256']:
        parser.error('source input digest mismatch: ' + key)

print('Verified six storage artifacts and both pinned source checkouts.')
