// =====================================================================
// plan.js — the BUILDING AS DATA.
//
// Nothing in this file draws anything. It only describes the house.
// index.html reads this object and builds the 3D model from it.
//
// Units: FEET.  Floor plan coordinates: x goes RIGHT, y goes DOWN.
// The top-left corner of the house is (0, 0).
//
//        x ->  0                                   32
//   y  0       +-----------------------------------+
//   |          |        LIVING / KITCHEN           |
//   v  14      +-------+----+------+---------------+
//              | BED 1 |HALL| BATH |     BED 2     |
//      25      +-------+----+------+---------------+
//
// The footprint is 32 x 25 ft = 800 sq ft.
// =====================================================================

const PLAN = {
  name: "2-Bed ADU",
  wallHeight: 9,          // floor to ceiling

  // ---------------------------------------------------------------
  // ROOMS: each room is a rectangle. (x, y) is its top-left corner,
  // w = width (left-right), h = depth (top-bottom).
  // "type" decides the floor color in the 3D view.
  // ---------------------------------------------------------------
  rooms: [
    { id: "living", name: "Living / Kitchen", type: "living", x: 0,  y: 0,  w: 32, h: 14 },
    { id: "bed1",   name: "Bedroom 1",        type: "bedroom", x: 0,  y: 14, w: 11, h: 11 },
    { id: "hall",   name: "Hallway",          type: "hallway", x: 11, y: 14, w: 4,  h: 11 },
    { id: "bath",   name: "Bathroom",         type: "bathroom", x: 15, y: 14, w: 6,  h: 11 },
    { id: "bed2",   name: "Bedroom 2",        type: "bedroom", x: 21, y: 14, w: 11, h: 11 }
  ],

  // ---------------------------------------------------------------
  // WALLS: each wall is a straight line from one point to another
  // (down the CENTER of the wall). Walls must run straight across or
  // straight up/down for now. "thickness" is in feet.
  // ---------------------------------------------------------------
  walls: [
    // Outside walls (6 inches thick), going clockwise from the top-left.
    { id: "n", from: [0, 0],   to: [32, 0],   thickness: 0.5 },   // top
    { id: "e", from: [32, 0],  to: [32, 25],  thickness: 0.5 },   // right
    { id: "s", from: [32, 25], to: [0, 25],   thickness: 0.5 },   // bottom
    { id: "w", from: [0, 25],  to: [0, 0],    thickness: 0.5 },   // left

    // Inside walls (4 inches thick).
    { id: "mid",       from: [0, 14],  to: [32, 14], thickness: 0.33 }, // living room | bedrooms, hall, bath
    { id: "bed1-hall", from: [11, 14], to: [11, 25], thickness: 0.33 },
    { id: "hall-bath", from: [15, 14], to: [15, 25], thickness: 0.33 },
    { id: "bath-bed2", from: [21, 14], to: [21, 25], thickness: 0.33 }
  ],

  // ---------------------------------------------------------------
  // DOORS: sit inside a wall. "wall" is the wall's id.
  // "offset" = how far from the wall's START point to the door's near
  // edge (a wall starts at its "from" point). "width" is the opening.
  // type "door" = a door slab;  type "opening" = an empty doorway.
  // ---------------------------------------------------------------
  doors: [
    { wall: "e",         type: "door",    offset: 4,    width: 3 },   // front door, into the living room
    { wall: "mid",       type: "opening", offset: 11.5, width: 3 },   // living room -> hallway
    { wall: "mid",       type: "door",    offset: 24,   width: 3 },   // living room -> bedroom 2
    { wall: "bed1-hall", type: "door",    offset: 2.5,  width: 3 },   // hallway -> bedroom 1
    { wall: "hall-bath", type: "door",    offset: 3,    width: 2.5 }  // hallway -> bathroom
  ],

  // ---------------------------------------------------------------
  // WINDOWS: same idea as doors, plus "sill" (height of the bottom
  // edge above the floor) and "height" (how tall the glass is).
  // ---------------------------------------------------------------
  windows: [
    // Living / kitchen
    { wall: "n", offset: 3,  width: 4, sill: 3.5, height: 3.5 },   // kitchen
    { wall: "n", offset: 12, width: 6, sill: 2.5, height: 4.5 },   // big living room window
    { wall: "n", offset: 22, width: 6, sill: 2.5, height: 4.5 },
    { wall: "e", offset: 9,  width: 3, sill: 3,   height: 4 },
    { wall: "w", offset: 15, width: 5, sill: 2.5, height: 4.5 },

    // Bedroom 1 (left wall runs bottom-to-top, so offset counts up from y = 25)
    { wall: "w", offset: 3,  width: 4, sill: 3,   height: 4 },
    { wall: "s", offset: 24, width: 4, sill: 3,   height: 4 },

    // Bathroom (small, high window for privacy)
    { wall: "s", offset: 12, width: 2, sill: 4.5, height: 2 },

    // Bedroom 2 (bottom wall runs right-to-left, so offset counts left from x = 32)
    { wall: "s", offset: 3,  width: 4, sill: 3,   height: 4 },
    { wall: "e", offset: 17, width: 3, sill: 3,   height: 4 }
  ]
};
