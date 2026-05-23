/*
  Warnings:

  - Added the required column `userId` to the `conversations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `holdings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `portfolio_settings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `strategies` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "style" TEXT NOT NULL DEFAULT '{}',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "briefings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tickers" TEXT NOT NULL DEFAULT '[]',
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "briefings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "backtests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "config" TEXT NOT NULL DEFAULT '{}',
    "result" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "backtests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_conversations" ("createdAt", "id", "title", "updatedAt") SELECT "createdAt", "id", "title", "updatedAt" FROM "conversations";
DROP TABLE "conversations";
ALTER TABLE "new_conversations" RENAME TO "conversations";
CREATE INDEX "conversations_userId_idx" ON "conversations"("userId");
CREATE TABLE "new_holdings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "companyName" TEXT,
    "shares" REAL NOT NULL,
    "avgCost" REAL NOT NULL,
    "sector" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "holdings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_holdings" ("avgCost", "companyName", "createdAt", "id", "sector", "shares", "ticker", "updatedAt") SELECT "avgCost", "companyName", "createdAt", "id", "sector", "shares", "ticker", "updatedAt" FROM "holdings";
DROP TABLE "holdings";
ALTER TABLE "new_holdings" RENAME TO "holdings";
CREATE INDEX "holdings_userId_idx" ON "holdings"("userId");
CREATE UNIQUE INDEX "holdings_ticker_userId_key" ON "holdings"("ticker", "userId");
CREATE TABLE "new_portfolio_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "cashBalance" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "portfolio_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_portfolio_settings" ("cashBalance", "id", "updatedAt") SELECT "cashBalance", "id", "updatedAt" FROM "portfolio_settings";
DROP TABLE "portfolio_settings";
ALTER TABLE "new_portfolio_settings" RENAME TO "portfolio_settings";
CREATE UNIQUE INDEX "portfolio_settings_userId_key" ON "portfolio_settings"("userId");
CREATE TABLE "new_strategies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "strategies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_strategies" ("active", "cagr", "config", "createdAt", "desc", "id", "lastTrade", "maxDD", "name", "research", "sharpe", "tag", "tickers", "updatedAt", "winRate") SELECT "active", "cagr", "config", "createdAt", "desc", "id", "lastTrade", "maxDD", "name", "research", "sharpe", "tag", "tickers", "updatedAt", "winRate" FROM "strategies";
DROP TABLE "strategies";
ALTER TABLE "new_strategies" RENAME TO "strategies";
CREATE INDEX "strategies_userId_idx" ON "strategies"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- CreateIndex
CREATE INDEX "briefings_userId_createdAt_idx" ON "briefings"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "backtests_userId_idx" ON "backtests"("userId");
