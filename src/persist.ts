// Ask the browser to keep this app's local data (IndexedDB / localStorage)
// durable so it can't be silently evicted or cleared under storage pressure.
// Best-effort: browsers grant persistence based on engagement / installation,
// so it may be denied — this never throws and never blocks startup.
export async function ensurePersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted?.()) return true;
    const granted = await navigator.storage.persist();
    if (!granted) {
      console.info(
        "[storage] Persistent storage not granted yet — local data is best-effort. " +
          "Add the app to your home screen or bookmark it to make storage durable.",
      );
    }
    return granted;
  } catch {
    return false;
  }
}
