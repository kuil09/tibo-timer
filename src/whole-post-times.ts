export interface WholeTimeCandidate { id:string;text:string;start:number;end:number;time_zone:string|null; }
/** Scan the untouched entire post; no sentence boundaries or cross-sentence constraint. */
export function wholePostTimes(text:string):WholeTimeCandidate[] {
  const zone = '(?:PST|PDT|PT|UTC|[A-Za-z_]+(?:/[A-Za-z_]+)+)';
  const day = '(?:today|tomorrow|\\d{4}-\\d{2}-\\d{2})';
  const expressions = new RegExp([
    '\\b(?:in|within)\\s+(?:(?:around|about|approximately)\\s+|~\\s*)?(?:\\d+(?:\\.\\d+)?|a|an|one|two|three|four|five|six|twelve)\\s+(?:hours?|hrs?|minutes?|mins?)\\b',
    `\\b(?:(?:at|by|before|around|about|approximately)\\s+)?\\d{1,2}(?::\\d{2})?\\s*(?:am|pm)\\b(?:\\s+${zone})?(?:\\s+${day})?`,
    `\\b(?:(?:at|by|before|around|about|approximately)\\s+)?\\d{1,2}:\\d{2}\\s+${zone}(?:\\s+${day})?`,
    `\\b(?:today|tomorrow)(?:\\s+${zone})?`,
    '\\b(?:by\\s+)?end of day\\b',
    '\\bsoon\\b',
  ].join('|'), 'gi');
  return [...text.matchAll(expressions)].map((m,i)=>{
    const z=m[0].match(/\b(PST|PDT|PT|UTC|[A-Za-z_]+(?:\/[A-Za-z_]+)+)\b/i)?.[1]??null;
    return {id:`t${i}`,text:m[0],start:m.index!,end:m.index!+m[0].length,time_zone:z&&/^(PST|PDT|PT|UTC)$/i.test(z)?z.toUpperCase():z};
  });
}
