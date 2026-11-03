/**
 * In-memory Supabase test double for API route tests.
 *
 * The API routes under test no longer fall back to the mock store — they require
 * a Supabase admin client. Importing this module from a test file (via vi.mock
 * of `@/lib/supabase/admin` + `@/lib/supabase/server`) gives routes a fully
 * local client backed by the SAME mock-store arrays the tests already seed and
 * reset, so `npm test` runs hermetically: no network, no live-project mutation.
 *
 * Supported surface (only what the routes under test use):
 *  - from(table).select(...).eq/ne/in/gte/ilike/is/not/or/order/limit
 *  - single()/maybeSingle()/await (list)
 *  - insert/update/delete/upsert (+ .select()/.single() variants, onConflict)
 *  - count queries via select(cols, { count: "exact", head: true })
 *  - PostgREST-style embedded resources (alias:table(cols), nested, unique-FK to-one)
 *  - storage.from(bucket).createSignedUrl/upload/createBucket/remove
 *  - auth.admin.{getUserById,createUser,updateUserById,listUsers,deleteUser}
 */

import { getMockStore, DEMO_THERAPIST_ID } from "@/lib/supabase/mock-store";

type Row = Record<string, any>;

const TABLE_STORE: Record<string, string> = {
  profiles: "profiles",
  patients: "patients",
  home_programs: "programs",
  program_steps: "steps",
  submissions: "submissions",
  step_submissions: "stepSubmissions",
  submission_reviews: "reviews",
  step_reviews: "stepReviews",
  messages: "messages",
  ai_analyses: "aiAnalyses",
  soap_notes: "soapNotes",
  audit_events: "auditEvents",
};

const SINGULAR: Record<string, string> = {
  profiles: "profile",
  patients: "patient",
  home_programs: "program",
  program_steps: "program_step",
  submissions: "submission",
  step_submissions: "step_submission",
  submission_reviews: "review",
  step_reviews: "step_review",
  messages: "message",
  ai_analyses: "ai_analysis",
  soap_notes: "soap_note",
  audit_events: "audit_event",
};

/** Parent alias -> FK columns on the parent row pointing at the child id (to-one). */
const PARENT_FK: Record<string, string[]> = {
  program: ["program_id"],
  submission: ["submission_id"],
  review: ["review_id"],
  patient: ["patient_id"],
  step: ["program_step_id", "step_submission_id"],
  sender_profile: ["sender_id"],
  therapist_profile: ["therapist_id"],
  referenced_program: ["referenced_program_id"],
};

/** Child FKs that are UNIQUE in the schema -> embedded as a single object (PostgREST one-to-one). */
const UNIQUE_CHILD_FK = new Set(["submission_reviews.submission_id"]);

function rowsOf(table: string): Row[] {
  const key = TABLE_STORE[table];
  if (!key) return [];
  const store = getMockStore() as any;
  const arr = store[key];
  return Array.isArray(arr) ? arr : [];
}

function valEq(a: any, b: any): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (typeof a === "boolean" || typeof b === "boolean") return a === b || String(a) === String(b);
  return a === b || String(a) === String(b);
}

function ilikeMatch(value: any, pattern: string): boolean {
  const v = String(value ?? "");
  if (!pattern.includes("%") && !pattern.includes("_")) {
    return v.toLowerCase() === pattern.toLowerCase();
  }
  const rx = new RegExp(
    "^" + pattern.split("").map((ch) => {
      if (ch === "%") return ".*";
      if (ch === "_") return ".";
      return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }).join("") + "$",
    "i"
  );
  return rx.test(v);
}

type FilterFn = (row: Row) => boolean;

