"""Run from repository root: .venv/bin/python scripts/dev.py"""
import os
import signal
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

root=Path(__file__).resolve().parents[1]
os.chdir(root)
env=os.environ|{'PYTHONPATH':str(root/'services/api'),'APP_ENV':'development'}
children=[]
def stop(*_, exit_code=0):
    for child in children:
        if child.poll() is None: child.terminate()
    for child in children:
        try: child.wait(timeout=5)
        except subprocess.TimeoutExpired: child.kill()
    sys.exit(exit_code)
signal.signal(signal.SIGINT,stop)
signal.signal(signal.SIGTERM,stop)
exit_code=0
try:
    children.append(subprocess.Popen([sys.executable,'-m','uvicorn','dentpro.main:app','--host',os.environ.get('DENTPRO_API_HOST','127.0.0.1'),'--port','8000'],env=env))
    for attempt in range(60):
        if children[0].poll() is not None: raise RuntimeError('API exited during startup')
        try:
            urllib.request.urlopen('http://127.0.0.1:8000/health',timeout=1)
            break
        except OSError: time.sleep(.25)
    else: raise RuntimeError('API did not start within 15 seconds')
    children.append(subprocess.Popen([sys.executable,'-m','dentpro.worker'],env=env))
    children.append(subprocess.Popen(['npm','run','dev'],env=env))
    print('\nDENTpro: http://127.0.0.1:3000 | API: http://127.0.0.1:8000/docs\n',flush=True)
    while all(c.poll() is None for c in children): time.sleep(1)
    exit_code=next((c.returncode for c in children if c.returncode),0)
except Exception as exc:
    print(f"DENTpro startup failed: {exc}",file=sys.stderr)
    exit_code=1
finally: stop(exit_code=exit_code)
