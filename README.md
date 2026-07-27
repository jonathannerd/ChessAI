<div align="center">

# SixySeveny

**A browser chess engine built from scratch with HTML, CSS, and vanilla JavaScript.**

[Play SixySeveny](https://jonathannerd.github.io/ChessAI/)

![JavaScript](https://img.shields.io/badge/JavaScript-vanilla-F7DF1E?logo=javascript&logoColor=111)
![No engine dependency](https://img.shields.io/badge/chess_engine-built_from_scratch-7C3AED)
![GitHub Pages](https://img.shields.io/badge/deployed-GitHub_Pages-222?logo=github)

</div>

SixySeveny implements its own board state, legal-move generator, special chess rules, position evaluation, minimax search, and alpha-beta pruning. It does not use chess.js, Stockfish, an external chess engine, a chess-rules library, or a frontend framework.

## Highlights

- Play as White or Black with automatic board flipping
- Click-to-move controls and legal-move highlights
- Full castling, en passant, and promotion rules
- Check, checkmate, stalemate, and draw detection
- Four AI search depths
- Move history, status messages, and responsive layout
- Zero build step and no runtime dependencies

## Quick start

Open the [live GitHub Pages version](https://jonathannerd.github.io/ChessAI/), or clone and open the static site locally:

```bash
git clone https://github.com/jonathannerd/ChessAI.git
cd ChessAI
open index.html
```

## Files

- `index.html` creates the page structure: controls, chessboard, status text, move list, and pawn promotion dialog.
- `style.css` handles the board layout, responsive sizing, highlighted squares, controls, and game panels.
- `script.js` contains the chess rules, legal move system, draw detection, UI behavior, and SixySeveny AI.

## How The App Is Organized

### 1. Chessboard UI

The board is an 8 by 8 CSS grid. Every square is a button so the game can use click-to-move controls. The board is rendered from the current game state, and the render order changes when the user plays as Black so the board flips naturally.

### 2. Board Representation

The board is a two-dimensional array:

```js
board[row][col]
```

Rows run from `0` to `7`, where row `0` is rank 8 and row `7` is rank 1. Columns run from `0` to `7`, where column `0` is file `a`.

Each piece is an object:

```js
{ type: "p", color: "w" }
```

Piece types are:

- `p` pawn
- `n` knight
- `b` bishop
- `r` rook
- `q` queen
- `k` king

Colors are:

- `w` White
- `b` Black

### 3. Click-To-Move Controls

When the user clicks one of their pieces, the app finds that piece's legal moves and highlights them. Clicking a highlighted square plays the move. If a pawn reaches the last rank, the promotion dialog lets the user choose queen, rook, bishop, or knight.

### 4. Pseudo-Legal Move Generation

`generatePseudoLegalMoves()` creates moves based on how each piece moves:

- Pawns move forward, capture diagonally, move two squares from the starting rank, promote, and capture en passant.
- Knights jump in L-shapes.
- Bishops slide diagonally.
- Rooks slide horizontally and vertically.
- Queens combine bishop and rook movement.
- Kings move one square and can castle when the castling rules allow it.

Pseudo-legal moves know how pieces move, but they do not yet guarantee that the king is safe.

### 5. Check Detection

`isSquareAttacked()` checks whether a square is attacked by pawns, knights, bishops, rooks, queens, or kings. `isKingInCheck()` finds the king and asks whether the enemy attacks that square.

### 6. Fully Legal Moves

`getLegalMoves()` starts with pseudo-legal moves, plays each move on a cloned game state, and removes any move that leaves that side's own king in check. This is what handles pins, discovered checks, illegal king moves, and en passant cases that expose the king.

### 7. Special Rules

SixySeveny manually implements:

- Kingside and queenside castling
- No castling while in check
- No castling through check
- No castling after the king or rook has moved
- En passant
- Pawn promotion to queen, rook, bishop, or knight
- The fifty-move rule
- Threefold repetition
- Draw by insufficient material

### 8. Checkmate And Stalemate

`getGameResult()` checks the side to move. If that side has no legal moves and is in check, the game is checkmate. If that side has no legal moves and is not in check, the game is stalemate.

### 9. Evaluation Function

SixySeveny evaluates positions mostly by material:

```txt
Pawn   = 100
Knight = 320
Bishop = 330
Rook   = 500
Queen  = 900
King   = 100000
```

The score is positive when the position is good for SixySeveny and negative when it is good for the user. The evaluation also gives a small bonus for checking the enemy king and a small penalty when SixySeveny's own king is in check.

### 10. Minimax

`minimax()` searches future moves. SixySeveny assumes both sides will try to make the best move they can see:

- On SixySeveny's turn, it chooses the move with the highest score.
- On the user's simulated turn, it assumes the user chooses the move with the lowest score for SixySeveny.

### 11. Alpha-Beta Pruning

Alpha-beta pruning skips branches that cannot affect the final decision. It gives the same answer as minimax but usually searches fewer positions.

### 12. Difficulty

The difficulty selector controls search depth:

- Easy: depth 1
- Medium: depth 2
- Hard: depth 3
- Very Hard: depth 4

Higher depth means SixySeveny sees farther ahead, but it also takes longer to move.

### 13. Side Switching And Board Flipping

The user can choose White or Black. If the user chooses White, the user moves first. If the user chooses Black, SixySeveny plays White and moves first. The board is rendered from the user's point of view.

## Search-Based AI vs Training-Based AI

### Search-Based Chess AI

A search-based chess AI looks ahead through possible legal moves. It uses rules to generate moves, a search algorithm like minimax to explore them, and an evaluation function to estimate which final positions are best.

SixySeveny currently uses this approach:

- Generate legal moves.
- Search future move sequences.
- Evaluate leaf positions with material values.
- Choose the move with the best score.
