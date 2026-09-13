from pathlib import Path
import urllib.request

UPSTREAM = "https://raw.githubusercontent.com/Yuheng0101/X/main/Tasks/95598/95598.js"
OUT = Path("95598.js")

src = urllib.request.urlopen(UPSTREAM, timeout=30).read().decode("utf-8")

old = 'a.data.url="".concat(w).concat(a.data.url),a.data.body=JSON.stringify(a.data.data),delete a.data.data,e.a(2,a.data)'
new = 'a.data.url="".concat(w).concat(a.data.url),a.data.headers=a.data.headers||{},a.data.headers.timestamp=String(a.data.headers.timestamp||Date.now()),a.data.headers["User-Agent"]=a.data.headers["User-Agent"]||S,a.data.headers.Origin=a.data.headers.Origin||w,a.data.headers.Referer=a.data.headers.Referer||k,a.data.headers["Accept-Language"]=a.data.headers["Accept-Language"]||"zh-CN,zh-Hans;q=0.9",a.data.data&&(a.data.data.timestamp=String(a.data.data.timestamp||a.data.headers.timestamp)),a.data.body=JSON.stringify(a.data.data),delete a.data.data,e.a(2,a.data)'

if old not in src:
    raise SystemExit("Patch anchor not found in upstream 95598.js")

src = src.replace(old, new, 1)
OUT.write_text(src, encoding="utf-8")
print(f"Wrote {OUT} ({len(src)} bytes)")
