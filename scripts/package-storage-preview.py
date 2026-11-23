#!/usr/bin/env python3
"""Package local storage builds with source provenance; never publish or deploy."""
import argparse
import gzip
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--rs', type=Path, required=True)
parser.add_argument('--widget', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--rs-version', default='2.0.0-beta.10-pondersource.7-preview.6')
parser.add_argument('--widget-version', default='1.8.2-pondersource.2-preview.6')
args = parser.parse_args()
for version in [args.rs_version, args.widget_version]:
    if not version or any(char not in '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-+' for char in version):
        parser.error('versions must contain only letters, digits, dots, hyphens and plus signs')
if args.output.exists():
    parser.error('output exists; choose a new directory')
args.output.mkdir(parents=True)

def package(checkout, version, files, metadata):
    checkout = checkout.resolve()
    sources = sorted(path for path in checkout.glob('src/**/*') if path.is_file())
    digest = hashlib.sha256()
    build_inputs = [checkout / name for name in ['package.json', 'package-lock.json', 'tsconfig.json', 'webpack.config.js', 'scripts/nextgraph-csp-loader.cjs'] if (checkout / name).is_file()]
    for path in [*sources, *build_inputs]:
        digest.update(str(path.relative_to(checkout)).encode() + b'\0' + path.read_bytes())
    provenance = {
        'status': 'experimental fork preview; not published to npm',
        'baseCommit': subprocess.check_output(['git', '-C', str(checkout), 'rev-parse', 'HEAD'], text=True).strip(),
        'sourceSha256': digest.hexdigest(),
        'artifacts': {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in sorted(files.items())},
    }
    data = json.loads((checkout / 'package.json').read_text())
    for key in ['scripts', 'devDependencies', 'overrides', 'optionalDependencies']:
        data.pop(key, None)
    data.update(version=version, **metadata)
    contents = {name: path.read_bytes() for name, path in files.items()}
    contents.update({str(path.relative_to(checkout)): path.read_bytes() for path in sources})
    contents['package.json'] = (json.dumps(data, indent=2) + '\n').encode()
    contents['storage-preview.json'] = (json.dumps(provenance, indent=2) + '\n').encode()
    output = args.output / (data['name'] + '-' + version + '.tgz')
    with output.open('wb') as raw, gzip.GzipFile(fileobj=raw, mode='wb', mtime=0, filename='') as zipped, tarfile.open(fileobj=zipped, mode='w') as archive:
        for name, body in sorted(contents.items()):
            info = tarfile.TarInfo('package/' + name)
            info.size = len(body)
            info.mode = 0o644
            archive.addfile(info, io.BytesIO(body))
    print(output)

rsfiles = {str(p.relative_to(args.rs)): p for p in (args.rs / 'release/types').glob('**/*') if p.is_file()}
for filename in ['LICENSE', 'README.md', 'docs/lws-experimental.md', 'docs/nextgraph-experimental.md', 'docs/interrupted-writes.md', 'webpack.config.js', 'scripts/nextgraph-csp-loader.cjs']:
    rsfiles[filename] = args.rs / filename
for name in ['remotestorage.js', 'remotestorage-all.js', 'remotestorage-solid.js']:
    rsfiles['release/' + name] = args.rs / 'release/remotestorage-all.js'
for suffix in ['.map', '.LICENSE.txt']:
    rsfiles['release/remotestorage-all.js' + suffix] = args.rs / ('release/remotestorage-all.js' + suffix)
package(args.rs, args.rs_version, rsfiles, {'types':'./release/types/remotestorage-all.d.ts'})
widgetfiles = {name: args.widget / name for name in ['build/widget.js', 'build/widget.js.map', 'build/widget.js.LICENSE.txt', 'README.md', 'index.d.ts']}
package(args.widget, args.widget_version, widgetfiles, {})
