export default async function handler(req: any, res: any) {
  if (res.setHeader) {
    res.setHeader('Content-Type', 'application/json');
  }
  if (typeof res.status === 'function') {
    return res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  }
  res.writeHead?.(200, { 'Content-Type': 'application/json' });
  return res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
}
