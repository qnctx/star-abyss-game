"""Package generated originals and their local Blender derivative without new API calls."""
import json, sys, datetime, subprocess, shutil
from pathlib import Path
root=Path(__file__).resolve().parents[1]
out=root/'artifacts/c2-lux3d-20260911'
skill=Path.home()/'.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.0/skills/lux3d'
sys.path.insert(0,str(skill/'core/runtime'))
from artifact_delivery import inspect_artifact
game=root/'playable/assets/characters/c2-explorer.glb'
inspection=inspect_artifact(str(game),'glb',require_embedded_glb=True)
(out/'fitted-inspection.json').write_text(json.dumps(inspection,indent=2),encoding='utf-8')
source=json.loads((out/'source-state.json').read_text())
derived=dict(source)
completed=datetime.datetime.fromtimestamp(game.stat().st_mtime,datetime.timezone.utc).isoformat()
derived.update(expectedFormats=['glb'],downloadedArtifacts=[{'path':str(game),'format':'glb'}],
               updatedAt=completed,localCompletedAt=completed,
               localProcessing={'sourceTaskId':source['taskId'],'sourceState':'source-state.json',
                                'script':'tools/prepare-c2-character.py',
                                'description':'Local proportion fitting, back shell, automatic weights, canonical bind-pose conversion and mesh reduction. No additional generation task.'})
(out/'fitted-state.json').write_text(json.dumps(derived,indent=2),encoding='utf-8')
spec={'schema':'lux3d.delivery-spec/v2','title':'C2 探索者 · 原始模型与游戏版',
      'items':[{'id':'c2-source','label':'C2 原始生成模型','selectedAttemptId':'source',
                'attempts':[{'id':'source','statePath':'source-state.json'}]},
               {'id':'c2-game','label':'C2 游戏版 · Blender 本地绑定与减面','selectedAttemptId':'fitted',
                'attempts':[{'id':'fitted','statePath':'fitted-state.json'}]}],
      'scene':{'status':'not-requested'}}
(out/'delivery-spec.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf-8')
subprocess.run([sys.executable,str(skill/'core/runtime/delivery_bundle.py'),'prepare','--spec',str(out/'delivery-spec.json'),
                '--output-dir',str(out/'delivery-final'),'--locale','zh-CN'],check=True)
record=json.loads((out/'production-record.json').read_text())
record.update(meshStatus='succeeded',gameReplacementStatus='integrated',observedAccountBalanceBefore=900,
              observedAccountBalanceAfter=856,observedBalanceDecrease=44,gameGlb=str(game.relative_to(root)),
              sourceGlbTriangles=96394,gameGlbTriangles=43992,bones=19,
              visualAcceptance='First integrated candidate; exact reference fidelity is not claimed. Helmet, cloth and back-shell finish still differ from concept.',
              validation=['GLB structural inspection','Blender import/export','6 motion modes: finite skinned bounds','offline preview and actual game third-person load'])
(out/'production-record.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
