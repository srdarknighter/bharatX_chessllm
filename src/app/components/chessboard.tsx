"use client";

import html2canvas from "html2canvas";
import { useState, useMemo, useEffect, useRef, JSX, SetStateAction } from "react";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { describeMove } from "../extras/moves";
import { getNextMove } from "../LLM/llm";
import { IPlayer } from "../extras/types";
import { llms } from "../extras/models";
import Image from "next/image";

const LLM_THINK_DELAY = 0.5;
const LOOP_DELAY = 0.5;

function delay(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function ChessBoard() {

  const game = useMemo(() => new Chess(), []);
  const [gamePosition, setGamePosition] = useState(game.fen());
  const [allMovesString, setAllMovesString] = useState<string[]>([]);
  const [isPlaying, setIsPlaying] = useState(false); // Play/Pause state
  const isPlayingRef = useRef(false);
  const [hasGameStarted, setHasGameStarted] = useState(false);
  const [isGameOver, setIsGameOver] = useState(true); // Game over state
  const isGameOverRef = useRef(true);
  const endDivRef = useRef<HTMLDivElement>(null);

  const [thinkingMessage, setThinkingMessage] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const isMoveInProgress = useRef(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const whiteModalRef = useRef<HTMLSelectElement | null>(null);
  const blackModalRef = useRef<HTMLSelectElement | null>(null);
  const whiteApiKeyRef = useRef<HTMLInputElement | null>(null);
  const blackApiKeyRef = useRef<HTMLInputElement | null>(null);
  const [whitePlayer, setWhitePlayer] = useState("");
  const [blackPlayer, setBlackPlayer] = useState("");

  const playersRef = useRef<Record<string, IPlayer | undefined>>({
    w: { color: "White", llm: llms[0], apiKey: "" },
    b: { color: "Black", llm: llms[0], apiKey: "" },
  });

  useEffect(() => {
    if (endDivRef.current) {
      endDivRef.current.scrollIntoView();
    }
  }, [allMovesString]);

  const handleSave = async () => {
    const whiteLlm = llms.find((llm) => llm.model === whiteModalRef.current?.value);
    const blackLlm = llms.find((llm) => llm.model === blackModalRef.current?.value);
    const whiteApiKey = whiteApiKeyRef.current?.value ?? "";
    const blackApiKey = blackApiKeyRef.current?.value ?? "";

    if (whiteLlm && blackLlm) {
      playersRef.current = {
        w: {
          color: "White",
          llm: whiteLlm,
          apiKey: whiteApiKey,
        },
        b: {
          color: "Black",
          llm: blackLlm,
          apiKey: blackApiKey,
        },
      };
      setSavedMessage("Settings saved successfully!");
      await delay(2);
      setSavedMessage("");
    } else {
      setErrorMessage("Error: LLM selection is invalid.");
      await delay(2);
      setErrorMessage("");
    }
  };

  const startGameLoop = async () => {
    console.log("Starting loop...");
    setHasGameStarted(true);
    isPlayingRef.current = true;
    isGameOverRef.current = false;
    setIsGameOver(false);
    setIsPlaying(true);

    const turnKey = game.turn();
    const players = playersRef.current;
    const isHumanGame = Object.values(players).some((player) => player?.llm.model === "human");
    if (isHumanGame) {
      const model = players[turnKey]?.llm.model;
      if (model !== "human") {
        await makeMove();
      }
    } else {
      while (true) {
        if (isGameOverRef.current) {
          console.log("Game over");
          break;
        }     
        if (isPlayingRef.current) {
          await makeMove();
        }
        await delay(LOOP_DELAY);
      }
      console.log("Game loop ended");
    }
  };

  const makeMove = async () => {
    isMoveInProgress.current = true;
    console.log("Making move");
    const moves = game.moves();
    let currentTurn = "";
    let lastTurn = "";
    const turnKey = game.turn();
    if (game.turn() === "w") {
      currentTurn = "White";
      lastTurn = "Black";
    } else {
      currentTurn = "Black";
      lastTurn = "White";
    }
    let move = "";
    if (moves.length === 1) move = moves[0];
    else {
      const canvas = await html2canvas(document.getElementById("cb")!);
      const img = canvas.toDataURL("image/png");
      const movesToStrings = moves.map((move) => describeMove(move));
      for (let retry = 0; retry < 1; retry++) {
        try {
          console.log(`Trying to get next move (try: ${retry + 1})...`);
          const previousMoves = game.history();
          const lastMove = previousMoves[previousMoves.length - 1] ?? "";
          const lastMoveString = lastMove
              ? `${lastTurn}: ${describeMove(lastMove)}`
              : "No previous moves yet.";
          setThinkingMessage(`${currentTurn} is thinking...`);
          const provider = playersRef.current[turnKey]?.llm.provider;
          const model = playersRef.current[turnKey]?.llm.model;
          const apiKey = playersRef.current[turnKey]?.apiKey;
          if (!provider || !model || !apiKey) {
            throw new Error("Provider, model, or API key is undefined");
          }
          const nextMove = await getNextMove({
            currentStateImage: img,
            allMoves: movesToStrings,
            provider,
            model,
            color: game.turn() === "w" ? "White" : "Black",
            lastMove: lastMoveString,
            apiKey,
          });
          await delay(LLM_THINK_DELAY);
          setThinkingMessage("");
          if (nextMove < 0 || nextMove >= moves.length) {
            throw new Error(`Invalid move: ${nextMove}`);
          }
          move = moves[nextMove];
          break;
        } catch (e) {
          console.error(`Error: ${e}. Trying again...`);
        } finally {
          isMoveInProgress.current = false;
          setThinkingMessage("");
        }
      }
    }
    try {
      const moveString = `${currentTurn}: ${describeMove(move)}`;
      if (!isGameOverRef.current) {
        game.move(move);
      } else return;
      setAllMovesString((prev) => [...prev, moveString]);
      setGamePosition(game.fen());
      if (game.isGameOver()) {
        let reason = "";
        if (game.isCheckmate()) reason = "Checkmate";
        else if (game.isStalemate()) reason = "Stalemate";
        else if (game.isDraw()) reason = "Draw";
        const finalStringToDisplay = `Game Over: ${reason}.${
            !game.isDraw() ? ` Winner: ${currentTurn}.` : ""
        }`;
        setResultMessage(finalStringToDisplay);
        setAllMovesString((prev) => [...prev, finalStringToDisplay]);
        setIsGameOver(true);
        isGameOverRef.current = true;
      }
      isMoveInProgress.current = false;
    } catch (e) {
      console.error(e);
      isMoveInProgress.current = false;
      resetGame();
      setErrorMessage(
          "Error occured finding next move, make sure API key is correct."
      );
      await delay(3);
      setErrorMessage("");
    } finally {
      isMoveInProgress.current = false;
    }
  };

  const togglePlayPause = () => {
    if (isPlayingRef.current) {
      isPlayingRef.current = false;
    } else {
      isPlayingRef.current = true;
    }
    setIsPlaying(!isPlaying);
  };

  const resetGame = () => {
    isMoveInProgress.current = false;
    game.reset();
    setGamePosition(game.fen());
    setAllMovesString([]);
    setIsGameOver(true);
    isGameOverRef.current = true;
    setIsPlaying(false);
    isPlayingRef.current = false;
    setResultMessage("");
    setThinkingMessage("");
    setHasGameStarted(false);
    console.log("Game reset");
  };

  const [activeSquare, setActiveSquare] = useState("");
  const threeDPieces = useMemo(() => {
    const pieces = ["wP", "wN", "wB", "wR", "wQ", "wK", "bP", "bN", "bB", "bR", "bQ", "bK"];
    
    const pieceComponents: Record<string, (props: { squareWidth: number }) => JSX.Element> = {};
    pieces.forEach((piece) => {
      pieceComponents[piece] = ({ squareWidth }: { squareWidth: number }) => (
        <div style={{ 
          width: squareWidth,
          height: squareWidth,
          position: "relative",
          pointerEvents: "none"
        }}>
          <Image
            src={`/media/${piece}.png`}
            alt={`${piece} piece`}
            width={squareWidth}
            height={squareWidth}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain'
            }}
          />
        </div>
      );
    });
    return pieceComponents;
  }, []);
  
  const onDrop = (
    sourceSquare: string,
    targetSquare: string,
    piece: string
  ): boolean => {
    const move = game.move({
      from: sourceSquare,
      to: targetSquare,
      promotion: piece[1]?.toLowerCase() ?? "q",
    });

    
    let currentTurn = "";
    if (game.turn() === "w") {
      currentTurn = "Black";
    } else {
      currentTurn = "White";
    }
    const lastMove = game.history().slice(-1)[0];
    const moveString = `${currentTurn}: ${describeMove(lastMove)}`;   
    setGamePosition(game.fen());
    setAllMovesString((prev) => [...prev, moveString]);

    if (move === null) return false;
    if (game.isGameOver() || game.isDraw()) return false;

    const players = playersRef.current;
    const isAllHumanGame = Object.values(players).every((player) => player?.llm.model === "human");
    if (!isAllHumanGame) {
      makeMove()
    }
    return true;
  };

  return (
      <div className="flex flex-row gap-10 items-start justify-start">
        
        <div className="flex flex-col flex-grow gap-2 justify-start mt-5 bg-gray-100 rounded-lg w-full pt-3 min-h-[85vh] h-full">
          <h3 className="text-xl font-semibold text-center">Moves</h3>
          {allMovesString.map((moveString, index) => (
              <div className="mx-3" key={index}>
                {moveString}
              </div>
          ))}
          <div ref={endDivRef} className="mb-10 mx-3">
            {thinkingMessage}
          </div>
        </div>

        <div className="flex flex-col gap-2 ml-10 sticky mt-5 top-20 bg-gray-100 pb-3 px-3 pt-2 rounded-lg">
          <h3 className="text-xl font-semibold text-center">Chess Board</h3>
          <div id={"cb"} className="h-[600px] w-[600px]">
            
          <Chessboard
              id="FlatBoard"
              position={gamePosition}
              showBoardNotation={true}
              autoPromoteToQueen={true}
              isDraggablePiece={({ piece }: {piece:string}) => {
                const turnKey = game.turn();
                const model = playersRef.current[turnKey]?.llm.model;
                if (game.turn() === "w" && model === "human") return piece.startsWith("w");
                if (game.turn() === "b" && model === "human") return piece.startsWith("b");
                return false;
              }}
              customBoardStyle={{
                borderRadius: "4px",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
              }}
              customPieces={threeDPieces}
              customLightSquareStyle={{
                backgroundColor: "#f0d9b5",
              }}
              customDarkSquareStyle={{
                backgroundColor: "#b58863",
              }}
              animationDuration={300}
              customSquareStyles={{
                [activeSquare]: {
                  boxShadow: "inset 0 0 2px 2px rgba(255,255,255,0.5)",
                },
              }}
              onMouseOverSquare={(sq: SetStateAction<string>) => setActiveSquare(sq)}
              onMouseOutSquare={() => setActiveSquare("")}
              onPieceDrop={onDrop}
            />
          </div>
          <div className="flex justify-between items-center action-box">
            {hasGameStarted ? (
                <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={togglePlayPause}
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>
            ) : (
                <button
                    className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                    onClick={startGameLoop}
                >
                  Start
                </button>
            )}
            {!isPlaying && hasGameStarted && <span>Game is Paused</span>}
            <button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                onClick={resetGame}
            >
              Reset
            </button>
          </div>

          {isGameOver && <div>{resultMessage}</div>}
          {errorMessage && <div className="text-red-500">{errorMessage}</div>}
          
        </div>

        <div className="flex flex-col items-start p-6 bg-gray-100 rounded-lg shadow-lg top-20 mt-5 sticky mr-10 w-full">
          <div className="w-full">
            <h2 className="text-2xl font-semibold mb-4 text-center">Settings</h2>
          </div>

          <div className="w-full mb-6">
            <h3 className="text-lg font-medium mb-2">White</h3>
            <div className="flex flex-col mb-4">
              <label htmlFor="white-llm" className="mb-1">
                Select Player:
              </label>
              <select
                  id="white-llm"
                  ref={whiteModalRef}
                  className="border border-gray-300 rounded p-2"
                  value={whitePlayer}
                  onChange={(e) => {
                    setWhitePlayer(e.target.value);
                    if (whiteApiKeyRef.current) {
                      whiteApiKeyRef.current.value = "";
                    }
                  }}
              >
                {llms.map((llm) => (
                    <option key={llm.model} value={llm.model}>
                      {llm.model}
                    </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label htmlFor="white-api-key" className="mb-1">
                API Key:
              </label>
              <input
                  type="password"
                  ref={whiteApiKeyRef}
                  id="white-api-key"
                  className="border border-gray-300 rounded p-2"
                  placeholder="Enter API Key"
                  disabled={whiteModalRef?.current?.value === 'human'}
              />
            </div>
          </div>

          <div className="w-full">
            <h3 className="text-lg font-medium mb-2">Black</h3>
            <div className="flex flex-col mb-4">
              <label htmlFor="black-llm" className="mb-1">
                Select Player:
              </label>
              <select
                  id="black-llm"
                  ref={blackModalRef}
                  className="border border-gray-300 rounded p-2"
                  value={blackPlayer}
                  onChange={(e) => {
                    setBlackPlayer(e.target.value);
                    if (blackApiKeyRef.current) {
                      blackApiKeyRef.current.value = "";
                    }
                  }}
              >
                {llms.map((llm) => (
                    <option key={llm.model} value={llm.model}>
                      {llm.model}
                    </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col">
              <label htmlFor="black-api-key" className="mb-1">
                API Key:
              </label>
              <input
                  type="password"
                  ref={blackApiKeyRef}
                  id="black-api-key"
                  className="border border-gray-300 rounded p-2"
                  placeholder="Enter API Key"
                  disabled={blackModalRef?.current?.value === 'human'}
              />
            </div>
          </div>
          <div>
            <button
                onClick={handleSave}
                className="mt-4 bg-blue-500 text-white rounded p-2 px-4 hover:bg-blue-600"
            >
              Save
            </button>
            {savedMessage && (
                <span className="text-green-500 text-sm ml-2">{savedMessage}</span>
            )}
          </div>
        </div>
      </div>
  );
}

export default ChessBoard;