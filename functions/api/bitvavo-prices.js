/**
 * /api/bitvavo-prices?symbols=BTC,ETH,SOL — Cloudflare Pages Function
 * Haalt live EUR-koersen op via Bitvavo public ticker API.
 * Geen authenticatie nodig — public endpoint.
 */
export async function onRequestGet(context) {
  const { request } = context;
  const url     = new URL(request.url);
  const symbols = url.searchParams.get('symbols');

  if (!symbols) {
    return new Response(JSON.stringify({ error: 'symbols parameter verplicht, bijv. ?symbols=BTC,ETH' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const syms = symbols.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);

  try {
    const upstream = await fetch('https://api.bitvavo.com/v2/ticker/24h', {
      headers: { 'Accept': 'application/json' },
    });

    if (!upstream.ok) {
      throw new Error(`Bitvavo ticker: ${upstream.status}`);
    }

    const tickers = await upstream.json();

    const result = {};
    for (const sym of syms) {
      const market = `${sym}-EUR`;
      const ticker = tickers.find(t => t.market === market);
      if (ticker) {
        const last     = parseFloat(ticker.last)   || 0;
        const open     = parseFloat(ticker.open)   || last;
        const change24 = open > 0 ? ((last - open) / open) * 100 : 0;
        result[sym] = {
          price:     last,
          change24h: parseFloat(change24.toFixed(2)),
          high24h:   parseFloat(ticker.high)   || 0,
          low24h:    parseFloat(ticker.low)    || 0,
          volume:    parseFloat(ticker.volume) || 0,
          market,
        };
      }
    }

    return new Response(JSON.stringify({ prices: result, fetchedAt: new Date().toISOString() }), {
      status: 200,
      headers: {
        'Content-Type':  'application/json',
        'Cache-Control': 'max-age=30', // 30s cache
      },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
