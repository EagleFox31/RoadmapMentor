"""Browser e2e: a mentor creates a roadmap and attaches a learner from the UI only.

    TEST_BASE_URL=http://localhost:5055 python test/e2e/roadmaps-ui.e2e.py

Requires a dev-mode server on a disposable database (provisions mentor@test.com).
"""
import json, os, sys, time, urllib.request
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("TEST_BASE_URL")
if not BASE:
    sys.exit("TEST_BASE_URL not set")
RUN = str(int(time.time()))
PWD = "Test123!"
LEARNER_EMAIL = f"ui.learner.{RUN}@it.test"
TITLE = f"UI Roadmap {RUN}"


def api(method, path, body=None):
    req = urllib.request.Request(
        BASE + path, method=method,
        data=None if body is None else json.dumps(body).encode(),
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read() or "null")


def tid(page, name):
    return page.locator(f'[data-testid="{name}"]')


def login_ui(page, email):
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    tid(page, "input-email").fill(email)
    tid(page, "input-password").fill(PWD)
    tid(page, "button-submit-auth").click()
    page.wait_for_url("**/roadmap", timeout=10000)


def ok(msg):
    print("PASS", msg)


api("POST", "/api/auth/create-test-users")
api("POST", "/api/auth/register", {"fullName": "Ui Learner", "email": LEARNER_EMAIL, "password": PWD})

with sync_playwright() as p:
    browser = p.chromium.launch()

    mentor_page = browser.new_context().new_page()
    login_ui(mentor_page, "mentor@test.com")
    tid(mentor_page, "button-roadmaps").click()
    mentor_page.wait_for_url("**/roadmaps")
    ok("mentor reaches the roadmaps page from the navigation")

    tid(mentor_page, "input-roadmap-title").fill(TITLE)
    tid(mentor_page, "button-create-roadmap").click()
    expect(mentor_page.get_by_text(TITLE).first).to_be_visible()
    expect(tid(mentor_page, "mentorships-empty")).to_be_visible()
    ok("mentor creates a roadmap and sees the empty mentorship state")

    tid(mentor_page, "input-learner-email").fill("nobody@it.test")
    tid(mentor_page, "button-lookup-learner").click()
    expect(mentor_page.get_by_role("alert").filter(has_text="Aucun apprenant")).to_be_visible()
    ok("unknown e-mail shows an actionable error")

    tid(mentor_page, "input-learner-email").fill("mentor@test.com")
    tid(mentor_page, "button-lookup-learner").click()
    expect(mentor_page.get_by_role("alert").filter(has_text="Aucun apprenant")).to_be_visible()
    ok("a mentor account cannot be found as a learner")

    tid(mentor_page, "input-learner-email").fill(LEARNER_EMAIL)
    tid(mentor_page, "button-lookup-learner").click()
    expect(tid(mentor_page, "learner-found")).to_be_visible()
    tid(mentor_page, "button-attach-learner").click()
    expect(mentor_page.get_by_text("Actif").first).to_be_visible()
    ok("mentor attaches the learner without any manual API call")

    tid(mentor_page, "input-learner-email").fill(LEARNER_EMAIL)
    tid(mentor_page, "button-lookup-learner").click()
    expect(mentor_page.get_by_text("Déjà rattaché")).to_be_visible()
    ok("re-attaching is reported as already attached (conflict state)")

    learner_page = browser.new_context().new_page()
    login_ui(learner_page, LEARNER_EMAIL)
    tid(learner_page, "button-roadmaps").click()
    learner_page.wait_for_url("**/roadmaps")
    expect(learner_page.get_by_text(TITLE).first).to_be_visible()
    expect(tid(learner_page, "button-create-roadmap")).to_have_count(0)
    expect(tid(learner_page, "input-learner-email")).to_have_count(0)
    ok("learner sees the roadmap after login, without any mentor-only controls")

    browser.close()
print("ALL PASS")
