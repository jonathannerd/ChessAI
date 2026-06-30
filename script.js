(function () {
  "use strict";

  const white = "w";
  const black = "b";
  const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const promotionPieces = ["q", "r", "b", "n"];
  const difficultyDepths = {
    easy: 1,
    medium: 2,
    hard: 3,
    veryHard: 4
  };
  const maxQuiescenceDepth = 4;
  const maxTranspositionEntries = 50000;
  const exactFlag = "exact";
  const lowerBoundFlag = "lowerBound";
  const upperBoundFlag = "upperBound";

  const pieceValues = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 100000
  };

  const pieceNames = {
    p: "Pawn",
    n: "Knight",
    b: "Bishop",
    r: "Rook",
    q: "Queen",
    k: "King"
  };

  const pieceSymbols = {
    w: {
      k: "♔",
      q: "♕",
      r: "♖",
      b: "♗",
      n: "♘",
      p: "♙"
    },
    b: {
      k: "♚",
      q: "♛",
      r: "♜",
      b: "♝",
      n: "♞",
      p: "♟"
    }
  };

  const knightOffsets = [
    [-2, -1],
    [-2, 1],
    [-1, -2],
    [-1, 2],
    [1, -2],
    [1, 2],
    [2, -1],
    [2, 1]
  ];

  const kingOffsets = [
    [-1, -1],
    [-1, 0],
    [-1, 1],
    [0, -1],
    [0, 1],
    [1, -1],
    [1, 0],
    [1, 1]
  ];

  const bishopDirections = [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1]
  ];

  const rookDirections = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1]
  ];

  const queenDirections = bishopDirections.concat(rookDirections);

  let gameState;
  let selectedSquare = null;
  let selectedLegalMoves = [];
  let isAiThinking = false;
  let pendingPromotionMoves = [];
  let latestSearchStats = createSearchStats(0);
  let activeSearchToken = 0;
  const transpositionTable = new Map();

  let boardElement;
  let topCoordinatesElement;
  let bottomCoordinatesElement;
  let leftCoordinatesElement;
  let rightCoordinatesElement;
  let statusElement;
  let currentTurnElement;
  let evaluationElement;
  let thinkingElement;
  let searchDepthElement;
  let positionsSearchedElement;
  let tableHitsElement;
  let thinkingTimeElement;
  let bestMoveElement;
  let moveListElement;
  let moveCountElement;
  let restartButton;
  let difficultySelect;
  let sideButtons;
  let promotionDialog;
  let promotionChoices;

  function createPiece(type, color) {
    return { type: type, color: color };
  }

  function createInitialBoard() {
    const board = Array.from({ length: 8 }, function () {
      return Array(8).fill(null);
    });
    const backRank = ["r", "n", "b", "q", "k", "b", "n", "r"];

    for (let col = 0; col < 8; col += 1) {
      board[0][col] = createPiece(backRank[col], black);
      board[1][col] = createPiece("p", black);
      board[6][col] = createPiece("p", white);
      board[7][col] = createPiece(backRank[col], white);
    }

    return board;
  }

  function createNewGame(userColor, difficulty) {
    const state = {
      board: createInitialBoard(),
      turn: white,
      userColor: userColor,
      aiColor: oppositeColor(userColor),
      difficulty: difficulty,
      castlingRights: {
        w: { k: true, q: true },
        b: { k: true, q: true }
      },
      enPassantTarget: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
      moveHistory: [],
      lastMove: null,
      positionCounts: new Map(),
      gameOver: false
    };

    addCurrentPositionToCounts(state);
    return state;
  }

  function clonePiece(piece) {
    if (!piece) {
      return null;
    }
    return { type: piece.type, color: piece.color };
  }

  function cloneBoard(board) {
    return board.map(function (row) {
      return row.map(clonePiece);
    });
  }

  function cloneCastlingRights(rights) {
    return {
      w: { k: rights.w.k, q: rights.w.q },
      b: { k: rights.b.k, q: rights.b.q }
    };
  }

  function cloneSquare(square) {
    if (!square) {
      return null;
    }
    return { row: square.row, col: square.col };
  }

  function cloneLastMove(move) {
    if (!move) {
      return null;
    }

    return {
      from: cloneSquare(move.from),
      to: cloneSquare(move.to),
      piece: clonePiece(move.piece)
    };
  }

  function cloneStateForMove(state, shouldRecord) {
    return {
      board: cloneBoard(state.board),
      turn: state.turn,
      userColor: state.userColor,
      aiColor: state.aiColor,
      difficulty: state.difficulty,
      castlingRights: cloneCastlingRights(state.castlingRights),
      enPassantTarget: cloneSquare(state.enPassantTarget),
      halfmoveClock: state.halfmoveClock,
      fullmoveNumber: state.fullmoveNumber,
      moveHistory: shouldRecord ? state.moveHistory.slice() : state.moveHistory,
      lastMove: cloneLastMove(state.lastMove),
      positionCounts: shouldRecord ? new Map(state.positionCounts) : state.positionCounts,
      gameOver: state.gameOver
    };
  }

  function oppositeColor(color) {
    return color === white ? black : white;
  }

  function colorName(color) {
    return color === white ? "White" : "Black";
  }

  function isOnBoard(row, col) {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

  function squareName(row, col) {
    return files[col] + String(8 - row);
  }

  function sameSquare(first, second) {
    return Boolean(first && second && first.row === second.row && first.col === second.col);
  }

  function getPieceAt(board, square) {
    if (!square || !isOnBoard(square.row, square.col)) {
      return null;
    }
    return board[square.row][square.col];
  }

  function addMove(moves, board, fromRow, fromCol, toRow, toCol, extra) {
    const targetPiece = board[toRow][toCol];
    const move = {
      from: { row: fromRow, col: fromCol },
      to: { row: toRow, col: toCol },
      piece: clonePiece(board[fromRow][fromCol]),
      captured: clonePiece(targetPiece),
      promotion: null,
      isEnPassant: false,
      isCastle: false,
      castleSide: null
    };

    Object.assign(move, extra || {});
    moves.push(move);
  }

  function addPromotionMoves(moves, board, fromRow, fromCol, toRow, toCol, extra) {
    promotionPieces.forEach(function (promotionPiece) {
      addMove(
        moves,
        board,
        fromRow,
        fromCol,
        toRow,
        toCol,
        Object.assign({}, extra || {}, { promotion: promotionPiece })
      );
    });
  }

  function generatePseudoLegalMoves(state, color) {
    const moves = [];

    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const piece = state.board[row][col];
        if (!piece || piece.color !== color) {
          continue;
        }

        if (piece.type === "p") {
          generatePawnMoves(state, row, col, moves);
        } else if (piece.type === "n") {
          generateJumpMoves(state.board, row, col, moves, knightOffsets);
        } else if (piece.type === "b") {
          generateSlidingMoves(state.board, row, col, moves, bishopDirections);
        } else if (piece.type === "r") {
          generateSlidingMoves(state.board, row, col, moves, rookDirections);
        } else if (piece.type === "q") {
          generateSlidingMoves(state.board, row, col, moves, queenDirections);
        } else if (piece.type === "k") {
          generateKingMoves(state, row, col, moves);
        }
      }
    }

    return moves;
  }

  function generatePawnMoves(state, row, col, moves) {
    const board = state.board;
    const pawn = board[row][col];
    const direction = pawn.color === white ? -1 : 1;
    const startRow = pawn.color === white ? 6 : 1;
    const promotionRow = pawn.color === white ? 0 : 7;
    const oneStepRow = row + direction;
    const twoStepRow = row + direction * 2;

    if (isOnBoard(oneStepRow, col) && !board[oneStepRow][col]) {
      if (oneStepRow === promotionRow) {
        addPromotionMoves(moves, board, row, col, oneStepRow, col);
      } else {
        addMove(moves, board, row, col, oneStepRow, col);
      }

      if (row === startRow && !board[twoStepRow][col]) {
        addMove(moves, board, row, col, twoStepRow, col);
      }
    }

    [-1, 1].forEach(function (colOffset) {
      const targetRow = row + direction;
      const targetCol = col + colOffset;

      if (!isOnBoard(targetRow, targetCol)) {
        return;
      }

      const targetPiece = board[targetRow][targetCol];
      if (targetPiece && targetPiece.color !== pawn.color) {
        if (targetRow === promotionRow) {
          addPromotionMoves(moves, board, row, col, targetRow, targetCol);
        } else {
          addMove(moves, board, row, col, targetRow, targetCol);
        }
      }

      if (state.enPassantTarget && state.enPassantTarget.row === targetRow && state.enPassantTarget.col === targetCol) {
        const capturedPawn = board[row][targetCol];
        if (capturedPawn && capturedPawn.type === "p" && capturedPawn.color !== pawn.color) {
          addMove(moves, board, row, col, targetRow, targetCol, {
            captured: clonePiece(capturedPawn),
            isEnPassant: true
          });
        }
      }
    });
  }

  function generateJumpMoves(board, row, col, moves, offsets) {
    const piece = board[row][col];

    offsets.forEach(function (offset) {
      const targetRow = row + offset[0];
      const targetCol = col + offset[1];

      if (!isOnBoard(targetRow, targetCol)) {
        return;
      }

      const targetPiece = board[targetRow][targetCol];
      if (!targetPiece || targetPiece.color !== piece.color) {
        addMove(moves, board, row, col, targetRow, targetCol);
      }
    });
  }

  function generateSlidingMoves(board, row, col, moves, directions) {
    const piece = board[row][col];

    directions.forEach(function (direction) {
      let targetRow = row + direction[0];
      let targetCol = col + direction[1];

      while (isOnBoard(targetRow, targetCol)) {
        const targetPiece = board[targetRow][targetCol];

        if (!targetPiece) {
          addMove(moves, board, row, col, targetRow, targetCol);
        } else {
          if (targetPiece.color !== piece.color) {
            addMove(moves, board, row, col, targetRow, targetCol);
          }
          break;
        }

        targetRow += direction[0];
        targetCol += direction[1];
      }
    });
  }

  function generateKingMoves(state, row, col, moves) {
    generateJumpMoves(state.board, row, col, moves, kingOffsets);
    generateCastlingMoves(state, row, col, moves);
  }

  function generateCastlingMoves(state, row, col, moves) {
    const board = state.board;
    const king = board[row][col];
    const homeRow = king.color === white ? 7 : 0;
    const enemyColor = oppositeColor(king.color);

    if (row !== homeRow || col !== 4 || isKingInCheck(board, king.color)) {
      return;
    }

    if (state.castlingRights[king.color].k) {
      const rook = board[homeRow][7];
      const pathIsClear = !board[homeRow][5] && !board[homeRow][6];
      const pathIsSafe = !isSquareAttacked(board, homeRow, 5, enemyColor) && !isSquareAttacked(board, homeRow, 6, enemyColor);

      if (rook && rook.type === "r" && rook.color === king.color && pathIsClear && pathIsSafe) {
        addMove(moves, board, row, col, homeRow, 6, { isCastle: true, castleSide: "k" });
      }
    }

    if (state.castlingRights[king.color].q) {
      const rook = board[homeRow][0];
      const pathIsClear = !board[homeRow][1] && !board[homeRow][2] && !board[homeRow][3];
      const pathIsSafe = !isSquareAttacked(board, homeRow, 3, enemyColor) && !isSquareAttacked(board, homeRow, 2, enemyColor);

      if (rook && rook.type === "r" && rook.color === king.color && pathIsClear && pathIsSafe) {
        addMove(moves, board, row, col, homeRow, 2, { isCastle: true, castleSide: "q" });
      }
    }
  }

  function isSquareAttacked(board, row, col, attackingColor) {
    const pawnDirection = attackingColor === white ? -1 : 1;
    const pawnSourceRow = row - pawnDirection;

    for (let colOffset = -1; colOffset <= 1; colOffset += 2) {
      const pawnSourceCol = col + colOffset;
      if (isOnBoard(pawnSourceRow, pawnSourceCol)) {
        const pawn = board[pawnSourceRow][pawnSourceCol];
        if (pawn && pawn.color === attackingColor && pawn.type === "p") {
          return true;
        }
      }
    }

    for (let i = 0; i < knightOffsets.length; i += 1) {
      const sourceRow = row + knightOffsets[i][0];
      const sourceCol = col + knightOffsets[i][1];
      if (isOnBoard(sourceRow, sourceCol)) {
        const piece = board[sourceRow][sourceCol];
        if (piece && piece.color === attackingColor && piece.type === "n") {
          return true;
        }
      }
    }

    for (let i = 0; i < kingOffsets.length; i += 1) {
      const sourceRow = row + kingOffsets[i][0];
      const sourceCol = col + kingOffsets[i][1];
      if (isOnBoard(sourceRow, sourceCol)) {
        const piece = board[sourceRow][sourceCol];
        if (piece && piece.color === attackingColor && piece.type === "k") {
          return true;
        }
      }
    }

    if (isAttackedBySlidingPiece(board, row, col, attackingColor, bishopDirections, ["b", "q"])) {
      return true;
    }

    return isAttackedBySlidingPiece(board, row, col, attackingColor, rookDirections, ["r", "q"]);
  }

  function isAttackedBySlidingPiece(board, row, col, attackingColor, directions, attackingTypes) {
    for (let i = 0; i < directions.length; i += 1) {
      let sourceRow = row + directions[i][0];
      let sourceCol = col + directions[i][1];

      while (isOnBoard(sourceRow, sourceCol)) {
        const piece = board[sourceRow][sourceCol];
        if (piece) {
          if (piece.color === attackingColor && attackingTypes.includes(piece.type)) {
            return true;
          }
          break;
        }
        sourceRow += directions[i][0];
        sourceCol += directions[i][1];
      }
    }

    return false;
  }

  function findKing(board, color) {
    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const piece = board[row][col];
        if (piece && piece.color === color && piece.type === "k") {
          return { row: row, col: col };
        }
      }
    }
    return null;
  }

  function isKingInCheck(board, color) {
    const kingSquare = findKing(board, color);
    if (!kingSquare) {
      return true;
    }
    return isSquareAttacked(board, kingSquare.row, kingSquare.col, oppositeColor(color));
  }

  function getLegalMoves(state, color) {
    const pseudoMoves = generatePseudoLegalMoves(state, color);

    return pseudoMoves.filter(function (move) {
      const nextState = makeMove(state, move, { recordPosition: false });
      return !isKingInCheck(nextState.board, color);
    });
  }

  function makeMove(state, move, options) {
    const shouldRecord = Boolean(options && options.recordPosition);
    const nextState = cloneStateForMove(state, shouldRecord);
    const board = nextState.board;
    const piece = board[move.from.row][move.from.col];
    const targetPiece = board[move.to.row][move.to.col];
    const capturedPiece = move.isEnPassant ? board[move.from.row][move.to.col] : targetPiece;
    const wasPawnMove = piece.type === "p";
    const wasCapture = Boolean(capturedPiece);

    board[move.from.row][move.from.col] = null;

    if (move.isEnPassant) {
      board[move.from.row][move.to.col] = null;
    }

    if (move.isCastle) {
      moveRookForCastle(board, piece.color, move.castleSide);
    }

    if (move.promotion) {
      board[move.to.row][move.to.col] = createPiece(move.promotion, piece.color);
    } else {
      board[move.to.row][move.to.col] = piece;
    }

    updateCastlingRights(nextState.castlingRights, piece, move, capturedPiece);
    nextState.enPassantTarget = getNextEnPassantTarget(piece, move);
    nextState.halfmoveClock = wasPawnMove || wasCapture ? 0 : nextState.halfmoveClock + 1;

    if (state.turn === black) {
      nextState.fullmoveNumber += 1;
    }

    nextState.turn = oppositeColor(state.turn);
    nextState.gameOver = false;
    nextState.lastMove = {
      from: cloneSquare(move.from),
      to: cloneSquare(move.to),
      piece: clonePiece(piece)
    };

    if (shouldRecord) {
      const notation = buildMoveNotation(state, nextState, move, capturedPiece);
      nextState.moveHistory.push(notation);
      addCurrentPositionToCounts(nextState);
    }

    return nextState;
  }

  function moveRookForCastle(board, color, castleSide) {
    const homeRow = color === white ? 7 : 0;

    if (castleSide === "k") {
      board[homeRow][5] = board[homeRow][7];
      board[homeRow][7] = null;
    } else {
      board[homeRow][3] = board[homeRow][0];
      board[homeRow][0] = null;
    }
  }

  function updateCastlingRights(rights, piece, move, capturedPiece) {
    if (piece.type === "k") {
      rights[piece.color].k = false;
      rights[piece.color].q = false;
    }

    if (piece.type === "r") {
      removeRookCastlingRight(rights, piece.color, move.from.row, move.from.col);
    }

    if (capturedPiece && capturedPiece.type === "r") {
      removeRookCastlingRight(rights, capturedPiece.color, move.to.row, move.to.col);
    }
  }

  function removeRookCastlingRight(rights, color, row, col) {
    const homeRow = color === white ? 7 : 0;

    if (row !== homeRow) {
      return;
    }

    if (col === 0) {
      rights[color].q = false;
    } else if (col === 7) {
      rights[color].k = false;
    }
  }

  function getNextEnPassantTarget(piece, move) {
    if (piece.type !== "p" || Math.abs(move.to.row - move.from.row) !== 2) {
      return null;
    }

    return {
      row: (move.from.row + move.to.row) / 2,
      col: move.from.col
    };
  }

  function buildMoveNotation(previousState, nextState, move, capturedPiece) {
    if (move.isCastle) {
      return move.castleSide === "k" ? "O-O" : "O-O-O";
    }

    const piece = move.piece;
    const pieceLetter = piece.type === "p" ? "" : piece.type.toUpperCase();
    const captureMark = capturedPiece ? "x" : "-";
    const fromName = squareName(move.from.row, move.from.col);
    const toName = squareName(move.to.row, move.to.col);
    const promotionText = move.promotion ? "=" + move.promotion.toUpperCase() : "";
    const opponentColor = nextState.turn;
    const opponentInCheck = isKingInCheck(nextState.board, opponentColor);
    const opponentMoves = getLegalMoves(nextState, opponentColor);
    let ending = "";

    if (opponentInCheck && opponentMoves.length === 0) {
      ending = "#";
    } else if (opponentInCheck) {
      ending = "+";
    }

    return pieceLetter + fromName + captureMark + toName + promotionText + ending;
  }

  function getPositionKey(state) {
    const rows = state.board.map(function (row) {
      return row.map(function (piece) {
        if (!piece) {
          return ".";
        }
        return piece.color + piece.type;
      }).join("");
    });
    const rights = [
      state.castlingRights.w.k ? "K" : "",
      state.castlingRights.w.q ? "Q" : "",
      state.castlingRights.b.k ? "k" : "",
      state.castlingRights.b.q ? "q" : ""
    ].join("") || "-";
    const enPassant = getRelevantEnPassantKey(state);

    return rows.join("/") + " " + state.turn + " " + rights + " " + enPassant;
  }

  function getRelevantEnPassantKey(state) {
    if (!state.enPassantTarget) {
      return "-";
    }

    const direction = state.turn === white ? -1 : 1;
    const pawnRow = state.enPassantTarget.row - direction;

    for (let colOffset = -1; colOffset <= 1; colOffset += 2) {
      const pawnCol = state.enPassantTarget.col + colOffset;
      if (!isOnBoard(pawnRow, pawnCol)) {
        continue;
      }

      const pawn = state.board[pawnRow][pawnCol];
      if (pawn && pawn.type === "p" && pawn.color === state.turn) {
        return squareName(state.enPassantTarget.row, state.enPassantTarget.col);
      }
    }

    return "-";
  }

  function addCurrentPositionToCounts(state) {
    const key = getPositionKey(state);
    const currentCount = state.positionCounts.get(key) || 0;
    state.positionCounts.set(key, currentCount + 1);
  }

  function getGameResult(state, options) {
    const includeDrawRules = !options || options.includeDrawRules !== false;
    const legalMoves = getLegalMoves(state, state.turn);
    const currentPlayerInCheck = isKingInCheck(state.board, state.turn);

    if (legalMoves.length === 0) {
      if (currentPlayerInCheck) {
        const winner = oppositeColor(state.turn);
        return {
          type: "checkmate",
          winner: winner,
          message: colorName(winner) + " wins by checkmate."
        };
      }

      return {
        type: "stalemate",
        winner: null,
        message: "Draw by stalemate."
      };
    }

    if (!includeDrawRules) {
      return null;
    }

    if (hasInsufficientMaterial(state.board)) {
      return {
        type: "insufficientMaterial",
        winner: null,
        message: "Draw by insufficient material."
      };
    }

    if (state.halfmoveClock >= 100) {
      return {
        type: "fiftyMove",
        winner: null,
        message: "Draw by the fifty-move rule."
      };
    }

    const key = getPositionKey(state);
    if ((state.positionCounts.get(key) || 0) >= 3) {
      return {
        type: "threefold",
        winner: null,
        message: "Draw by threefold repetition."
      };
    }

    return null;
  }

  function hasInsufficientMaterial(board) {
    const pieces = [];

    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const piece = board[row][col];
        if (piece && piece.type !== "k") {
          pieces.push({ type: piece.type, squareColor: (row + col) % 2 });
        }
      }
    }

    if (pieces.length === 0) {
      return true;
    }

    if (pieces.length === 1 && (pieces[0].type === "b" || pieces[0].type === "n")) {
      return true;
    }

    if (pieces.every(function (piece) { return piece.type === "b"; })) {
      const firstSquareColor = pieces[0].squareColor;
      return pieces.every(function (piece) {
        return piece.squareColor === firstSquareColor;
      });
    }

    return false;
  }

  function createSearchStats(maxDepth) {
    return {
      currentDepth: 0,
      maxDepth: maxDepth,
      positionsSearched: 0,
      transpositionHits: 0,
      timeSpentMs: 0,
      bestMove: null,
      bestScore: null,
      startTime: getCurrentTime()
    };
  }

  function getCurrentTime() {
    if (typeof performance !== "undefined" && performance.now) {
      return performance.now();
    }

    return Date.now();
  }

  function updateSearchStatsTime(stats) {
    stats.timeSpentMs = Math.round(getCurrentTime() - stats.startTime);
  }

  function findBestMove(state, aiColor, depth) {
    const stats = createSearchStats(depth);
    let bestMove = null;
    let bestScore = -Infinity;
    let preferredMove = null;

    for (let currentDepth = 1; currentDepth <= depth; currentDepth += 1) {
      stats.currentDepth = currentDepth;
      const result = searchRootAtDepth(state, aiColor, currentDepth, preferredMove, stats);

      if (result.bestMove) {
        bestMove = result.bestMove;
        bestScore = result.bestScore;
        preferredMove = result.bestMove;
        stats.bestMove = cloneMoveForSearch(bestMove);
        stats.bestScore = bestScore;
      }

      updateSearchStatsTime(stats);
    }

    latestSearchStats = stats;
    return bestMove;
  }

  async function findBestMoveAsync(state, aiColor, depth, shouldContinue) {
    const stats = createSearchStats(depth);
    let bestMove = null;
    let bestScore = -Infinity;
    let preferredMove = null;

    latestSearchStats = stats;
    renderSearchStats();

    for (let currentDepth = 1; currentDepth <= depth; currentDepth += 1) {
      if (shouldContinue && !shouldContinue()) {
        break;
      }

      stats.currentDepth = currentDepth;

      const result = searchRootAtDepth(state, aiColor, currentDepth, preferredMove, stats);

      if (result.bestMove) {
        bestMove = result.bestMove;
        bestScore = result.bestScore;
        preferredMove = result.bestMove;
        stats.bestMove = cloneMoveForSearch(bestMove);
        stats.bestScore = bestScore;
      }

      updateSearchStatsTime(stats);
      latestSearchStats = stats;
      renderSearchStats();

      // Yielding between depths lets the browser repaint the thinking stats.
      await waitForBrowserToPaint();
    }

    updateSearchStatsTime(stats);
    latestSearchStats = stats;
    renderSearchStats();

    return bestMove;
  }

  function waitForBrowserToPaint() {
    if (typeof window === "undefined") {
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      window.setTimeout(resolve, 0);
    });
  }

  function searchRootAtDepth(state, aiColor, depth, preferredMove, stats) {
    const storedMove = getStoredBestMove(state, aiColor);
    const moveToTryFirst = preferredMove || storedMove;
    const legalMoves = orderMoves(state.board, getLegalMoves(state, aiColor), aiColor, state, moveToTryFirst);
    let bestMove = null;
    let bestScore = -Infinity;
    let alpha = -Infinity;
    const beta = Infinity;

    for (let i = 0; i < legalMoves.length; i += 1) {
      const move = legalMoves[i];
      const nextState = makeMove(state, move, { recordPosition: false });
      const score = minimax(nextState, depth - 1, alpha, beta, aiColor, stats);

      if (score > bestScore || !bestMove) {
        bestScore = score;
        bestMove = move;
      }

      alpha = Math.max(alpha, bestScore);
    }

    if (bestMove) {
      storeTranspositionEntry(state, aiColor, depth, bestScore, exactFlag, bestMove);
    }

    return {
      bestMove: bestMove,
      bestScore: bestScore
    };
  }

  function minimax(state, depth, alpha, beta, aiColor, stats) {
    if (stats) {
      stats.positionsSearched += 1;
    }

    const result = getGameResult(state, { includeDrawRules: false });

    if (result) {
      return evaluateState(state, aiColor, result, depth);
    }

    if (depth <= 0) {
      return quiescenceSearch(state.board, alpha, beta, state.turn, state, aiColor, stats, 0);
    }

    const originalAlpha = alpha;
    const originalBeta = beta;
    const tableEntry = transpositionTable.get(getSearchHash(state, aiColor));

    if (tableEntry && tableEntry.depth >= depth) {
      if (stats) {
        stats.transpositionHits += 1;
      }

      if (tableEntry.flag === exactFlag) {
        return tableEntry.score;
      }

      if (tableEntry.flag === lowerBoundFlag) {
        alpha = Math.max(alpha, tableEntry.score);
      } else if (tableEntry.flag === upperBoundFlag) {
        beta = Math.min(beta, tableEntry.score);
      }

      if (alpha >= beta) {
        return tableEntry.score;
      }
    }

    const preferredMove = tableEntry ? tableEntry.bestMove : null;
    const legalMoves = orderMoves(state.board, getLegalMoves(state, state.turn), state.turn, state, preferredMove);
    let bestMove = null;
    let bestScore;

    if (state.turn === aiColor) {
      bestScore = -Infinity;

      for (let i = 0; i < legalMoves.length; i += 1) {
        const move = legalMoves[i];
        const nextState = makeMove(state, move, { recordPosition: false });
        const score = minimax(nextState, depth - 1, alpha, beta, aiColor, stats);

        if (score > bestScore || !bestMove) {
          bestScore = score;
          bestMove = move;
        }

        alpha = Math.max(alpha, bestScore);

        if (beta <= alpha) {
          break;
        }
      }
    } else {
      bestScore = Infinity;

      for (let i = 0; i < legalMoves.length; i += 1) {
        const move = legalMoves[i];
        const nextState = makeMove(state, move, { recordPosition: false });
        const score = minimax(nextState, depth - 1, alpha, beta, aiColor, stats);

        if (score < bestScore || !bestMove) {
          bestScore = score;
          bestMove = move;
        }

        beta = Math.min(beta, bestScore);

        if (beta <= alpha) {
          break;
        }
      }
    }

    const flag = getTranspositionFlag(bestScore, originalAlpha, originalBeta);
    storeTranspositionEntry(state, aiColor, depth, bestScore, flag, bestMove);

    return bestScore;
  }

  function quiescenceSearch(board, alpha, beta, color, state, aiColor, stats, ply) {
    const searchState = state || createSearchStateFromBoard(board, color);
    const perspectiveColor = aiColor || color;
    const currentPly = ply || 0;

    if (stats) {
      stats.positionsSearched += 1;
    }

    const result = getGameResult(searchState, { includeDrawRules: false });

    if (result || currentPly >= maxQuiescenceDepth) {
      return evaluateState(searchState, perspectiveColor, result, maxQuiescenceDepth - currentPly);
    }

    const sideToMoveIsInCheck = isKingInCheck(searchState.board, searchState.turn);

    if (!sideToMoveIsInCheck) {
      const standPatScore = evaluateState(searchState, perspectiveColor, null, 0);

      if (searchState.turn === perspectiveColor) {
        if (standPatScore >= beta) {
          return beta;
        }

        alpha = Math.max(alpha, standPatScore);
      } else {
        if (standPatScore <= alpha) {
          return alpha;
        }

        beta = Math.min(beta, standPatScore);
      }
    }

    const legalMoves = getLegalMoves(searchState, searchState.turn);
    const tacticalMoves = legalMoves.filter(function (move) {
      return sideToMoveIsInCheck || isTacticalMove(searchState, move);
    });
    const orderedMoves = orderMoves(searchState.board, tacticalMoves, searchState.turn, searchState, null);

    if (searchState.turn === perspectiveColor) {
      for (let i = 0; i < orderedMoves.length; i += 1) {
        const nextState = makeMove(searchState, orderedMoves[i], { recordPosition: false });
        const score = quiescenceSearch(nextState.board, alpha, beta, nextState.turn, nextState, perspectiveColor, stats, currentPly + 1);

        if (score >= beta) {
          return beta;
        }

        alpha = Math.max(alpha, score);
      }

      return alpha;
    }

    for (let i = 0; i < orderedMoves.length; i += 1) {
      const nextState = makeMove(searchState, orderedMoves[i], { recordPosition: false });
      const score = quiescenceSearch(nextState.board, alpha, beta, nextState.turn, nextState, perspectiveColor, stats, currentPly + 1);

      if (score <= alpha) {
        return alpha;
      }

      beta = Math.min(beta, score);
    }

    return beta;
  }

  function evaluateState(state, aiColor, result, depth) {
    if (result) {
      if (result.type === "checkmate") {
        return result.winner === aiColor ? 1000000 + depth : -1000000 - depth;
      }
      return 0;
    }

    let score = 0;

    for (let row = 0; row < 8; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        const piece = state.board[row][col];
        if (!piece) {
          continue;
        }

        const value = pieceValues[piece.type];
        score += piece.color === aiColor ? value : -value;
      }
    }

    if (isKingInCheck(state.board, oppositeColor(aiColor))) {
      score += 20;
    }

    if (isKingInCheck(state.board, aiColor)) {
      score -= 20;
    }

    return score;
  }

  function getBoardHash(state) {
    return getPositionKey(state) + " " + state.halfmoveClock;
  }

  function getSearchHash(state, aiColor) {
    return getBoardHash(state) + " " + aiColor;
  }

  function getStoredBestMove(state, aiColor) {
    const tableEntry = transpositionTable.get(getSearchHash(state, aiColor));
    return tableEntry ? tableEntry.bestMove : null;
  }

  function storeTranspositionEntry(state, aiColor, depth, score, flag, bestMove) {
    if (!bestMove) {
      return;
    }

    // The table is deliberately simple: if it gets too large, start fresh.
    if (transpositionTable.size > maxTranspositionEntries) {
      transpositionTable.clear();
    }

    transpositionTable.set(getSearchHash(state, aiColor), {
      depth: depth,
      score: score,
      bestMove: cloneMoveForSearch(bestMove),
      flag: flag
    });
  }

  function getTranspositionFlag(score, originalAlpha, originalBeta) {
    if (score <= originalAlpha) {
      return upperBoundFlag;
    }

    if (score >= originalBeta) {
      return lowerBoundFlag;
    }

    return exactFlag;
  }

  function createSearchStateFromBoard(board, color) {
    return {
      board: cloneBoard(board),
      turn: color,
      userColor: oppositeColor(color),
      aiColor: color,
      difficulty: "medium",
      castlingRights: {
        w: { k: false, q: false },
        b: { k: false, q: false }
      },
      enPassantTarget: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
      moveHistory: [],
      lastMove: null,
      positionCounts: new Map(),
      gameOver: false
    };
  }

  function cloneMoveForSearch(move) {
    if (!move) {
      return null;
    }

    return {
      from: cloneSquare(move.from),
      to: cloneSquare(move.to),
      piece: clonePiece(move.piece),
      captured: clonePiece(move.captured),
      promotion: move.promotion,
      isEnPassant: move.isEnPassant,
      isCastle: move.isCastle,
      castleSide: move.castleSide
    };
  }

  function isSameMove(first, second) {
    return Boolean(
      first &&
      second &&
      sameSquare(first.from, second.from) &&
      sameSquare(first.to, second.to) &&
      first.promotion === second.promotion &&
      first.isCastle === second.isCastle &&
      first.isEnPassant === second.isEnPassant
    );
  }

  function orderMoves(board, moves, color, state, preferredMove) {
    const scoredMoves = moves.map(function (move) {
      return {
        move: move,
        score: scoreMoveForOrdering(board, move, color, state, preferredMove)
      };
    });

    scoredMoves.sort(function (first, second) {
      return second.score - first.score;
    });

    return scoredMoves.map(function (scoredMove) {
      return scoredMove.move;
    });
  }

  function scoreMoveForOrdering(board, move, color, state, preferredMove) {
    let score = scoreCenterMove(move);
    const checkDetails = state ? getMoveCheckDetails(state, move, color) : { givesCheck: false, isCheckmate: false };
    const capturedPiece = getCapturedPieceForMove(board, move);

    if (checkDetails.isCheckmate) {
      score += 10000000;
    }

    if (checkDetails.givesCheck) {
      score += 1000000;
    }

    if (preferredMove && isSameMove(move, preferredMove)) {
      score += 800000;
    }

    if (capturedPiece) {
      // MVV-LVA: valuable victims and cheap attackers are searched first.
      score += 100000 + pieceValues[capturedPiece.type] * 10 - pieceValues[move.piece.type];
    }

    if (move.promotion) {
      score += 50000 + pieceValues[move.promotion];
    }

    if (move.isCastle) {
      score += 10000;
    }

    return score;
  }

  function getMoveCheckDetails(state, move, color) {
    const nextState = makeMove(state, move, { recordPosition: false });
    const opponentColor = oppositeColor(color);
    const givesCheck = isKingInCheck(nextState.board, opponentColor);

    if (!givesCheck) {
      return {
        givesCheck: false,
        isCheckmate: false
      };
    }

    return {
      givesCheck: true,
      isCheckmate: getLegalMoves(nextState, opponentColor).length === 0
    };
  }

  function getCapturedPieceForMove(board, move) {
    if (move.captured) {
      return move.captured;
    }

    if (move.isEnPassant) {
      return board[move.from.row][move.to.col];
    }

    return board[move.to.row][move.to.col];
  }

  function isTacticalMove(state, move) {
    if (getCapturedPieceForMove(state.board, move) || move.promotion) {
      return true;
    }

    const nextState = makeMove(state, move, { recordPosition: false });
    return isKingInCheck(nextState.board, nextState.turn);
  }

  function scoreCenterMove(move) {
    const rowDistance = Math.abs(move.to.row - 3.5);
    const colDistance = Math.abs(move.to.col - 3.5);
    return Math.max(0, 28 - Math.round((rowDistance + colDistance) * 4));
  }

  function initApp() {
    boardElement = document.getElementById("chessboard");
    topCoordinatesElement = document.getElementById("topCoordinates");
    bottomCoordinatesElement = document.getElementById("bottomCoordinates");
    leftCoordinatesElement = document.getElementById("leftCoordinates");
    rightCoordinatesElement = document.getElementById("rightCoordinates");
    statusElement = document.getElementById("statusText");
    currentTurnElement = document.getElementById("currentTurnText");
    evaluationElement = document.getElementById("evaluationText");
    thinkingElement = document.getElementById("thinkingText");
    searchDepthElement = document.getElementById("searchDepthText");
    positionsSearchedElement = document.getElementById("positionsSearchedText");
    tableHitsElement = document.getElementById("tableHitsText");
    thinkingTimeElement = document.getElementById("thinkingTimeText");
    bestMoveElement = document.getElementById("bestMoveText");
    moveListElement = document.getElementById("moveList");
    moveCountElement = document.getElementById("moveCountText");
    restartButton = document.getElementById("restartButton");
    difficultySelect = document.getElementById("difficultySelect");
    sideButtons = Array.from(document.querySelectorAll(".sideButton"));
    promotionDialog = document.getElementById("promotionDialog");
    promotionChoices = document.getElementById("promotionChoices");

    gameState = createNewGame(white, difficultySelect.value);
    latestSearchStats = createSearchStats(difficultyDepths[difficultySelect.value] || 2);
    wireControls();
    render();
  }

  function wireControls() {
    restartButton.addEventListener("click", function () {
      startNewUiGame(gameState.userColor);
    });

    difficultySelect.addEventListener("change", function () {
      gameState.difficulty = difficultySelect.value;
      latestSearchStats.maxDepth = difficultyDepths[gameState.difficulty] || 2;
      renderStatus();
      renderSearchStats();
    });

    sideButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        startNewUiGame(button.dataset.side);
      });
    });
  }

  function startNewUiGame(userColor) {
    selectedSquare = null;
    selectedLegalMoves = [];
    pendingPromotionMoves = [];
    isAiThinking = false;
    activeSearchToken += 1;
    transpositionTable.clear();
    latestSearchStats = createSearchStats(difficultyDepths[difficultySelect.value] || 2);
    gameState = createNewGame(userColor, difficultySelect.value);
    updateSideButtons();
    hidePromotionDialog();
    render();
    maybeAskAiToMove();
  }

  function updateSideButtons() {
    sideButtons.forEach(function (button) {
      button.classList.toggle("active", button.dataset.side === gameState.userColor);
    });
  }

  function render() {
    renderBoard();
    renderStatus();
    renderSearchStats();
    renderMoveList();
  }

  function renderBoard() {
    boardElement.innerHTML = "";

    const rows = gameState.userColor === white ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const cols = gameState.userColor === white ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
    const checkSquare = isKingInCheck(gameState.board, gameState.turn) ? findKing(gameState.board, gameState.turn) : null;

    renderBoardCoordinates(rows, cols);

    rows.forEach(function (row) {
      cols.forEach(function (col) {
        const squareButton = document.createElement("button");
        const piece = gameState.board[row][col];
        const legalMove = findMoveToSquare(selectedLegalMoves, row, col);
        const isSelected = selectedSquare && selectedSquare.row === row && selectedSquare.col === col;
        const isLastMoveSquare = isSquareInLastMove(row, col);
        const isCheckSquare = sameSquare(checkSquare, { row: row, col: col });

        squareButton.type = "button";
        squareButton.className = "square " + ((row + col) % 2 === 0 ? "light" : "dark");
        squareButton.dataset.row = String(row);
        squareButton.dataset.col = String(col);
        squareButton.setAttribute("aria-label", buildSquareLabel(row, col, piece));

        if (isSelected) {
          squareButton.classList.add("selected");
        }

        if (legalMove) {
          squareButton.classList.add(legalMove.captured || legalMove.isEnPassant ? "captureMove" : "legalMove");
        }

        if (isLastMoveSquare) {
          squareButton.classList.add("lastMove");
        }

        if (isCheckSquare) {
          squareButton.classList.add("inCheck");
        }

        if (piece) {
          const pieceSpan = document.createElement("span");
          pieceSpan.className = "piece " + (piece.color === white ? "whitePiece" : "blackPiece");
          pieceSpan.textContent = pieceSymbols[piece.color][piece.type];
          squareButton.appendChild(pieceSpan);
        }

        squareButton.addEventListener("click", function () {
          handleSquareClick(row, col);
        });

        boardElement.appendChild(squareButton);
      });
    });
  }

  function renderBoardCoordinates(rows, cols) {
    const fileLabels = cols.map(function (col) {
      return files[col];
    });
    const rankLabels = rows.map(function (row) {
      return String(8 - row);
    });

    renderCoordinateLine(topCoordinatesElement, fileLabels);
    renderCoordinateLine(bottomCoordinatesElement, fileLabels);
    renderCoordinateLine(leftCoordinatesElement, rankLabels);
    renderCoordinateLine(rightCoordinatesElement, rankLabels);
  }

  function renderCoordinateLine(element, labels) {
    element.innerHTML = "";

    labels.forEach(function (label) {
      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;
      element.appendChild(labelSpan);
    });
  }

  function buildSquareLabel(row, col, piece) {
    const base = squareName(row, col);
    if (!piece) {
      return base + ", empty";
    }
    return base + ", " + colorName(piece.color) + " " + pieceNames[piece.type];
  }

  function isSquareInLastMove(row, col) {
    if (!gameState.lastMove) {
      return false;
    }

    return sameSquare(gameState.lastMove.from, { row: row, col: col }) || sameSquare(gameState.lastMove.to, { row: row, col: col });
  }

  function renderStatus() {
    const result = getGameResult(gameState);
    currentTurnElement.textContent = colorName(gameState.turn) + " (" + (gameState.turn === gameState.userColor ? "you" : "SixySeveny") + ")";
    evaluationElement.textContent = formatEvaluation(gameState, result);

    if (result) {
      gameState.gameOver = true;
      statusElement.textContent = result.message;
      return;
    }

    gameState.gameOver = false;

    if (isAiThinking) {
      statusElement.textContent = "SixySeveny is thinking as " + colorName(gameState.aiColor) + ".";
      return;
    }

    const checkText = isKingInCheck(gameState.board, gameState.turn) ? " " + colorName(gameState.turn) + " is in check." : "";
    const actorText = gameState.turn === gameState.userColor ? "Your move" : "SixySeveny to move";
    statusElement.textContent = actorText + " as " + colorName(gameState.turn) + "." + checkText;
  }

  function renderSearchStats() {
    if (!thinkingElement || !searchDepthElement || !positionsSearchedElement || !tableHitsElement || !thinkingTimeElement || !bestMoveElement) {
      return;
    }

    const stats = latestSearchStats || createSearchStats(difficultyDepths[gameState.difficulty] || 2);
    const maxDepth = stats.maxDepth || difficultyDepths[gameState.difficulty] || 2;

    thinkingElement.textContent = isAiThinking ? "Thinking" : "Idle";
    thinkingElement.classList.toggle("thinking", isAiThinking);
    searchDepthElement.textContent = String(stats.currentDepth || 0) + " / " + String(maxDepth);
    positionsSearchedElement.textContent = formatWholeNumber(stats.positionsSearched || 0);
    tableHitsElement.textContent = formatWholeNumber(stats.transpositionHits || 0);
    thinkingTimeElement.textContent = formatThinkingTime(stats.timeSpentMs || 0);
    bestMoveElement.textContent = formatMoveForStats(stats.bestMove);
  }

  function formatWholeNumber(value) {
    return Math.round(value).toLocaleString("en-US");
  }

  function formatThinkingTime(milliseconds) {
    if (milliseconds < 1000) {
      return String(milliseconds) + " ms";
    }

    return (milliseconds / 1000).toFixed(2) + " s";
  }

  function formatMoveForStats(move) {
    if (!move) {
      return "None yet";
    }

    const pieceLetter = move.piece.type === "p" ? "" : move.piece.type.toUpperCase();
    const separator = move.captured || move.isEnPassant ? "x" : "-";
    const promotionText = move.promotion ? "=" + move.promotion.toUpperCase() : "";

    return pieceLetter + squareName(move.from.row, move.from.col) + separator + squareName(move.to.row, move.to.col) + promotionText;
  }

  function formatEvaluation(state, result) {
    if (result) {
      if (result.winner === null) {
        return "0.00";
      }

      return result.winner === state.aiColor ? "Mate for SixySeveny" : "Mate against SixySeveny";
    }

    const score = evaluateState(state, state.aiColor, null, 0) / 100;
    const sign = score > 0 ? "+" : "";
    return "SixySeveny " + sign + score.toFixed(2);
  }

  function renderMoveList() {
    moveListElement.innerHTML = "";
    moveCountElement.textContent = gameState.moveHistory.length === 1 ? "1 move" : String(gameState.moveHistory.length) + " moves";

    gameState.moveHistory.forEach(function (notation, index) {
      const item = document.createElement("li");
      item.textContent = String(index + 1) + ". " + notation;
      moveListElement.appendChild(item);
    });

    moveListElement.scrollTop = moveListElement.scrollHeight;
  }

  function handleSquareClick(row, col) {
    if (gameState.gameOver || isAiThinking || gameState.turn !== gameState.userColor) {
      return;
    }

    const clickedPiece = gameState.board[row][col];

    if (selectedSquare) {
      const matchingMoves = selectedLegalMoves.filter(function (move) {
        return move.to.row === row && move.to.col === col;
      });

      if (matchingMoves.length > 0) {
        if (matchingMoves.length > 1 && matchingMoves[0].promotion) {
          showPromotionDialog(matchingMoves);
        } else {
          playMove(matchingMoves[0]);
        }
        return;
      }
    }

    if (clickedPiece && clickedPiece.color === gameState.userColor) {
      selectSquare(row, col);
      return;
    }

    selectedSquare = null;
    selectedLegalMoves = [];
    render();
  }

  function selectSquare(row, col) {
    const legalMoves = getLegalMoves(gameState, gameState.userColor).filter(function (move) {
      return move.from.row === row && move.from.col === col;
    });

    selectedSquare = legalMoves.length > 0 ? { row: row, col: col } : null;
    selectedLegalMoves = legalMoves;
    render();
  }

  function findMoveToSquare(moves, row, col) {
    for (let i = 0; i < moves.length; i += 1) {
      if (moves[i].to.row === row && moves[i].to.col === col) {
        return moves[i];
      }
    }
    return null;
  }

  function showPromotionDialog(moves) {
    pendingPromotionMoves = moves;
    promotionChoices.innerHTML = "";

    moves.forEach(function (move) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", "Promote to " + pieceNames[move.promotion]);
      button.textContent = pieceSymbols[gameState.userColor][move.promotion];
      button.addEventListener("click", function () {
        hidePromotionDialog();
        playMove(move);
      });
      promotionChoices.appendChild(button);
    });

    promotionDialog.classList.remove("hidden");
  }

  function hidePromotionDialog() {
    pendingPromotionMoves = [];
    promotionDialog.classList.add("hidden");
    promotionChoices.innerHTML = "";
  }

  function playMove(move) {
    gameState = makeMove(gameState, move, { recordPosition: true });
    selectedSquare = null;
    selectedLegalMoves = [];
    render();
    maybeAskAiToMove();
  }

  function maybeAskAiToMove() {
    const result = getGameResult(gameState);
    if (result || gameState.turn !== gameState.aiColor) {
      render();
      return;
    }

    isAiThinking = true;
    activeSearchToken += 1;
    const searchToken = activeSearchToken;
    const searchState = gameState;
    const depth = difficultyDepths[gameState.difficulty] || 2;
    latestSearchStats = createSearchStats(depth);
    render();

    window.setTimeout(function () {
      findBestMoveAsync(searchState, searchState.aiColor, depth, function () {
        return searchToken === activeSearchToken;
      }).then(function (move) {
        if (searchToken !== activeSearchToken) {
          return;
        }

        if (move) {
          gameState = makeMove(gameState, move, { recordPosition: true });
        }

        isAiThinking = false;
        selectedSquare = null;
        selectedLegalMoves = [];
        render();
      }).catch(function (error) {
        if (searchToken === activeSearchToken) {
          isAiThinking = false;
          statusElement.textContent = "SixySeveny search stopped: " + error.message;
          render();
        }
      });
    }, 120);
  }

  const sixySevenyApi = {
    createNewGame: createNewGame,
    createInitialBoard: createInitialBoard,
    generatePseudoLegalMoves: generatePseudoLegalMoves,
    getLegalMoves: getLegalMoves,
    isKingInCheck: isKingInCheck,
    isSquareAttacked: isSquareAttacked,
    makeMove: makeMove,
    getGameResult: getGameResult,
    hasInsufficientMaterial: hasInsufficientMaterial,
    evaluateState: evaluateState,
    minimax: minimax,
    quiescenceSearch: quiescenceSearch,
    orderMoves: orderMoves,
    findBestMove: findBestMove,
    findBestMoveAsync: findBestMoveAsync,
    getBoardHash: getBoardHash,
    getPositionKey: getPositionKey,
    squareName: squareName,
    pieceValues: pieceValues,
    difficultyDepths: difficultyDepths
  };

  if (typeof window !== "undefined") {
    window.SixySeveny = sixySevenyApi;
    window.addEventListener("DOMContentLoaded", initApp);
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = sixySevenyApi;
  }
}());
