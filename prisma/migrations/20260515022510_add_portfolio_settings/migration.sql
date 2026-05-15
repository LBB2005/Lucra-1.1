-- CreateTable
CREATE TABLE "portfolio_settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "cashBalance" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
