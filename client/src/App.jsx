import { useEffect, useMemo, useState } from "react";

const glyphs = {
  K: "♔", Q: "♕", R: "♖", B: "♗", N: "♘", P: "♙",
  k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟",
};

function readPieces(fen) {
  const rows = fen.split(" ")[0].split("/");
  const pieces = {};
  rows.forEach((row, rowIndex) => {
    let file = 0;
    for (const symbol of row) {
      if (/\d/.test(symbol)) {
        file += Number(symbol);
      } else {
        pieces[`${String.fromCharCode(97 + file)}${8 - rowIndex}`] = symbol;
        file += 1;
      }
    }
  });
  return pieces;
}

function kingSquare(pieces, turn) {
  const king = turn === "w" ? "K" : "k";
  return Object.keys(pieces).find((square) => pieces[square] === king);
}

export default function App() {
  const [game, setGame] = useState(null);
  const [selected, setSelected] = useState(null);
  const [flipped, setFlipped] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestState(path = "/api/state", method = "GET", body) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Request failed");
      setGame(data);
      setSelected(null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    requestState();
  }, []);

  const pieces = useMemo(() => game ? readPieces(game.fen) : {}, [game]);
  const checkedKing = game && ["check", "checkmate"].includes(game.status)
    ? kingSquare(pieces, game.turn)
    : null;
  const targets = selected && game ? game.legalMoves[selected] || [] : [];
  const lastMove = game && game.history.length ? game.history[game.history.length - 1] : null;

  async function playMove(from, to) {
    await requestState("/api/move", "POST", { from, to, promotion: "q" });
  }

  function clickSquare(square) {
    if (!game || busy || game.status === "checkmate" || game.status === "stalemate" || game.status === "draw") return;
    if (selected && targets.includes(square)) {
      playMove(selected, square);
      return;
    }
    if (game.legalMoves[square]) {
      setSelected(square === selected ? null : square);
    } else {
      setSelected(null);
    }
  }

  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
  const files = flipped ? ["h", "g", "f", "e", "d", "c", "b", "a"] : ["a", "b", "c", "d", "e", "f", "g", "h"];
  const statusText = game ? {
    playing: "Game in progress",
    check: "Check",
    checkmate: `Checkmate · ${game.turn === "w" ? "Black" : "White"} wins`,
    stalemate: "Draw · Stalemate",
    draw: "Draw",
  }[game.status] : "Loading game…";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-icon">♞</span><span>Chess<span className="brand-dot">.</span></span></div>
        <span className="topbar-label">A game of strategy</span>
      </header>

      <div className="game-layout">
        <section className="board-section" aria-label="Chess board">
          <div className="board-frame">
            <div className="board">
              {ranks.flatMap((rank, row) => files.map((file, column) => {
                const square = `${file}${rank}`;
                const piece = pieces[square];
                const isLight = (row + column) % 2 === 0;
                const isTarget = targets.includes(square);
                const classes = [
                  "square",
                  isLight ? "light" : "dark",
                  selected === square ? "selected" : "",
                  isTarget ? "target" : "",
                  (lastMove?.from === square || lastMove?.to === square) ? "last-move" : "",
                  checkedKing === square ? "in-check" : "",
                ].filter(Boolean).join(" ");
                return (
                  <button
                    className={classes}
                    key={square}
                    onClick={() => clickSquare(square)}
                    aria-label={`${square}${piece ? ` ${piece}` : ""}`}
                    type="button"
                  >
                    {column === 0 && <span className="coordinate rank-coordinate">{rank}</span>}
                    {row === 7 && <span className="coordinate file-coordinate">{file}</span>}
                    {piece && <span className={`piece ${piece === piece.toUpperCase() ? "white-piece" : "black-piece"}`}>{glyphs[piece]}</span>}
                    {isTarget && <span className={piece ? "capture-marker" : "move-marker"} />}
                  </button>
                );
              }))}
            </div>
          </div>
          <div className="board-footer">
            <span className="board-caption">Tap a piece, then choose a square</span>
            <button className="flip-button" onClick={() => setFlipped(!flipped)} type="button">↕ <span>Flip board</span></button>
          </div>
        </section>

        <aside className="side-panel">
          <section className="game-card">
            <div className="card-heading">
              <div>
                <p className="eyebrow">LOCAL GAME</p>
                <h1>Ready to play?</h1>
              </div>
              <span className="heading-piece">♟</span>
            </div>
            <div className="turn-card">
              <span className={`turn-disc ${game?.turn === "b" ? "black-turn" : ""}`}>{game?.turn === "b" ? "♟" : "♙"}</span>
              <div><span className="turn-label">CURRENT TURN</span><strong>{game?.turn === "b" ? "Black to move" : "White to move"}</strong></div>
              <span className="turn-pulse" />
            </div>
            <div className={`status-banner status-${game?.status || "playing"}`}>
              <span className="status-indicator" />
              <span>{statusText}</span>
            </div>
            {error && <p className="error-message" role="alert">{error}</p>}
            <div className="actions">
              <button className="undo-button" type="button" disabled={busy || !game?.history.length} onClick={() => requestState("/api/undo", "POST")}>↶ <span>Undo</span></button>
              <button className="new-game-button" type="button" disabled={busy} onClick={() => requestState("/api/reset", "POST")}>New game <span>↗</span></button>
            </div>
          </section>

          <section className="moves-card">
            <div className="moves-heading">
              <div><p className="eyebrow">THE MATCH</p><h2>Move history</h2></div>
              <span className="move-count">{game?.history.length || 0} plies</span>
            </div>
            <div className="move-list">
              {game?.history.length ? (
                Array.from({ length: Math.ceil(game.history.length / 2) }, (_, index) => (
                  <div className="move-row" key={index}>
                    <span className="move-number">{index + 1}.</span>
                    <span className={lastMove === game.history[index * 2] ? "latest-move" : ""}>{game.history[index * 2].san}</span>
                    <span className={lastMove === game.history[index * 2 + 1] ? "latest-move" : ""}>{game.history[index * 2 + 1]?.san || ""}</span>
                  </div>
                ))
              ) : <div className="empty-history"><span>♙</span><p>Your moves will appear here</p></div>}
            </div>
          </section>
          <p className="panel-note"><span>✦</span> Play at your own pace. No clock, just chess.</p>
        </aside>
      </div>
      <footer className="page-footer"><span>CHESS · CLASSIC EDITION</span><span>GOOD LUCK & HAVE FUN</span></footer>
    </main>
  );
}
