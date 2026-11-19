// =====================================================================
// api/generate.js — the SERVER half of "AI generates the plan".
//
// Vercel runs this file as a "serverless function": a small program that
// wakes up when someone visits /api/generate, does its job, and goes back to sleep.
//
// Why a server? Your Anthropic API key must stay SECRET. Code in the browser
// can be read by anyone who opens the page, but code here runs on Vercel's
// computers, and the key lives in an "environment variable" there (never in the files).
//
// The page sends:   { prompt: "2-bed ADU...", accessCode: "..." }
// This sends back:  { plan: {...}, problems: [...] }   or   { error: "..." }
//
// Two environment variables must be set on Vercel:
//   ANTHROPIC_API_KEY — your Anthropic key
//   ACCESS_CODE       — a password you choose; without it, anyone on the internet
//                       could spend YOUR money by calling this function.
// =====================================================================

const crypto = require("crypto");
const Anthropic = require("@anthropic-ai/sdk");
const PLAN = require("../plan.js");      // the sample house, used as the format example

const MODEL = "claude-opus-5-5";
const MAX_PROMPT_LENGTH = 600;           // characters; keeps costs and abuse down

// ---------------------------------------------------------------------
// The SHAPE of the answer we want (a "JSON schema"). Mirrors plan.js exactly.
// ---------------------------------------------------------------------
const num = { type: "number" };
const point = { type: "array", items: num };   // [x, y]

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "wallHeight", "rooms", "walls", "doors", "windows"],
  properties: {
    name: { type: "string" },
    wallHeight: num,
    rooms: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "name", "type", "x", "y", "w", "h"],
        properties: {
          id: { type: "string" }, name: { type: "string" },
          type: { type: "string", enum: ["living", "bedroom", "bathroom", "hallway"] },
          x: num, y: num, w: num, h: num
        }
      }
    },
    walls: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["id", "from", "to", "thickness"],
        properties: { id: { type: "string" }, from: point, to: point, thickness: num }
      }
    },
    doors: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["wall", "type", "offset", "width"],
        properties: {
          wall: { type: "string" }, type: { type: "string", enum: ["door", "opening"] },
          offset: num, width: num
        }
      }
    },
    windows: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["wall", "offset", "width", "sill", "height"],
        properties: { wall: { type: "string" }, offset: num, width: num, sill: num, height: num }
      }
    }
  }
};

// ---------------------------------------------------------------------
// The instructions. Claude doesn't know our conventions, so we spell them out.
// ---------------------------------------------------------------------
function buildSystemPrompt() {
  return `You are an architect's assistant that designs small homes (ADUs and custom homes) as DATA.
Given a short description, return a floor plan as JSON in exactly the shape of the example below.

CONVENTIONS
- Units are feet. x goes right, y goes down. The top-left corner of the house is (0, 0).
- rooms: axis-aligned rectangles (x, y = top-left corner, w = width, h = depth). Room types: living (also used for open living/kitchen/dining areas), bedroom, bathroom, hallway.
- The rooms must TILE the footprint: no gaps and no overlaps. Footprint is a plain rectangle.
- walls: straight lines (from -> to) down the CENTER of the wall, either exactly horizontal or exactly vertical. Exterior walls are 0.5 thick, interior walls 0.33. Give every wall a short unique id.
- There must be a wall along every room boundary. Exterior walls go around the whole footprint clockwise from (0,0). Where an interior wall is a long straight line, use ONE wall with several openings instead of many short walls.
- doors and windows sit in a wall: "wall" is the wall id, "offset" is the distance in feet from the wall's FROM point to the opening's near edge, "width" is its size. Openings must fit inside the wall (offset + width <= wall length), must not overlap each other, and should stay at least 0.5 ft from wall ends.
- Door type "door" has a door slab; "opening" is an empty doorway (good between living space and hallway). Door widths: 2.5-3 ft (front door 3 ft). Window sill is the height of the bottom edge (usually 3 ft; 4.5 ft and small for bathrooms); sill + height must be below the wall height.
- wallHeight is 9 unless asked otherwise.

DESIGN RULES
- Match the requested square footage within about 5% (the footprint area = width x depth).
- Exactly one front door, on an exterior wall, opening into the living area (or a hallway).
- Every room must be reachable by a door or opening from the living area or a hallway. Bathrooms and bedrooms get a real door.
- Every bedroom and the living area gets at least one exterior window. Bathrooms get a small high window.
- Keep room sizes realistic: bedrooms at least 9 x 10 ft, bathrooms at least 5 x 8 ft, hallways about 3-4 ft wide.
- Give the plan a short descriptive name.

The example below shows the FORMAT only. Do NOT copy its layout, room sizes, or door and window positions. Design a fresh layout that fits this particular request, and vary the arrangement (for example a different footprint shape, room order, or entry side) when the request leaves room for it.

EXAMPLE (format reference: an 800 sq ft 2-bed ADU):
${JSON.stringify(PLAN)}`;
}

