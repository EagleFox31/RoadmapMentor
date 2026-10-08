"""Mentor journey: sign in, validate a week from the UI, read a learner comment."""
from playwright.sync_api import sync_playwright, expect
from _support import *

steps = Steps()
email, mentor = ensure_mentor("journey")
learner_email = f"e2e.mentor-learner.{RUN}@it.test"
reg = api("POST", "/api/auth/register", body={"fullName": "E2E Mentee", "email": learner_email, "password": PWD})
seeded = seed_week(mentor, f"Semaine mentor {RUN}", learner_id=reg["user"]["id"])
lab = api("POST", f"/api/weeks/{seeded['week']}/labs", mentor, {
    "title": f"Lab Python {RUN}",
    "instructions": "Écrire une fonction simple.",
    "difficulty": "BEGINNER",
    "estimatedMinutes": 20,
    "starterCode": "print('bonjour')",
    "testCode": "assert 1 == 1",
    "isPublished": True,
})
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.set_default_timeout(10000)

    login_ui(page, email, MENTOR_PWD)
    expect(tid(page, "badge-user-role")).to_contain_text("Mentor")
    steps.ok("signs in from the UI as Mentor")

    tid(page, f"card-week-{seeded['week']}").click()
    tid(page, "button-validate-week").click()
    expect(tid(page, f"icon-validated-{seeded['week']}")).to_be_visible()
    steps.ok("validates the week from the UI")

    # Learners cannot submit work until the mentor validates the week.
    submission = api("PUT", f"/api/labs/{lab['id']}/submission", reg["token"], {
        "code": "print('bonjour')",
        "output": "Tests réussis",
        "submit": True,
    })
    assert submission["executionTrust"] == "CLIENT_UNVERIFIED"
    page.reload(); page.wait_for_load_state("networkidle")
    tid(page, f"card-week-{seeded['week']}").click()

    lab_card = tid(page, f"card-lab-{lab['id']}")
    expect(lab_card).to_be_visible()
    expect(lab_card.get_by_text("Résultat non vérifié")).to_be_visible()
    lab_card.get_by_text("Voir la solution").click()
    expect(lab_card.get_by_text("Exécution locale non vérifiée", exact=False)).to_be_visible()
    steps.ok("labels learner-supplied results as unverified")

    api("POST", f"/api/weeks/{seeded['week']}/comments", reg["token"], {"content": "Bonjour mentor"})
    page.reload(); page.wait_for_load_state("networkidle")
    tid(page, f"card-week-{seeded['week']}").click()
    expect(page.get_by_text("Bonjour mentor")).to_be_visible()
    steps.ok("reads the learner comment")
    browser.close()

steps.done()
