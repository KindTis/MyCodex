import {
  DebugError,
  SourceName,
  emptyCcusageSummary,
  emptyCodexAppServerSummary,
  type CcusageSummary,
  type CodexAppServerSummary
} from "./types.js";

type SourceDebugState<TSummary> = {
  ok: boolean;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  summary: TSummary;
};

export type DebugSnapshot = {
  ccusage: SourceDebugState<CcusageSummary>;
  codexAppServer: SourceDebugState<CodexAppServerSummary>;
  errors: DebugError[];
};

export class DebugStore {
  private errors: DebugError[] = [];
  private readonly sources: DebugSnapshot = {
    ccusage: {
      ok: false,
      lastSuccessAt: null,
      lastFailureAt: null,
      summary: emptyCcusageSummary()
    },
    codexAppServer: {
      ok: false,
      lastSuccessAt: null,
      lastFailureAt: null,
      summary: emptyCodexAppServerSummary()
    },
    errors: this.errors
  };

  recordSuccess(source: "ccusage", at: string, summary: CcusageSummary): void;
  recordSuccess(source: "codexAppServer", at: string, summary: CodexAppServerSummary): void;
  recordSuccess(source: SourceName, at: string, summary: CcusageSummary | CodexAppServerSummary): void {
    if (source === "ccusage") {
      this.sources.ccusage.ok = true;
      this.sources.ccusage.lastSuccessAt = at;
      this.sources.ccusage.summary = summary as CcusageSummary;
      return;
    }

    this.sources.codexAppServer.ok = true;
    this.sources.codexAppServer.lastSuccessAt = at;
    this.sources.codexAppServer.summary = summary as CodexAppServerSummary;
  }

  recordFailure(source: SourceName, at: string, message: string): void {
    const state = this.sources[source];
    state.ok = false;
    state.lastFailureAt = at;
    this.errors.unshift({ at, source, message });
    this.errors = this.errors.slice(0, 20);
    this.sources.errors = this.errors;
  }

  snapshot(): DebugSnapshot {
    return {
      ccusage: { ...this.sources.ccusage, summary: { ...this.sources.ccusage.summary } },
      codexAppServer: {
        ...this.sources.codexAppServer,
        summary: {
          ...this.sources.codexAppServer.summary,
          bucketIds: [...this.sources.codexAppServer.summary.bucketIds]
        }
      },
      errors: this.errors.map((error) => ({ ...error }))
    };
  }

  clearForTests(): void {
    this.errors = [];
    this.sources.ccusage = {
      ok: false,
      lastSuccessAt: null,
      lastFailureAt: null,
      summary: emptyCcusageSummary()
    };
    this.sources.codexAppServer = {
      ok: false,
      lastSuccessAt: null,
      lastFailureAt: null,
      summary: emptyCodexAppServerSummary()
    };
    this.sources.errors = this.errors;
  }
}

export const debugStore = new DebugStore();
