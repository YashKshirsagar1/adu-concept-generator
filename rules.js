// =====================================================================
// rules.js — square footage, rough cost, and a basic zoning check.
//
// Like plan.js, the RULES are data (CITY_RULES). The functions below just
// compare a plan to that data. To support another city later, add another
// entry to CITY_RULES — no other code needs to change.
//
// Units: feet and square feet.
// =====================================================================

const CITY_RULES = {
  kirkland: {
    name: "Kirkland, WA",
    lastChecked: "2026-11-18",
    // These numbers come from a third-party summary of the city code (aduzoning.org),
    // because the city's own pages blocked our lookup. VERIFY WITH THE CITY before relying on them.
    sources: "KZC 115.07, 115.42, 15.30.060; Ordinances O-4905 and O-4948",

    adu: {
      maxSqFt: 1200,       // max gross floor area of one ADU, attached or detached (KZC 115.07(4))
      maxHeight: 25,       // feet above average building elevation, in RS zones (KZC 115.07(5))
      maxPerLot: 2,        // two ADUs per single-family lot
      parkingRequired: false  // none, since Sept 26, 2026 (Ordinance O-4948)
    },

    // Distances the building must stay back from the lot lines (RS zone). KZC 15.30.060.
    setbacks: {
      front: 20,
      rear: 10,        // can drop to 5 ft for some detached ADUs; we use the safe number
      side: 5,         // each side...
      sideTotal: 15    // ...but the two sides together must be at least this
    },

    // Rough build cost, in dollars per square foot. Seattle-area builders quote roughly
    // $350–$650 for a detached ADU in 2026 (sources disagree); this is a middle value.
    costPerSqFt: 450,
    costRange: 0.2     // show the estimate as ±20%
  }
};

// ---------------------------------------------------------------------
// Total floor area: add up every room's width x depth.
// ---------------------------------------------------------------------
function totalSqFt(plan) {
  return plan.rooms.reduce((sum, r) => sum + r.w * r.h, 0);
}

// The size of the smallest rectangle that holds the whole house.
function footprintSize(plan) {
  const minX = Math.min(...plan.rooms.map(r => r.x));
  const minY = Math.min(...plan.rooms.map(r => r.y));
  const maxX = Math.max(...plan.rooms.map(r => r.x + r.w));
  const maxY = Math.max(...plan.rooms.map(r => r.y + r.h));
  return { w: maxX - minX, d: maxY - minY };
}

// ---------------------------------------------------------------------
// Rough cost = square feet x dollars per square foot (plus a low/high range).
// ---------------------------------------------------------------------
function estimateCost(sqFt, perSqFt, rangePct) {
  const mid = sqFt * perSqFt;
  return { low: mid * (1 - rangePct), mid, high: mid * (1 + rangePct) };
}

// ---------------------------------------------------------------------
// Zoning check. Returns a list of results, each one:
//   { status: "pass" | "fail" | "info", text: "..." }
// "info" = we can't check it from the plan alone, but you should know about it.
// lot = { w, d } in feet, or null if the lot size is unknown.
// ---------------------------------------------------------------------
function checkZoning(plan, city, lot) {
  const results = [];
  const sqFt = Math.round(totalSqFt(plan));
  const fp = footprintSize(plan);

  // 1. Size
  results.push(sqFt <= city.adu.maxSqFt
    ? { status: "pass", text: `Size: ${sqFt} sq ft is within the ${city.adu.maxSqFt} sq ft ADU limit.` }
    : { status: "fail", text: `Size: ${sqFt} sq ft is over the ${city.adu.maxSqFt} sq ft ADU limit by ${sqFt - city.adu.maxSqFt} sq ft.` });

  // 2. Height (we only know the wall height; the roof isn't modeled yet)
  results.push(plan.wallHeight <= city.adu.maxHeight
    ? { status: "pass", text: `Height: ${plan.wallHeight} ft walls, limit is ${city.adu.maxHeight} ft to the roof peak (roof not modeled yet).` }
    : { status: "fail", text: `Height: ${plan.wallHeight} ft walls already exceed the ${city.adu.maxHeight} ft limit.` });

  // 3. Does the footprint fit inside the setbacks of the lot?
  if (lot && lot.w > 0 && lot.d > 0) {
    const s = city.setbacks;
    const buildW = lot.w - Math.max(s.sideTotal, 2 * s.side);   // lot width minus side yards
    const buildD = lot.d - s.front - s.rear;                    // lot depth minus front and rear yards
    const fitsAsIs    = fp.w <= buildW && fp.d <= buildD;
    const fitsTurned  = fp.w <= buildD && fp.d <= buildW;       // same house, rotated 90 degrees
    const area = `${fp.w} x ${fp.d} ft house, ${Math.max(buildW, 0)} x ${Math.max(buildD, 0)} ft buildable area on a ${lot.w} x ${lot.d} ft lot`;
    if (fitsAsIs)        results.push({ status: "pass", text: `Setbacks: fits (${area}).` });
    else if (fitsTurned) results.push({ status: "pass", text: `Setbacks: fits if the house is turned 90° (${area}).` });
    else                 results.push({ status: "fail", text: `Setbacks: does not fit (${area}).` });
  } else {
    results.push({ status: "info", text: "Setbacks: enter your lot size to check the fit." });
  }

  // 4. Things we can't check from the plan alone.
  results.push({ status: "info", text: `Units: ${city.adu.maxPerLot} ADUs are allowed per single-family lot.` });
  results.push({ status: "info", text: city.adu.parkingRequired
    ? "Parking: required." : "Parking: no parking required for ADUs." });
  results.push({ status: "info", text: "Not checked yet: lot coverage, floor-area ratio, distance from the main house, and your zone's exact rules." });

  return results;
}
