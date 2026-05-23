-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_strategies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "desc" TEXT NOT NULL DEFAULT '',
    "tickers" TEXT NOT NULL DEFAULT '[]',
    "config" TEXT NOT NULL DEFAULT '{}',
    "research" TEXT NOT NULL DEFAULT '',
    "sharpe" REAL NOT NULL DEFAULT 0,
    "cagr" REAL NOT NULL DEFAULT 0,
    "maxDD" REAL NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "lastTrade" TEXT NOT NULL DEFAULT '—',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_strategies" ("active", "cagr", "createdAt", "desc", "id", "lastTrade", "maxDD", "name", "sharpe", "tag", "tickers", "updatedAt", "winRate") SELECT "active", "cagr", "createdAt", "desc", "id", "lastTrade", "maxDD", "name", "sharpe", "tag", "tickers", "updatedAt", "winRate" FROM "strategies";
DROP TABLE "strategies";
ALTER TABLE "new_strategies" RENAME TO "strategies";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
