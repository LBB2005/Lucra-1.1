-- CreateTable
CREATE TABLE "strategies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "desc" TEXT NOT NULL DEFAULT '',
    "tickers" TEXT NOT NULL DEFAULT '[]',
    "sharpe" REAL NOT NULL DEFAULT 0,
    "cagr" REAL NOT NULL DEFAULT 0,
    "maxDD" REAL NOT NULL DEFAULT 0,
    "winRate" REAL NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "lastTrade" TEXT NOT NULL DEFAULT '—',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
