// ===== 06-legacy-storage.js =====
// ============================================================================
// LEGACY LOCAL STORAGE — simple synchronous persistence for the modules that
// have NOT yet been migrated to the DataService (Inventory, Test Types, Test
// Records, Equipment, Glassware, Gas). This is Phase-2 migration scope.
// The new Sample Lifecycle module (20/21) uses DataService instead — see
// 01-data-service.js for the async, backend-swappable replacement.
// ============================================================================
// ---------------- Persistence (browser localStorage — standalone file, not a Claude artifact) ----------------
// reportStorageError()/registerStorageErrorHandler() live in 00-core.js (it
// loads first, and 01-data-service.js needs them too) — see there.
function loadKey(key, fallback) {
  try {
    const raw = window.localStorage.getItem("aqualab:" + key);
    if (raw) return JSON.parse(raw);
    return fallback;
  } catch (e) {
    reportStorageError("load", key, e);
    return fallback;
  }
}
function saveKey(key, value) {
  try {
    window.localStorage.setItem("aqualab:" + key, JSON.stringify(value));
  } catch (e) {
    reportStorageError("save", key, e);
  }
}
