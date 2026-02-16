import { query } from "@/lib/db";
import { redisGet, redisSet, redisDel } from "@/lib/redis-cache";

export interface Linktree {
  id: string;
  name: string;
  subtitle?: string;
  seo_name: string;
  uid: string;
  image?: string;
  background_color: string;
  template_config?: Record<string, unknown> | null;
  footer_text?: string;
  footer_phone?: string;
  footer_hidden?: boolean;
  status?: string;
  created_at: string;
  updated_at: string;
  analytics?: { unique_views: number; unique_clicks: number };
}

export interface Link {
  id: string;
  linktree_id: string;
  platform: string;
  url: string;
  display_name?: string | null;
  description?: string | null;
  default_message?: string | null;
  display_order: number;
  click_count: number;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface LinkMetadata {
  display_name?: string;
  default_message?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateLinktreeData {
  name: string;
  subtitle?: string;
  slug: string;
  image?: string | null;
  background_color: string;
  template_config?: Record<string, unknown> | null;
  footer_text?: string;
  footer_phone?: string;
  footer_hidden?: boolean;
  platforms: string[];
  links: Record<string, string[]>;
  linkMetadata?: Record<string, LinkMetadata[]>;
}

export interface UpdateLinktreeData {
  name?: string;
  subtitle?: string;
  slug?: string;
  image?: string | null;
  background_color?: string;
  template_config?: Record<string, unknown> | null;
  footer_text?: string;
  footer_phone?: string;
  footer_hidden?: boolean;
}

const COLS_LINKTREE =
  "id, name, subtitle, seo_name, uid, image, background_color, template_config, footer_text, footer_phone, footer_hidden, status, created_at, updated_at";
const COLS_LINK =
  "id, linktree_id, platform, url, display_name, description, default_message, display_order, click_count, metadata, created_at, updated_at";

function getDefaultMessageForPlatform(platform: string, custom?: string): string | null {
  if (custom) return custom;
  if (["whatsapp", "telegram", "viber"].includes(platform)) return "";
  return null;
}

const uidAlphabet = "abcdefghijklmnopqrstuvwxyz0123456789-";
function generateUid(len = 21): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const a = new Uint32Array(len);
    crypto.getRandomValues(a);
    return Array.from(a, (x) => uidAlphabet[x % uidAlphabet.length]).join("");
  }
  return Array.from({ length: len }, () => uidAlphabet[Math.floor(Math.random() * uidAlphabet.length)]).join("");
}

export async function getAllLinktrees(includeAnalytics = false): Promise<Linktree[]> {
  const cacheKey = includeAnalytics ? "lt:list:all:analytics" : "lt:list:all";
  const cached = await redisGet(cacheKey);
  if (cached) {
    try { return JSON.parse(cached) as Linktree[]; } catch { /* fall through */ }
  }
  const { rows } = await query<Linktree>(
    `SELECT ${COLS_LINKTREE} FROM linktrees ORDER BY created_at DESC`
  );
  const list = rows || [];
  if (!includeAnalytics) {
    await redisSet(cacheKey, list, 30);
    return list;
  }
  try {
    const { rows: aRows } = await query<{ linktree_id: string; unique_views: string; unique_clicks: string }>(
      "SELECT * FROM get_all_linktrees_analytics_optimized()"
    );
    const byId: Record<string, { unique_views: number; unique_clicks: number }> = {};
    for (const r of aRows || []) {
      if (r?.linktree_id) byId[r.linktree_id] = { unique_views: Number(r.unique_views) || 0, unique_clicks: Number(r.unique_clicks) || 0 };
    }
    const result = list.map((lt) => (byId[lt.id] ? { ...lt, analytics: byId[lt.id] } : lt));
    await redisSet(cacheKey, result, 30);
    return result;
  } catch {
    return list;
  }
}

export async function getLinktreeById(id: string): Promise<Linktree | null> {
  const cached = await redisGet("lt:id:" + id);
  if (cached) {
    try { return JSON.parse(cached) as Linktree; } catch { /* fall through */ }
  }
  const { rows } = await query<Linktree>(`SELECT ${COLS_LINKTREE} FROM linktrees WHERE id = $1`, [id]);
  const row = rows[0] ?? null;
  if (row) await redisSet("lt:id:" + id, row, 60);
  return row;
}

