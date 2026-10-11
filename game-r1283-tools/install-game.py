#!/usr/bin/env python3
"""ANDRIK GAME R1283: safe game-only upgrade, no systemctl, radio or site-wide edits."""
import argparse,datetime,hashlib,os,json,shutil,tempfile
from pathlib import Path
HERE=Path(__file__).resolve().parent.parent
FILES=['dreaming-of-lira.html', 'assets/lira-3d-r1283.js', 'assets/lira-ruins-r1283.js', 'assets/portrait-r1283.js', 'assets/portrait-core-r1283.js']
BASE_SHA='d524cbbfb5deb21e15a988b1a967cc09c33817ac9c9c9634d5979c66682e12c0'
NEW_SHA='e07cef72a76833e01aaa3bd92c1dc22e580a4a2172ab2b80d07cdec81886dcfe'
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def atomic(src,dst):
 dst.parent.mkdir(parents=True,exist_ok=True)
 fd,temporary=tempfile.mkstemp(prefix='.andrik-r1283-',dir=str(dst.parent))
 try:
  with os.fdopen(fd,'wb') as f: f.write(src.read_bytes());f.flush();os.fsync(f.fileno())
  os.replace(temporary,dst)
 finally:
  if os.path.exists(temporary):os.unlink(temporary)
def main():
 ap=argparse.ArgumentParser(description='ANDRIK GAME R1283 upgrade/rollback')
 ap.add_argument('--root',required=True,help='Folder containing the extracted game/site')
 ap.add_argument('--check',action='store_true')
 ap.add_argument('--rollback',action='store_true')
 a=ap.parse_args();root=Path(a.root).resolve()
 if not root.is_dir() or not (root/'dreaming-of-lira.html').is_file():raise SystemExit('STOP: invalid site root')
 bdir=root/'game-r1283-backups'
 if a.rollback:
  entries=sorted(bdir.glob('PRE-R1283-*'),reverse=True) if bdir.is_dir() else []
  if not entries:raise SystemExit('STOP: no R1283 backup')
  backup=entries[0];manifest=json.loads((backup/'manifest.json').read_text())
  for rel,meta in manifest['files'].items():
   dest=root/rel
   if not dest.is_file() or digest(dest)!=meta['installed_sha']:raise SystemExit('STOP: post-R1283 modifications detected in '+rel)
  if a.check:print('ROLLBACK CHECK OK:',backup);return
  for rel,meta in manifest['files'].items():
   dest=root/rel
   if meta['existed']:atomic(backup/rel,dest)
   else:dest.unlink()
  print('ROLLBACK OK:',backup);return
 for rel in FILES:
  if not (HERE/rel).is_file():raise SystemExit('STOP: missing patch file: '+rel)
 if digest(root/'dreaming-of-lira.html')==NEW_SHA:
  if all((root/f).is_file() and digest(root/f)==digest(HERE/f) for f in FILES):print('OK: R1283 already installed');return
  raise SystemExit('STOP: R1283 HTML does not match its modules')
 if digest(root/'dreaming-of-lira.html')!=BASE_SHA:raise SystemExit('STOP: base is NOT R1282. No changes made.')
 for rel in FILES[1:]:
  target=root/rel
  if target.exists() and digest(target)!=digest(HERE/rel):raise SystemExit('STOP: name conflict '+rel)
 print('CHECK OK: R1282 confirmed, only game HTML and four new JS modules will be updated')
 if a.check:return
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
 b=bdir/('PRE-R1283-'+stamp);b.mkdir(parents=True,exist_ok=False)
 manifest={'base_html_sha':BASE_SHA,'files':{}}
 for rel in FILES:
  target=root/rel;present=target.exists();manifest['files'][rel]={'existed':present,'installed_sha':digest(HERE/rel)}
  if present:
   (b/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(target,b/rel)
 (b/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf-8')
 for rel in FILES[1:]+FILES[:1]:atomic(HERE/rel,root/rel)
 print('INSTALL OK R1283; backup:',b)
 print('ROLLBACK command: python3',str(HERE/'game-r1283-tools/install-game.py'),'--root',root,'--rollback')
if __name__=='__main__':main()
