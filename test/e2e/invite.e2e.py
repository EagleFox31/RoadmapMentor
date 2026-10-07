"""Invitation journey: mentor invites an unknown e-mail from the UI, the invitee joins via the link."""
from playwright.sync_api import sync_playwright, expect
from _support import *

steps = Steps()
email, mentor = ensure_mentor("invite")
invitee = f"e2e.invitee.{RUN}@it.test"
roadmap = api("POST", "/api/roadmaps", mentor, {"title": f"Roadmap invitation {RUN}"})


def forge_token(invitation_id):
    token = f"e2e-{RUN}-{invitation_id}"
    subprocess.run(
        ["node", "--import", "tsx", "test/integration/support/set-invitation-token.ts",
         f"--id={invitation_id}", f"--token={token}"],
        cwd=ROOT, check=True, capture_output=True, env=os.environ)
    return token


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.set_default_timeout(10000)
    page.on("pageerror", lambda e: print("pageerror:", str(e)[:300]))

    login_ui(page, email, MENTOR_PWD)
    page.goto(f"{BASE}/roadmaps"); page.wait_for_load_state("networkidle")
    tid(page, "input-learner-email").fill(invitee)
    tid(page, "button-lookup-learner").click()
    tid(page, "button-invite-learner").click()
    expect(tid(page, "invitations-list")).to_contain_text(invitee)
    invitations = api("GET", f"/api/roadmaps/{roadmap['id']}/invitations", mentor)
    assert len(invitations) == 1 and invitations[0]["email"] == invitee, invitations
    expect(tid(page, f"invitation-{invitations[0]['id']}")).to_contain_text(invitee)
    steps.ok("mentor invites an unregistered e-mail and sees it pending")

    token = forge_token(invitations[0]["id"])
    guest = browser.new_page()
    guest.set_default_timeout(10000)
    guest.goto(f"{BASE}/invite/{token}"); guest.wait_for_load_state("networkidle")
    assert tid(guest, "input-invite-email").input_value() == invitee
    assert tid(guest, "input-invite-email").get_attribute("readonly") is not None
    steps.ok("invite page shows the locked e-mail")

    tid(guest, "input-invite-name").fill("E2E Invitee")
    tid(guest, "input-invite-password").fill("Invitee-pass-1")
    tid(guest, "button-invite-accept").click()
    guest.wait_for_url("**/roadmap")
    expect(tid(guest, "badge-user-role")).to_contain_text("Apprenant")
    steps.ok("invitee signs up with name and password only and lands on /roadmap as Apprenant")

    guest.goto(f"{BASE}/invite/{token}"); guest.wait_for_load_state("networkidle")
    expect(tid(guest, "invite-signed-in")).to_be_visible()
    steps.ok("a signed-in visitor is told to log out first")
    browser.close()

steps.done()
