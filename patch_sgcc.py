from pathlib import Path

# Keep the exact upstream input in this repository so rebuilding does not
# depend on another person's repository or on network availability.
UPSTREAM = Path(__file__).with_name("95598-upstream.js")
OUT = Path(__file__).with_name("95598.js")

src = UPSTREAM.read_text(encoding="utf-8")

old = 'a.data.url="".concat(w).concat(a.data.url),a.data.body=JSON.stringify(a.data.data),delete a.data.data,e.a(2,a.data)'
new = 'a.data.url="".concat(w).concat(a.data.url),a.data.headers=a.data.headers||{},a.data.headers.timestamp=String(a.data.headers.timestamp||Date.now()),a.data.headers["User-Agent"]=a.data.headers["User-Agent"]||S,a.data.headers.Origin=a.data.headers.Origin||w,a.data.headers.Referer=a.data.headers.Referer||k,a.data.headers["Accept-Language"]=a.data.headers["Accept-Language"]||"zh-CN,zh-Hans;q=0.9",a.data.data&&(a.data.data.timestamp=String(a.data.data.timestamp||a.data.headers.timestamp)),a.data.body=JSON.stringify(a.data.data),delete a.data.data,e.a(2,a.data)'

if old not in src:
    raise SystemExit("Patch anchor not found in upstream 95598.js")

src = src.replace(old, new, 1)
OUT.write_text(src, encoding="utf-8")
print(f"Wrote {OUT} ({len(src)} bytes)")
