from zipfile import ZipFile,ZIP_DEFLATED
from pathlib import Path
import hashlib
root=Path('/mnt/data/r1309work');src=Path('/mnt/data/SITE-R1308-LYRA-ABC-STORY-SOCIAL-FULL.zip')
full=Path('/mnt/data/SITE-R1309-LYRA-3D-COMBAT-FULL.zip')
patch=Path('/mnt/data/ANDRIK-GAME-R1309-LYRA-3D-COMBAT-PATCH.zip')
replace=['dreaming-of-lira.html','index.html']
added=['assets/lyra-hero-r1309.js','assets/city-3d-r1309.js','assets/portrait-r1309.js','assets/lira-3d-r1309.js','assets/lira-boot-r1309.js','game-refresh-r1309.html','README-R1309-LYRA-3D-RU.txt']
with ZipFile(src) as zi, ZipFile(full,'w',allowZip64=True) as zo:
 names=set(zi.namelist())
 for item in zi.infolist():
  if item.is_dir():zo.writestr(item,b'')
  elif item.filename in replace:zo.writestr(item,(root/item.filename).read_bytes())
  else:zo.writestr(item,zi.read(item.filename))
 for f in added:
  assert f not in names,f
  zo.write(root/f,f,compress_type=ZIP_DEFLATED,compresslevel=9)
with ZipFile(patch,'w') as zo:
 for f in replace+added:zo.write(root/f,f,compress_type=ZIP_DEFLATED,compresslevel=9)
for fn in [full,patch]:
 with ZipFile(fn) as z:
  assert z.testzip() is None
  a=z.namelist()
  assert len(a)==len(set(a))
  for f in replace+added: assert f in a
 print(fn,fn.stat().st_size,hashlib.sha256(fn.read_bytes()).hexdigest())
with ZipFile(src) as zin,ZipFile(full) as zout:
 old=set(zin.namelist())
 unchanged=old-set(replace)
 assert all(zin.getinfo(f).CRC==zout.getinfo(f).CRC for f in unchanged if not f.endswith('/'))
 print('unchanged original files:',len(unchanged),'binary-equivalent by CRC')
