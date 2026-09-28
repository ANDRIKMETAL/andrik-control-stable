#!/usr/bin/env python3
"""Read-only radio/VPS audit. Writes a redacted ZIP; never restarts services."""
import argparse, datetime, hashlib, json, os, pathlib, re, shutil, subprocess, time, urllib.request, zipfile

SERVICE='andrik-radio.service'
SOURCE=pathlib.Path('/opt/andrik-radio/radio247/server.mjs')
CACHE=pathlib.Path('/var/cache/andrik-radio-r622')
UTC=datetime.timezone.utc

def now(): return datetime.datetime.now(UTC).isoformat()
def redact(text):
    text=re.sub(r'(?i)rtmps?://[^\s\x00\"\'<>]+','rtmps://[REDACTED]',str(text))
    text=re.sub(r'(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+',r'\1[REDACTED]',text)
    text=re.sub(r'(?i)((?:YOUTUBE_STREAM_KEY|STREAM_URL_OVERRIDE|ADMIN_KEY|api[_-]?key|token|password|secret)\s*[=:]\s*)[^\s,;]+',r'\1[REDACTED]',text)
    text=re.sub(r'(?<![\w-])[a-zA-Z0-9]{4}(?:-[a-zA-Z0-9]{4}){4}(?![\w-])','[STREAM-KEY-REDACTED]',text)
    return text

def safe_obj(obj):
    if isinstance(obj,dict):
        return {k:('[REDACTED]' if re.search(r'(password|secret|token|stream.?key|authorization)',k,re.I) else safe_obj(v)) for k,v in obj.items()}
    if isinstance(obj,list):return [safe_obj(v) for v in obj]
    if isinstance(obj,str):return redact(obj)
    return obj

def read(path,limit=4*1024*1024):
    try:
        with open(path,'rb') as f:return f.read(limit).decode('utf-8','replace')
    except (OSError,PermissionError) as e:return 'UNAVAILABLE: '+type(e).__name__

def command(args,timeout=12):
    try:
        p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout,check=False)
        return redact(p.stdout.decode('utf-8','replace'))
    except Exception as e:return 'UNAVAILABLE: '+type(e).__name__+'\n'

def proc_sample():
    rows=[]
    for path in pathlib.Path('/proc').iterdir():
        if not path.name.isdigit():continue
        try:
            comm=(path/'comm').read_text().strip()
            if comm not in ('ffmpeg','ffprobe','node','nodejs'):continue
            stat=(path/'stat').read_text().rsplit(') ',1)[1].split()
            status=(path/'status').read_text()
            def field(name):
                m=re.search(r'^'+re.escape(name)+r':\s*(.+)$',status,re.M)
                return m.group(1) if m else None
            rows.append({'pid':int(path.name),'comm':comm,'ppid':int(stat[1]),'state':stat[0],
                'ticks':int(stat[11])+int(stat[12]),'start_ticks':int(stat[19]),'rss':field('VmRSS'),
                'threads':field('Threads'),'voluntary_context_switches':field('voluntary_ctxt_switches'),
                'involuntary_context_switches':field('nonvoluntary_ctxt_switches'),
                'fd_count':len(list((path/'fd').iterdir())),'io':read(path/'io',4096),
                'args':redact((path/'cmdline').read_bytes().replace(b'\0',b' ').decode('utf-8','replace'))})
        except (OSError,ValueError,IndexError):continue
    return rows

def udp():
    lines=read('/proc/net/snmp').splitlines()
    for a,b in zip(lines,lines[1:]):
        if a.startswith('Udp:') and b.startswith('Udp:'):
            return dict(zip(a.split()[1:],[int(n) for n in b.split()[1:]]))
    return {}

def local_status():
    try:
        with urllib.request.urlopen('http://127.0.0.1:8080/status',timeout=3) as r:
            return safe_obj(json.loads(r.read(2*1024*1024)))
    except Exception as e:return {'capture_error':type(e).__name__}

