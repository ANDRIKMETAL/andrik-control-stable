#!/usr/bin/env python3
"""ANDRIK GAME R1285: game-only safe installer/rollback. Does not restart or modify radio."""
import argparse,datetime,hashlib,json,os,shutil,tempfile
from pathlib import Path
SOURCE=Path(__file__).resolve().parent.parent
FILES=['dreaming-of-lira.html','assets/lira-3d-r1285.js','assets/lira-ruins-r1285.js']
MANIFEST=json.loads((SOURCE/'game-r1285-tools/manifest.json').read_text(encoding='utf-8'))
def sha(path):
 h=hashlib.sha256()
 with path.open('rb') as r:
  for block in iter(lambda:r.read(1048576),b''):h.update(block)
 return h.hexdigest()
def atomic(src,dst):
 dst.parent.mkdir(parents=True,exist_ok=True)
 fd,tmp=tempfile.mkstemp(prefix='.andrik-r1285-',dir=str(dst.parent))
 try:
  with os.fdopen(fd,'wb') as output,src.open('rb') as data:
   shutil.copyfileobj(data,output)
   output.flush();os.fsync(output.fileno())
  shutil.copymode(src,tmp)
  os.replace(tmp,dst)
 finally:
  if os.path.exists(tmp):os.unlink(tmp)
def main():
 ap=argparse.ArgumentParser(description='R1285 game-only patch; no server restart')
 ap.add_argument('--root',required=True,help='Website root containing dreaming-of-lira.html')
 ap.add_argument('--check',action='store_true')
 ap.add_argument('--rollback',action='store_true')
 a=ap.parse_args();root=Path(a.root).resolve()
 if not root.is_dir() or not (root/'dreaming-of-lira.html').is_file():raise SystemExit('STOP: wrong site directory')
 backups=root/'game-r1285-backups'
 if a.rollback:
  folders=sorted(backups.glob('PRE-R1285-*'),reverse=True) if backups.is_dir() else []
  if not folders:raise SystemExit('STOP: no R1285 backup')
  backup=folders[0]
  if sha(root/'dreaming-of-lira.html')!=MANIFEST['new_html_sha256']:raise SystemExit('STOP: site changed since R1285; refusing unsafe rollback')
  for rel in FILES[1:]:
   p=root/rel
   if not p.is_file() or sha(p)!=MANIFEST['files'][rel]:raise SystemExit('STOP: game module changed: '+rel)
  if sha(backup/'dreaming-of-lira.html')!=MANIFEST['base_html_sha256']:raise SystemExit('STOP: invalid backup')
  if a.check:print('ROLLBACK CHECK OK:',backup);return
  atomic(backup/'dreaming-of-lira.html',root/'dreaming-of-lira.html')
  for rel in FILES[1:]: (root/rel).unlink()
  print('ROLLBACK OK: R1284 HTML restored; new R1285 modules removed');return
 for rel in FILES:
  if not (SOURCE/rel).is_file() or sha(SOURCE/rel)!=MANIFEST['files'][rel]:raise SystemExit('STOP: bad patch file: '+rel)
 current=sha(root/'dreaming-of-lira.html')
 if current==MANIFEST['new_html_sha256']:
  if all((root/rel).is_file() and sha(root/rel)==MANIFEST['files'][rel] for rel in FILES):
   print('ALREADY INSTALLED R1285');return
  raise SystemExit('STOP: R1285 HTML installed but modules missing/mismatched')
 if current!=MANIFEST['base_html_sha256']:raise SystemExit('STOP: requires exact R1284 site; no changes made')
 for rel,expected in MANIFEST['dependency_sha256'].items():
  p=root/rel
  if not p.is_file() or sha(p)!=expected:raise SystemExit('STOP: incorrect R1284 dependency: '+rel)
 for rel in FILES[1:]:
  if (root/rel).exists():raise SystemExit('STOP: file already exists: '+rel)
 if a.check:print('CHECK OK: exact R1284; R1285 game patch can be installed safely');return
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 backup=backups/('PRE-R1285-'+stamp)
 backup.mkdir(parents=True,exist_ok=False)
 shutil.copy2(root/'dreaming-of-lira.html',backup/'dreaming-of-lira.html')
 (backup/'manifest.json').write_text(json.dumps(MANIFEST,ensure_ascii=False,indent=2),encoding='utf8')
 try:
  # New modules first; switch HTML only after their installation succeeds.
  for rel in FILES[1:]:atomic(SOURCE/rel,root/rel)
  atomic(SOURCE/FILES[0],root/FILES[0])
 except Exception:
  if sha(root/'dreaming-of-lira.html')==MANIFEST['new_html_sha256']:
   atomic(backup/'dreaming-of-lira.html',root/'dreaming-of-lira.html')
  for rel in FILES[1:]:
   p=root/rel
   if p.exists() and sha(p)==MANIFEST['files'][rel]:p.unlink()
  raise
 print('INSTALL OK: ANDRIK GAME R1285')
 print('BACKUP:',backup)
 print('ROLLBACK: python3',SOURCE/'game-r1285-tools/install-game.py','--root',root,'--rollback')
if __name__=='__main__':main()
