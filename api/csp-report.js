// Vercel Serverless Function — receives Content-Security-Policy violation reports.
//
// CSP is configured in vercel.json with `report-uri /api/csp-report` and
// `Reporting-Endpoints`/`report-to`. Browsers POST reports here; we log them so they
// show up in Vercel → Project → Logs (Runtime Logs). No database is required.
//
// Reports arrive as `application/csp-report` (report-uri) or `application/reports+json`
// (Reporting API / report-to).

function readRaw(req) {
  return new Promise((resolve) => {
    if (req.body) {
      return resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    }
    let raw = '';
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(raw); };
    // Guard: never hang if the platform already consumed the stream.
    const timer = setTimeout(finish, 1500);
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 20000) req.destroy();
    });
    req.on('end', () => { clearTimeout(timer); finish(); });
    req.on('error', () => { clearTimeout(timer); finish(); });
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const raw = await readRaw(req);
  try {
    // Vercel runtime logs capture console output (retained for a short period).
    console.log('[CSP-REPORT] ' + String(raw).slice(0, 4000));
  } catch (_) { /* never fail on logging */ }

  // 204 = no content, as expected for a report endpoint.
  return res.status(204).end();
};
