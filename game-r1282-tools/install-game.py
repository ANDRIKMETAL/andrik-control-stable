#!/usr/bin/env python3
"""Safe isolated R1282 game patch installer. No radio/service operations."""
import argparse,datetime,hashlib,json,os,shutil,tempfile
from pathlib import Path
SRC=Path(__file__).resolve().parent.parent
FILES=['dreaming-of-lira.html', 'assets/lira-3d-r1282.js', 'assets/lira-ruins-r1282.js']
OLD_SHA='7c3eb213eb279dcf7d1144d5af322ae4dcfe8d4ff2dc65fbe4d8e3c851fea60d'
NEW_SHA='d524cbbfb5deb21e15a988b1a967cc09c33817ac9c9c9634d5979c66682e12c0'
def digest(f): return hashlib.sha256(f.read_bytes()).hexdigest()
def atomic(source,dest):
    dest.parent.mkdir(parents=True,exist_ok=True)
    fd,tmp=tempfile.mkstemp(prefix='.andrik-r1282-',dir=str(dest.parent))
    try:
        with os.fdopen(fd,'wb') as handle:handle.write(source.read_bytes());handle.flush();os.fsync(handle.fileno())
        os.replace(tmp,dest)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)
def main():
    ap=argparse.ArgumentParser(description='ANDRIK GAME R1282, isolated sixth-level patch')
    ap.add_argument('--root',required=True,help='Path to EXTRACTED SITE root')
    ap.add_argument('--check',action='store_true')
    ap.add_argument('--rollback',action='store_true')
    args=ap.parse_args();site=Path(args.root).resolve()
    if not site.is_dir():raise SystemExit('STOP: site root does not exist')
    backups=site/'game-r1282-backups'
    if args.rollback:
        entries=sorted(backups.glob('PRE-R1282-*'),reverse=True) if backups.is_dir() else []
        if not entries:raise SystemExit('STOP: no backup from this installer')
        backup=entries[0];data=json.loads((backup/'manifest.json').read_text())
        # Never overwrite unexpected newer content while rolling back.
        current=site/'dreaming-of-lira.html'
        if current.exists() and digest(current)!=NEW_SHA:raise SystemExit('STOP: current game HTML is not R1282')
        for rel,meta in data['files'].items():
            dst=site/rel
            if meta['existed']:
                atomic(backup/rel,dst)
            elif dst.exists():
                if digest(dst)!=meta['installed_sha']:raise SystemExit('STOP: modified asset, manual review: '+rel)
                dst.unlink()
        print('ROLLBACK OK:',backup);return
    for rel in FILES:
        if not (SRC/rel).is_file():raise SystemExit('STOP: missing patch file '+rel)
    html=site/'dreaming-of-lira.html'
    if not html.is_file():raise SystemExit('STOP: missing original game HTML')
    current_sha=digest(html)
    if current_sha==NEW_SHA:
        if all((site/rel).is_file() and digest(site/rel)==digest(SRC/rel) for rel in FILES):
            print('OK: R1282 already installed');return
        raise SystemExit('STOP: HTML R1282 but assets differ')
    if current_sha!=OLD_SHA:raise SystemExit('STOP: unknown version of game HTML; nothing changed')
    for rel in FILES[1:]:
        d=site/rel
        if d.exists() and digest(d)!=digest(SRC/rel):raise SystemExit('STOP: new asset conflicts with an existing file: '+rel)
    print('CHECK OK: original R1281 confirmed; only 3 game files will change')
    if args.check:return
    stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    b=backups/('PRE-R1282-'+stamp);b.mkdir(parents=True,exist_ok=False)
    manifest={'base_sha':OLD_SHA,'files':{}}
    for rel in FILES:
        d=site/rel
        meta={'existed':d.exists(),'installed_sha':digest(SRC/rel)}
        manifest['files'][rel]=meta
        if d.exists():
            (b/rel).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(d,b/rel)
    (b/'manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
    # New modules first, then game HTML last to avoid a temporarily broken import.
    for rel in FILES[1:]+FILES[:1]:atomic(SRC/rel,site/rel)
    print('INSTALL OK R1282; backup:',b)
    print('ROLLBACK: python3',str(SRC/'game-r1282-tools/install-game.py'),'--root',site,'--rollback')
if __name__=='__main__':main()
