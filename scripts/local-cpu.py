"""Prepare a verified macOS CPU lab; print the launch command without starting it.

Run from any directory. --check is strictly offline and does not write files.
The model and runtime version match the Linux Actions lock; platform binaries differ.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import platform
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.cache' / 'cpu'


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(block)
    return result.hexdigest()


def obtain(url, path, expected, offline):
    if path.exists():
        if digest(path) != expected:
            raise RuntimeError(f'Cached SHA256 mismatch; preserve and inspect this file: {path}')
        return
    if offline:
        raise RuntimeError(f'Not ready: missing {path}')
    partial = path.with_name(path.name + '.part')
    if partial.exists():
        raise RuntimeError(f'Existing download detected; wait or inspect: {partial}')
    subprocess.run(['curl', '--fail', '--location', '--retry', '2', '--max-time', '240',
                    '--output', str(partial), url], check=True)
    if digest(partial) != expected:
        raise RuntimeError(f'Download SHA256 mismatch; inspect: {partial}')
    os.replace(partial, path)


def verify_unpacked(archive, directory):
    if not directory.is_dir():
        return False
    with tarfile.open(archive, 'r:gz') as bundle:
        for member in bundle.getmembers():
            target = directory / member.name
            if not target.resolve().is_relative_to(directory.resolve()):
                raise RuntimeError('Unsafe runtime archive member')
            if member.isfile():
                if not target.is_file() or target.is_symlink():
                    return False
                with bundle.extractfile(member) as stream:
                    expected = hashlib.sha256(stream.read()).hexdigest()
                if digest(target) != expected:
                    return False
            elif member.issym():
                if not target.is_symlink() or os.readlink(target) != member.linkname:
                    return False
            elif not member.isdir():
                raise RuntimeError('Unsupported runtime archive member')
    return True


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Verify readiness offline without writing anything')
    parser.add_argument('--model', help='Model key from models.lock.json; defaults to its sole active candidate')
    args = parser.parse_args()
    local = json.loads((ROOT / 'config/local-runtime.json').read_text())
    lock = json.loads((ROOT / 'config/models.lock.json').read_text())
    runtime = local['runtime']
    if platform.system() != local['platform'] or platform.machine() != local['architecture']:
        raise RuntimeError('This local runtime supports macOS arm64 only')
    if runtime['version'] != lock['runtime']['version']:
        raise RuntimeError('Local runtime version differs from the Actions model lock')
    candidates = lock.get('active_candidates', [])
    key = args.model or (candidates[0] if len(candidates) == 1 else None)
    if key not in lock['models']:
        raise RuntimeError('Select one locked model with --model')
    model = lock['models'][key]
    if not args.check:
        CACHE.mkdir(parents=True, exist_ok=True)
    archive = CACHE / runtime['archive']
    obtain(runtime['url'], archive, runtime['sha256'], args.check)
    weights = CACHE / model['file']
    obtain(f"https://huggingface.co/{model['repo']}/resolve/{model['revision']}/{model['file']}",
           weights, model['sha256'], args.check)
    directory = CACHE / runtime['directory']
    if not verify_unpacked(archive, directory):
        if args.check:
            raise RuntimeError('Not ready: extracted runtime missing or differs from verified archive')
        if directory.exists():
            raise RuntimeError(f'Extracted runtime differs from archive; preserve and inspect: {directory}')
        if not hasattr(tarfile, 'data_filter'):
            raise RuntimeError('Secure runtime extraction requires Python with tarfile.data_filter (Python 3.12+)')
        temporary = Path(tempfile.mkdtemp(prefix='local-unpack-', dir=CACHE))
        try:
            with tarfile.open(archive, 'r:gz') as bundle:
                bundle.extractall(temporary, filter='data')
            if not verify_unpacked(archive, temporary):
                raise RuntimeError('Extracted runtime verification failed')
            temporary.rename(directory)
        finally:
            if temporary.exists():
                shutil.rmtree(temporary)
    server = directory / runtime['server']
    if not server.is_file() or not os.access(server, os.X_OK):
        raise RuntimeError('Runtime server is missing or not executable')
    command = [str(server), '-m', str(weights), '-ngl', '0', '-t', '4', '-c', '4096',
               '--parallel', '1', '--jinja', '--host', '127.0.0.1', '--port', '8080']
    print(json.dumps({'ready': True, 'model': key, 'runtime_version': runtime['version'],
                      'model_sha256': model['sha256'], 'runtime_sha256': runtime['sha256'],
                      'command': shlex.join(command)}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.CalledProcessError, tarfile.TarError) as error:
        print(f'local-cpu: {error}', file=sys.stderr)
        sys.exit(1)
