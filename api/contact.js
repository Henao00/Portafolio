// Vercel Serverless Function — contact form endpoint.
//
// Dependency-free (uses the global fetch available in Node.js 18+).
//
// Environment variables (Vercel → Project → Settings → Environment Variables):
//   RESEND_API_KEY        Required to actually deliver email (Resend: https://resend.com).
//   CONTACT_TO            Destination inbox. Default: juaneshm3@gmail.com
//   CONTACT_FROM          Verified sender, e.g. "Portfolio <contact@yourdomain.com>".
//                         Default: "Portfolio <onboarding@resend.dev>" (Resend test sender).
//   TURNSTILE_SECRET_KEY  Cloudflare Turnstile secret key. When set, a valid captcha
//                         token is REQUIRED. Configure the matching public site key in
//                         index.html (<meta name="turnstile-site-key">).
//
// If RESEND_API_KEY is missing the endpoint replies 503 not_configured and the client
// transparently falls back to the legacy relay, so the form never breaks.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string' && req.body.length) {
      try { return resolve(JSON.parse(req.body)); } catch (_) { return resolve({}); }
    }
    let raw = '';
    let done = false;
    const finish = (value) => { if (done) return; done = true; resolve(value); };
    // Guard: never hang if the platform already consumed the stream.
    const timer = setTimeout(() => finish({}), 1500);
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 100000) req.destroy();
    });
    req.on('end', () => {
      clearTimeout(timer);
      try { finish(JSON.parse(raw || '{}')); } catch (_) { finish({}); }
    });
    req.on('error', () => { clearTimeout(timer); finish({}); });
  });
}

async function verifyTurnstile(secret, token, ip) {
  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip })
    });
    const data = await res.json();
    return !!(data && data.success);
  } catch (_) {
    return false;
  }
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const body = await readBody(req);
  const name = String(body.name || '').trim().slice(0, 120);
  const email = String(body.email || '').trim().slice(0, 200);
  const project = String(body.project || '').trim().slice(0, 5000);
  const token = String(body.token || '').trim();

  if (!name || !project || !EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: 'validation' });
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
  if (turnstileSecret) {
    if (!token) return res.status(400).json({ ok: false, error: 'captcha' });
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const valid = await verifyTurnstile(turnstileSecret, token, ip);
    if (!valid) return res.status(403).json({ ok: false, error: 'captcha' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(503).json({ ok: false, error: 'not_configured' });

  const to = process.env.CONTACT_TO || 'juaneshm3@gmail.com';
  const from = process.env.CONTACT_FROM || 'Portfolio <onboarding@resend.dev>';

  try {
    const send = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: email,
        subject: 'New project request — ' + name,
        text: 'Name: ' + name + '\nEmail: ' + email + '\n\n' + project
      })
    });
    if (!send.ok) return res.status(502).json({ ok: false, error: 'send_failed' });
    return res.status(200).json({ ok: true });
  } catch (_) {
    return res.status(502).json({ ok: false, error: 'send_failed' });
  }
};