// ---------------------------------------------------------------------
// Our own double-check of the geometry. Returns a list of problems.
// ---------------------------------------------------------------------
function validatePlan(plan) {
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
    if (w.from.length !== 2 || w.to.length !== 2) { problems.push(`Wall "${w.id}" needs from and to as [x, y].`); return; }
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

// ---------------------------------------------------------------------
// Ask Claude for a plan. Returns { plan, problems }.
// ---------------------------------------------------------------------
async function generatePlan(userPrompt) {
  const client = new Anthropic();   // reads ANTHROPIC_API_KEY from the environment

  async function ask(text) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: buildSystemPrompt(),
      messages: [{ role: "user", content: text }],
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: PLAN_SCHEMA }
      }
    });
    if (response.stop_reason === "refusal") throw new UserFacingError(422, "Claude declined this request.");
    if (response.stop_reason === "max_tokens") throw new UserFacingError(422, "The answer was cut off. Try a simpler request.");
    const textBlock = response.content.find(b => b.type === "text");
    return JSON.parse(textBlock.text);
  }

  let plan = await ask(userPrompt);
  let problems = validatePlan(plan);

  // One automatic second try, telling Claude exactly what was wrong.
  if (problems.length) {
    plan = await ask(
      `${userPrompt}\n\nA previous attempt had these problems:\n- ${problems.join("\n- ")}\n\n` +
      `Previous attempt:\n${JSON.stringify(plan)}\n\nReturn a corrected, complete plan.`
    );
    problems = validatePlan(plan);
  }
  return { plan, problems };
}

// An error whose message is safe to show to the person using the page.
class UserFacingError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Compare two strings without leaking (through timing) how many characters matched.
function sameSecret(a, b) {
  const hash = s => crypto.createHash("sha256").update(String(s)).digest();
  return crypto.timingSafeEqual(hash(a), hash(b));
}

// ---------------------------------------------------------------------
// The function Vercel calls for every request to /api/generate.
// ---------------------------------------------------------------------
module.exports = async function handler(req, res) {
  try {
    if (req.method !== "POST") throw new UserFacingError(405, "Use POST.");

    if (!process.env.ANTHROPIC_API_KEY || !process.env.ACCESS_CODE)
      throw new UserFacingError(500, "The server isn't set up yet (missing ANTHROPIC_API_KEY or ACCESS_CODE).");

    const { prompt, accessCode } = req.body || {};
    if (!accessCode || !sameSecret(accessCode, process.env.ACCESS_CODE))
      throw new UserFacingError(401, "Wrong or missing access code.");

    if (typeof prompt !== "string" || !prompt.trim())
      throw new UserFacingError(400, "Describe the home you want first.");
    if (prompt.length > MAX_PROMPT_LENGTH)
      throw new UserFacingError(400, `Please keep the description under ${MAX_PROMPT_LENGTH} characters.`);

    res.status(200).json(await generatePlan(prompt.trim()));
  } catch (err) {
    if (err instanceof UserFacingError) return res.status(err.status).json({ error: err.message });
    // Anything else is unexpected. Log the details for us, but show the visitor a safe message.
    console.error(err);
    if (err instanceof Anthropic.RateLimitError)
      return res.status(429).json({ error: "Too many requests right now. Try again in a minute." });
    res.status(502).json({ error: "The AI service had a problem. Please try again." });
  }
};

// Exported so we can test the checker without calling the API.
module.exports.validatePlan = validatePlan;
