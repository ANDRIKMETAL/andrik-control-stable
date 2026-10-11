#!/usr/bin/env python3
"""ANDRIK GAME R1286: game-only safe install or rollback. Never touches radio service."""
import argparse,datetime,hashlib,json,os,shutil,tempfile
from pathlib import Path
SOURCE=Path(__file__).resolve().parent.parent
MANIFEST=json.loads((SOURCE/'game-r1286-tools/manifest.json').read_text('utf8'))
FILES=['dreaming-of-lira.html','index.html','assets/lira-3d-r1286.js','assets/portrait-r1286.js']
def sha(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(1048576),b''):h.update(chunk)
 return h.hexdigest()
def atomic(src,dst):
 dst.parent.mkdir(parents=True,exist_ok=True)
 fd,tmp=tempfile.mkstemp(prefix='.andrik-game-r1286-',dir=str(dst.parent))
 try:
  with os.fdopen(fd,'wb') as w,src.open('rb') as r:
   shutil.copyfileobj(r,w)
   w.flush();os.fsync(w.fileno())
  if dst.is_file():shutil.copymode(dst,tmp)
  os.replace(tmp,dst)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def check_source():
 for n in FILES:
  p=SOURCE/n
  if not p.is_file() or sha(p)!=MANIFEST['new_sha256'][n]:raise SystemExit('STOP: package missing or altered: '+n)
def main():
 ap=argparse.ArgumentParser(description='Install/rollback game R1286 only')
 ap.add_argument('--root',required=True,help='website root containing dreaming-of-lira.html')
 ap.add_argument('--check',action='store_true')
 ap.add_argument('--rollback',action='store_true')
 a=ap.parse_args();root=Path(a.root).resolve();check_source()
 if not (root/'dreaming-of-lira.html').is_file() or not (root/'index.html').is_file():raise SystemExit('STOP: site root not found; no changes made')
 backupbase=root/'game-r1286-backups'
 if a.rollback:
  backups=sorted(backupbase.glob('PRE-R1286-*'),reverse=True) if backupbase.is_dir() else []
  if not backups:raise SystemExit('STOP: no R1286 backup')
  bk=backups[0]
  for n in FILES:
   p=root/n
   if not p.is_file() or sha(p)!=MANIFEST['new_sha256'][n]:raise SystemExit('STOP: changed since install; refusing rollback: '+n)
  for n,h in MANIFEST['base_sha256'].items():
   if not (bk/n).is_file() or sha(bk/n)!=h:raise SystemExit('STOP: invalid backup: '+n)
  if a.check:print('ROLLBACK CHECK OK:',bk);return
  for n in MANIFEST['base_sha256']:atomic(bk/n,root/n)
  for n in FILES[2:]: (root/n).unlink()
  print('ROLLBACK OK: R1285 HTML and homepage restored, R1286 modules removed');return
 status=[(root/n).is_file() and sha(root/n)==MANIFEST['new_sha256'][n] for n in FILES]
 if all(status):print('ALREADY INSTALLED R1286');return
 if any(status) and not all(status):raise SystemExit('STOP: partial R1286 installation; inspect manually')
 for n,h in MANIFEST['base_sha256'].items():
  p=root/n
  if not p.is_file() or sha(p)!=h:raise SystemExit('STOP: requires exact R1285 website: '+n)
 for n,h in MANIFEST['dependencies_sha256'].items():
  p=root/n
  if not p.is_file() or sha(p)!=h:raise SystemExit('STOP: incorrect R1285 dependency: '+n)
 for n in FILES[2:]:
  if (root/n).exists():raise SystemExit('STOP: new file already exists: '+n)
 if a.check:print('CHECK OK: exact R1285, game-only R1286 install available');return
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 bk=backupbase/('PRE-R1286-'+stamp)
 bk.mkdir(parents=True,exist_ok=False)
 for n in MANIFEST['base_sha256']:
  (bk/n).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/n,bk/n)
 (bk/'manifest.json').write_text(json.dumps(MANIFEST,ensure_ascii=False,indent=2),'utf8')
 try:
  for n in FILES[2:]:atomic(SOURCE/n,root/n)
  atomic(SOURCE/FILES[0],root/FILES[0])
  atomic(SOURCE/FILES[1],root/FILES[1])
 except Exception:
  for n in MANIFEST['base_sha256']:atomic(bk/n,root/n)
  for n in FILES[2:]:
   p=root/n
   if p.is_file() and sha(p)==MANIFEST['new_sha256'][n]:p.unlink()
  raise
 print('INSTALL OK: R1286, Portrait first, mobile orientation unblocked')
 print('BACKUP:',bk)
 print('Rollback: python3',SOURCE/'game-r1286-tools/install-game.py','--root',root,'--rollback')
if __name__=='__main__':main()