function parseOrCondition(cond: string): FilterFn {
  const m = cond.trim().match(/^([A-Za-z0-9_]+)\.(eq|neq|ilike|like|gte|gt|lte|lt|in|is)\.(.*)$/);
  if (!m) return () => true;
  const [, field, op, raw] = m;
  switch (op) {
    case "eq": return (r) => valEq(r[field], raw);
    case "neq": return (r) => !valEq(r[field], raw);
    case "ilike": return (r) => ilikeMatch(r[field], raw);
    case "like": return (r) => ilikeMatch(r[field], raw);
    case "gte": return (r) => r[field] != null && String(r[field]) >= raw;
    case "gt": return (r) => r[field] != null && String(r[field]) > raw;
    case "lte": return (r) => r[field] != null && String(r[field]) <= raw;
    case "lt": return (r) => r[field] != null && String(r[field]) < raw;
    case "in": {
      const vals = raw.replace(/^\(|\)$/g, "").split(",").map((s) => s.trim());
      return (r) => vals.some((v) => valEq(r[field], v));
    }
    case "is":
      return (r) => (raw === "null" ? r[field] == null : String(r[field]) === raw);
    default: return () => true;
  }
}

function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim() !== "") parts.push(cur);
  return parts;
}

type SelNode =
  | { kind: "star" }
  | { kind: "col"; name: string }
  | { kind: "rel"; alias: string; table: string; children: SelNode[] };

function parseSelect(sel: string): SelNode[] {
  // Select clauses span lines — collapse whitespace first (no string literals inside).
  const flat = sel.replace(/\s+/g, " ").trim();
  return splitTopLevel(flat)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((token): SelNode => {
      if (token === "*") return { kind: "star" };
      const rel = token.match(/^([A-Za-z0-9_]+):([A-Za-z0-9_]+)\s*(\((.*)\))?$/);
      if (rel) {
        const [, alias, table, , inner] = rel;
        return { kind: "rel", alias, table, children: inner != null ? parseSelect(inner) : [{ kind: "star" }] };
      }
      const bare = token.match(/^([A-Za-z0-9_]+)\s*\((.*)\)$/);
      if (bare) {
        const [, table, inner] = bare;
        return { kind: "rel", alias: table, table, children: parseSelect(inner) };
      }
      return { kind: "col", name: token };
    });
}

function resolveRelation(parentTable: string, parent: Row, alias: string, childTable: string): Row[] | Row | null {
  const childRows = rowsOf(childTable);
  if (childRows.length >= 0 && !(childTable in TABLE_STORE)) return null;
  // to-many: child has <parentSingular>_id
  const parentSing = SINGULAR[parentTable];
  const childFk = parentSing ? `${parentSing}_id` : "";
  const hasChildFk = childFk !== "" && childRows.some((c) => Object.prototype.hasOwnProperty.call(c, childFk));
  if (hasChildFk) {
    const matched = childRows.filter((c) => valEq(c[childFk], parent.id));
    if (UNIQUE_CHILD_FK.has(`${childTable}.${childFk}`)) {
      return matched.length > 0 ? { ...matched[0] } : null;
    }
    return matched.map((c) => ({ ...c }));
  }
  // to-one: parent holds an FK to the child id
  const candidates = PARENT_FK[alias] || [`${alias}_id`];
  for (const fk of candidates) {
    if (parent[fk] != null) {
      const found = childRows.find((c) => valEq(c.id, parent[fk]));
      return found ? { ...found } : null;
    }
  }
  return null;
}