def snapshot():
    mem={line.split(':',1)[0]:line.split(':',1)[1].strip() for line in read('/proc/meminfo').splitlines() if ':' in line}
    return {'at':now(),'monotonic':time.monotonic(),'loadavg':read('/proc/loadavg',1000).strip(),
        'memory':{k:mem.get(k) for k in ('MemTotal','MemAvailable','SwapTotal','SwapFree','Dirty','Writeback')},
        'pressure':{k:read('/proc/pressure/'+k,4096) for k in ('cpu','memory','io')},
        'udp':udp(),'processes':proc_sample(),'status':local_status()}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--seconds',type=int,default=60)
    parser.add_argument('--hours',type=float,default=0,help='Optional long observation, e.g. 16 hours')
    parser.add_argument('--interval',type=int,default=5)
    parser.add_argument('--out',default='.')
    args=parser.parse_args()
    duration=args.hours*3600 if args.hours else args.seconds
    if not 1<=duration<=86400 or not 1<=args.interval<=300:parser.error('Duration 1 second–24 hours; interval 1–300 seconds')
    os.umask(0o077)
    parent=pathlib.Path(args.out);parent.mkdir(parents=True,exist_ok=True)
    stamp=datetime.datetime.now(UTC).strftime('%Y%m%d-%H%M%S')
    stem='ANDRIK-DIAG-R1160L-'+stamp
    work=parent/(stem+'.work');work.mkdir()
    def save(name,value):
        text=json.dumps(safe_obj(value),ensure_ascii=False,indent=2) if not isinstance(value,str) else redact(value)
        (work/name).write_text(text,encoding='utf-8')
    def journal(name):save(name,command(['journalctl','-u',SERVICE,'--since','18 hours ago','-n','25000','--no-pager','-o','short-iso'],30))
    print('Сбор диагностики без остановки эфира. Продолжительность наблюдения:',int(duration),'сек.',flush=True)
    metadata={'started':now(),'collector':'R1160L','service':SERVICE,'cpu_count':os.cpu_count(),
        'clock_ticks':os.sysconf('SC_CLK_TCK'),'duration_seconds':duration,'interval':args.interval,
        'source_sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest() if SOURCE.is_file() else None,
        'source_path':str(SOURCE),'notes':'No environment files collected. CPU percent uses one CPU=100%; load average is not CPU%. Journal limited to latest 25000 lines within 18h.'}
    save('metadata.json',metadata)
    save('service.txt',command(['systemctl','show',SERVICE,'--property=ActiveState,SubState,MainPID,NRestarts,ExecMainStartTimestamp,ActiveEnterTimestamp,MemoryCurrent,MemoryPeak,TasksCurrent,CPUUsageNSec,ControlGroup']))
    save('versions.txt',command(['node','--version'])+command(['ffmpeg','-version'])+command(['uname','-srmo']))
    save('disk.txt',command(['df','-h','/',str(CACHE)])+command(['df','-i','/',str(CACHE)]))
    save('cpu.txt',command(['lscpu']))
    save('sockets-start.txt',command(['ss','-u','-a','-n','-p'])+command(['ss','-t','-i','-n','-p','state','established','dport = :443']))
    journal('journal-start.txt')
    for name in ('r802-events.ndjson.previous','r802-events.ndjson','r802-latest.json','r803-agent-events.ndjson','r1183-metrics-16h.json'):
        f=CACHE/'diagnostics'/name
        if f.is_file():save(name,read(f))
    first=None;last=None;previous=None;max_cpu=0;max_rss={};samples=0;start=time.monotonic();target=start
    try:
        with (work/'samples.ndjson').open('w',encoding='utf-8') as stream:
            while True:
                snap=snapshot()
                if first is None:first=snap
                if previous:
                    before={(r['pid'],r['start_ticks']):r for r in previous['processes']}
                    elapsed=snap['monotonic']-previous['monotonic']
                    for row in snap['processes']:
                        old=before.get((row['pid'],row['start_ticks']))
                        row['cpu_percent_one_core']=round(100*(row['ticks']-old['ticks'])/metadata['clock_ticks']/elapsed,2) if old else None
                    total=sum(r.get('cpu_percent_one_core') or 0 for r in snap['processes'])
                    snap['total_media_cpu_percent_one_core']=round(total,2);max_cpu=max(max_cpu,total)
                stream.write(json.dumps(snap,ensure_ascii=False)+'\n');stream.flush()
                samples+=1;last=snap;previous=snap
                if time.monotonic()-start>=duration:break
                target=min(target+args.interval,start+duration)
                time.sleep(max(0,target-time.monotonic()))
    except KeyboardInterrupt:
        print('Остановка сбора; сохраняю накопленные данные.',flush=True)
    save('summary.json',{'finished':now(),'samples':samples,'max_sampled_media_cpu_percent_one_core':round(max_cpu,2),
        'udp_delta':{k:last['udp'].get(k,0)-first['udp'].get(k,0) for k in last['udp']} if first and last else {},
        'interpretation':'CPU sample totals include observed ffmpeg/ffprobe/node processes. Short spikes and 12h stability cannot be proved by a 60s collection.'})
    save('status-first.json',first.get('status',{}) if first else {})
    save('status-last.json',last.get('status',{}) if last else {})
    save('sockets-end.txt',command(['ss','-u','-a','-n','-p'])+command(['ss','-t','-i','-n','-p','state','established','dport = :443']))
    journal('journal-end.txt')
    output=parent/(stem+'.zip')
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED,compresslevel=4) as z:
        for path in sorted(work.iterdir()):z.write(path,stem+'/'+path.name)
    shutil.rmtree(work)
    if os.geteuid()==0 and os.environ.get('SUDO_UID','').isdigit():
        os.chown(output,int(os.environ['SUDO_UID']),int(os.environ.get('SUDO_GID',os.environ['SUDO_UID'])))
    print('ГОТОВО:',output,flush=True)
    print('Пришлите этот ZIP. Эфир и настройки не изменялись.',flush=True)
if __name__=='__main__':main()
