import { DashboardPage } from "./pages/DashboardPage";
import { DebugPage } from "./pages/DebugPage";

export function App() {
  const isDebug = window.location.pathname.startsWith("/debug");

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">
            Cx
          </span>
          <div>
            <p className="eyebrow">Local Codex Usage</p>
            <h1>Codex 사용량</h1>
          </div>
        </div>
        <nav className="nav-links" aria-label="주요 페이지">
          <a className={!isDebug ? "active" : ""} href="/">
            대시보드
          </a>
          <a className={isDebug ? "active" : ""} href="/debug">
            디버그
          </a>
        </nav>
      </header>
      {isDebug ? <DebugPage /> : <DashboardPage />}
    </div>
  );
}
