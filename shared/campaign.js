// The jam keeps M1; M2 failed its cargo-lift browser qualification.
export const CAMPAIGN = [{id:'w1m1',world:'harbour',name:'First Light at the Quays'}];
export const missionEntry = id => CAMPAIGN.find(m => m.id === id);
export function nextMission(id) {
 const index=CAMPAIGN.findIndex(m => m.id === id);
 return index<0?null:CAMPAIGN[index+1]||null;
}
