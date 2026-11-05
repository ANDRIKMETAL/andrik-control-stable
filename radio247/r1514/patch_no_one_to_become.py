#!/usr/bin/env python3
"""Add the sixth album to the installed radio source without replacing its other patches."""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

SLOT='no-one-to-become'
MARKER='R1514-SIXTH-ALBUM-SLOT'
OFFICIAL={'illusion','ocean','trika','beyond','silent'}
ARRAY=re.compile(r'''\[(?:\s*["'][a-z0-9_-]+["']\s*,?){3,16}\s*\]''')

def patch_source(source):
    original=source
    signature=re.compile(r'function\s+radioBackgroundSlotForItemR1211\s*\(\s*item\s*\)\s*\{')
    if len(signature.findall(source))!=1:
        raise ValueError('Не найдена однозначная функция выбора фона radioBackgroundSlotForItemR1211. Рабочий файл не менялся.')
    if not re.search(r'function\s+publicStatus\s*\(',source):
        raise ValueError('Не найдена функция состояния publicStatus. Рабочий файл не менялся.')
    arrays=0
    def extend_array(match):
        nonlocal arrays
        text=match.group()
        values=re.findall(r'''["']([a-z0-9_-]+)["']''',text)
        if OFFICIAL.issubset(values) and SLOT not in values:
            arrays+=1
            return re.sub(r'''(["'])silent\1''',lambda m:m.group()+", '"+SLOT+"'",text,count=1)
        return text
    source=ARRAY.sub(extend_array,source)
    source,patterns=re.subn(r'illusion\|ocean\|trika\|beyond\|silent(?!\|no-one-to-become)',
        'illusion|ocean|trika|beyond|silent|no-one-to-become',source)
    if '// '+MARKER not in source:
        classification='''
  // R1514-SIXTH-ALBUM-SLOT: explicit album ownership precedes legacy title hints.
  if(item && String(item.type||'track')==='track'){
    const keyR1514=String(item.key||'').toLowerCase();
    const ownerR1514=String(item.pickerAlbum||item.albumSlug||'').toLowerCase();
    const albumR1514=String(item.album||'').toLowerCase().replace(/[_-]+/g,' ').replace(/\\s+/g,' ').trim();
    if(keyR1514.startsWith('albums/no-one-to-become/') || ownerR1514==='no-one-to-become' || albumR1514==='no one to become')return 'no-one-to-become';
  }
'''
        source=signature.sub(lambda m:m.group()+classification,source,count=1)
    if 'sixthAlbumSlotR1514:' not in source:
        status=re.compile(r'(function\s+publicStatus\s*\([^)]*\)\s*\{[\s\S]*?\breturn\s*\{)')
        source,n=status.subn(lambda m:m.group()+"\n    sixthAlbumSlotR1514:'no-one-to-become',",source,count=1)
        if n!=1:raise ValueError('Не удалось добавить проверку загрузки нового слота.')
    # Asset URL maps used by some studio revisions are extended only when all five
    # existing entries are flat literal asset URLs. Other object shapes are untouched.
    maps=0
    def extend_asset_map(match):
        nonlocal maps
        body=match.group(1)
        keys=set(re.findall(r'''(?:["']?)(illusion|ocean|trika|beyond|silent)(?:["']?)\s*:''',body))
        if not OFFICIAL.issubset(keys) or SLOT in body:return match.group()
        found=re.search(r'''["']?silent["']?\s*:\s*(["'])(https://andrikmetal\.com/assets/[^"']+)\1''',body)
        if not found:return match.group()
        maps+=1
        return '{'+body.rstrip().rstrip(',')+",\n  'no-one-to-become':'https://andrikmetal.com/assets/no-one-to-become-cover-r1513.webp'\n}"
    source=re.sub(r'\{([^{}]{1,12000})\}',extend_asset_map,source)
    # Validate every explicit list which already contains the five albums.
    for match in ARRAY.finditer(source):
        values=re.findall(r'''["']([a-z0-9_-]+)["']''',match.group())
        if OFFICIAL.issubset(values) and SLOT not in values:
            raise ValueError('Остался список без шестого альбома; рабочий файл не менялся.')
    if re.search(r'illusion\|ocean\|trika\|beyond\|silent(?!\|no-one-to-become)',source):
        raise ValueError('Остался шаблон пяти альбомов; рабочий файл не менялся.')
    if source==original and MARKER not in source:raise ValueError('Исходник не распознан; рабочий файл не менялся.')
    report={'revision':MARKER,'changed':source!=original,'arraysExtended':arrays,'patternsExtended':patterns,
            'assetMapsExtended':maps,'existingVideoSupport':('albumPingPongR1473' in source or (bool(re.search(r'album-loops?-r1442',source)) and bool(re.search(r'R1473',source,re.I)))),
            'sourceSha256':hashlib.sha256(original.encode()).hexdigest(),
            'patchedSha256':hashlib.sha256(source.encode()).hexdigest()}
    return source,report

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('source',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    source=args.source.read_text()
    patched,report=patch_source(source)
    check=subprocess.run(['node','--input-type=module','--check'],input=patched,text=True,capture_output=True)
    if check.returncode:raise ValueError('Проверка JavaScript не пройдена: '+check.stderr[-1500:])
    args.output.write_text(patched)
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__':main()
