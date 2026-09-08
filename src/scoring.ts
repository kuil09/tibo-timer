import type { EventRecord, Extraction, TemporalValue } from './types.ts';
export interface GoldCase { text:string;truncated:boolean;expected:{extraction:Extraction;temporal:Partial<TemporalValue>&{kind:TemporalValue['kind']}}; }
const phrase=(s:string)=>s.toLowerCase().replace(/\s+/g,' ').trim();
const timePhrase=(s:string)=>phrase(s).replace(/^at /,'').replace(/(\d)\s+(am|pm)\b/g,'$1$2').replace(/[.!]$/,'');
function matchesTemporal(actual:TemporalValue, expected:Partial<TemporalValue>) {
 return Object.entries(expected).every(([k,v])=>['at','from','until'].includes(k)&&typeof v==='string'?Date.parse(String(actual[k as keyof TemporalValue]))===Date.parse(v):actual[k as keyof TemporalValue]===v);
}
export function scoreCase(sample:GoldCase,event:EventRecord,extraction:Extraction|null,invocations:number,error:boolean) {
 const gold=sample.expected;
 const semantic_class_match=!!extraction&&extraction.event_type===gold.extraction.event_type&&extraction.state===gold.extraction.state;
 const production_class_match=event.event.type===gold.extraction.event_type&&event.event.state===gold.extraction.state;
 const temporal_match=matchesTemporal(event.temporal,gold.temporal);
 const evidence_match=!!extraction&&(extraction.evidence===''?extraction.event_type==='unknown'&&extraction.state==='unknown':sample.text.includes(extraction.evidence));
 // Equal unresolved outputs alone prove nothing about which source time was selected.
 const time_link_match=!!extraction&&(gold.extraction.time_expression===''?extraction.time_expression==='':
   evidence_match&&extraction.evidence.includes(extraction.time_expression)&&
   (event.temporal.kind!=='unresolved'&&temporal_match ||
    timePhrase(extraction.time_expression)===timePhrase(gold.extraction.time_expression)&&phrase(extraction.evidence).includes(phrase(gold.extraction.time_expression))));
 const strict_match=!!extraction&&semantic_class_match&&phrase(extraction.time_expression)===phrase(gold.extraction.time_expression)&&temporal_match&&evidence_match;
 const truncated_safe=sample.truncated&&invocations===0&&event.event.state==='unknown'&&event.temporal.kind==='unresolved';
 const operational_correct=sample.truncated?truncated_safe:!error&&semantic_class_match&&production_class_match&&temporal_match&&evidence_match&&time_link_match;
 return {operational_correct,semantic_class_match,production_class_match,temporal_match,evidence_match,time_link_match,strict_match,truncated_safe,
 false_completed:event.event.state==='completed'&&gold.extraction.state!=='completed',
 false_time:event.temporal.kind!=='unresolved'&&(!temporal_match||!time_link_match)};
}
