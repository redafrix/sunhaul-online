export const MACHINE_TYPES=['lever','valve','capstan','crank','winch','counterweightLift','crane','drawbridge','sluiceGate','waterwheel','mirror','prismSocket'];
export const MACHINE_ASSETS={lever:'pirate/Prop_Anchor',valve:'fantasy/Barrel_Holder',capstan:'pirate/Prop_Anchor',crank:'fantasy/Barrel_Holder',winch:'pirate/Prop_Anchor',counterweightLift:'village/Prop_Crate',crane:'harbour/Crane',drawbridge:'pirate/Environment_Dock',sluiceGate:'harbour/Warehouse',waterwheel:'fantasy/Barrel',mirror:'fantasy/Shield_Wooden',prismSocket:'fantasy/Cauldron',cradle:'fantasy/Cauldron',well:'fantasy/Cauldron',receiver:'fantasy/Cauldron',plate:'village/Prop_Crate',gate:'pirate/Prop_Anchor',shadowLock:'pirate/Characters_Skeleton',hook:'pirate/Prop_Anchor',dial:'fantasy/Shield_Wooden',runes:'fantasy/BookStand',sequence:'fantasy/Chandelier',cargoSocket:'pirate/Environment_Dock',cargo:'fantasy/Rope_1',secret:'pirate/Prop_Chest_Gold',mural:'fantasy/BookStand'};
export function objectiveDone(objective,machines,flags={}) {
 if(objective.requires&&!objective.requires.every(id=>machines[id]?.complete||flags[id]))return false;
 if(objective.flag)return !!flags[objective.flag];
 if(objective.done){const [id,field]=objective.done.split('.');return !!machines[id]?.[field];}
 return !!machines[objective.id]?.complete;
}
Object.assign(MACHINE_ASSETS,{vineNode:'nature/Plant_1_Big',hedge:'nature/Bush_Common'});
Object.assign(MACHINE_ASSETS,{iceField:'nature/RockPath_Round_Wide',loadField:'fantasy/Shield_Wooden',meltSocket:'nature/Rock_Medium_2',bell:'fantasy/Chandelier',avalanche:'nature/Rock_Medium_3'});
Object.assign(MACHINE_ASSETS,{coolingChannel:'fantasy/Bucket_Metal',steamVent:'fantasy/Cauldron'});
