const express = require("express");
const cors = require("cors");
const { Chess } = require("chess.js");

const app = express();
const port = 3001;
const chess = new Chess();
const history = [];

app.use(cors());
app.use(express.json());

function getState() {
  const legalMoves = {};
  for (const move of chess.moves({ verbose: true })) {
    if (!legalMoves[move.from]) legalMoves[move.from] = [];
    legalMoves[move.from].push(move.to);
  }

  let status = "playing";
  if (chess.isCheckmate()) status = "checkmate";
  else if (chess.isStalemate()) status = "stalemate";
  else if (chess.isDraw()) status = "draw";
  else if (chess.isCheck()) status = "check";

  return {
    fen: chess.fen(),
    turn: chess.turn(),
    history: history.map((move) => ({ ...move })),
    status,
    legalMoves,
  };
}

app.get("/api/state", (req, res) => {
  res.json(getState());
});

app.post("/api/move", (req, res) => {
  const { from, to, promotion } = req.body || {};
  if (typeof from !== "string" || typeof to !== "string") {
    return res.status(400).json({ error: "from and to are required" });
  }

  try {
    const piece = chess.get(from);
    const promotes = piece && piece.type === "p" &&
      ((piece.color === "w" && to[1] === "8") || (piece.color === "b" && to[1] === "1"));
    const move = chess.move({
      from,
      to,
      ...(promotion ? { promotion } : promotes ? { promotion: "q" } : {}),
    });
    history.push({
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color,
    });
    res.json(getState());
  } catch (error) {
    res.status(400).json({ error: "Illegal move" });
  }
});

app.post("/api/undo", (req, res) => {
  const move = chess.undo();
  if (move) history.pop();
  res.json(getState());
});

app.post("/api/reset", (req, res) => {
  chess.reset();
  history.length = 0;
  res.json(getState());
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Invalid JSON" });
  }
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Chess API listening on http://localhost:${port}`);
});
