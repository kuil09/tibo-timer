import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCase,type GoldCase} from '../src/scoring.ts';
import type {Extraction,EventRecord} from '../src/types.ts';
const extraction:Extraction={event_type:'reset',state:'scheduled',audience:[],time_expression:'at 6pm PT today',evidence:'Usage resets at 6pm PT today',time_zone:'PT'};
const sample:GoldCase={text:extraction.evidence,truncated:false,expected:{extraction,temporal:{kind:'instant',precision:'exact',at:'2026-09-09T01:00:00Z'}}};
const event:EventRecord={id:'1',source:{text:sample.text,url:'https://example.invalid',posted_at:'2026-09-08T12:00:00Z'},event:{type:'reset',state:'scheduled',audience:[]},temporal:{kind:'instant',precision:'exact',original:extraction.time_expression,at:'2026-09-09T01:00:00Z'},interpretation:{method:'test'}};
test('equivalent normalized time passes operational scoring while exact-string metric differs',()=>{
 const score=scoreCase(sample,event,{...extraction,time_expression:'6pm PT today'},1,false);
 assert.equal(score.operational_correct,true);assert.equal(score.strict_match,false);
});
test('unresolved wrong signup deadline cannot pass as unresolved delivery',()=>{
 const source='Banked reset lands by end of day. Sign up by 8pm PT.';
 const gold={...extraction,event_type:'banked_reset' as const,time_expression:'by end of day',evidence:source,time_zone:null};
 const s:GoldCase={text:source,truncated:false,expected:{extraction:gold,temporal:{kind:'unresolved',precision:'unspecified'}}};
 const e={...event,event:{...event.event,type:'banked_reset' as const},temporal:{kind:'unresolved' as const,precision:'unspecified' as const,original:'by 8pm PT'}};
 assert.equal(scoreCase(s,e,{...gold,time_expression:'by 8pm PT'},1,false).operational_correct,false);
 assert.equal(scoreCase(s,e,gold,1,false).operational_correct,true);
});
test('does not erase by versus within meaning on unresolved expressions',()=>{
 const gold={...extraction,time_expression:'by end of day',evidence:'Reset by end of day or within a day?'};
 const s:GoldCase={text:gold.evidence,truncated:false,expected:{extraction:gold,temporal:{kind:'unresolved'}}};
 const e={...event,temporal:{kind:'unresolved' as const,precision:'unspecified' as const,original:'within a day'}};
 assert.equal(scoreCase(s,e,{...gold,time_expression:'within a day'},1,false).time_link_match,false);
});
test('truncated sources require production bypass and unknown unresolved output',()=>{
 const e={...event,event:{...event.event,state:'unknown' as const},temporal:{kind:'unresolved' as const,precision:'unspecified' as const,original:''}};
 assert.equal(scoreCase({...sample,truncated:true},e,null,0,false).operational_correct,true);
 assert.equal(scoreCase({...sample,truncated:true},e,null,1,false).operational_correct,false);
 assert.equal(scoreCase({...sample,truncated:true},event,null,0,false).operational_correct,false);
});
test('a caught inference failure cannot pass unknown gold by fallback',()=>{
 const unknown={...extraction,event_type:'unknown' as const,state:'unknown' as const,time_expression:'',evidence:''};
 const s:GoldCase={text:'nothing',truncated:false,expected:{extraction:unknown,temporal:{kind:'unresolved'}}};
 const e={...event,event:{...event.event,state:'unknown' as const},temporal:{kind:'unresolved' as const,precision:'unspecified' as const,original:''}};
 assert.equal(scoreCase(s,e,null,1,true).operational_correct,false);
});
