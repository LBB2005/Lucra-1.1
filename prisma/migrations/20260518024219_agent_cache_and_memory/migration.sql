-- CreateTable
CREATE TABLE "agent_cache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cacheKey" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ticker_memory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "insight" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_cache_cacheKey_key" ON "agent_cache"("cacheKey");

-- CreateIndex
CREATE INDEX "agent_cache_agentName_idx" ON "agent_cache"("agentName");

-- CreateIndex
CREATE INDEX "agent_cache_expiresAt_idx" ON "agent_cache"("expiresAt");

-- CreateIndex
CREATE INDEX "ticker_memory_ticker_createdAt_idx" ON "ticker_memory"("ticker", "createdAt");
