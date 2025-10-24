// functions/api/programs/programs.js

export const onRequestGet = async ({ env, request }) => {
  const url = new URL(request.url);
  const limit   = Number(url.searchParams.get("limit")   ?? 50);
  const offset  = Number(url.searchParams.get("offset")  ?? 0);
  const include = (url.searchParams.get("include") || "").toLowerCase();

  const programsRes = await env.DB.prepare(
    `SELECT * FROM programs ORDER BY createdAt DESC LIMIT ? OFFSET ?`
  ).bind(limit, offset).all();

  const programs = programsRes.results || [];

  if (include !== "lines" || programs.length === 0) {
    return json(programs);
  }

  for (const p of programs) {
    const linesRes = await env.DB.prepare(
      `SELECT pn, description, rrp, promoRrp, vatOnRrp, rebate, maxQty, totalProgramRebate, lineProgramNumber
       FROM program_lines WHERE program_id = ? ORDER BY id ASC`
    ).bind(p.id).all();
    p.lines = linesRes.results || [];
  }

  return json(programs);
};

export const onRequestPost = async ({ env, request }) => {
  try {
    const payload = await request.json();

    // ====== MODO UPDATE (editar) ======
    // Se invoca desde /programs/edit. Reemplaza líneas y valida que no aumente maxQty.
    if (payload?.mode === "update") {
      const { id, lines } = payload || {};
      if (!id || !Array.isArray(lines) || lines.length === 0) {
        return json({ error: "Invalid payload (id/lines)" }, 400);
      }

      // Cargar maxQty actuales para validar "solo a la baja"
      const current = await env.DB
        .prepare(`SELECT pn, maxQty FROM program_lines WHERE program_id = ?`)
        .bind(id)
        .all();

      const currentMap = new Map(
        (current.results || []).map(r => [String(r.pn), Number(r.maxQty) || 0])
      );

      for (const ln of lines) {
        const key = String(ln.pn ?? ln.PN ?? "");
        const oldQty = currentMap.get(key);
        const newQty = num(ln.maxQty);
        // Si no existía la línea, permitimos (es un caso raro) pero nunca aumentar respecto a inexistente (old undefined => tratamos como +∞?)
        if (oldQty != null && newQty > oldQty) {
          return json({
            error: `Max Qty for PN ${key} cannot increase (${newQty} > ${oldQty}).`
          }, 400);
        }
      }

      // Reemplazar líneas del programa
      const stmts = [
        env.DB.prepare(`DELETE FROM program_lines WHERE program_id = ?`).bind(id),
        ...lines.map((ln) =>
          env.DB.prepare(
            `INSERT INTO program_lines
             (program_id, pn, description, rrp, promoRrp, vatOnRrp, rebate, maxQty, totalProgramRebate, lineProgramNumber)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            id,
            String(ln.pn ?? ln.PN ?? ""),
            String(ln.description ?? ""),
            num(ln.rrp),
            num(ln.promoRrp),
            String(ln.vatOnRrp ?? "No"),
            num(ln.rebate),
            num(ln.maxQty),
            num(ln.totalProgramRebate),
            String(ln.programNumber ?? ln.lineProgramNumber ?? "")
          )
        )
      ];

      await env.DB.batch(stmts);
      return json({ ok: true, id, linesUpdated: lines.length });
    }

    // ====== MODO CREATE (alta) ======
    const { header, lines } = payload || {};
    if (!header || !Array.isArray(lines) || lines.length === 0) {
      return json({ error: "Invalid payload (header/lines)" }, 400);
    }

    const id = payload.id || genId(header.programNumber, header.customer, header.startDay);
    const createdAt = payload.createdAt || new Date().toISOString();
    const activity = header.activity ?? null;

    // ✨ IMPORTANTE: 11 columnas + 11 valores (incluye activity)
    const stmtHeader = env.DB.prepare(
      `INSERT INTO programs
       (id, createdAt, programNumber, programType, geo, country, vertical, customer, startDay, endDay, activity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      id, createdAt,
      header.programNumber,
      header.programType,
      header.geo,
      header.country,
      header.vertical,
      header.customer,
      header.startDay,
      header.endDay || null,
      activity
    );

    const lineStmts = lines.map((ln) =>
      env.DB.prepare(
        `INSERT INTO program_lines
         (program_id, pn, description, rrp, promoRrp, vatOnRrp, rebate, maxQty, totalProgramRebate, lineProgramNumber)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        String(ln.pn ?? ln.PN ?? ""),
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

    return json({ ok: true, id, createdAt, linesInserted: lines.length });

  } catch (e) {
    // En D1, conviene exponer el mensaje para depurar
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

/* helpers */
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });

function num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; }
function genId(programNumber, customer, startDay) {
  const base = `${programNumber || "NONUM"}|${customer || "NOCUST"}|${startDay || ""}`;
  let h = 0; for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return `PRG-${h.toString(16).padStart(8, "0")}`;
}
