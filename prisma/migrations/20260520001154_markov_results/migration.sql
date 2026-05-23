-- CreateTable
CREATE TABLE "markov_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticker" TEXT NOT NULL,
    "years" INTEGER NOT NULL DEFAULT 5,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "markov_results_createdAt_idx" ON "markov_results"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "markov_results_ticker_years_key" ON "markov_results"("ticker", "years");
