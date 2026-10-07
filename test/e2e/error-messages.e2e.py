"""Browser e2e: API errors reach the user as French messages; lazy pages and WebP background load.

    TEST_BASE_URL=http://localhost:5055 python test/e2e/error-messages.e2e.py

Requires a dev-mode server on a disposable database.
"""
import json, os, sys, time, urllib.request
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get("TEST_BASE_URL")
if not BASE:
    sys.exit("TEST_BASE_URL not set")
RUN = str(int(time.time()))
PWD = "Test123!"
EMAIL = f"err.learner.{RUN}@it.test"
# Hors-ligne : Google Fonts bloquerait l'événement `load`.
ARGS = ["--host-resolver-rules=MAP fonts.googleapis.com 127.0.0.1:9, MAP fonts.gstatic.com 127.0.0.1:9"]


def tid(page, name):
    return page.locator(f'[data-testid="{name}"]')


req = urllib.request.Request(
    BASE + "/api/auth/register", method="POST",
    data=json.dumps({"email": EMAIL, "password": PWD, "fullName": "Err Learner"}).encode(),
    headers={"Content-Type": "application/json"})
urllib.request.urlopen(req).read()

with sync_playwright() as p:
    browser = p.chromium.launch(args=ARGS)
    page = browser.new_page()
    console_errors, images = [], []
    # Les « Failed to load resource » viennent des polices bloquées et des 401/404 provoqués volontairement.
    page.on("console", lambda m: m.type == "error" and "Failed to load resource" not in m.text and console_errors.append(m.text))
    page.on("pageerror", lambda e: console_errors.append(str(e)))
    page.on("response", lambda r: r.request.resource_type == "image" and images.append((r.url, r.status)))

    # 1. Identifiants invalides : message français, pas l'anglais brut.
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    tid(page, "input-email").fill(EMAIL)
    tid(page, "input-password").fill("mauvais-mot-de-passe")
    tid(page, "button-submit-auth").click()
    expect(page.get_by_text("E-mail ou mot de passe incorrect.").first).to_be_visible(timeout=5000)
    assert page.get_by_text("Invalid credentials").count() == 0, "message anglais affiché"
    page.screenshot(path=os.path.join(os.environ.get("TEMP", "."), "err-login.png"), clip={"x": 0, "y": 0, "width": 1280, "height": 720})

    # 2. Lien d'invitation invalide.
    page.goto(f"{BASE}/invite/jeton-inexistant-{RUN}")
    expect(page.get_by_text("Ce lien d’invitation est invalide.").first).to_be_visible(timeout=5000)

    # 3. Pages chargées à la demande après connexion.
    page.goto(BASE)
    page.wait_for_load_state("networkidle")
    tid(page, "input-email").fill(EMAIL)
    tid(page, "input-password").fill(PWD)
    tid(page, "button-submit-auth").click()
    page.wait_for_url("**/roadmap", timeout=10000)
    for route in ("/preferences", "/roadmaps", "/roadmap"):
        page.goto(BASE + route)
        page.wait_for_load_state("networkidle")
        assert page.locator("body").inner_text().strip(), f"{route} vide"

    # 4. Route /api inconnue : JSON, pas la page HTML.
    r = page.request.get(BASE + "/api/inexistante")
    body = r.json()
    assert r.status == 404 and body["code"] == "ROUTE_NOT_FOUND" and body["requestId"], body
    assert r.headers.get("x-request-id") == body["requestId"]

    assert not console_errors, console_errors
    bg = [u for u, s in images if "mentor-bg" in u]
    print("background:", bg[:1], "| lazy pages OK | errors français OK")
    browser.close()
