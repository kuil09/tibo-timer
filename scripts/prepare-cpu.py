"""Download immutable CPU runtime and model, verifying cached and fresh bytes."""
import hashlib, json, os, pathlib, subprocess, sys, time, urllib.request
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
binroot = root / 'runtime'; binroot.mkdir(exist_ok=True)
subprocess.run(['tar','-xzf',str(a),'-C',str(binroot)],check=True)
m = root / model['file']
model_hit = download(f"https://huggingface.co/{model['repo']}/resolve/{model['revision']}/{model['file']}",m,model['sha256'])
server = next(binroot.rglob('llama-server'))
result = {'model':key,'runtime_cache_hit':runtime_hit,'model_cache_hit':model_hit,'prepare_seconds':time.monotonic()-start,'model_path':str(m.resolve()),'server_path':str(server.resolve())}
(root/'prepared.json').write_text(json.dumps(result,indent=2))
if os.getenv('GITHUB_ENV'):
    with open(os.environ['GITHUB_ENV'],'a') as env:
        env.write(f"MODEL_PATH={m.resolve()}\nLLAMA_SERVER={server.resolve()}\nMODEL_ID={key}\n")
print(json.dumps(result))
