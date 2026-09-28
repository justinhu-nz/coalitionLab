// NZ MMP electoral engine — ported verbatim from index.html. Do NOT change the maths.
export const PALETTE = ["#1f6fd6","#d1352b","#2f9e44","#f0a020","#7048e8","#e64980","#0c8599","#e8590c","#495057","#12b886"];

function row(name, votes, elect){ return { name:name, votes:votes, elect:elect }; }

export const PRESETS = {
  poll2026: { mode:"pct", seats:120, thresh:5, coattail:true, rows:[
    row("Labour", 30, 0),
    row("National", 29, 0),
    row("Green", 12, 0),
    row("ACT", 9, 0),
    row("Opportunity (TOP)", 8, 0),
    row("NZ First", 8, 0),
    row("Te Pāti Māori", 1, 4),
    row("Tākuta Ferris (Ind)", 0, 1),
    row("Te Tai Tokerau Party", 0, 1),
    row("Others (below 5%)", 3, 0)
  ]},
  result2023: { mode:"pct", seats:120, thresh:5, coattail:true, rows:[
    row("National", 38.08, 27),
    row("Labour", 26.92, 17),
    row("Green", 11.60, 3),
    row("ACT", 8.64, 1),
    row("NZ First", 6.09, 0),
    row("Te Pāti Māori", 3.08, 6)
  ]},
  blank: { mode:"pct", seats:120, thresh:5, coattail:true, rows:[
    row("","",""), row("","",""), row("","",""), row("","","")
  ]}
};

// Sainte-Laguë highest-quotient allocation.
export function allocate(parties, seats){
  var seatsBy = {}, i;
  for(i=0;i<parties.length;i++) seatsBy[parties[i].key] = 0;
  for(var s=0;s<seats;s++){
    var bestKey=null, bestQ=-1, bestVotes=-1;
    for(i=0;i<parties.length;i++){
      var p = parties[i];
      var q = p.votes/(2*seatsBy[p.key]+1);
      if(q > bestQ + 1e-12){ bestQ=q; bestKey=p.key; bestVotes=p.votes; }
      else if(Math.abs(q-bestQ) <= 1e-9){ if(p.votes > bestVotes){ bestKey=p.key; bestVotes=p.votes; } }
    }
    seatsBy[bestKey]++;
  }
  return seatsBy;
}

// opts: {mode, seats, thresh, coattail}
export function compute(rows, opts){
  var mode = opts.mode || "pct";
  var seats = Math.max(1, parseInt(opts.seats,10)||120);
  var thr = Math.max(0, parseFloat(opts.thresh)||0);
  var coat = !!opts.coattail;

  var active = rows.filter(function(r){ return String(r.name).trim() !== ""; })
                   .map(function(r){
    return { name:String(r.name).trim(), votes:Math.max(0,parseFloat(r.votes)||0), elect:Math.max(0,parseInt(r.elect,10)||0) };
  });
  var totalVotes = active.reduce(function(a,r){ return a + r.votes; }, 0);

  active.forEach(function(r){
    r.pct = (mode==="pct") ? r.votes : (totalVotes>0 ? r.votes/totalVotes*100 : 0);
    r.qualifies = (r.pct >= thr - 1e-9) || (coat && r.elect >= 1);
  });

  var qualifiers = active.filter(function(r){ return r.qualifies && r.votes>0; })
                         .map(function(r){ return {key:r.name, votes:r.votes}; });
  var alloc = allocate(qualifiers, seats);

  var totalOverhang = 0;
  active.forEach(function(r){
    var ent = r.qualifies ? (alloc[r.name]||0) : 0;
    r.entitlement = ent;
    if(r.elect > ent){ r.list = 0; r.overhang = r.elect - ent; r.total = r.elect; totalOverhang += r.overhang; }
    else { r.list = ent - r.elect; r.overhang = 0; r.total = ent; }
  });

  active.sort(function(a,b){ return b.total - a.total || b.pct - a.pct; });
  return {
    parties: active, seats: seats, totalOverhang: totalOverhang,
    house: seats + totalOverhang, majority: Math.floor((seats+totalOverhang)/2)+1,
    totalVotes: totalVotes, mode: mode
  };
}

export function fmt(n,d){ if(!isFinite(n)) n=0; return n.toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d}); }

// Hemicycle seat layout: returns [{x,y,r,row}] normalized to a viewBox of width W, given seat count.
export function hemicycle(nSeats, opts){
  opts = opts || {};
  var rings = opts.rings || Math.max(4, Math.round(Math.sqrt(nSeats/3)));
  // distribute seats across rings proportional to ring radius
  var r0 = opts.innerRadius || 0.5; // relative
  var weights = [], i;
  for(i=0;i<rings;i++){ weights.push(r0 + (1-r0)*(i/(rings-1||1))); }
  var wsum = weights.reduce(function(a,b){return a+b;},0);
  var counts = weights.map(function(w){ return Math.max(1, Math.round(nSeats*w/wsum)); });
  // fix rounding to match nSeats
  var diff = nSeats - counts.reduce(function(a,b){return a+b;},0);
  var idx = counts.length-1;
  while(diff!==0){ counts[idx] += (diff>0?1:-1); diff += (diff>0?-1:1); idx=(idx-1+counts.length)%counts.length; }
  var seats = [];
  for(i=0;i<rings;i++){
    var cnt = counts[i], rad = weights[i];
    for(var j=0;j<cnt;j++){
      var t = cnt===1 ? Math.PI/2 : Math.PI * (j/(cnt-1)); // 0..PI (left to right along the arc, but we want angle from pi to 0)
      var ang = Math.PI - t; // pi (left) -> 0 (right)
      seats.push({ ang:ang, rad:rad, ring:i });
    }
  }
  // sort by angle (left to right) so we can assign parties in seating order
  seats.sort(function(a,b){ return b.ang - a.ang || a.rad - b.rad; });
  return seats;
}
