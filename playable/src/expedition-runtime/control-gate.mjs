/** Set desired state before invoking input: captureChanged may synchronously re-enter refresh. */
export function createControlGate(getInput) {
  let applied=null;
  return {update({screen,menu=false,loading=false,defeated=false,capture=true}){
    const input=getInput();if(!input)return;
    const enabled=screen==='playing'&&!menu&&!loading&&!defeated;
    if(applied===enabled)return;
    applied=enabled;
    input.setEnabled(enabled,{capture:enabled&&capture});
  }};
}