export async function getLinktreeByUid(uid: string): Promise<Linktree | null> {
  const { rows } = await query<Linktree>(`SELECT ${COLS_LINKTREE} FROM linktrees WHERE uid = $1`, [uid]);
  const row = rows[0];
  if (!row) return null;
  return row;
}

export async function getLinktreeBySeoName(seoName: string): Promise<Linktree | null> {
  const { rows } = await query<Linktree>(`SELECT ${COLS_LINKTREE} FROM linktrees WHERE seo_name = $1`, [seoName]);
  const row = rows[0];
  if (!row) return null;
  return row;
}

export async function getLinktreeIdByUid(uid: string): Promise<string | null> {
  const rk = await redisGet("lt:uid:" + uid);
  if (rk) return rk;
  const { rows } = await query<{ id: string }>(
    "SELECT id FROM linktrees WHERE uid = $1",
    [uid]
  );
  const r = rows[0];
  if (!r) return null;
  await redisSet("lt:uid:" + uid, r.id, 300);
  return r.id;
}

/** Bulk resolve UIDs to linktree IDs in one query (no N+1). Used by analytics batch. */
export async function getLinktreeIdsByUids(uids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(uids)].filter((u) => u && u.trim());
  if (unique.length === 0) return new Map();
  const { rows } = await query<{ uid: string; id: string }>(
    "SELECT uid, id FROM linktrees WHERE uid = ANY($1::text[])",
    [unique]
  );
  const map = new Map<string, string>();
  for (const r of rows ?? []) {
    if (r?.uid && r?.id) map.set(r.uid, r.id);
  }
  return map;
}

export async function getLinktreeWithLinksByUid(uid: string): Promise<{ linktree: Linktree | null; links: Link[]; schemaMissing?: boolean }> {
  const cached = await redisGet("lt:wl:" + uid);
  if (cached) {
    try {
      const o = JSON.parse(cached) as { linktree: Linktree | null; links: Link[] };
      if (o && o.linktree === null)
        return { linktree: null, links: [] };
      return o;
    } catch {
      /* stale or invalid, fall through */
    }
  }
  try {
    const { rows: ltRows } = await query<Linktree & { links?: Link[] }>(
      `SELECT ${COLS_LINKTREE} FROM linktrees WHERE uid = $1`,
      [uid]
    );
    const lt = ltRows[0];
    if (!lt)
      return { linktree: null, links: [] };
    const { rows: linkRows } = await query<Link>(
      `SELECT ${COLS_LINK} FROM links WHERE linktree_id = $1 ORDER BY display_order ASC`,
      [lt.id]
    );
    const links = (linkRows || []).sort((a, b) => a.display_order - b.display_order);
    const out = { linktree: lt as Linktree, links };
    await redisSet("lt:wl:" + uid, out, 60);
    return out;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      return { linktree: null, links: [], schemaMissing: true };
    }
    throw err;
  }
}

export async function invalidateLinktreeCache(uid: string): Promise<void> {
  await Promise.all([
    redisDel("lt:wl:" + uid),
    redisDel("lt:uid:" + uid),
    redisDel("lt:list:all"),
    redisDel("lt:list:all:analytics"),
    redisDel("lt:analytics:totals"),
  ]);
}

export async function invalidateLinktreeCacheById(id: string): Promise<void> {
  const lt = await getLinktreeById(id);
  const promises: Promise<unknown>[] = [
    redisDel("lt:id:" + id),
    redisDel("lt:links:" + id),
    redisDel("lt:analytics:" + id),
  ];
  if (lt) {
    promises.push(invalidateLinktreeCache(lt.uid));
    promises.push(redisDel("lt:wl:" + lt.uid)); // Also invalidate linktree with links cache
  }
  await Promise.all(promises);
}

export async function invalidateLinkCache(linkId: string): Promise<void> {
  await redisDel("link:" + linkId);
}

