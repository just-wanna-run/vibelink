// Supabase REST API — minimal wrapper using Node.js https
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const BASE = `${SUPABASE_URL}/rest/v1`;

function req(method: string, path: string, body?: any, hdr?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const https = require('https');
    const { URL } = require('url');
    const u = new URL(`${BASE}${path}`);
    const headers: any = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...hdr,
    };
    const bodyStr = body ? JSON.stringify(body) : undefined;
    if (bodyStr) headers['Content-Length'] = Buffer.byteLength(bodyStr);

    const r = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers }, (res: any) => {
      let d = '';
      res.on('data', (c: string) => d += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(d ? JSON.parse(d) : null); } catch { resolve(null); }
        } else {
          reject(new Error(`DB ${method} ${path} -> ${res.statusCode}: ${d}`));
        }
      });
    });
    r.on('error', reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

type Row = Record<string, any>;

export function getDb() {
  return {
    from: (table: string) => ({
      // SELECT
      select: (cols: string = '*') => {
        let q = `/${table}?select=${cols}`;
        const chain: any = {
          eq: (c: string, v: any) => { q += `&${c}=eq.${encodeURIComponent(v)}`; return chain; },
          gt: (c: string, v: any) => { q += `&${c}=gt.${encodeURIComponent(v)}`; return chain; },
          lt: (c: string, v: any) => { q += `&${c}=lt.${encodeURIComponent(v)}`; return chain; },
          not: (c: string, op: string, v: any) => { q += `&${c}=not.is.${v}`; return chain; },
          order: (c: string, o?: any) => { q += `&order=${c}.${o?.ascending === false ? 'desc' : 'asc'}`; return chain; },
          limit: (n: number) => { q += `&limit=${n}`; return chain; },
          in: (c: string, vs: any[]) => { q += `&${c}=in.(${vs.map((v: any) => encodeURIComponent(v)).join(',')})`; return chain; },
          maybeSingle: (): Promise<{ data: Row | null }> => req('GET', `${q}&limit=1`).then((r: Row[]) => ({ data: r?.[0] || null })),
          single: (): Promise<{ data: Row | null }> => req('GET', `${q}&limit=1`).then((r: Row[]) => ({ data: r?.[0] || null })),
          then: (fn: (r: Row[]) => any) => req('GET', q).then(fn),
        };
        return chain;
      },
      // INSERT
      insert: (row: Row) => ({
        select: (): Promise<Row[]> => req('POST', `/${table}?select=*`, row, { 'Prefer': 'return=representation' }),
        then: (fn: (r: any) => any) => req('POST', `/${table}`, row, { 'Prefer': 'return=representation' }).then(fn),
      }),
      // UPDATE
      update: (row: Row) => ({
        eq: (c: string, v: any): Promise<any> => req('PATCH', `/${table}?${c}=eq.${encodeURIComponent(v)}`, row),
      }),
      // DELETE
      delete: () => {
        let dq = '';
        const dchain: any = {
          eq: (c: string, v: any) => { dq += `&${c}=eq.${encodeURIComponent(v)}`; return dchain; },
          in: (c: string, vs: any[]) => {
            dq += `&${c}=in.(${vs.map((v: any) => encodeURIComponent(v)).join(',')})`;
            return req('DELETE', `/${table}?${dq.slice(1)}`);
          },
          then: (fn: (r: any) => any) => req('DELETE', `/${table}?${dq.slice(1)}`).then(fn),
        };
        return dchain;
      },
    }),
  };
}
