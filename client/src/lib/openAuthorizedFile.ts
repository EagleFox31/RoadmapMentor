import { getAuthToken } from "@/lib/auth";

/**
 * Opens a protected file in a new tab without ever putting the session token in
 * a URL: the file is fetched with Authorization, then shown from a blob URL.
 * Throws if there is no session or the request fails; the caller reports it.
 */
export async function openAuthorizedFile(path: string, downloadName: string): Promise<void> {
  const token = getAuthToken();
  if (!token) throw new Error("No session");

  // Opening synchronously prevents popup blocking after the authenticated fetch.
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;
  try {
    const response = await fetch(path, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("File request failed");
    const url = URL.createObjectURL(await response.blob());
    if (tab && !tab.closed) {
      tab.location.replace(url);
    } else {
      // Fallback if the browser blocks new tabs: save the authorized file.
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      a.click();
    }
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (error) {
    tab?.close();
    throw error;
  }
}
