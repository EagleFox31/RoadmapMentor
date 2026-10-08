"""Browser e2e of the mentor / learner journey (Playwright for Python).

    pip install playwright && playwright install chromium
    TEST_BASE_URL=http://localhost:5055 python test/e2e/mentor-learner.e2e.py

Requires a dev-mode server on a disposable database (provisions mentor@test.com).
Start it with RATE_LIMIT_AUTH_MAX=1000: the journey makes more auth calls than the default limiter allows.
"""
import json, os, sys, time, urllib.request
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("TEST_BASE_URL")
if not BASE:
    sys.exit("TEST_BASE_URL not set")
RUN = str(int(time.time()))
PWD = "Test123!"
EMAIL = f"e2e.learner.{RUN}@it.test"


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


def tid(page, name):
    return page.locator(f'[data-testid="{name}"]')


def login_ui(page, email, password):
    page.goto(BASE); page.wait_for_load_state("networkidle")
    tid(page, "input-email").fill(email); tid(page, "input-password").fill(password)
    tid(page, "button-submit-auth").click()
    page.wait_for_url("**/roadmap", timeout=10000)


def open_roadmap(page, roadmap_id):
    """The page is scoped to one roadmap: open the one under test, not the first listed."""
    page.wait_for_load_state("networkidle")
    page.goto(f"{BASE}/roadmap?roadmap={roadmap_id}")
    page.wait_for_load_state("networkidle")


def logout_ui(page):
    tid(page, "button-logout").click(); page.wait_for_load_state("networkidle")


import base64
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")

steps = []
def ok(msg): steps.append(msg); print("PASS", msg)


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.set_default_timeout(10000)

    # 1. A new user registers from the UI and is a learner
    page.goto(BASE); page.wait_for_load_state("networkidle")
    tid(page, "button-show-register").click()
    tid(page, "input-fullname").fill("E2E Learner")
    tid(page, "input-email").fill(EMAIL); tid(page, "input-password").fill(PWD)
    assert tid(page, "select-role").count() == 0, "no role selector on public registration"
    tid(page, "button-submit-auth").click()
    page.wait_for_url("**/roadmap")
    expect(tid(page, "badge-user-role")).to_contain_text("Apprenant")
    ok("learner registers from the UI and lands on /roadmap as Apprenant")
    assert tid(page, "button-add-week").count() == 0
    ok("learner has no 'add week' control")

    # 2. Mentor prepares a roadmap and assigns the learner (API)
    api("POST", "/api/auth/create-test-users")
    mentor = api("POST", "/api/auth/login", body={"email": "mentor@test.com", "password": PWD})["token"]
    learner = api("POST", "/api/auth/login", body={"email": EMAIL, "password": PWD})
    rm = api("POST", "/api/roadmaps", mentor, {"title": f"E2E {RUN}"})
    wk = api("POST", "/api/weeks", mentor, {"roadmapId": rm["id"], "number": 1, "title": f"Semaine E2E {RUN}",
                                            "startDate": "2026-10-05", "endDate": "2026-10-11"})
    ob = api("POST", f"/api/weeks/{wk['id']}/objectives", mentor, {"title": "Objectif E2E", "type": "OTHER"})
    tk = api("POST", f"/api/objectives/{ob['id']}/tasks", mentor, {"label": "Tâche E2E"})
    api("POST", f"/api/roadmaps/{rm['id']}/mentorships", mentor, {"learnerId": learner["user"]["id"]})

    logout_ui(page)

    # 3. Mentor validates the week from the UI (learners only see validated weeks)
    login_ui(page, "mentor@test.com", PWD)
    expect(tid(page, "badge-user-role")).to_contain_text("Mentor")
    open_roadmap(page, rm["id"])
    tid(page, f"card-week-{wk['id']}").click()
    tid(page, "button-validate-week").click()
    expect(tid(page, f"icon-validated-{wk['id']}")).to_be_visible()
    ok("mentor validates the week")
    logout_ui(page)

    # 4. Learner sees the validated week, ticks the task, comments
    login_ui(page, EMAIL, PWD)
    expect(tid(page, f"icon-validated-{wk['id']}")).to_be_visible()
    tid(page, f"card-week-{wk['id']}").click()
    box = tid(page, f"checkbox-task-{tk['id']}")
    assert box.is_disabled(), "a task cannot be ticked without evidence"
    page.set_input_files("#screenshot-upload", files=[{"name": "proof.png", "mimeType": "image/png", "buffer": PNG}])
    page.wait_for_timeout(1500)
    expect(box).to_have_attribute("data-state", "checked")
    page.reload(); page.wait_for_load_state("networkidle")
    tid(page, f"card-week-{wk['id']}").click()
    expect(tid(page, f"checkbox-task-{tk['id']}")).to_have_attribute("data-state", "checked")
    expect(tid(page, f"link-screenshot-{tk['id']}")).to_be_visible()
    ok("learner completes a task with a screenshot as evidence (persisted after reload)")

    tid(page, "textarea-new-comment").fill("Bonjour mentor")
    tid(page, "button-submit-comment").click()
    expect(page.get_by_text("Bonjour mentor")).to_be_visible()
    ok("learner posts a comment on the week")
    assert tid(page, "button-validate-week").count() == 0
    ok("learner has no validate control")
    logout_ui(page)

    # 5. Mentor reads the learner comment
    login_ui(page, "mentor@test.com", PWD)
    open_roadmap(page, rm["id"])
    tid(page, f"card-week-{wk['id']}").click()
    expect(page.get_by_text("Bonjour mentor")).to_be_visible()
    ok("mentor sees the learner comment")
    browser.close()

print(f"{len(steps)} e2e steps passed")
