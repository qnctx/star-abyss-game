"""Read-only product fingerprint; writes only in this report directory."""
import datetime, hashlib, json, pathlib, subprocess

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]
files = sorted((ROOT / 'godot/scripts').glob('*.gd')) + [ROOT / 'godot/project.godot']
report = {
    'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'worktree': str(ROOT),
    'head': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
    'status': subprocess.check_output(['git', 'status', '--short'], cwd=ROOT, text=True),
    'files': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest() for p in files},
    'note': 'HEAD alone does not identify this heavily dirty checkout; per-file SHA256 is mandatory.',
}
(HERE / 'baseline.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: report[k] for k in ['utc', 'head', 'worktree']}, ensure_ascii=False))
