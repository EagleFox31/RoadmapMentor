"""Learner journey: register, see validated weeks only, evidence, comment."""
from playwright.sync_api import sync_playwright, expect
import re
from _support import *

EMAIL = f"e2e.learner.{RUN}@it.test"
steps = Steps()

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.set_default_timeout(10000)
    page.on("console", lambda m: print("console:", m.type, m.text[:200]) if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: print("pageerror:", str(e)[:300]))
    page.on("requestfailed", lambda r: print("requestfailed:", r.url[:150], r.failure))

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
    mentor_weeks = api("GET", f"/api/weeks?roadmapId={seeded['roadmap']}", mentor)
    objective = next(w for w in mentor_weeks if w["id"] == seeded["week"])["objectives"][0]
    second_task = api("POST", f"/api/objectives/{objective['id']}/tasks", mentor, {"label": "Deuxième tâche E2E"})
    video = api("POST", f"/api/weeks/{seeded['week']}/resources", mentor, {
        "label": "Vidéo YouTube guidée", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "resourceType": "VIDEO",
        "problemToSolve": "Comment retrouver une version stable après un bug ?",
        "practicePrompt": "Créer une branche, reproduire le bug et revenir au commit stable.",
        "estimatedMinutes": 15, "isRequired": True, "orderIndex": 1,
    })
    external = api("POST", f"/api/weeks/{seeded['week']}/resources", mentor, {
        "label": "Vidéo non intégrable", "url": "https://example.org/video",
        "resourceType": "VIDEO",
    })

    pdf_resource = api("POST", f"/api/weeks/{seeded['week']}/resources", mentor, {
        "label": "Documentation PDF", "url": "https://docs.example.org/manual.pdf",
        "resourceType": "DOC", "practicePrompt": "Lire puis appliquer au projet.",
    })
    # This PDF is fetched by the browser only; the app never proxies remote URLs.
    page.route("https://docs.example.org/manual.pdf", lambda route: route.fulfill(
        status=200,
        headers={"Content-Type": "application/pdf", "Access-Control-Allow-Origin": "*"},
        body=b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n",
    ))

    login_ui(page, EMAIL, PWD)
    expect(tid(page, f"icon-validated-{seeded['week']}")).to_be_visible()
    assert tid(page, f"card-week-{hidden['week']}").count() == 0, "unvalidated week must stay hidden"
    steps.ok("sees the validated week and not the unvalidated one")

    tid(page, f"card-week-{seeded['week']}").click()
    expect(tid(page, f"resource-priority-{video['id']}")).to_contain_text("Essentielle")
    expect(tid(page, f"resource-problem-{video['id']}")).to_contain_text("version stable")
    expect(tid(page, f"resource-practice-{video['id']}")).to_contain_text("Créer une branche")
    expect(tid(page, f"card-resource-{video['id']}")).to_contain_text("15 min indicatives")
    consult_button = tid(page, f"button-consult-resource-{video['id']}")
    expect(consult_button).to_contain_text("Marquer comme consultée")
    consult_button.click()
    expect(consult_button).to_contain_text("Consultée")
    page.reload()
    tid(page, f"card-week-{seeded['week']}").click()
    expect(tid(page, f"button-consult-resource-{video['id']}")).to_contain_text("Consultée")
    steps.ok("consultation is explicitly declared and survives a reload")

    tid(page, f"button-preview-pdf-{pdf_resource['id']}").click()
    expect(tid(page, "iframe-resource-pdf")).to_have_attribute("src", re.compile(r"^blob:"))
    expect(tid(page, "link-resource-pdf-original")).to_have_attribute("href", "https://docs.example.org/manual.pdf")
    tid(page, "button-close-pdf-preview").click()
    expect(tid(page, "iframe-resource-pdf")).to_have_count(0)
    steps.ok("previews a fetched PDF locally and keeps the source fallback")

    tid(page, f"button-play-resource-{video['id']}").click()
    video_frame = tid(page, "iframe-resource-video")
    expect(video_frame).to_have_attribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0")
    expect(tid(page, "link-resource-player-fallback")).to_have_attribute(
        "href", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    tid(page, "button-close-resource-player").click()
    expect(video_frame).to_have_count(0)
    assert tid(page, f"button-play-resource-{external['id']}").count() == 0
    assert tid(page, f"button-open-resource-{external['id']}").count() == 1
    steps.ok("plays supported video inline, closes player, keeps unsupported videos external")

    box = tid(page, f"checkbox-task-{seeded['task']}")
    assert box.is_disabled(), "a task cannot be ticked without evidence"
    first_input = tid(page, f"input-upload-screenshot-{seeded['task']}")
    second_input = tid(page, f"input-upload-screenshot-{second_task['id']}")
    assert first_input.get_attribute("id") != second_input.get_attribute("id"), "file inputs must use unique ids"
    for file_input in (first_input, second_input):
        element_id = file_input.get_attribute("id")
        assert page.locator(f'label[for="{element_id}"]').count() == 1, "each upload button must target its own input"
    steps.ok("two screenshot upload buttons target distinct file inputs")

    second_box = tid(page, f"checkbox-task-{second_task['id']}")
    page.set_input_files(f'[data-testid="input-upload-screenshot-{second_task["id"]}"]',
                         files=[{"name": "proof.png", "mimeType": "image/png", "buffer": PNG}])
    expect(second_box).to_have_attribute("data-state", "checked", timeout=15000)
    expect(box).to_have_attribute("data-state", "unchecked")
    steps.ok("uploading proof for second task never completes first task")
    page.set_input_files(f'[data-testid="input-upload-screenshot-{seeded["task"]}"]',
                         files=[{"name": "proof.png", "mimeType": "image/png", "buffer": PNG}])
    expect(box).to_have_attribute("data-state", "checked", timeout=15000)
    page.reload(); page.wait_for_load_state("networkidle")
    tid(page, f"card-week-{seeded['week']}").click()
    expect(tid(page, f"checkbox-task-{seeded['task']}")).to_have_attribute("data-state", "checked")
    proof_link = tid(page, f"link-screenshot-{seeded['task']}")
    expect(proof_link).to_be_visible()
    with page.expect_popup() as popup_info:
        proof_link.click()
    proof_tab = popup_info.value
    proof_tab.wait_for_url("blob:**", timeout=15000)
    assert proof_tab.url.startswith("blob:"), proof_tab.url
    proof_tab.close()
    steps.ok("completes a task with a screenshot, then opens it through authenticated evidence access")

    tid(page, "textarea-new-comment").fill("Bonjour mentor")
    tid(page, "button-submit-comment").click()
    expect(page.get_by_text("Bonjour mentor")).to_be_visible()
    steps.ok("posts a comment on the week")
    assert tid(page, "button-validate-week").count() == 0
    steps.ok("has no validate control")
    browser.close()

steps.done()
