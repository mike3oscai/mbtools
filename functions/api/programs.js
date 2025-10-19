export const onRequestGet = async ({ env, request }) => {
  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? 50);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  const result = await env.DB.prepare(
    `SELECT * FROM programs ORDER BY createdAt DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  return json(result.results ?? []);
};

export const onRequestPost = async ({ env, request }) => {
  try {
    const payload = await request.json();
    const { header, lines } = payload || {};
    if (!header || !Array.isArray(lines) || lines.length === 0) {
      return json({ error: "Invalid payload" }, 400);
    }

    const id = payload.id || genId(header.programNumber, header.customer, header.startDay);
    const createdAt = payload.createdAt || new Date().toISOString();

    const stmtHeader = env.DB.prepare(
      `INSERT INTO programs
       (id, createdAt, programNumber, programType, geo, country, vertical, customer, startDay, endDay)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, createdAt, header.programNumber, header.programType, header.geo, header.country,
      header.vertical, header.customer, header.startDay, header.endDay || null
    );

    const lineStmts = lines.map((ln) =>
      env.DB.prepare(
        `INSERT INTO program_lines
         (program_id, pn, description, rrp, promoRrp, vatOnRrp, rebate, maxQty, totalProgramRebate, lineProgramNumber)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        String(ln.pn ?? ""),
        String(ln.description ?? ""),
        num(ln.rrp),
        num(ln.promoRrp),
        String(ln.vatOnRrp ?? "No"),
        num(ln.rebate),
        num(ln.maxQty),
        num(ln.totalProgramRebate),
        String(ln.programNumber ?? header.programNumber)
      )
    );

    await env.DB.batch([stmtHeader, ...lineStmts]);
    return json({ ok: true, id, createdAt });
  } catch (e) {
    return json({ error: (e && e.message) || "Failed to save" }, 500);
  }
};

export const onRequestOptions = () =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    }
  });

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,OPTIONS"
    }
  });

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}
function genId(programNumber, customer, startDay) {
  const base = `${programNumber || "NONUM"}|${customer || "NOCUST"}|${startDay || ""}`;
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return `PRG-${h.toString(16).padStart(8, "0")}`;
}
