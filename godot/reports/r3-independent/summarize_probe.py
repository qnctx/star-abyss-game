import collections, json, pathlib, statistics
here = pathlib.Path(__file__).resolve().parent
data = json.loads((here/'normal-time-samples.json').read_text())
groups = collections.defaultdict(list)
for row in data['rows']:
    groups[row['phase']].append(row)
summary = {'utc': data['utc'], 'changed_during_run': data['changed_during_run'], 'time_scale': data['time_scale'], 'phases': {}}
for name, rows in groups.items():
    stable = rows[20:]
    summary['phases'][name] = {
        'samples': len(rows), 'all_physics': all(r['physics'] for r in rows),
        'delta_min_max': [min(r['delta'] for r in rows),max(r['delta'] for r in rows)],
        'wall_seconds': sum(r['wall_delta'] for r in rows),
        'physics_seconds': sum(r['delta'] for r in rows),
        'stable_speed_mean': statistics.mean(r['measured_speed'] for r in stable),
        'stable_vy_mean': statistics.mean(r['velocity'][1] for r in stable),
        'pitch': rows[-1]['pitch'], 'clips': sorted(set(r['clip'] for r in rows)),
        'cast_seen': any(r['cast'] or r['pending_cast']>0 for r in rows),
        'input_observed': all(r.get('requested_keys')==r.get('observed_keys') for r in rows),
        'mouse_modes': sorted(set(r.get('mouse_mode',-1) for r in rows)),
        'feet_names': list(rows[-1]['feet']),
    }
(here/'normal-time-summary.json').write_text(json.dumps(summary,indent=2),encoding='utf-8')
print('UTC',summary['utc'],'changed',summary['changed_during_run'])
for name, phase in summary['phases'].items():
    print(name, 'speed',round(phase['stable_speed_mean'],3),'vy',round(phase['stable_vy_mean'],3),'inputs',phase['input_observed'],'mouse',phase['mouse_modes'],'cast',phase['cast_seen'])
