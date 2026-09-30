"""Read-only mesh topology audit; no generation or implementation edits."""
from pathlib import Path
from collections import Counter
import json

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / 'godot/assets/planet-ecology-r3'
results = []
for path in sorted(ASSETS.glob('*-[012].json')):
    data = json.loads(path.read_text())
    p = data['positions']
    verts = [tuple(p[i:i+3]) for i in range(0, len(p), 3)]
    edges = Counter()
    degenerate = 0
    for i in range(0, len(verts), 3):
        a, b, c = verts[i:i+3]
        if len({a, b, c}) < 3:
            degenerate += 1
        for x, y in [(a,b), (b,c), (c,a)]:
            edges[tuple(sorted((x,y)))] += 1
    boundaries = [edge for edge, n in edges.items() if n == 1]
    results.append(dict(asset=path.stem, triangles=len(verts)//3,
                        min_y=min(v[1] for v in verts), max_y=max(v[1] for v in verts),
                        boundary_edges=len(boundaries), degenerate=degenerate,
                        lowest_boundary_y=min((v[1] for e in boundaries for v in e), default=None)))
same = []
for lod in range(3):
    a=json.loads((ASSETS/f'outcrop-{lod}.json').read_text())
    b=json.loads((ASSETS/f'floatrock-{lod}.json').read_text())
    same.append(a['positions']==b['positions'])
print(json.dumps(dict(meshes=results, floatrock_equals_outcrop=same), indent=2))
