# Generates 40 procedural stock images into client/public/stock + server/seed-stock.js  (run: python3 make_stock.py)
import random
import json
import os
from math import sin, cos, pi
os.makedirs('client/public/stock', exist_ok=True)
W, H = 1200, 800
PAL = {'sunset': ['#ff7e5f', '#feb47b', '#ff4fd8', '#3b1a5a', '#1b1035'], 'ocean': ['#00d4ff', '#0077ff', '#7c5cff', '#031b34', '#00f5d4'], 'forest': ['#3ddc97', '#0f9d58', '#134e4a', '#052e2b', '#d9f99d'],
       'candy': ['#ff4fd8', '#ffb84d', '#7c5cff', '#1a1033', '#00d4ff'], 'mono': ['#e8e8ff', '#9fb3c8', '#5b6b8c', '#1a2238', '#0b0b16'], 'ember': ['#ff5c5c', '#ffb84d', '#7a1f3d', '#240b1e', '#ff9f1c'],
       'aurora': ['#00f5d4', '#7c5cff', '#3ddc97', '#0b1026', '#00d4ff'], 'gold': ['#ffd166', '#ef476f', '#7c5cff', '#0b0b16', '#06d6a0']}


def S(
    b, d=''): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" preserveAspectRatio="xMidYMid slice"><defs>{d}</defs>{b}</svg>'


def LG(i, st, x2=0, y2=1): return f'<linearGradient id="{i}" x1="0" y1="0" x2="{x2}" y2="{y2}">'+''.join(
    f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in st)+'</linearGradient>'
def RG(
    i, c, a=.9): return f'<radialGradient id="{i}"><stop offset="0" stop-color="{c}" stop-opacity="{a}"/><stop offset="1" stop-color="{c}" stop-opacity="0"/></radialGradient>'


def rect(f, x=''): return f'<rect width="{W}" height="{H}" fill="{f}" {x}/>'


def stars(r, n=90): return ''.join(
    f'<circle cx="{r.randint(0, W)}" cy="{r.randint(0, H*2//3)}" r="{r.choice([1, 1, 1.5, 2])}" fill="#fff" opacity="{r.uniform(.3, .9):.2f}"/>' for _ in range(n))


def ridge(r, base, amp, col, op=1, n=24):
    pts = [(i*W/n, base+r.uniform(-amp, amp)) for i in range(n+1)]
    return f'<path d="M0,{H} L'+' L'.join(f'{x:.0f},{y:.0f}' for x, y in pts)+f' L{W},{H}Z" fill="{col}" opacity="{op}"/>'


def blob(r, cx, cy, rad, n=7):
    p = [(cx+rad*(1+r.uniform(-.35, .35))*cos(2*pi*i/n), cy+rad *
          (1+r.uniform(-.35, .35))*sin(2*pi*i/n)) for i in range(n)]
    d = f'M{(p[0][0]+p[-1][0])/2:.0f},{(p[0][1]+p[-1][1])/2:.0f}'
    for i in range(n):
        q = p[(i+1) % n]
        d += f' Q{p[i][0]:.0f},{p[i][1]:.0f} {(p[i][0]+q[0])/2:.0f},{(p[i][1]+q[1])/2:.0f}'
    return d+'Z'


def mesh(P, r):
    d = LG('b', [(0, P[3], 1), (1, P[4], 1)], 1, 1) + \
        ''.join(RG(f'g{i}', c) for i, c in enumerate(P))
    return S(rect('url(#b)')+''.join(f'<circle cx="{r.randint(0, W)}" cy="{r.randint(0, H)}" r="{r.randint(380, 640)}" fill="url(#g{i})"/>' for i in range(5)), d)


def aurora(P, r):
    d = LG('b', [(0, '#02040f', 1), (1, P[3], 1)])+''.join(
        LG(f'a{k}', [(0, P[k], 0), (.5, P[k], .7), (1, P[k], 0)]) for k in range(3))
    b = rect('url(#b)')+stars(r, 120)
    for k in range(3):
        y0 = r.randint(150, 350)+k*70
        ph = r.uniform(0, 6)
        amp = r.randint(40, 90)
        top = [(x, y0+amp*sin(x/170+ph)) for x in range(0, W+1, 40)]
        bot = [(x, y+r.randint(150, 260)) for x, y in reversed(top)]
        b += f'<polygon points="' + \
            ' '.join(f'{x},{y:.0f}' for x, y in top+bot) + \
            f'" fill="url(#a{k})" opacity=".8"/>'
    return S(b+ridge(r, 640, 50, '#04060f')+ridge(r, 720, 40, '#02030a'), d)


