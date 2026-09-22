// 22 September 2026, 00:00 in Adelaide (UTC+09:30).
const START='2026-09-21T14:30:00.000Z';
const LABEL='22 Sep 2026';
function windowFor(period) {
  return {start:period.start<START?START:period.start,end:period.end,status:period.end<=START?'unavailable':period.start<START?'partial':'available'};
}
module.exports={START,LABEL,windowFor};
