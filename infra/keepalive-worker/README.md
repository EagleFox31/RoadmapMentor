# Keep-alive Render (Worker Cloudflare)

Ping `GET /health/live` toutes les **10 minutes** pour empêcher le plan gratuit Render de s'endormir (timer 15 min). GitHub Actions n'est pas assez régulier pour ça.

- Worker : `roadmapmentor-keepalive`
- Cron UTC : `*/10 * * * *`
- Cible : `https://roadmapmentor.onrender.com/health/live` (pas `/health/ready` : la base n'est pas prête au cold start)

Déployer (compte Cloudflare déjà utilisé pour R2) :

```bash
npx wrangler deploy --config infra/keepalive-worker/wrangler.jsonc
```

Ping manuel : [https://roadmapmentor-keepalive.lawrynnjennifer.workers.dev/](https://roadmapmentor-keepalive.lawrynnjennifer.workers.dev/)