function projectRow(table: string, row: Row, nodes: SelNode[]): Row {
  const out: Row = {};
  const hasStar = nodes.some((n) => n.kind === "star");
  if (hasStar) {
    for (const k of Object.keys(row)) {
      if (k === "generated_activity") continue;
      out[k] = row[k];
    }
  }
  for (const n of nodes) {
    if (n.kind === "col") {
      out[n.name] = row[n.name];
    } else if (n.kind === "rel") {
      const rel = resolveRelation(table, row, n.alias, n.table);
      if (Array.isArray(rel)) {
        out[n.alias] = rel.map((child) => projectRow(n.table, child, n.children));
      } else if (rel) {
        out[n.alias] = projectRow(n.table, rel, n.children);
      } else {
        out[n.alias] = null;
      }
    }
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return "00000000-0000-4000-8000-" + Math.random().toString(16).slice(2, 14).padEnd(12, "0");
}

class FakeQuery {
  private table: string;
  private op: "select" | "insert" | "update" | "delete" | "upsert" | null = null;
  private payload: any = null;
  private selectCols: string | null = null;
  private selectOpts: any = {};
  private selectCalled = false;
  private conflict: string | null = null;
  private filters: FilterFn[] = [];
  private orders: Array<{ col: string; asc: boolean }> = [];
  private limitN: number | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(cols?: string, opts?: any) {
    if (this.op === null) this.op = "select";
    this.selectCalled = true;
    if (cols !== undefined) this.selectCols = cols;
    if (opts) this.selectOpts = { ...this.selectOpts, ...opts };
    return this;
  }
  insert(rows: any) {
    this.op = "insert";
    this.payload = rows;
    return this;
  }
  update(obj: any) {
    this.op = "update";
    this.payload = obj;
    return this;
  }
  delete() {
    this.op = "delete";
    return this;
  }
  upsert(obj: any, opts?: { onConflict?: string }) {
    this.op = "upsert";
    this.payload = obj;
    if (opts?.onConflict) this.conflict = opts.onConflict;
    return this;
  }
  eq(col: string, val: any) { this.filters.push((r) => valEq(r[col], val)); return this; }
  neq(col: string, val: any) { this.filters.push((r) => !valEq(r[col], val)); return this; }
  in(col: string, vals: any[]) { this.filters.push((r) => vals.some((v) => valEq(r[col], v))); return this; }
  gte(col: string, val: any) { this.filters.push((r) => r[col] != null && String(r[col]) >= String(val)); return this; }
  gt(col: string, val: any) { this.filters.push((r) => r[col] != null && String(r[col]) > String(val)); return this; }
  lte(col: string, val: any) { this.filters.push((r) => r[col] != null && String(r[col]) <= String(val)); return this; }
  lt(col: string, val: any) { this.filters.push((r) => r[col] != null && String(r[col]) < String(val)); return this; }
  like(col: string, pat: string) { this.filters.push((r) => ilikeMatch(r[col], pat)); return this; }
  ilike(col: string, pat: string) { this.filters.push((r) => ilikeMatch(r[col], pat)); return this; }
  is(col: string, val: any) { this.filters.push((r) => (val === null ? r[col] == null : String(r[col]) === String(val))); return this; }
  not(col: string, op: string, val: any) {
    if (op === "is" && val === null) this.filters.push((r) => r[col] != null);
    else this.filters.push(() => true);
    return this;
  }
  or(cond: string) {
    const parts = splitTopLevel(cond).map((c) => c.trim()).filter(Boolean).map(parseOrCondition);
    this.filters.push((r) => parts.some((f) => f(r)));
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orders.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) { this.limitN = n; return this; }

  private allRows(): Row[] {
    return rowsOf(this.table);
  }
  private matched(): Row[] {
    let rows = this.allRows().filter((r) => this.filters.every((f) => f(r)));
    for (const o of this.orders) {
      rows = [...rows].sort((a, b) => {
        const av = a[o.col];
        const bv = b[o.col];
        if (av == null && bv == null) return 0;
        if (av == null) return o.asc ? -1 : 1;
        if (bv == null) return o.asc ? 1 : -1;
        const c = String(av) < String(bv) ? -1 : String(av) > String(bv) ? 1 : 0;
        return o.asc ? c : -c;
      });
    }
    if (this.limitN != null) rows = rows.slice(0, this.limitN);
    return rows;
  }
  private projected(rows: Row[]): any {
    const cols = this.selectCols == null || this.selectCols.trim() === "" ? "*" : this.selectCols;
    const nodes = parseSelect(cols);
    return rows.map((r) => projectRow(this.table, r, nodes));
  }

  private execute(): { data: any; error: any; count?: number } {
    const store = getMockStore() as any;
    const key = TABLE_STORE[this.table];
    const op = this.op || "select";
    if (op === "select") {
      const rows = this.matched();
      if (this.selectOpts?.head) {
        return { data: [], error: null, count: rows.length };
      }
      return { data: this.projected(rows), error: null, count: this.selectOpts?.count ? rows.length : undefined };
    }
    if (op === "insert") {
      const items = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => ({
        created_at: nowIso(),
        updated_at: nowIso(),
        ...r,
        id: r.id || newId(),
      }));
      if (key) (store[key] as Row[]).push(...items.map((r: Row) => ({ ...r })));
      if (this.selectCalled) {
        return { data: this.projected(items), error: null };
      }
      return { data: null, error: null };
    }
    if (op === "update") {
      const rows = this.matched();
      for (const r of rows) {
        for (const k of Object.keys(this.payload || {})) {
          if (this.payload[k] !== undefined) r[k] = this.payload[k];
        }
        if ("updated_at" in r && !("updated_at" in (this.payload || {}))) r.updated_at = nowIso();
      }
      if (this.selectCalled) {
        return { data: this.projected(rows), error: null };
      }
      return { data: null, error: null };
    }
    if (op === "delete") {
      const rows = this.matched();
      if (key) {
        const arr = store[key] as Row[];
        const doomed = new Set(rows);
        store[key] = arr.filter((r) => !doomed.has(r));
      }
      if (this.selectCalled) {
        return { data: this.projected(rows), error: null };
      }
      return { data: null, error: null };
    }
    if (op === "upsert") {
      const items = Array.isArray(this.payload) ? this.payload : [this.payload];
      const conflictCols = (this.conflict || "id").split(",").map((s) => s.trim()).filter(Boolean);
      const touched: Row[] = [];
      const arr = key ? ((store[key] as Row[]) || (store[key] = [])) : [];
      for (const item of items) {
        const existing = arr.find((r) => conflictCols.every((c) => valEq(r[c], item[c])));
        if (existing) {
          for (const k of Object.keys(item)) {
            if (item[k] !== undefined) existing[k] = item[k];
          }
          if ("updated_at" in existing && !("updated_at" in item)) existing.updated_at = nowIso();
          touched.push(existing);
        } else {
          const row: Row = { created_at: nowIso(), updated_at: nowIso(), ...item, id: item.id || newId() };
          arr.push(row);
          touched.push(row);
        }
      }
      if (this.selectCalled) {
        return { data: this.projected(touched), error: null };
      }
      return { data: null, error: null };
    }
    return { data: null, error: { message: `unsupported op ${op}` } };
  }

  single(): Promise<{ data: any; error: any }> {
    const res = this.execute();
    if (res.error) return Promise.resolve({ data: null, error: res.error });
    const list = Array.isArray(res.data) ? res.data : res.data != null ? [res.data] : [];
    if (list.length === 0) return Promise.resolve({ data: null, error: { message: "No rows returned", code: "PGRST116" } });
    if (list.length > 1) return Promise.resolve({ data: null, error: { message: "Multiple rows returned", code: "PGRST116" } });
    return Promise.resolve({ data: list[0], error: null });
  }
  maybeSingle(): Promise<{ data: any; error: any }> {
    const res = this.execute();
    if (res.error) return Promise.resolve({ data: null, error: res.error });
    const list = Array.isArray(res.data) ? res.data : res.data != null ? [res.data] : [];
    if (list.length === 0) return Promise.resolve({ data: null, error: null });
    if (list.length > 1) return Promise.resolve({ data: null, error: { message: "Multiple rows returned", code: "PGRST116" } });
    return Promise.resolve({ data: list[0], error: null });
  }
  then(resolve: (v: any) => any, reject?: (e: any) => any) {
    try {
      const res = this.execute();
      if (this.op === "select" || this.op === null) {
        return Promise.resolve({ data: res.data, error: res.error, count: (res as any).count }).then(resolve, reject);
      }
      return Promise.resolve({ data: res.data, error: res.error }).then(resolve, reject);
    } catch (e) {
      if (reject) return Promise.reject(e).catch(reject);
      throw e;
    }
  }
}

