/**
 * Client-only UI preferences (localStorage).
 * Not sent to server / settings.json.
 */

export interface UiPrefs {
  /** Auto-refresh tasks list (task page) */
  autoRefreshTasks: boolean
  /** Auto-refresh library book list */
  autoRefreshLibrary: boolean
}

const STORAGE_KEY = 'yuque-dl-ui-prefs'
const DEFAULTS: UiPrefs = {
  autoRefreshTasks: true,
  autoRefreshLibrary: true,
}

function readPrefs(): UiPrefs {
  if (!import.meta.client) return { ...DEFAULTS }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const data = JSON.parse(raw) as Partial<UiPrefs> & { autoRefresh?: boolean }
    // 兼容旧版单一 autoRefresh：两边都继承该值
    const legacy = data.autoRefresh
    const fromLegacy = typeof legacy === 'boolean' ? legacy : undefined
    return {
      autoRefreshTasks:
        typeof data.autoRefreshTasks === 'boolean'
          ? data.autoRefreshTasks
          : fromLegacy !== undefined
            ? fromLegacy
            : DEFAULTS.autoRefreshTasks,
      autoRefreshLibrary:
        typeof data.autoRefreshLibrary === 'boolean'
          ? data.autoRefreshLibrary
          : fromLegacy !== undefined
            ? fromLegacy
            : DEFAULTS.autoRefreshLibrary,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function writePrefs(prefs: UiPrefs) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        autoRefreshTasks: prefs.autoRefreshTasks,
        autoRefreshLibrary: prefs.autoRefreshLibrary,
      }),
    )
  } catch {
    // ignore quota / private mode
  }
}

/** Shared reactive prefs across pages (singleton) */
const g = globalThis as typeof globalThis & {
  __yuqueUiPrefs?: UiPrefs
}

function state(): UiPrefs {
  if (!g.__yuqueUiPrefs) {
    g.__yuqueUiPrefs = reactive(readPrefs()) as UiPrefs
  }
  return g.__yuqueUiPrefs
}

export function useUiPrefs() {
  const prefs = state()

  function setAutoRefreshTasks(v: boolean) {
    prefs.autoRefreshTasks = Boolean(v)
    writePrefs({
      autoRefreshTasks: prefs.autoRefreshTasks,
      autoRefreshLibrary: prefs.autoRefreshLibrary,
    })
  }

  function setAutoRefreshLibrary(v: boolean) {
    prefs.autoRefreshLibrary = Boolean(v)
    writePrefs({
      autoRefreshTasks: prefs.autoRefreshTasks,
      autoRefreshLibrary: prefs.autoRefreshLibrary,
    })
  }

  return {
    prefs,
    setAutoRefreshTasks,
    setAutoRefreshLibrary,
  }
}
