// =====================================================================
// generate.js — the BROWSER half of "AI generates the plan".
//
// It only passes your sentence to our server function (api/generate.js).
// The server holds the secret API key, calls Claude, checks the answer,
// and sends back a finished plan. So there's nothing secret in this file.
//
//   generatePlan(prompt, accessCode, onStatus) -> { plan, problems }
//     plan     = a house in the same shape as PLAN in plan.js
//     problems = a list of issues the server's double-check found (empty = all good)
// =====================================================================

async function generatePlan(userPrompt, accessCode, onStatus = () => {}) {
  onStatus("Designing your plan… (this can take a minute or two)");

  const response = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: userPrompt, accessCode })
  });

  // The server always answers with JSON; if it somehow doesn't, fall back to an empty object.
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Server error (${response.status})`);
  return data;
}
