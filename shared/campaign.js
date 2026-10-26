// Only the approved jam mission is playable; optional harbour missions await J3.
export const CAMPAIGN = [{id:'w1m1',world:'harbour',name:'First Light at the Quays'}];
export const missionEntry = id => CAMPAIGN.find(m => m.id === id);
export function nextMission(id) {
 const index=CAMPAIGN.findIndex(m => m.id === id);
 return index<0?null:CAMPAIGN[index+1]||null;
}
