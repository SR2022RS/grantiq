// GET /api/auth/me — 200 when the caller is logged in (middleware gate), else 401.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.status(200).json({ ok: true, admin: true });
}
