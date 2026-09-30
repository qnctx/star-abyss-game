/** Receipt and stamina are serialized together in the same legacy save value. */
export function applyStaminaGrant(stamina,receipt,worldId,grant){
  if(!worldId||!Number.isSafeInteger(grant?.sequence)||grant.sequence<=0||!Number.isFinite(grant.amount)||grant.amount<0)return receipt;
  if(receipt?.worldId===worldId&&receipt.sequence>=grant.sequence)return receipt;
  stamina.value=Math.min(100,Math.max(0,stamina.value)+grant.amount);
  return {worldId,sequence:grant.sequence};
}
