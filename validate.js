// =====================================================================
// validate.js — checks that a plan is safe and makes sense.
//
// Used in TWO places:
//   - the server (api/generate.js) checks Claude's answers
//   - the browser (index.html) checks plans that arrive in a share link
//
// A share link can be edited by anyone, so a plan from a link is UNTRUSTED.
// We never draw it until it passes. There are two checks:
//   1. SHAPE: is it really a plan (right fields, sensible numbers, not huge)?
//   2. GEOMETRY: do the walls, doors and rooms make sense together?
//
// validatePlan(plan) returns a list of problems. An empty list means all good.
// =====================================================================

const ROOM_TYPES = ["living", "bedroom", "bathroom", "hallway"];
const DOOR_TYPES = ["door", "opening"];
const MAX_ITEMS = 100;      // most rooms / walls / doors / windows allowed
const MAX_COORD = 500;      // feet; no number in a plan may be bigger than this

// ---------------------------------------------------------------------
// 1. SHAPE check. Returns a list of problems (empty = the shape is fine).
// ---------------------------------------------------------------------
function shapeProblems(plan) {
  const problems = [];
  const isNum = v => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= MAX_COORD;
  const isText = v => typeof v === "string" && v.length > 0 && v.length <= 60;

  if (!plan || typeof plan !== "object" || Array.isArray(plan)) return ["The plan isn't an object."];
  if (!isText(plan.name)) problems.push("name must be short text.");
  if (!isNum(plan.wallHeight)) problems.push("wallHeight must be a number.");
  ["rooms", "walls", "doors", "windows"].forEach(key => {
    if (!Array.isArray(plan[key]) || plan[key].length > MAX_ITEMS)
      problems.push(`"${key}" must be a list of at most ${MAX_ITEMS} items.`);
  });
  if (problems.length) return problems;      // can't look inside lists that aren't lists

  // Every item must be an object with the right fields.
  const check = (list, label, test) => list.forEach((item, i) => {
    if (!item || typeof item !== "object" || !test(item)) problems.push(`${label} #${i + 1} is malformed.`);
  });
  check(plan.rooms, "Room", r => isText(r.id) && isText(r.name) && ROOM_TYPES.includes(r.type) &&
    [r.x, r.y, r.w, r.h].every(isNum));
  check(plan.walls, "Wall", w => isText(w.id) && isNum(w.thickness) && w.thickness > 0 && w.thickness <= 3 &&
    Array.isArray(w.from) && w.from.length === 2 && w.from.every(isNum) &&
    Array.isArray(w.to) && w.to.length === 2 && w.to.every(isNum));
  check(plan.doors, "Door", d => isText(d.wall) && DOOR_TYPES.includes(d.type) && [d.offset, d.width].every(isNum));
  check(plan.windows, "Window", w => isText(w.wall) && [w.offset, w.width, w.sill, w.height].every(isNum));
  return problems;
}

// ---------------------------------------------------------------------
// 2. GEOMETRY check (only runs once the shape is fine).
// ---------------------------------------------------------------------
function validatePlan(plan) {
  const shape = shapeProblems(plan);
  if (shape.length) return shape;

  const problems = [];
  const wallLen = {};

  if (!(plan.wallHeight >= 7 && plan.wallHeight <= 14)) problems.push("wallHeight should be between 7 and 14 ft.");
  if (!plan.rooms.length) problems.push("There are no rooms.");

  // Rooms: positive size, and no two rooms overlap.
  plan.rooms.forEach(r => {
    if (!(r.w > 0 && r.h > 0)) problems.push(`Room "${r.id}" has no size.`);
  });
  for (let i = 0; i < plan.rooms.length; i++) {
    for (let j = i + 1; j < plan.rooms.length; j++) {
      const a = plan.rooms[i], b = plan.rooms[j];
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (overlapX > 0.01 && overlapY > 0.01) problems.push(`Rooms "${a.id}" and "${b.id}" overlap.`);
    }
  }

  // Walls: unique ids, and perfectly horizontal or vertical.
  plan.walls.forEach(w => {
    if (wallLen[w.id] !== undefined) problems.push(`Wall id "${w.id}" is used twice.`);
    const dx = w.to[0] - w.from[0], dy = w.to[1] - w.from[1];
    if (dx !== 0 && dy !== 0) problems.push(`Wall "${w.id}" is diagonal; walls must be horizontal or vertical.`);
    wallLen[w.id] = Math.hypot(dx, dy);
    if (!(wallLen[w.id] > 0)) problems.push(`Wall "${w.id}" has zero length.`);
  });

  // Doors and windows: on a real wall, inside it, and not overlapping each other.
  const openings = [
    ...plan.doors.map(d => ({ ...d, label: "Door", top: 6.67 })),
    ...plan.windows.map(w => ({ ...w, label: "Window", top: w.sill + w.height }))
  ];
  openings.forEach(o => {
    const len = wallLen[o.wall];
    if (len === undefined) { problems.push(`${o.label} refers to a wall "${o.wall}" that doesn't exist.`); return; }
    if (o.offset < 0 || o.offset + o.width > len + 0.001)
      problems.push(`${o.label} on wall "${o.wall}" (offset ${o.offset}, width ${o.width}) sticks out of the wall (length ${len}).`);
    if (o.top > plan.wallHeight - 0.3) problems.push(`${o.label} on wall "${o.wall}" is too tall for the wall.`);
  });
  openings.forEach((a, i) => openings.slice(i + 1).forEach(b => {
    if (a.wall === b.wall && Math.min(a.offset + a.width, b.offset + b.width) - Math.max(a.offset, b.offset) > 0.001)
      problems.push(`Two openings overlap on wall "${a.wall}" (near offset ${Math.max(a.offset, b.offset)}).`);
  }));

  if (!plan.doors.length) problems.push("The plan has no doors.");
  return problems;
}

// Lets the server (Node) load this file too. In the browser "module" doesn't exist, so this is skipped.
if (typeof module !== "undefined") module.exports = { validatePlan, shapeProblems };