// ---- storage double ----
const mockFiles = new Map<string, any>();
const fakeStorage = {
  from: (bucket: string) => ({
    createSignedUrl: async (path: string, _ttl: number) => ({
      data: { signedUrl: `https://mock-storage.local/${bucket}/${path}` },
      error: null,
    }),
    upload: async (path: string, file: any, _opts?: any) => {
      mockFiles.set(`${bucket}/${path}`, file);
      return { data: { path, id: path, fullPath: `${bucket}/${path}` }, error: null };
    },
    remove: async (_paths: string[]) => ({ data: [], error: null }),
    createBucket: async (_id: string, _opts?: any) => ({ data: {}, error: null }),
  }),
  createBucket: async (_id: string, _opts?: any) => ({ data: {}, error: null }),
};

// ---- auth.admin double (backed by mock profiles + on-the-fly demo identities) ----
const fakeAuthUsers = new Map<string, { id: string; email: string; user_metadata: any }>();

function ensureDemoTherapistEmail() {
  const store = getMockStore() as any;
  const th = (store.profiles as Row[]).find((p) => p.id === DEMO_THERAPIST_ID);
  if (th && !th.email) th.email = "dr.elena.ramos@aruga.local";
}

function authUserFor(id: string): { id: string; email: string; user_metadata: any } | null {
  if (fakeAuthUsers.has(id)) return fakeAuthUsers.get(id)!;
  const store = getMockStore() as any;
  const prof = (store.profiles as Row[]).find((p) => p.id === id) as Row | undefined;
  if (prof?.email) return { id, email: prof.email, user_metadata: { role: prof.role } };
  const pat = (store.patients as Row[]).find((p) => p.client_user_id === id) as Row | undefined;
  if (pat?.email) return { id, email: pat.email, user_metadata: { role: "client", name: pat.name } };
  return null;
}

