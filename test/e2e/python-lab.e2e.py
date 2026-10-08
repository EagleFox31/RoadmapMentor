"""Run an actual Pyodide lab in the production browser build.

This intentionally exercises the production CSP, jsDelivr Pyodide startup,
the browser worker, successful execution, and rerun-after-edit behavior.
It requires network access to Pyodide assets (first load can be slow).
"""
from playwright.sync_api import sync_playwright, expect
from _support import *

steps = Steps()
email, mentor = ensure_mentor("python-lab")
learner_email = f"e2e.python.{RUN}@it.test"
learner = api("POST", "/api/auth/register", body={
    "fullName": "Python E2E Learner", "email": learner_email, "password": PWD,
})
seeded = seed_week(mentor, f"Python browser {RUN}", learner_id=learner["user"]["id"])
lab = api("POST", f"/api/weeks/{seeded['week']}/labs", mentor, {
    "title": "Python browser smoke test",
    "instructions": "Exécuter du code Python réel dans le navigateur.",
    "difficulty": "BEGINNER",
    "estimatedMinutes": 10,
    "starterCode": "print('PYTHON_RUNTIME_READY')",
    "testCode": "assert 2 + 2 == 4\nprint('PYTHON_ASSERTIONS_PASSED')",
    "isPublished": True,
})
api("POST", f"/api/weeks/{seeded['week']}/validate", mentor)

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.set_default_timeout(15000)
    csp_errors = []
    page.on("console", lambda msg: csp_errors.append(msg.text)
            if msg.type == "error" and ("Content Security Policy" in msg.text or "violates" in msg.text)
            else None)

    login_ui(page, learner_email, PWD)
    tid(page, f"card-week-{seeded['week']}").click()
    lab_card = tid(page, f"card-lab-{lab['id']}")
    expect(lab_card).to_be_visible()
    lab_card.get_by_role("button", name="Ouvrir le lab").click()

    run_btn = page.get_by_role("button", name="Exécuter les tests")
    expect(run_btn).to_be_enabled(timeout=120000)
    steps.ok("Pyodide worker and packages initialize in production")

    submit_btn = page.get_by_role("button", name="Envoyer au mentor")
    expect(submit_btn).to_be_disabled()
    run_btn.click()
    expect(page.get_by_text("Exécution locale terminée (non vérifiée)")).to_be_visible(timeout=60000)
    expect(page.get_by_text("PYTHON_RUNTIME_READY", exact=False).last).to_be_visible()
    expect(page.get_by_text("PYTHON_ASSERTIONS_PASSED", exact=False).last).to_be_visible()
    expect(submit_btn).to_be_enabled()
    steps.ok("real Python and lab assertions run successfully")

    editor = page.locator(f"#lab-code-{lab['id']}")
    editor.fill("print('PYTHON_MODIFIED')")
    expect(submit_btn).to_be_disabled()
    expect(page.get_by_text("Code modifié depuis la dernière exécution", exact=False)).to_be_visible()
    steps.ok("edited Python cannot be submitted until rerun")

    run_btn.click()
    expect(page.get_by_text("Exécution locale terminée (non vérifiée)")).to_be_visible(timeout=60000)
    expect(page.get_by_text("PYTHON_MODIFIED", exact=False).last).to_be_visible()
    expect(submit_btn).to_be_enabled()
    submit_btn.click()
    expect(page.get_by_text("Lab envoyé")).to_be_visible(timeout=10000)
    steps.ok("executed code can be submitted")

    weeks = api("GET", f"/api/weeks?roadmapId={seeded['roadmap']}", learner["token"])
    submissions = next(x for x in weeks if x["id"] == seeded["week"])["labs"][0]["submissions"]
    assert submissions and submissions[0]["executionTrust"] == "CLIENT_UNVERIFIED"
    assert submissions[0]["code"] == "print('PYTHON_MODIFIED')"
    assert submissions[0]["status"] == "SUBMITTED"
    steps.ok("server stores code and marks execution unverified")

    assert not csp_errors, csp_errors
    browser.close()

steps.done()
