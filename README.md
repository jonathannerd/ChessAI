# SixySeveny

SixySeveny is a browser-based chess AI written from scratch with HTML, CSS, and vanilla JavaScript. It does not use chess.js, Stockfish, external chess engines, chess rules libraries, or frontend frameworks.

Open `https://jonathannerd.github.io/ChessAI/` in a browser to play. The project is fully static, so it can also be published directly with GitHub Pages.

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

### Training-Based Chess AI

A training-based chess AI learns patterns from data or self-play. Instead of only using hand-written material values, it uses a model, often a neural network, to estimate which positions and moves are strong.

Training-based systems need extra pieces that SixySeveny does not have yet:

- A dataset or self-play loop
- A neural network model
- A training process
- A way to save and load model weights
- A position encoder that turns chess boards into numbers
- Testing to compare model strength over time

### How Neural Network Training Could Be Added Later

Neural network training could be added as a second layer after the rule engine is stable. The current legal move generator would still be useful because a neural network should only choose legal moves.

A future version could:

1. Keep the current hand-written chess rules.
2. Encode each board position as numeric input.
3. Train a model from human games or SixySeveny self-play.
4. Use the model to evaluate positions instead of, or alongside, the material evaluation.
5. Combine neural evaluation with search, similar to how many modern chess engines still search through legal moves.

For now, SixySeveny is intentionally search-based and beginner-friendly.

## Deploying to GitHub Pages

SixySeveny is a static website. GitHub Pages can host it directly from the project root because `index.html`, `style.css`, and `script.js` are all in the root folder and are linked with relative paths.

To publish it:

1. Create a GitHub repository.
2. Push the project files to GitHub.
3. Open the repository on GitHub.
4. Go to **Settings**.
5. Go to **Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Choose the `main` branch.
8. Choose `/root`.
9. Save.
10. Wait for GitHub Pages to publish the site.

The site URL will usually look like:

```txt
https://USERNAME.github.io/REPOSITORY-NAME/
```

For this project, if the repository is `jonathannerd/ChessAI`, the URL will usually be:

```txt
https://jonathannerd.github.io/ChessAI/
```

GitHub Pages notes:

- `index.html` must stay in the repository root.
- CSS and JavaScript should stay linked with relative paths like `./style.css` and `./script.js`.
- There are no image or piece asset files to upload right now because SixySeveny uses Unicode chess pieces.
- The site does not require localhost, a backend server, a build command, or external chess libraries.

## Deployment Checklist

- `index.html` is in the root
- `style.css` loads correctly
- `script.js` loads correctly
- no localhost-only paths
- board works after deployment
- AI still moves correctly
- side switching still works
- training/localStorage still works

## Responsive UI Fix

This version includes a responsive layout fix for GitHub Pages and different devices:

- The app uses a flexible grid that keeps the board and side panel from squeezing each other.
- The chessboard frame uses viewport-aware sizing so it stays square on desktops, laptops, tablets, and phones.
- Coordinates are tied to the same grid as the board so they stay aligned when the board flips.
- Pieces use a broader chess-symbol font stack and responsive sizing to reduce differences between macOS, Windows, Chromebooks, and mobile browsers.
- The CSS and JavaScript links include a version query to help browsers load the newest deployed files instead of old cached copies.

If the deployed site still looks old after pushing, hard refresh the page:

- Mac: `Cmd + Shift + R`
- Windows/Chromebook: `Ctrl + F5`
