"""Resource lifecycle: unapproved links stay hidden, mentor approves, learner reports, mentor resolves."""
from playwright.sync_api import sync_playwright, expect
from _support import *

steps = Steps()
mentor_email, mentor = ensure_mentor("resources")
learner_email = f"e2e.resources.{RUN}@it.test"
reg = api("POST", "/api/auth/register", body={"fullName": "E2E Resources Learner", "email": learner_email, "password": PWD})
base_week = seed_week(mentor, f"Semaine ressources {RUN}", validate=True, learner_id=reg["user"]["id"])

imported = api("POST", "/api/weeks/bulk", mentor, [{
    "roadmapId": base_week["roadmap"], "number": 2, "title": f"Semaine importée {RUN}",
    "startDate": "2026-10-12", "endDate": "2026-10-18",
    "objectives": [{"type": "PROJECT", "title": "Corriger un bug", "orderIndex": 0,
                    "tasks": [{"label": "Diagnostiquer", "orderIndex": 0}]}],
    "resources": [{"label": f"Lien à vérifier {RUN}", "url": "https://vimeo.com/123456789", "resourceType": "VIDEO"}],
}])
week_id = imported["weeks"][0]["id"]
resource_id = imported["weeks"][0]["resources"][0]["id"]
api("POST", f"/api/weeks/{week_id}/validate", mentor)

with sync_playwright() as p:
    browser = p.chromium.launch()
    mentor_page = browser.new_context().new_page()
    learner_page = browser.new_context().new_page()
    for page in (mentor_page, learner_page):
        page.set_default_timeout(10000)

    login_ui(mentor_page, mentor_email, MENTOR_PWD)
    tid(mentor_page, f"card-week-{week_id}").click()
    expect(tid(mentor_page, f"resource-pending-{resource_id}")).to_be_visible()
    expect(tid(mentor_page, f"button-approve-resource-{resource_id}")).to_be_visible()
    steps.ok("mentor sees the imported link flagged as pending verification")

    login_ui(learner_page, learner_email, PWD)
    tid(learner_page, f"card-week-{week_id}").click()
    expect(tid(learner_page, f"card-resource-{resource_id}")).to_have_count(0)
    steps.ok("learner does not see the unapproved link")

    tid(mentor_page, f"button-approve-resource-{resource_id}").click()
    expect(tid(mentor_page, f"resource-pending-{resource_id}")).to_have_count(0)
    steps.ok("mentor approves the link from the UI")

    learner_page.reload(); learner_page.wait_for_load_state("networkidle")
    tid(learner_page, f"card-week-{week_id}").click()
    expect(tid(learner_page, f"card-resource-{resource_id}")).to_be_visible()
    steps.ok("learner sees the link once approved")

    tid(learner_page, f"button-report-resource-{resource_id}").click()
    expect(tid(learner_page, f"resource-unavailable-{resource_id}")).to_be_visible()
    expect(tid(learner_page, f"button-report-resource-{resource_id}")).to_have_count(0)
    steps.ok("learner reports the link as unavailable, once")

    mentor_page.reload(); mentor_page.wait_for_load_state("networkidle")
    tid(mentor_page, f"card-week-{week_id}").click()
    expect(tid(mentor_page, f"resource-unavailable-{resource_id}")).to_be_visible()
    tid(mentor_page, f"button-clear-report-{resource_id}").click()
    expect(tid(mentor_page, f"resource-unavailable-{resource_id}")).to_have_count(0)
    steps.ok("mentor sees the report and clears it")

    learner_page.reload(); learner_page.wait_for_load_state("networkidle")
    tid(learner_page, f"card-week-{week_id}").click()
    expect(tid(learner_page, f"resource-unavailable-{resource_id}")).to_have_count(0)
    expect(tid(learner_page, f"button-report-resource-{resource_id}")).to_be_visible()
    steps.ok("learner sees the link as available again")
    browser.close()
