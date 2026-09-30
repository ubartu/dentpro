import { connection } from "next/server";

export default async function NotFound() {
  await connection();
  return (
    <main className="not-found-page">
      <div className="not-found-card">
        <span className="not-found-code">404</span>
        <h1>Bu sayfa bulunamadı.</h1>
        <p>Aradığın sayfa taşınmış veya adresi yanlış yazılmış olabilir.</p>
        <a className="button button-primary" href="/">Ana sayfaya dön</a>
      </div>
    </main>
  );
}
