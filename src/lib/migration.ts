import type { Application } from "@/types"

const MIGRATION_KEY = "_migrated_to_db_v1"

/**
 * Migrate localStorage applications to DB on first load.
 * Idempotent: only runs once per browser (uses localStorage flag).
 * Returns the count migrated, or null if already done / nothing to migrate.
 */
export async function migrateLocalStorageToDb(): Promise<number | null> {
  if (typeof window === "undefined") return null
  if (localStorage.getItem(MIGRATION_KEY)) return null

  const stored = localStorage.getItem("applications")
  if (!stored) {
    localStorage.setItem(MIGRATION_KEY, "1")
    return null
  }

  try {
    const apps: Application[] = JSON.parse(stored)
    if (apps.length === 0) {
      localStorage.setItem(MIGRATION_KEY, "1")
      return null
    }

    const res = await fetch("/api/apply/migrate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applications: apps }),
    })

    if (res.ok) {
      localStorage.setItem(MIGRATION_KEY, "1")
      return apps.length
    }
  } catch {
    // Silent: keep localStorage, retry next session
  }

  return null
}

/**
 * Clear the migration flag — useful for re-migration after a manual data reset.
 */
export function resetMigrationFlag() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(MIGRATION_KEY)
  }
}
