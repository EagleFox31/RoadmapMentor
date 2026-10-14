const DEFAULT_URL = "https://roadmapmentor.onrender.com/health/live";

export default {
  async scheduled(_controller, env) {
    await ping(env);
  },

  async fetch(_request, env) {
    const result = await ping(env);
    return Response.json(result, { status: result.ok ? 200 : 502 });
  },
};

async function ping(env) {
  const url = env.HEALTH_URL || DEFAULT_URL;
  const started = Date.now();
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const text = await res.text();
    const result = {
      ok: res.ok,
      status: res.status,
      ms: Date.now() - started,
      url,
      body: text.slice(0, 200),
    };
    console.log(JSON.stringify(result));
    return result;
  } catch (err) {
    const result = {
      ok: false,
      error: String(err),
      ms: Date.now() - started,
      url,
    };
    console.log(JSON.stringify(result));
    return result;
  }
}
