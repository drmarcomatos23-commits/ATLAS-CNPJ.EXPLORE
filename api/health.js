export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    return res.status(405).json({ titulo: 'Método não permitido' });
  }
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ status: 'ok', provider: 'CNPJws', mode: 'vercel-function' });
}
