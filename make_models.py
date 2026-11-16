# Generates real binary glTF (.glb) models into client/public/models (run: python3 make_models.py)
import struct
import json
import math
from math import sin, cos, pi


def grid(f, ctr, nu, nv, wu, wv):
    I = nu if wu else nu+1
    J = nv if wv else nv+1
    P = [(i/nu, j/nv) for i in range(I) for j in range(J)]
    V = [f(a, b) for a, b in P]
    C = [ctr(a, b) for a, b in P]
    def d(i, j): return (i % I)*J+(j % J)
    T = []
    s = 0
    for i in range(nu):
        for j in range(nv):
            a, b, c, e = d(i, j), d(i+1, j), d(i+1, j+1), d(i, j+1)
            T += [(a, b, c), (a, c, e)]
    for a, b, c in T:
        u = [V[b][k]-V[a][k] for k in range(3)]
        v = [V[c][k]-V[a][k] for k in range(3)]
        n = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        s += sum(n[k]*(V[a][k]-C[a][k]) for k in range(3))
    if s < 0:
        T = [(a, c, b) for a, b, c in T]
    return V, [i for t in T for i in t]


def merge(*ms):
    V = []
    I = []
    for v, i in ms:
        I += [x+len(V) for x in i]
        V += v
    return V, I


def write(name, V, idx):
    N = [[0, 0, 0] for _ in V]
    for t in range(0, len(idx), 3):
        a, b, c = idx[t:t+3]
        u = [V[b][k]-V[a][k] for k in range(3)]
        v = [V[c][k]-V[a][k] for k in range(3)]
        f = [u[1]*v[2]-u[2]*v[1], u[2]*v[0]-u[0]*v[2], u[0]*v[1]-u[1]*v[0]]
        for x in (a, b, c):
            for k in range(3):
                N[x][k] += f[k]
    for n in N:
        l = math.sqrt(sum(c*c for c in n)) or 1
        n[:] = [c/l for c in n]
    pos = b''.join(struct.pack('<3f', *v) for v in V)
    nor = b''.join(struct.pack('<3f', *n) for n in N)
    ind = struct.pack(f'<{len(idx)}I', *idx)
    bn = pos+nor+ind
    bn += b'\0'*(-len(bn) % 4)
    acc = lambda bv, ct, t, cnt, **k: dict(bufferView=bv,
                                           componentType=ct, count=cnt, type=t, **k)
    j = dict(asset=dict(version="2.0"), scene=0, scenes=[dict(nodes=[0])], nodes=[dict(mesh=0, name=name)],
             meshes=[dict(primitives=[dict(attributes=dict(
                 POSITION=0, NORMAL=1), indices=2, material=0)])],
             materials=[dict(pbrMetallicRoughness=dict(baseColorFactor=[
                             1, 1, 1, 1], metallicFactor=.6, roughnessFactor=.3))],
             buffers=[dict(byteLength=len(bn))],
             bufferViews=[dict(buffer=0, byteOffset=0, byteLength=len(pos), target=34962), dict(buffer=0, byteOffset=len(
                 pos), byteLength=len(nor), target=34962), dict(buffer=0, byteOffset=2*len(pos), byteLength=len(ind), target=34963)],
             accessors=[acc(0, 5126, "VEC3", len(V), min=[min(v[k] for v in V) for k in range(3)], max=[max(v[k] for v in V) for k in range(3)]), acc(1, 5126, "VEC3", len(V)), acc(2, 5125, "SCALAR", len(idx))])
    js = json.dumps(j).encode()
    js += b' '*(-len(js) % 4)
    out = struct.pack('<III', 0x46546C67, 2, 28+len(js)+len(bn))+struct.pack(
        '<II', len(js), 0x4E4F534A)+js+struct.pack('<II', len(bn), 0x004E4942)+bn
    open(f'client/public/models/{name}.glb', 'wb').write(out)
    print(name, len(V), 'verts', len(out), 'bytes')


def O(a, b): return (0, 0, 0)


write('sphere', *grid(lambda a, b: (sin(pi*b)*cos(2*pi*a),
      cos(pi*b), sin(pi*b)*sin(2*pi*a)), O, 48, 24, True, False))
write('torus', *grid(lambda a, b: ((1+.35*cos(2*pi*b))*cos(2*pi*a), .35*sin(2*pi*b), (1+.35 *
      cos(2*pi*b))*sin(2*pi*a)), lambda a, b: (cos(2*pi*a), 0, sin(2*pi*a)), 64, 24, True, True))


def K(a): u = 2*pi*a; r = 2 + \
    cos(3*u); return [.33*r*cos(2*u), .33*sin(3*u), .33*r*sin(2*u)]


def knot(a, b):
    h = 1e-3
    p = K(a)
    q = K(a+h)
    m = K(a-h)
    T = [q[k]-m[k] for k in range(3)]
    l = math.sqrt(sum(x*x for x in T))
    T = [x/l for x in T]
    dd = [q[k]-2*p[k]+m[k] for k in range(3)]
    dt = sum(dd[k]*T[k] for k in range(3))
    N = [dd[k]-dt*T[k] for k in range(3)]
    l = math.sqrt(sum(x*x for x in N))
    N = [x/l for x in N]
    B = [T[1]*N[2]-T[2]*N[1], T[2]*N[0]-T[0]*N[2], T[0]*N[1]-T[1]*N[0]]
    v = 2*pi*b
    return tuple(p[k]+.2*(cos(v)*N[k]+sin(v)*B[k]) for k in range(3))


write('knot', *grid(knot, lambda a, b: tuple(K(a)), 240, 16, True, True))
write('cone', *merge(grid(lambda a, b: ((1-b)*cos(2*pi*a), -1+2*b, (1-b)*sin(2*pi*a)), lambda a, b: (0, -1+2*b, 0), 48, 8, True, False),
                     grid(lambda a, b: (b*cos(2*pi*a), -1, b*sin(2*pi*a)), O, 48, 1, True, False)))


def face(ax, sg):
    def f(a, b):
        p = [0, 0, 0]
        o = [k for k in range(3) if k != ax]
        p[ax] = sg*.75
        p[o[0]] = (2*a-1)*.75
        p[o[1]] = (2*b-1)*.75
        return tuple(p)
    return grid(f, O, 1, 1, False, False)


write('box', *merge(*[face(ax, sg) for ax in range(3) for sg in (1, -1)]))
