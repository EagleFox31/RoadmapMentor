"""Learner journey: register, see validated weeks only, evidence, comment."""
from playwright.sync_api import sync_playwright, expect
from _support import *

EMAIL = f"e2e.learner.{RUN}@it.test"
steps = Steps()

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.set_default_timeout(10000)

    page.goto(BASE); page.wait_for_load_state("networkidle")
    tid(page, "button-show-register").click()
    tid(page, "input-fullname").fill("E2E Learner")
    tid(page, "input-email").fill(EMAIL); tid(page, "input-password").fill(PWD)
    assert tid(page, "select-role").count() == 0, "no role selector on public registration"
    tid(page, "button-submit-auth").click()
    page.wait_for_url("**/roadmap")
    expect(tid(page, "badge-user-role")).to_contain_text("Apprenant")
    steps.ok("registers from the UI and lands on /roadmap as Apprenant")
    assert tid(page, "button-add-week").count() == 0
    steps.ok("has no 'add week' control")
    logout_ui(page)

    _, mentor = ensure_mentor("learner")
    learner = api("POST", "/api/auth/login", body={"email": EMAIL, "password": PWD})
    seeded = seed_week(mentor, f"Semaine E2E {RUN}", validate=True, learner_id=learner["user"]["id"])
    hidden = seed_week(mentor, f"Brouillon E2E {RUN}", roadmap_id=seeded["roadmap"])

    login_ui(page, EMAIL, PWD)
    expect(tid(page, f"icon-validated-{seeded['week']}")).to_be_visible()
    assert tid(page, f"card-week-{hidden['week']}").count() == 0, "unvalidated week must stay hidden"
    steps.ok("sees the validated week and not the unvalidated one")

    tid(page, f"card-week-{seeded['week']}").click()
    box = tid(page, f"checkbox-task-{seeded['task']}")
    assert box.is_disabled(), "a task cannot be ticked without evidence"
    page.set_input_files("#screenshot-upload", files=[{"name": "proof.png", "mimeType": "image/png", "buffer": PNG}])
    page.wait_for_timeout(1500)
    expect(box).to_have_attribute("data-state", "checked")
    page.reload(); page.wait_for_load_state("networkidle")
    tid(page, f"card-week-{seeded['week']}").click()
    expect(tid(page, f"checkbox-task-{seeded['task']}")).to_have_attribute("data-state", "checked")
    expect(tid(page, f"link-screenshot-{seeded['task']}")).to_be_visible()
    steps.ok("completes a task with a screenshot as evidence (persisted after reload)")

    tid(page, "textarea-new-comment").fill("Bonjour mentor")
    tid(page, "button-submit-comment").click()
    expect(page.get_by_text("Bonjour mentor")).to_be_visible()
    steps.ok("posts a comment on the week")
    assert tid(page, "button-validate-week").count() == 0
    steps.ok("has no validate control")
    browser.close()

steps.done()
