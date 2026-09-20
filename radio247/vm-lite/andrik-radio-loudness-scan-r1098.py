#!/usr/bin/env python3
import os, sys, re, json, math, subprocess, tempfile
from pathlib import Path
from datetime import datetime, timezone

DIR=Path('/var/cache/andrik-radio-r622/audio')
TARGET_I=-14
TARGET_LRA=11
TARGET_TP=-1.5


def valid_cache(mp3:Path, sidecar:Path):
    try:
        st=mp3.stat()
        row=json.loads(sidecar.read_text(encoding='utf-8'))
        if int(row.get('size',-1)) != int(st.st_size): return False
        if abs(float(row.get('mtimeMs',-999999)) - (st.st_mtime_ns/1_000_000)) > 2: return False
        for k in ('input_i','input_lra','input_tp','input_thresh','target_offset'):
            if not math.isfinite(float(row[k])): return False
        return True
    except Exception:
        return False


def analyze(mp3:Path):
    cmd=[
        '/usr/bin/ffmpeg','-hide_banner','-nostats','-loglevel','info','-re',
        '-threads','1','-filter_threads','1','-i',str(mp3),
        '-map','0:a:0','-vn','-sn','-dn',
        '-af',f'loudnorm=I={TARGET_I}:LRA={TARGET_LRA}:TP={TARGET_TP}:print_format=json',
        '-f','null','-'
    ]
    p=subprocess.run(cmd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,errors='replace')
    if p.returncode != 0:
        raise RuntimeError(f'ffmpeg exit {p.returncode}: {p.stderr[-900:]}')
    matches=re.findall(r'\{[\s\S]*?"target_offset"[\s\S]*?\}',p.stderr)
    if not matches:
        raise RuntimeError('loudnorm JSON missing')
    raw=json.loads(matches[-1])
    st=mp3.stat()
    row={
        'size':int(st.st_size),
        'mtimeMs':st.st_mtime_ns/1_000_000,
        'input_i':float(raw['input_i']),
        'input_lra':float(raw['input_lra']),
        'input_tp':float(raw['input_tp']),
        'input_thresh':float(raw['input_thresh']),
        'target_offset':float(raw['target_offset']),
        'analyzedAt':datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
    }
    for k in ('input_i','input_lra','input_tp','input_thresh','target_offset'):
        if not math.isfinite(row[k]): raise RuntimeError(f'invalid {k}')
    sidecar=Path(str(mp3)+'.r747-loudnorm.json')
    tmp=Path(str(sidecar)+'.tmp-r1098')
    tmp.write_text(json.dumps(row,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    os.replace(tmp,sidecar)
    return row


def main():
    if not DIR.is_dir():
        print(f'ERROR audio cache missing: {DIR}',flush=True)
        return 2
    files=sorted(DIR.glob('*.mp3'))
    todo=[p for p in files if not valid_cache(p,Path(str(p)+'.r747-loudnorm.json'))]
    print(f'R1098 START total={len(files)} missing={len(todo)} target={TARGET_I}LUFS TP={TARGET_TP}dBTP',flush=True)
    ok=0; fail=0
    for i,mp3 in enumerate(todo,1):
        print(f'[{i}/{len(todo)}] ANALYZE {mp3.name}',flush=True)
        try:
            r=analyze(mp3); ok+=1
            print(f'[{i}/{len(todo)}] SAVED I={r["input_i"]:.2f} LRA={r["input_lra"]:.2f} TP={r["input_tp"]:.2f} OFFSET={r["target_offset"]:+.2f}',flush=True)
        except Exception as e:
            fail+=1
            print(f'[{i}/{len(todo)}] FAILED {mp3.name}: {e}',flush=True)
    valid=sum(valid_cache(p,Path(str(p)+'.r747-loudnorm.json')) for p in files)
    print(f'R1098 DONE total={len(files)} valid={valid} new_ok={ok} failed={fail}',flush=True)
    return 0 if fail==0 else 3

if __name__=='__main__':
    raise SystemExit(main())