def landscape(P, r):
    d = LG('b', [(0, P[3], 1), (.7, P[0], 1), (1, P[1], 1)]) + \
        RG('s', '#fff', .95)+RG('h', P[1], .6)
    sx, sy = r.randint(300, 900), r.randint(330, 430)
    b = rect('url(#b)') + \
        f'<circle cx="{sx}" cy="{sy}" r="260" fill="url(#h)"/><circle cx="{sx}" cy="{sy}" r="60" fill="url(#s)"/>'
    for i, c in enumerate([P[2], P[3], P[4], '#05050a']):
        b += ridge(r, 380+i*95, 70-i*8, c, [.55, .75, .9, 1][i])
    return S(b, d)


def ocean(P, r):
    d = LG('b', [(0, P[4], 1), (1, P[0], 1)])+LG('w', [(0, P[1], 1),
                                                       (1, P[3], 1)])+RG('h', '#fff', .9)+RG('g', P[1], .7)
    sx = r.randint(450, 750)
    b = rect('url(#b)') + \
        f'<circle cx="{sx}" cy="470" r="300" fill="url(#g)"/><circle cx="{sx}" cy="470" r="70" fill="url(#h)"/><rect y="470" width="{W}" height="330" fill="url(#w)"/>'
    for i in range(22):
        w = max(30, 210-i*8)*r.uniform(.6, 1.1)
        b += f'<rect x="{sx-w/2:.0f}" y="{480+i*15}" width="{w:.0f}" height="4" rx="2" fill="#fff" opacity="{.7-i*.03:.2f}"/>'
    return S(b, d)


def planets(P, r):
    px, py, pr = r.randint(380, 820), r.randint(300, 500), r.randint(190, 260)
    d = RG('bg', P[3], 1)+LG('p', [(0, P[0], 1), (1, P[2], 1)], 1, 1)+RG('sh',
                                                                         '#000', .8)+f'<clipPath id="c"><circle cx="{px}" cy="{py}" r="{pr}"/></clipPath>'
    b = rect('#04040c') + \
        '<circle cx="600" cy="400" r="700" fill="url(#bg)" opacity=".5"/>'+stars(
            r, 140)
    b += f'<ellipse cx="{px}" cy="{py}" rx="{pr*1.7:.0f}" ry="{pr*.38:.0f}" fill="none" stroke="{P[1]}" stroke-width="14" opacity=".55" transform="rotate({r.randint(-25, -10)} {px} {py})"/>'
    b += f'<circle cx="{px}" cy="{py}" r="{pr}" fill="url(#p)"/><circle cx="{px+pr*.4:.0f}" cy="{py+pr*.35:.0f}" r="{pr}" fill="url(#sh)" clip-path="url(#c)"/><circle cx="{r.randint(80, 300)}" cy="{r.randint(500, 700)}" r="38" fill="{P[4]}" opacity=".9"/>'
    return S(b, d)


def city(P, r):
    d = LG('b', [(0, P[3], 1), (.8, P[2], 1), (1, P[1], 1)])+RG('g', P[1], .8)
    b = rect('url(#b)') + \
        f'<circle cx="{r.randint(300, 900)}" cy="430" r="260" fill="url(#g)"/>' + \
        stars(r, 50)
    for col, hmin, hmax, wins in [('#241a3f', 120, 380, False), ('#0c0a18', 160, 520, True)]:
        x = -20
        while x < W:
            w = r.randint(55, 120)
            h = r.randint(hmin, hmax)
            y = H-h
            b += f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{col}"/>'
            if wins:
                for wy in range(y+16, H-16, 26):
                    for wx in range(x+10, x+w-14, 20):
                        if r.random() < .35:
                            b += f'<rect x="{wx}" y="{wy}" width="9" height="12" fill="{r.choice([P[0], P[1], "#fff"])}" opacity=".85"/>'
            x += w+r.randint(0, 12)
    return S(b, d)


def blobs(P, r):
    d = LG('b', [(0, P[3], 1), (1, P[4], 1)], 1, 1)
    b = rect('url(#b)')
    for i in range(6):
        c1, c2 = r.sample(P[:3]+[P[4]], 2)
        d += LG(f'k{i}', [(0, c1, 1), (1, c2, 1)], 1, 1)
        b += f'<path d="{blob(r, r.randint(100, 1100), r.randint(100, 700), r.randint(150, 300))}" fill="url(#k{i})" opacity="{r.uniform(.6, .9):.2f}"/>'
    return S(b, d)


