from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import urlsplit, unquote
root=Path('/mnt/data/work_r1304')
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--no-proxy-server'])
 page=b.new_page()
 def route(r):
  path=unquote(urlsplit(r.request.url).path).lstrip('/')
  fp=root/path
  if fp.is_file():
   t={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.mp3':'audio/mpeg','.woff2':'font/woff2'}.get(fp.suffix,'application/octet-stream')
   return r.fulfill(status=200,body=fp.read_bytes(),content_type=t)
  return r.fulfill(status=404,body='NO '+path)
 page.route('**/*',route)
 try:
  page.goto('https://example.com/dreaming-of-lira.html?v=r1304',timeout=5000)
  print('PAGE',page.title(),page.locator('body').inner_text()[:150])
 except Exception as e:print('FAIL',str(e)[:600])
 b.close()
