import pathlib, sys
sys.stdout.reconfigure(encoding='utf-8')
p = pathlib.Path(__file__).resolve().parents[3] / sys.argv[1]
lines = p.read_text(encoding='utf-8-sig').splitlines()
a, b = int(sys.argv[2]), int(sys.argv[3])
for i in range(a-1, min(b,len(lines))):
    print(f'{i+1}: {lines[i]}')
