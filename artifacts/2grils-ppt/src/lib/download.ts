/**
 * Trigger a browser download of a protected file.
 *
 * Plain `<a download>` or `window.open(url)` do not attach the Bearer token
 * we store in `localStorage.auth_token`, so any server route that gates on
 * `Authorization` returns 403 for logged-in users. We instead fetch the file
 * with the token, materialise it as a Blob, and synthesise a click on a
 * temporary anchor pointing at the blob URL.
 *
 * `suggestedName` is best-effort: the browser will also honour any
 * `Content-Disposition: attachment; filename=...` the server sent, which
 * the `/api/download/:id` route already provides via `res.download()`.
 */
export async function downloadProtectedFile(url: string, suggestedName?: string): Promise<void> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    let message = `Tải file thất bại (HTTP ${res.status})`;
    try {
      const err = await res.json();
      if (err?.error) message = err.error;
    } catch {
      // Non-JSON error body — keep the generic message.
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = blobUrl;
    if (suggestedName) a.download = suggestedName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Defer revocation so Safari finishes the navigation.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
  }
}
