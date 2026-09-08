import {runTwoStage,claimPrompt,validateClaim,type StageCall} from './two-stage.ts';
export const CLAIM_V3_VERSION='claims-v3';
export const claimV3Prompt=claimPrompt+`\nAdditional distinctions:\n- Historical periods (for example, "during our previous launch") and recollections of earlier resets are retrospective, not a current completed announcement.\n- "Lands", "arrives" or "rolls out" with a forthcoming delivery time announces a schedule. "Has landed" or "has been delivered" announces completion. Read later sentences before deciding: reassurance that users are covered is not proof that a promised grant was already delivered.\n- Completion requires a direct past-delivery claim; an approximate time or the word "today" alone is not one.`;
const branch=(claims:string[],kinds:(string|null)[])=>({type:'object',additionalProperties:false,required:['claim','reset_kind'],properties:{claim:{type:'string',enum:claims},reset_kind:{enum:kinds}}});
export const claimV3Schema={oneOf:[branch(['scheduled','completed','retrospective'],['reset','banked_reset']),branch(['not_announcement','uncertain'],[null])]};
export function runClaimV3(post:Parameters<typeof runTwoStage>[0],call:StageCall){
 return runTwoStage(post,async(stage,prompt,input,schema)=>stage==='claim'?validateClaim(await call(stage,claimV3Prompt,input,claimV3Schema)):call(stage,prompt,input,schema));
}
