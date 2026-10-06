"""Shared helpers for the browser e2e journeys (Playwright for Python).

    pip install playwright && playwright install chromium
    TEST_BASE_URL=http://localhost:5055 DATABASE_URL=... JWT_SECRET=... python test/e2e/learner.e2e.py

Mentors are provisioned with scripts/create-mentor.ts, which works against a
development server and a production build alike (the create-test-users route
exists in development only).
"""
import base64, json, os, subprocess, sys, time, urllib.error, urllib.request

BASE = os.environ.get("TEST_BASE_URL")
if not BASE:
    sys.exit("TEST_BASE_URL not set")
RUN = str(int(time.time()))
PWD = "Test123!"
MENTOR_PWD = "Mentor-Test-123!"
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def api(method, path, token=None, body=None):
    req = urllib.request.Request(
        BASE + path, method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read() or "null")
    except urllib.error.HTTPError as e:
        raise AssertionError(f"{method} {path} -> {e.code} {e.read()[:200]}")


def ensure_mentor(label):
    """Provision a mentor through the operator script and return (email, token)."""
    email = f"e2e.mentor.{label}.{RUN}@it.test"
    subprocess.run(
        ["node", "--import", "tsx", "scripts/create-mentor.ts", f"--email={email}", f"--name=E2E Mentor {label}"],
        cwd=ROOT, check=True, capture_output=True, env={**os.environ, "MENTOR_PASSWORD": MENTOR_PWD})
    token = api("POST", "/api/auth/login", body={"email": email, "password": MENTOR_PWD})["token"]
    return email, token


def seed_week(mentor_token, title, validate=False, learner_id=None, roadmap_id=None):
    """Create a roadmap (unless given) with one week, one objective and one task."""
    if roadmap_id is None:
        roadmap_id = api("POST", "/api/roadmaps", mentor_token, {"title": f"E2E {RUN}"})["id"]
        if learner_id:
            api("POST", f"/api/roadmaps/{roadmap_id}/mentorships", mentor_token, {"learnerId": learner_id})
    number = len(api("GET", f"/api/weeks?roadmapId={roadmap_id}", mentor_token)) + 1
    wk = api("POST", "/api/weeks", mentor_token, {"roadmapId": roadmap_id, "number": number, "title": title,
                                                  "startDate": "2026-10-05", "endDate": "2026-10-11"})
    ob = api("POST", f"/api/weeks/{wk['id']}/objectives", mentor_token, {"title": "Objectif E2E", "type": "OTHER"})
    tk = api("POST", f"/api/objectives/{ob['id']}/tasks", mentor_token, {"label": "Tâche E2E"})
    if validate:
        api("POST", f"/api/weeks/{wk['id']}/validate", mentor_token)
    return {"roadmap": roadmap_id, "week": wk["id"], "task": tk["id"]}


def tid(page, name):
    return page.locator(f'[data-testid="{name}"]')


def login_ui(page, email, password):
    page.goto(BASE); page.wait_for_load_state("networkidle")
    tid(page, "input-email").fill(email); tid(page, "input-password").fill(password)
    tid(page, "button-submit-auth").click()
    page.wait_for_url("**/roadmap", timeout=10000)


def logout_ui(page):
    tid(page, "button-logout").click(); page.wait_for_load_state("networkidle")


class Steps:
    def __init__(self):
        self.count = 0

    def ok(self, msg):
        self.count += 1
        print("PASS", msg)

    def done(self):
        print(f"{self.count} e2e steps passed")
