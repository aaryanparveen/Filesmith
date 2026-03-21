export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/ai') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      if (request.method === 'POST') {
        const body = await request.text();
        const auth = request.headers.get('Authorization');

        const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(auth ? { Authorization: auth } : {}),
          },
          body,
        });

        const text = await res.text();
        return new Response(text, {
          status: res.status,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }
    }

    return env.ASSETS.fetch(request);
  },
};
