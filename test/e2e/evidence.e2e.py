"""Evidence upload: invalid files rejected, scoped tickets enforced, proof readable by learner and mentor only."""
import urllib.error, urllib.request
from playwright.sync_api import sync_playwright, expect
from _support import *

steps = Steps()
mentor_email, mentor = ensure_mentor("evidence")
learner_email = f"e2e.evidence.{RUN}@it.test"
learner = api("POST", "/api/auth/register", body={"fullName": "E2E Evidence Learner", "email": learner_email, "password": PWD})
outsider = api("POST", "/api/auth/register", body={"fullName": "E2E Outsider", "email": f"e2e.outsider.{RUN}@it.test", "password": PWD})
seeded = seed_week(mentor, f"Semaine preuves {RUN}", validate=True, learner_id=learner["user"]["id"])
learner_id = learner["user"]["id"]
SVG = b'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><script>alert(1)</script></svg>'


def status(method, path, token=None, headers=None, body=None):
    req = urllib.request.Request(BASE + path, method=method, data=body,
                                 headers={**({"Authorization": f"Bearer {token}"} if token else {}), **(headers or {})})
    try:
        with urllib.request.urlopen(req) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


with sync_playwright() as p:
    browser = p.chromium.launch()
    learner_page = browser.new_context().new_page()
    mentor_page = browser.new_context().new_page()
    for page in (learner_page, mentor_page):
        page.set_default_timeout(10000)

    login_ui(learner_page, learner_email, PWD)
    tid(learner_page, f"card-week-{seeded['week']}").click()
    box = tid(learner_page, f"checkbox-task-{seeded['task']}")
    upload = f'[data-testid="input-upload-screenshot-{seeded["task"]}"]'

    learner_page.set_input_files(upload, files=[{"name": "logo.svg", "mimeType": "image/svg+xml", "buffer": SVG}])
    expect(learner_page.get_by_text("Formats acceptés")).to_be_visible()
    expect(box).to_have_attribute("data-state", "unchecked")
    steps.ok("SVG is refused by the uploader and the task stays open")

    learner_page.set_input_files(upload, files=[{"name": "fake.png", "mimeType": "image/png", "buffer": SVG}])
    expect(learner_page.get_by_text("Erreur lors de l'upload")).to_be_visible()
    expect(box).to_have_attribute("data-state", "unchecked")
    steps.ok("non-image bytes labelled as PNG are refused by the server")

    learner_page.set_input_files(upload, files=[{"name": "proof.png", "mimeType": "image/png", "buffer": PNG}])
    expect(box).to_have_attribute("data-state", "checked", timeout=15000)
    steps.ok("a genuine PNG completes the task")

    start = api("POST", "/api/objects/upload", learner["token"], {})
    if not start["uploadURL"].startswith("/api/objects/local-upload/"):
        print("SKIP ticket checks: storage provider issues its own signed URLs")
    else:
        put = lambda token, ticket, ctype="image/png", body=PNG: status(
            "PUT", start["uploadURL"], token,
            {"Content-Type": ctype, **({"X-Upload-Ticket": ticket} if ticket else {})}, body)
        assert put(learner["token"], None) == 403, "bearer token alone must not upload"
        assert put(outsider["token"], start["uploadTicket"]) == 403, "another user cannot reuse the ticket"
        assert put(learner["token"], start["uploadTicket"], "image/svg+xml", SVG) in (400, 415), "SVG refused even with a valid ticket"
        assert put(learner["token"], start["uploadTicket"], "image/png", SVG) == 415, "image signature is verified"
        steps.ok("upload tickets are bound to their requester and file content is verified")

    evidence = f"/api/tasks/{seeded['task']}/evidence/{learner_id}"
    assert status("GET", evidence, learner["token"]) == 200
    assert status("GET", evidence, mentor) == 200
    assert status("GET", evidence, outsider["token"]) == 403
    assert status("GET", evidence) == 401
    steps.ok("proof is readable by its learner and mentor only")

    login_ui(mentor_page, mentor_email, MENTOR_PWD)
    tid(mentor_page, f"card-week-{seeded['week']}").click()
    with mentor_page.expect_popup() as popup_info:
        tid(mentor_page, f"link-screenshot-{seeded['task']}-{learner_id}").click()
    proof_tab = popup_info.value
    proof_tab.wait_for_url("blob:**", timeout=15000)
    proof_tab.close()
    steps.ok("mentor opens the learner proof from the week view")
    browser.close()