const fakeAuthAdmin = {
  getUserById: async (id: string) => {
    ensureDemoTherapistEmail();
    const u = authUserFor(id);
    if (!u) return { data: { user: null }, error: { message: "User not found" } };
    return { data: { user: u }, error: null };
  },
  createUser: async (attrs: any) => {
    ensureDemoTherapistEmail();
    const email = String(attrs?.email || "").toLowerCase();
    const store = getMockStore() as any;
    const dup =
      [...fakeAuthUsers.values()].find((u) => u.email.toLowerCase() === email) ||
      (store.profiles as Row[]).find((p) => String(p.email || "").toLowerCase() === email);
    if (dup) return { data: { user: null }, error: { message: "User already registered" } };
    const id = attrs?.id || newId();
    const user = { id, email: attrs?.email || "", user_metadata: attrs?.user_metadata || {} };
    fakeAuthUsers.set(id, user);
    return { data: { user }, error: null };
  },
  updateUserById: async (id: string, attrs: any) => {
    const u = authUserFor(id) || { id, email: "", user_metadata: {} };
    const merged = { ...u, user_metadata: { ...(u.user_metadata || {}), ...(attrs?.user_metadata || {}) } };
    if (attrs?.email) (merged as any).email = attrs.email;
    fakeAuthUsers.set(id, merged);
    return { data: { user: merged }, error: null };
  },
  listUsers: async (_opts?: any) => {
    ensureDemoTherapistEmail();
    const store = getMockStore() as any;
    const byId = new Map<string, any>();
    for (const u of fakeAuthUsers.values()) byId.set(u.id, u);
    for (const p of store.profiles as Row[]) {
      if (p.email && !byId.has(p.id)) {
        byId.set(p.id, { id: p.id, email: p.email, user_metadata: { role: p.role } });
      }
    }
    const th = (store.profiles as Row[]).find((p) => p.id === DEMO_THERAPIST_ID);
    if (th && !byId.has(th.id)) {
      byId.set(th.id, { id: th.id, email: "dr.elena.ramos@aruga.local", user_metadata: { role: "therapist" } });
    }
    return { data: { users: [...byId.values()] }, error: null };
  },
  deleteUser: async (id: string) => {
    fakeAuthUsers.delete(id);
    return { data: {}, error: null };
  },
};

export function createFakeAdmin() {
  ensureDemoTherapistEmail();
  return {
    from: (table: string) => new FakeQuery(table),
    storage: fakeStorage,
    auth: { admin: fakeAuthAdmin },
  };
}

export function __resetFakeAuth() {
  fakeAuthUsers.clear();
  mockFiles.clear();
}
