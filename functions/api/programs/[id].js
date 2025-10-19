export const onRequestGet = async ({ env, params }) => {
  const id = params.id; // /api/programs/PRG-xxxx
  if (!id) return json({ error: "Missing id" }, 400);

  // Cabecera
  const hdr = await env.DB.prepare(
    `SELECT * FROM programs WHERE id = ? LIMIT 1`
  ).bind(id).first();

  if (!hdr) return json({ error: "Not found" }, 404);

  // Líneas
  const linesRes = await env.DB.prepare(
    `SELECT pn, description, rrp, promoRrp, vatOnRrp, rebate, maxQty, totalProgramRebate, lineProgramNumber
     FROM program_lines WHERE program_id = ? ORDER BY id ASC`
  ).bind(id).all();

  return json({ ...hdr, lines: linesRes.results || [] });
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
