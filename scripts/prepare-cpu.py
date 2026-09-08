"""Download immutable CPU runtime and model, verifying cached and fresh bytes."""
import hashlib, json, os, pathlib, shutil, subprocess, sys, tempfile, time
start = time.monotonic()
root = pathlib.Path('.cache/cpu'); root.mkdir(parents=True, exist_ok=True)
lock = json.load(open('config/models.lock.json'))
key = sys.argv[1]
model = lock['models'][key]
def download(url, path, expected):
    def digest():
        with open(path, 'rb') as stream:
            return hashlib.file_digest(stream, 'sha256').hexdigest()
    if path.exists() and digest() == expected:
        return True
    partial = path.with_suffix(path.suffix + '.part')
    subprocess.run(['curl','--fail','--location','--retry','2','--max-time','240','--output',str(partial),url], check=True)
    partial.replace(path)
    if digest() != expected:
        path.unlink()
        raise RuntimeError('SHA256 mismatch: ' + str(path))
    return False
runtime = lock['runtime']
a = root / 'runtime.tar.gz'
runtime_hit = download(runtime['url'], a, runtime['sha256'])
runtime_root = root / 'runtime'; runtime_root.mkdir(exist_ok=True)
binroot = runtime_root / runtime['sha256']
marker = binroot / '.complete.json'
unpack_hit = False
try:
    complete = json.loads(marker.read_text())
    server = binroot / complete['server']
    unpack_hit = complete['sha256'] == runtime['sha256'] and server.is_file() and os.access(server, os.X_OK)
except (OSError, ValueError, KeyError):
    pass
if not unpack_hit:
    temporary = pathlib.Path(tempfile.mkdtemp(prefix='unpack-', dir=runtime_root))
    try:
        subprocess.run(['tar','-xzf',str(a),'-C',str(temporary)],check=True)
        candidates = list(temporary.rglob('llama-server'))
        if len(candidates) != 1 or not os.access(candidates[0], os.X_OK):
            raise RuntimeError('Expected exactly one executable llama-server')
        relative_server = str(candidates[0].relative_to(temporary))
        (temporary / '.complete.json').write_text(json.dumps({'sha256':runtime['sha256'],'server':relative_server}))
        if binroot.exists():
            shutil.rmtree(binroot)
        temporary.rename(binroot)
        server = binroot / relative_server
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
m = root / model['file']
model_hit = download(f"https://huggingface.co/{model['repo']}/resolve/{model['revision']}/{model['file']}",m,model['sha256'])
result = {'runtime_version':runtime['version'],'runtime_sha256':runtime['sha256'],'model_sha256':model['sha256'],'model_revision':model['revision'],'model':key,'runtime_cache_hit':runtime_hit,'runtime_unpack_hit':unpack_hit,'model_cache_hit':model_hit,'prepare_seconds':time.monotonic()-start,'model_path':str(m.resolve()),'server_path':str(server.resolve())}
(root/'prepared.json').write_text(json.dumps(result,indent=2))
if os.getenv('GITHUB_ENV'):
    with open(os.environ['GITHUB_ENV'],'a') as env:
        env.write(f"MODEL_PATH={m.resolve()}\nLLAMA_SERVER={server.resolve()}\nMODEL_ID={key}\n")
print(json.dumps(result))