export async function createLinktree(data: CreateLinktreeData): Promise<Linktree> {
  let uid: string | undefined;
  for (let i = 0; i < 10; i++) {
    uid = generateUid();
    const { rows } = await query<{ id: string }>("SELECT id FROM linktrees WHERE uid = $1", [uid]);
    if (!rows.length) break;
    uid = undefined;
  }
  if (!uid) throw new Error("Failed to generate unique identifier");

  const status = "Active";
  const sub = data.subtitle || "بۆ پەیوەندی کردن, کلیک لەم لینکانەی خوارەوە بکە";
  const { rows: ins } = await query<Linktree>(
    `INSERT INTO linktrees (name, subtitle, seo_name, uid, image, background_color, template_config, footer_text, footer_phone, footer_hidden, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11)
     RETURNING ${COLS_LINKTREE}`,
    [
      data.name,
      sub,
      data.slug,
      uid,
      data.image ?? null,
      data.background_color,
      JSON.stringify(data.template_config || {}),
      data.footer_text ?? null,
      data.footer_phone ?? null,
      data.footer_hidden ?? false,
      status,
    ]
  );
  const linktree = ins[0];
  if (!linktree) throw new Error("Failed to create linktree");

  if (!data.links || Object.keys(data.links).length === 0) {
    await query("DELETE FROM linktrees WHERE id = $1", [linktree.id]);
    throw new Error("No links provided");
  }

  const toIns: Array<[string, string, string, string | null, string | null, number, Record<string, unknown>]> = [];
  let order = 0;
  for (const [platform, urls] of Object.entries(data.links)) {
    if (!Array.isArray(urls) || !platform?.trim()) continue;
    const metaArr = data.linkMetadata?.[platform] || [];
    for (let i = 0; i < urls.length; i++) {
      const u = urls[i];
      if (!u || typeof u !== "string" || !u.trim()) continue;
      const m = metaArr[i] || {};
      toIns.push([
        linktree.id,
        platform.trim(),
        u.trim(),
        m.display_name?.trim() || null,
        getDefaultMessageForPlatform(platform, m.default_message) ?? null,
        order++,
        (m.metadata as Record<string, unknown>) || {},
      ]);
    }
  }
  if (toIns.length === 0) {
    await query("DELETE FROM linktrees WHERE id = $1", [linktree.id]);
    throw new Error("No valid links provided");
  }

  for (const [ltId, platform, url, disp, defMsg, display_order, meta] of toIns) {
    await query(
      `INSERT INTO links (linktree_id, platform, url, display_name, default_message, display_order, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [ltId, platform, url, disp, defMsg, display_order, JSON.stringify(meta)]
    );
  }
  return linktree;
}

export async function updateLinktree(id: string, data: UpdateLinktreeData): Promise<Linktree> {
  const M: [string, unknown][] = [];
  if (data.name != null) M.push(["name", data.name]);
  if (data.subtitle != null) M.push(["subtitle", data.subtitle || "بۆ پەیوەندی کردن, کلیک لەم لینکانەی خوارەوە بکە"]);
  if (data.slug != null) M.push(["seo_name", data.slug]);
  // Allow setting image to null to remove it (check for undefined, not null)
  if (data.image !== undefined) M.push(["image", data.image]);
  if (data.background_color != null) M.push(["background_color", data.background_color]);
  if (data.template_config != null) M.push(["template_config", JSON.stringify(data.template_config)]);
  if (data.footer_text != null) M.push(["footer_text", data.footer_text]);
  if (data.footer_phone != null) M.push(["footer_phone", data.footer_phone]);
  if (data.footer_hidden != null) M.push(["footer_hidden", data.footer_hidden]);
  if (M.length === 0) return (await getLinktreeById(id))!;
  const sets = M.map(([k], i) => `"${k}" = $${i + 1}${k === "template_config" ? "::jsonb" : ""}`).join(", ");
  const vals = M.map(([, v]) => v);
  vals.push(id);
  const { rows } = await query<Linktree>(`UPDATE linktrees SET ${sets} WHERE id = $${vals.length} RETURNING ${COLS_LINKTREE}`, vals);
  if (!rows[0]) throw new Error("Failed to update linktree");
  return rows[0];
}

export async function deleteLinktree(id: string): Promise<void> {
  await query("DELETE FROM linktrees WHERE id = $1", [id]);
}

export async function getLinksByLinktreeId(linktreeId: string): Promise<Link[]> {
  const cached = await redisGet("lt:links:" + linktreeId);
  if (cached) {
    try { return JSON.parse(cached) as Link[]; } catch { /* fall through */ }
  }
  const { rows } = await query<Link>(`SELECT ${COLS_LINK} FROM links WHERE linktree_id = $1 ORDER BY display_order ASC`, [linktreeId]);
  const result = rows || [];
  await redisSet("lt:links:" + linktreeId, result, 60);
  return result;
}

export async function getLinkById(id: string): Promise<{ id: string; linktree_id: string; platform: string } | null> {
  const cached = await redisGet("link:" + id);
  if (cached) {
    try {
      return JSON.parse(cached) as { id: string; linktree_id: string; platform: string };
    } catch {
      /* fall through */
    }
  }
  const { rows } = await query<{ id: string; linktree_id: string; platform: string }>("SELECT id, linktree_id, platform FROM links WHERE id = $1", [id]);
  const row = rows[0] ?? null;
  if (row) await redisSet("link:" + id, row, 120);
  return row;
}

export async function createLink(
  linktreeId: string, platform: string, url: string,
  displayOrder?: number, displayName?: string | null, description?: string | null, defaultMessage?: string | null, metadata?: Record<string, unknown> | null
): Promise<Link> {
  let order = displayOrder;
  if (order === undefined) {
    const { rows } = await query<{ ord: number }>("SELECT get_next_display_order($1) AS ord", [linktreeId]);
    order = rows[0]?.ord ?? 0;
  }
  const def = defaultMessage ?? (["whatsapp", "telegram", "viber"].includes(platform) ? "" : null);
  const { rows } = await query<Link>(
    `INSERT INTO links (linktree_id, platform, url, display_name, description, default_message, display_order, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING ${COLS_LINK}`,
    [linktreeId, platform, url, displayName ?? null, description ?? null, def, order, JSON.stringify(metadata || {})]
  );
  if (!rows[0]) throw new Error("Failed to create link");
  return rows[0];
}

export async function updateLink(id: string, data: { platform?: string; url?: string; display_name?: string | null; description?: string | null; default_message?: string | null; display_order?: number; metadata?: Record<string, unknown> | null }): Promise<Link> {
  const M: [string, unknown][] = [];
  if (data.platform != null) M.push(["platform", data.platform]);
  if (data.url != null) M.push(["url", data.url]);
  if (data.display_name != null) M.push(["display_name", data.display_name]);
  if (data.description != null) M.push(["description", data.description]);
  if (data.default_message != null) M.push(["default_message", data.default_message]);
  if (data.display_order != null) M.push(["display_order", data.display_order]);
  if (data.metadata != null) M.push(["metadata", JSON.stringify(data.metadata)]);
  if (M.length === 0) {
    const { rows } = await query<Link>(`SELECT ${COLS_LINK} FROM links WHERE id = $1`, [id]);
    if (!rows[0]) throw new Error("Failed to update link");
    return rows[0];
  }
  const sets = M.map(([k], i) => `"${k}" = $${i + 1}${k === "metadata" ? "::jsonb" : ""}`).join(", ");
  const vals = M.map(([, v]) => v);
  vals.push(id);
  const { rows } = await query<Link>(`UPDATE links SET ${sets} WHERE id = $${vals.length} RETURNING ${COLS_LINK}`, vals);
  if (!rows[0]) throw new Error("Failed to update link");
  return rows[0];
}

export async function deleteLink(id: string): Promise<void> {
  await query("DELETE FROM links WHERE id = $1", [id]);
}

export async function batchDeleteLinks(linkIds: string[]): Promise<void> {
  if (linkIds.length === 0) return;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const valid = linkIds.filter((id) => id && uuidRegex.test(id));
  if (valid.length === 0) return;
  const placeholders = valid.map((_, i) => `$${i + 1}`).join(",");
  await query(`DELETE FROM links WHERE id IN (${placeholders})`, valid);
}

export async function deleteAllLinksForLinktree(linktreeId: string): Promise<void> {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!linktreeId || !uuidRegex.test(linktreeId)) throw new Error("Invalid linktree ID format");
  await query("DELETE FROM links WHERE linktree_id = $1", [linktreeId]);
}

export async function batchCreateLinks(
  links: Array<{
    linktree_id: string;
    platform: string;
    url: string;
    display_order: number;
    display_name?: string | null;
    description?: string | null;
    default_message?: string | null;
    metadata?: Record<string, unknown>;
  }>
): Promise<Link[]> {
  if (links.length === 0) return [];
  const msg = ["whatsapp", "telegram", "viber"];
  const inserted: Link[] = [];
  for (const l of links) {
    const def = l.default_message ?? (msg.includes(l.platform) ? "" : null);
    const { rows } = await query<Link>(
      `INSERT INTO links (linktree_id, platform, url, display_order, display_name, description, default_message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb) RETURNING ${COLS_LINK}`,
      [l.linktree_id, l.platform, l.url, l.display_order, l.display_name ?? null, l.description ?? null, def, JSON.stringify(l.metadata || {})]
    );
    if (rows[0]) inserted.push(rows[0]);
  }
  return inserted;
}

export async function reorderLinks(linktreeId: string, linkIds: string[]): Promise<void> {
  await query("SELECT reorder_links($1, $2::uuid[])", [linktreeId, linkIds]);
}

export interface PageView {
  id: string;
  linktree_id: string;
  ip_address: string;
  viewed_at: string;
  session_id?: string;
}

export interface LinkClick {
  id: string;
  link_id: string;
  linktree_id: string;
  ip_address: string;
  clicked_at: string;
  session_id?: string;
  platform?: string;
  display_name?: string;
}

export interface AnalyticsSummary {
  unique_views: number;
  unique_clicks: number;
  views_by_device: Record<string, number>;
  clicks_by_device: Record<string, number>;
  clicks_by_platform: Record<string, number>;
  views_by_referer: Record<string, number>;
  clicks_by_referer: Record<string, number>;
  views_by_os: Record<string, number>;
  clicks_by_os: Record<string, number>;
  top_clicked_links: Array<{ link_id: string; platform: string; display_name?: string; click_count: number; recent_clicks?: Array<{ ip_address: string; city?: string; clicked_at: string }> }>;
  recent_views: Array<{ ip_address: string; viewed_at: string }>;
  recent_clicks: Array<{ ip_address: string; platform?: string; clicked_at: string }>;
}

export async function getLinktreeAnalytics(linktreeId: string): Promise<AnalyticsSummary> {
  const cached = await redisGet("lt:analytics:" + linktreeId);
  if (cached) {
    try { return JSON.parse(cached) as AnalyticsSummary; } catch { /* fall through */ }
  }
  const [statsRes, breakdownRes, viewsRes, clicksRes, linksRes] = await Promise.all([
    query<{ total_views: string; unique_views: string; total_clicks: string; unique_clicks: string }>("SELECT * FROM get_linktree_analytics_optimized($1)", [linktreeId]),
    query<Record<string, unknown>>("SELECT * FROM get_linktree_breakdowns_optimized($1)", [linktreeId]),
    query<PageView>("SELECT id, ip_address, viewed_at, session_id FROM page_views WHERE linktree_id = $1 ORDER BY viewed_at DESC", [linktreeId]),
    query<LinkClick & { platform?: string; display_name?: string }>(
      "SELECT lc.id, lc.link_id, lc.linktree_id, lc.ip_address, lc.clicked_at, lc.session_id, l.platform, l.display_name FROM link_clicks lc JOIN links l ON l.id = lc.link_id WHERE lc.linktree_id = $1 ORDER BY lc.clicked_at DESC",
      [linktreeId]
    ),
    query<{ id: string; platform: string; display_name?: string | null; click_count: number }>("SELECT id, platform, display_name, click_count FROM links WHERE linktree_id = $1", [linktreeId]),
  ]);
  const stats = statsRes.rows[0];
  // Per-linktree: show total counts (all visits), not unique (so visiting twice = 2 views)
  const totalViews = stats ? Number(stats.total_views) || 0 : 0;
  const totalClicks = stats ? Number(stats.total_clicks) || 0 : 0;
  const views = viewsRes.rows || [];
  const clicks = clicksRes.rows || [];
  const linksData = linksRes.rows || [];
  const breakdown = breakdownRes.rows[0] || {};
  const by = (k: string) => (typeof breakdown[k] === "object" && breakdown[k] != null ? (breakdown[k] as Record<string, number>) : {});
  const linkClickCounts: Record<string, number> = {};
  for (const c of clicks) {
    if (c.link_id) linkClickCounts[c.link_id] = (linkClickCounts[c.link_id] || 0) + 1;
  }
  const linkMeta: Record<string, { platform: string; display_name?: string }> = {};
  for (const l of linksData) linkMeta[l.id] = { platform: l.platform, display_name: l.display_name ?? undefined };
  const topClicked = Object.entries(linkClickCounts)
    .map(([link_id, count]) => {
      const m = linkMeta[link_id] || { platform: "Unknown", display_name: undefined };
      const recent = clicks.filter((c) => c.link_id === link_id).sort((a, b) => new Date(b.clicked_at).getTime() - new Date(a.clicked_at).getTime()).slice(0, 5).map((c) => ({ ip_address: c.ip_address, clicked_at: c.clicked_at }));
      return { link_id, platform: m.platform, display_name: m.display_name, click_count: count, recent_clicks: recent.length ? recent : undefined };
    })
    .sort((a, b) => b.click_count - a.click_count)
    .slice(0, 10);
  const result: AnalyticsSummary = {
    unique_views: totalViews, // Per-linktree: show all visits (not unique)
    unique_clicks: totalClicks, // Per-linktree: show all clicks (not unique)
    views_by_device: by("views_by_device"),
    clicks_by_device: by("clicks_by_device"),
    clicks_by_platform: by("clicks_by_platform"),
    views_by_referer: by("views_by_referer"),
    clicks_by_referer: by("clicks_by_referer"),
    views_by_os: by("views_by_os"),
    clicks_by_os: by("clicks_by_os"),
    top_clicked_links: topClicked,
    recent_views: views.map((v) => ({ ip_address: v.ip_address, viewed_at: v.viewed_at })),
    recent_clicks: clicks.map((c) => ({ ip_address: c.ip_address, platform: c.platform, clicked_at: c.clicked_at })),
  };
  await redisSet("lt:analytics:" + linktreeId, result, 120);
  return result;
}

export async function getAllLinktreesAnalytics(): Promise<Record<string, { unique_views: number; unique_clicks: number }>> {
  const cached = await redisGet("lt:analytics:all");
  if (cached) {
    try { return JSON.parse(cached) as Record<string, { unique_views: number; unique_clicks: number }>; } catch { /* fall through */ }
  }
  try {
    const { rows } = await query<{ linktree_id: string; unique_views: string; unique_clicks: string }>("SELECT * FROM get_all_linktrees_analytics_optimized()");
    const out: Record<string, { unique_views: number; unique_clicks: number }> = {};
    for (const r of rows || []) {
      if (r?.linktree_id) out[r.linktree_id] = { unique_views: Number(r.unique_views) || 0, unique_clicks: Number(r.unique_clicks) || 0 };
    }
    await redisSet("lt:analytics:all", out, 120);
    return out;
  } catch {
    return {};
  }
}

export async function insertPageViewsBatch(
  items: Array<{ linktree_id: string; ip_address: string; session_id: string | null }>
): Promise<void> {
  if (!items.length) return;
  const CHUNK = 100;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const vals = chunk.map((_, j) => `($${j * 3 + 1}::uuid, $${j * 3 + 2}::inet, $${j * 3 + 3})`).join(", ");
    const params = chunk.flatMap((it) => [it.linktree_id, it.ip_address, it.session_id]);
    // Only insert when linktree still exists (avoids FK violation if linktree was deleted after event was queued)
    await query(
      `INSERT INTO page_views (linktree_id, ip_address, session_id)
       SELECT v.linktree_id, v.ip_address, v.session_id
       FROM (VALUES ${vals}) AS v(linktree_id, ip_address, session_id)
       WHERE EXISTS (SELECT 1 FROM linktrees l WHERE l.id = v.linktree_id)`,
      params
    );
  }
}

export async function insertLinkClicksBatch(
  items: Array<{ link_id: string; linktree_id: string; ip_address: string; session_id: string | null }>
): Promise<void> {
  if (!items.length) return;
  const CHUNK = 100;
  for (let i = 0; i < items.length; i += CHUNK) {
    const chunk = items.slice(i, i + CHUNK);
    const vals = chunk.map((_, j) => `($${j * 4 + 1}::uuid, $${j * 4 + 2}::uuid, $${j * 4 + 3}::inet, $${j * 4 + 4})`).join(", ");
    const params = chunk.flatMap((it) => [it.link_id, it.linktree_id, it.ip_address, it.session_id]);
    // Only insert when both link and linktree still exist (avoids FK violation if deleted after event was queued)
    await query(
      `INSERT INTO link_clicks (link_id, linktree_id, ip_address, session_id)
       SELECT v.link_id, v.linktree_id, v.ip_address, v.session_id
       FROM (VALUES ${vals}) AS v(link_id, linktree_id, ip_address, session_id)
       WHERE EXISTS (SELECT 1 FROM linktrees l WHERE l.id = v.linktree_id)
         AND EXISTS (SELECT 1 FROM links lk WHERE lk.id = v.link_id)`,
      params
    );
  }
}
