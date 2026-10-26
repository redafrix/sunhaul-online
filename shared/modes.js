// Optional harbour modes remain disabled until their J3 play tests.
export const MODE_MAPS = [{id:'twin-docks',world:'harbour',name:'Sun Race · Twin Docks'},{id:'last-light-harbour',world:'harbour',name:'Last Light · Harbour'}];
export const TEAMS=['dawn','dusk'];
export const TEAM_COLORS={dawn:'#ffd06a',dusk:'#99bcff'};
export const teamSun=(snapshot,player)=>snapshot?.suns?.find(s=>s.team===player?.team)||snapshot?.sun;
