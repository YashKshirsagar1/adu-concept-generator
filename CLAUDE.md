# ADU Concept Generator

## What we're building
A web app that turns a prompt or rough sketch ("2-bed ADU, 800 sq ft, big kitchen") into a floor plan and a 3D model you can walk around, with a rough cost estimate and a basic city zoning check. It's for ADU and custom-home builders to show homeowners what they'd get.

It's a learning project first. If it turns out well, it could become a product.

## About me
- I have some technical knowledge but I'm not a developer yet. I'm learning by building.
- Explain new concepts in plain English, briefly, the first time they come up.
- After each change, tell me in 2–3 sentences what you changed and why, and which file and lines to look at.
- When there's a simpler way and a "proper" way, use the simpler one and mention the other in one line.
- Don't make big changes I didn't ask for. Small steps, one milestone at a time.

## Tech stack (keep it simple)
- Plain HTML + JavaScript in the browser. No frameworks or build tools until we really need them.
- Three.js for 3D, loaded from a CDN with an import map (see index.html).
- Later: the Claude API for AI generation, Vercel for hosting, Supabase for login and saved projects.

## Conventions
- Units are feet everywhere.
- Floor plan coordinates: x goes right, y goes down (top-left corner of the house is 0,0). In 3D, plan y becomes Three.js z.
- The building is data first: rooms, walls, doors and windows live in a JavaScript object or JSON, and the 3D view is drawn from that data. Never hard-code geometry that should come from the data.
- Comment code in plain English so a beginner can follow it.

## Roadmap
1. ✅ One 3D room (index.html)
2. ✅ Floor plan from data: a list of rooms, walls, doors and windows → full 3D house (plan.js)
3. ✅ AI generates the data from a typed prompt (Claude API) (generate.js)
4. ✅ Rules: square footage, rough cost (sq ft × $/sq ft), one city's ADU limits (start with Kirkland, WA) (rules.js)
5. Make it sellable: hosting, shareable link per design, login, saved projects
6. Stretch: sketch/photo upload → plan, nicer visuals, PDF export

## Current milestone
Milestone 5: make it sellable (hosting, shareable link per design, login, saved projects).
