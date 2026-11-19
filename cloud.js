// =====================================================================
// cloud.js — everything that talks to Supabase (login + saved designs).
//
// index.html calls these small functions and shows the results. Each one
// either returns what you asked for or throws an Error with a plain-English
// message (so the page can show it).
//
// Remember: the database itself decides who may see what (Row Level
// Security). These functions just ask; they can't get around those rules.
// =====================================================================

let _clientPromise = null;

// Load the Supabase library the first time we need it (the import map in
// index.html says where it comes from), and make ONE shared connection.
// We store the *promise* (not the finished client) so that two callers asking at the
// same moment share one connection instead of each creating their own.
function cloud() {
  if (!_clientPromise) {
    _clientPromise = import("@supabase/supabase-js").then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_KEY));   // from supabase-config.js
  }
  return _clientPromise;
}

// If a Supabase call came back with an error, turn it into a normal Error.
function check({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

// ---------------------------------------------------------------------
// LOGIN
// ---------------------------------------------------------------------
async function cloudSignUp(email, password) {
  const db = await cloud();
  const data = check(await db.auth.signUp({ email, password }));
  // If email confirmation were switched on, there'd be no session yet.
  return { needsEmailConfirmation: !data.session };
}

async function cloudSignIn(email, password) {
  const db = await cloud();
  check(await db.auth.signInWithPassword({ email, password }));
}

async function cloudSignOut() {
  const db = await cloud();
  const { error } = await db.auth.signOut();
  if (error) throw new Error(error.message);
}

// Who is logged in right now? (null = nobody). Supabase remembers the login in this browser.
async function cloudUser() {
  const db = await cloud();
  const { data } = await db.auth.getSession();
  return data.session ? data.session.user : null;
}

// Call "callback(user)" now and every time someone logs in or out.
async function cloudOnAuthChange(callback) {
  const db = await cloud();
  db.auth.onAuthStateChange((_event, session) => callback(session ? session.user : null));
}

// ---------------------------------------------------------------------
// SAVED DESIGNS
// ---------------------------------------------------------------------

// Save a plan as a NEW design owned by the logged-in user.
async function cloudSaveDesign(name, plan) {
  const db = await cloud();
  return check(await db.from("designs").insert({ name, plan }).select("id, name, is_public, updated_at").single());
}

// The logged-in user's own designs, newest first.
// (We filter by user_id ourselves: the database also lets us READ other people's
//  public designs, and those don't belong in "My designs".)
async function cloudListDesigns() {
  const user = await cloudUser();
  if (!user) return [];
  const db = await cloud();
  return check(await db.from("designs").select("id, name, is_public, updated_at")
    .eq("user_id", user.id).order("updated_at", { ascending: false }));
}

// One design by id. Works for your own designs, or anyone's PUBLIC design. Returns null if
// it doesn't exist or you're not allowed to see it.
async function cloudLoadDesign(id) {
  const db = await cloud();
  return check(await db.from("designs").select("id, name, plan, is_public").eq("id", id).maybeSingle());
}

async function cloudSetPublic(id, isPublic) {
  const db = await cloud();
  check(await db.from("designs").update({ is_public: isPublic }).eq("id", id));
}

async function cloudDeleteDesign(id) {
  const db = await cloud();
  check(await db.from("designs").delete().eq("id", id));
}
