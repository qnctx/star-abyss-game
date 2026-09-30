"""Deliver the actual original and locally edited C2 character without API calls."""
import json,sys,datetime,subprocess,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'artifacts/c2-lux3d-20260912-r2'
skill=Path.home()/'.codex/plugins/cache/openai-curated-remote/aholo-lux3d/0.1.0/skills/lux3d'
sys.path.insert(0,str(skill/'core/runtime'))
from artifact_delivery import inspect_artifact
game=out/'c2-native.glb'
inspection=inspect_artifact(str(game),'glb',require_embedded_glb=True)
(out/'native-inspection.json').write_text(json.dumps(inspection,indent=2),encoding='utf-8')
source=json.loads((out/'source-state.json').read_text());derived=dict(source)
stamp=datetime.datetime.fromtimestamp(game.stat().st_mtime,datetime.timezone.utc).isoformat()
derived.update(expectedFormats=['glb'],downloadedArtifacts=[{'path':str(game),'format':'glb'}],updatedAt=stamp,localCompletedAt=stamp,
 localProcessing={'sourceTaskId':source['taskId'],'sourceState':'source-state.json','scripts':['tools/rig-c2-native.py','tools/c2-back-detail.py','tools/export-c2-runtime.py'],
 'description':'Original proportion mesh, native joint fit, proxy weight transfer, asymmetric rear shell and original reference projection, runtime reduction. No new generation task.'})
(out/'native-state.json').write_text(json.dumps(derived,indent=2),encoding='utf-8')
spec={'schema':'lux3d.delivery-spec/v2','title':'C2 探索者 · 原图重建第二版',
 'items':[{'id':'c2-game','label':'游戏版 · 背甲修形与骨骼绑定','selectedAttemptId':'native','attempts':[{'id':'native','statePath':'native-state.json'}]},
          {'id':'c2-source','label':'aholo 原始网格 · 未修形','selectedAttemptId':'source','attempts':[{'id':'source','statePath':'source-state.json'}]}],
 'scene':{'status':'not-requested'}}
(out/'delivery-spec.json').write_text(json.dumps(spec,ensure_ascii=False,indent=2),encoding='utf-8')
subprocess.run([sys.executable,str(skill/'core/runtime/delivery_bundle.py'),'prepare','--spec',str(out/'delivery-spec.json'),'--output-dir',str(out/'delivery-reviewed'),'--locale','zh-CN'],check=True)
record={'taskId':source['taskId'],'region':'cn','referenceInput':'six lossless crops of user original; no image regeneration',
 'conversationBudget':300,'priorCommitted':44,'thisAttemptQuotedCredits':20,'totalCommitted':64,'remainingAllowance':236,
 'sourceTriangles':296158,'runtimeTriangles':67754,'bones':19,'runtimeMeshPrimitives':4,
 'gameReplacementStatus':'integrated','gameSha256':hashlib.sha256(game.read_bytes()).hexdigest(),
 'editableSource':'c2-editable.blend','backup':'previous-production.glb',
 'visualLimitations':'Closer cloth and mantle; local asymmetric back correction. Helmet contour, seam precision and reference-level surface detail remain imperfect; user visual acceptance is not claimed.',
 'validation':['pixel-identical crop check','Blender bone weights normalized','native bind and bone-length regression tests','six actual skinned motion modes checked in browser']}
(out/'production-record.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