def pattern(k, P, r):
    A, B, bg = P[0], P[1], P[3]
    t = {'dots': f'<circle cx="40" cy="40" r="12" fill="{A}"/><circle cx="0" cy="0" r="5" fill="{B}"/><circle cx="80" cy="80" r="5" fill="{B}"/>', 'tri': f'<polygon points="40,10 70,66 10,66" fill="{A}"/><polygon points="40,30 56,58 24,58" fill="{bg}"/>',
         'waves': f'<path d="M0,40 Q20,10 40,40 T80,40" stroke="{A}" stroke-width="7" fill="none"/><path d="M0,70 Q20,40 40,70 T80,70" stroke="{B}" stroke-width="5" fill="none"/>', 'cross': f'<rect x="34" y="10" width="12" height="60" rx="4" fill="{A}"/><rect x="10" y="34" width="60" height="12" rx="4" fill="{B}"/>',
         'rings': f'<circle cx="40" cy="40" r="28" fill="none" stroke="{A}" stroke-width="7"/><circle cx="40" cy="40" r="10" fill="{B}"/>', 'diamonds': f'<polygon points="40,6 74,40 40,74 6,40" fill="none" stroke="{A}" stroke-width="6"/><polygon points="40,26 54,40 40,54 26,40" fill="{B}"/>'}[k]
    return S(rect(bg)+rect('url(#p)'), f'<pattern id="p" width="80" height="80" patternUnits="userSpaceOnUse" patternTransform="scale({r.choice([1, 1.3, 1.6])}) rotate({r.choice([0, 0, 15, 30])})">{t}</pattern>')


def texture(P, r):
    def flt(i, c, bf, s, o):
        R, G, B = [int(c[j:j+2], 16)/255 for j in (1, 3, 5)]
        return f'<filter id="{i}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="{bf}" numOctaves="{o}" seed="{s}"/><feColorMatrix values="0 0 0 0 {R:.2f} 0 0 0 0 {G:.2f} 0 0 0 0 {B:.2f} 0 0 0 1.7 -0.45"/></filter>'
    d = flt('n1', P[0], f'{r.uniform(.004, .012):.4f} {r.uniform(.01, .03):.4f}', r.randint(
        1, 99), 5)+flt('n2', P[1], f'{r.uniform(.01, .03):.4f}', r.randint(1, 99), 4)
    return S(rect(P[3])+rect('#000', 'filter="url(#n1)"')+rect('#000', 'filter="url(#n2)" opacity=".7"'), d)


items = []


def add(slug, title, cat, pn, svg):
    n = len(items)
    open(f'client/public/stock/{slug}.svg', 'w').write(svg)
    items.append([title, cat, 'img:'+slug, PAL[pn][0],
                 6+(n*7) % 19, 250+(n*173) % 1900])


def mk(fn, cat, pns, label, slug, extra=None):
    for i, pn in enumerate(pns):
        r = random.Random(hash((slug, pn)) % 99999+i*7)
        P = PAL[pn]
        s = f'{slug}-{pn}'
        add(s, f'{pn.title()} {label}', cat, pn, fn(P, r)
            if extra is None else fn(extra[i], P, r))


mk(mesh, 'Backgrounds', ['sunset', 'ocean', 'forest',
   'candy', 'ember', 'gold'], 'Mesh Gradient', 'mesh')
mk(aurora, 'Backgrounds', ['aurora', 'ocean',
   'candy'], 'Northern Lights', 'aurora')
mk(landscape, 'Backgrounds', ['sunset', 'forest',
   'mono', 'ember'], 'Mountain Range', 'range')
mk(ocean, 'Backgrounds', ['sunset', 'gold', 'candy'], 'Ocean Horizon', 'sea')
mk(planets, 'Illustrations', ['aurora', 'ember',
   'ocean', 'candy'], 'Planet Scene', 'planet')
mk(city, 'Illustrations', ['sunset', 'ocean',
   'candy', 'mono'], 'City Skyline', 'city')
mk(blobs, 'Illustrations', ['candy', 'ocean',
   'sunset', 'aurora'], 'Liquid Shapes', 'blob')
mk(texture, 'Textures', ['ember', 'ocean', 'forest',
   'gold', 'mono', 'candy'], 'Cloud Texture', 'tex')
K = ['dots', 'tri', 'waves', 'cross', 'rings', 'diamonds']
mk(pattern, 'Graphics', ['candy', 'ocean', 'sunset',
   'aurora', 'gold', 'forest'], 'Seamless Pattern', 'pat', K)
for i, k in enumerate(K):
    items[-6+i][0] = items[-6 +
                           i][0].replace('Seamless Pattern', k.title()+' Pattern')
open('server/seed-stock.js',
     'w').write('// generated by make_stock.py\nexport const STOCK='+json.dumps(items)+';\n')
print(len(items), 'stock images')
