#!/usr/bin/env python3
"""Optional game-only installer. Never restarts services or changes radio files."""
import argparse,datetime,hashlib,json,os,shutil,sys,tempfile
from pathlib import Path
BASE=Path(__file__).resolve().parent.parent
FILES=['assets/portrait-core-r1280.js','assets/portrait-r1280.js','assets/portrait-r1280.css','assets/lira-3d-r1280.js','dreaming-of-lira.html']
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dest(root,name):
 p=root/name
 if p.is_symlink() or not p.resolve().is_relative_to(root):raise RuntimeError('Небезопасный путь: '+name)
 return p

def copy(src,dst):
 dst.parent.mkdir(parents=True,exist_ok=True)
 fd,n=tempfile.mkstemp(prefix='.r1280-',dir=dst.parent)
 try:
  with os.fdopen(fd,'wb') as f:f.write(src.read_bytes());f.flush();os.fsync(f.fileno())
  shutil.copymode(src,n);os.replace(n,dst)
 finally:
  if os.path.exists(n):os.unlink(n)

def main():
 ap=argparse.ArgumentParser(description='R1280 beta: игровой патч с резервной копией и откатом.')
 ap.add_argument('--root',type=Path,default=Path.cwd(),help='Каталог целевого сайта; по умолчанию текущий каталог')
 ap.add_argument('--check',action='store_true');ap.add_argument('--rollback',type=Path)
 a=ap.parse_args();root=a.root.resolve();m=json.loads((BASE/'game-r1280-tools/manifest.json').read_text())
 if a.rollback:
  backup=a.rollback.resolve();r=json.loads((backup/'rollback.json').read_text())
  if r['root']!=str(root):raise RuntimeError('Резервная копия другого каталога')
  for n in FILES:
   p=dest(root,n)
   if not p.is_file() or sha(p)!=r['installed'][n]:raise RuntimeError('Файл изменён после установки: '+n)
  if a.check:print('Откат совместим. Изменений нет.');return
  copy(backup/'dreaming-of-lira.html',dest(root,'dreaming-of-lira.html'))
  for n in FILES[:-1]:dest(root,n).unlink()
  print('Откат выполнен.');return
 for n in FILES:
  if sha(BASE/n)!=m['patch'][n]:raise RuntimeError('Повреждён пакет: '+n)
 if all(dest(root,n).is_file() and sha(dest(root,n))==m['patch'][n] for n in FILES):print('R1280 уже установлен.');return
 for n,h in m['required'].items():
  p=dest(root,n)
  if not p.is_file() or sha(p)!=h:raise RuntimeError('Исходный игровой файл отличается: '+n)
 for n in FILES[:-1]:
  if dest(root,n).exists():raise RuntimeError('Новый путь занят: '+n)
 if a.check:print('Совместимо. Ничего не изменено.');return
 backup=root.parent/('ANDRIK-GAME-BACKUP-R1280-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'));backup.mkdir(mode=0o700)
 shutil.copy2(dest(root,'dreaming-of-lira.html'),backup/'dreaming-of-lira.html');(backup/'rollback.json').write_text(json.dumps({'root':str(root),'installed':m['patch']},indent=2))
 written=[]
 try:
  for n in FILES:copy(BASE/n,dest(root,n));written.append(n)
 except Exception:
  copy(backup/'dreaming-of-lira.html',dest(root,'dreaming-of-lira.html'))
  for n in written:
   if n!='dreaming-of-lira.html':dest(root,n).unlink(missing_ok=True)
  raise
 print('R1280 beta установлен. Службы не перезапускались. Резервная копия:',backup)
 print('Откат: python3 '+repr(str(Path(__file__).resolve()))+' --root '+repr(str(root))+' --rollback '+repr(str(backup)))
if __name__=='__main__':
 try:main()
 except (OSError,ValueError,KeyError,RuntimeError) as e:print('ОШИБКА:',e,file=sys.stderr);sys.exit(1)
