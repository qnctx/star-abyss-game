// G uses innate flight after unlock; Space remains the ordinary ground jump.
// A denied innate launch must not fall through to the old jet boost.
export function routeInnateTakeoff(controls,{unlocked=false,mounted=false,legacyAirborne=false}={}){
 const redirect=!!unlocked&&!mounted&&!legacyAirborne&&!!controls?.lift;
 if(!redirect)return {planet:controls,legacy:controls,redirected:false};
 return {planet:controls,legacy:{...controls,lift:false},redirected:true};
}
