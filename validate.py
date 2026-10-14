from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import subprocess, re
root=Path('/mnt/data/work_r1304')
base=Path('/mnt/data/SITE-R1303-COMPACT-FULL.zip')
full=Path('/mnt/data/SITE-R1304-SIX-WORLDS-3D-FULL.zip')
patch=Path('/mnt/data/ANDRIK-GAME-R1304-SIX-WORLDS-3D-PATCH.zip')
changed=['dreaming-of-lira.html','index.html']
added=[
 'assets/lira-3d-r1304.js',
 'assets/lira-boot-r1304.js',
 'assets/lira-i18n-r1304.js',
 'assets/city-core-r1304.js',
 'assets/city-3d-r1304.js',
 'assets/portrait-r1304.js',
 'game-refresh-r1304.html',
 'GAME-R1304-README.txt'
]
for f in changed+added:assert (root/f).is_file(),f
for f in added:
 if f.endswith('.js'):subprocess.run(['node','--check',str(root/f)],check=True)
html=(root/'dreaming-of-lira.html').read_text('utf-8')
js=(root/'assets/lira-3d-r1304.js').read_text('utf-8')
city=(root/'assets/city-core-r1304.js').read_text('utf-8')
index=(root/'index.html').read_text('utf-8')
assert "const campaignOrder=[1,'portrait',6,2,3,4]" in js
assert all(f'./{name}-r1304.js' in js for name in ['city-3d','portrait'])
assert 'renderSpace(s)' in js and 'renderTower(s)' in js and 'function renderGround(s,cam)' in js
assert "id===1?'./city-3d-r1304.js" in js
assert 'const planar=s.level>=3&&s.level<=5' in js
assert 's.level===2' in js
assert 'city===true' not in js
assert 'this.finale=.01' in city and 'this.load(3);this.race.postBoss=true' in city
assert '/assets/lira-boot-r1304.js?v=r1304' in html
assert '/assets/lira-i18n-r1304.js?v=r1304' in html
assert 'display: none !important' in html
assert '/dreaming-of-lira.html?v=r1304' in index
assert '/assets/dreaming-lira-preview-r1303.webp' in index and (root/'assets/dreaming-lira-preview-r1303.webp').is_file()
# ensure all direct import relative paths from new modules exist
for m in [root/x for x in added if x.endswith('.js')]:
 for ref in re.findall(r"(?:from\s*|import\()\s*['\"](\.\/[^'\"]+)",m.read_text()):
  target=(m.parent/ref.split('?')[0]).resolve()
  assert target.is_file(),f'{m} missing {ref}'
with ZipFile(patch,'w',ZIP_DEFLATED,compresslevel=9) as z:
 for fn in changed+added:z.write(root/fn,fn)
with ZipFile(base) as src,ZipFile(full,'w',ZIP_DEFLATED,compresslevel=9) as dst:
 old=set(src.namelist());assert set(added).isdisjoint(old)
 for info in src.infolist():
  dst.writestr(info,(root/info.filename).read_bytes() if info.filename in changed else src.read(info.filename))
 for f in added:dst.write(root/f,f,compress_type=ZIP_DEFLATED,compresslevel=9)
with ZipFile(base) as src,ZipFile(full) as z,ZipFile(patch) as pa:
 assert z.testzip() is None and pa.testzip() is None
 assert set(z.namelist())-set(src.namelist())==set(added)
 mismatches=[n for n in src.namelist() if src.getinfo(n).CRC!=z.getinfo(n).CRC]
 assert set(mismatches)==set(changed),mismatches
print('OK: imports, HTML, 3D-only renderer, six stages, new CITY boss->chase, untouched files, ZIP CRC')
for f in [patch,full]:print(f,f.stat().st_size, 'bytes')
