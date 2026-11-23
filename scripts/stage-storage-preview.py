#!/usr/bin/env python3
"""Stage the launcher with locally built storage dependencies; never deploy it."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--rs', type=Path, required=True, help='remoteStorage.js checkout after npm run build:all')
parser.add_argument('--widget', type=Path, required=True, help='widget checkout after npm run build')
parser.add_argument('--output', type=Path, required=True, help='new preview directory outside this repository')
args = parser.parse_args()
source = Path(__file__).resolve().parents[1]
output = args.output.resolve()
if output == source or source in output.parents or output in source.parents:
    parser.error('output must be outside the launcher repository')
if output.exists():
    parser.error('output already exists; choose a new directory')

assets = [
    (args.rs / 'release/remotestorage-all.js', Path('dependencies/remotestoragejs/remotestorage.js')),
    (args.rs / 'release/remotestorage-all.js.LICENSE.txt', Path('dependencies/remotestoragejs/remotestorage-all.js.LICENSE.txt')),
    (args.rs / 'release/remotestorage-all.js.map', Path('dependencies/remotestoragejs/remotestorage-all.js.map')),
    (args.widget / 'build/widget.js', Path('dependencies/remotestorage-widget/widget.js')),
    (args.widget / 'build/widget.js.map', Path('dependencies/remotestorage-widget/widget.js.map')),
    (args.widget / 'build/widget.js.LICENSE.txt', Path('dependencies/remotestorage-widget/widget.js.LICENSE.txt')),
]
for path, _ in assets:
    if not path.is_file():
        parser.error(f'missing build artifact: {path}')
shutil.copytree(source, output, ignore=shutil.ignore_patterns('.git', 'node_modules', '__pycache__'))
for path, target in assets:
    (output / target).parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, output / target)

def provenance(checkout):
    checkout = checkout.resolve()
    sources = sorted(path for path in checkout.glob('src/**/*') if path.is_file())
    build_inputs = [checkout / name for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'webpack.config.js', 'scripts/nextgraph-csp-loader.cjs'] if (checkout / name).is_file()]
    files = [*sources, *build_inputs]
    digest = hashlib.sha256()
    for path in files:
        if path.is_file():
            digest.update(str(path.relative_to(checkout)).encode())
            digest.update(b'\0')
            digest.update(path.read_bytes())
    return {'baseCommit': subprocess.check_output(['git', '-C', str(checkout), 'rev-parse', 'HEAD'], text=True).strip(),
            'sourceSha256': digest.hexdigest()}

manifest = {'status': 'experimental fork preview; source and artifact provenance',
            'remotestorage': provenance(args.rs), 'widget': provenance(args.widget),
            'artifacts': {str(target): hashlib.sha256((output / target).read_bytes()).hexdigest() for _, target in assets}}
(output / 'storage-preview.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(output)
