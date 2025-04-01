export function describeMove(move:string){
    
    const pieceNames = {
        K: "King", 
        Q: "Queen",
        R: "Rook",
        B: "Bishop",
        N: "Knight",
        P: "Pawn",
    };

    if(move === "0-0"){
        return "King castles kingside";
    } else if(move === "0-0-0"){
        return "King castles queenside";
    }  

    // capture move
    if(move.includes("x")) {
        const [from, to] = move.split("x");
        const piece = from[0] in pieceNames ? pieceNames[from[0] as keyof typeof pieceNames] : "Pawn";

        return `${piece} captures on ${to}`;
    }

    // check move
    if(move.includes("+")){
        const piece = move[0] in pieceNames ? pieceNames[move[0] as keyof typeof pieceNames]: "Pawn";
        return `${piece} moves to ${move.slice(1, -1)} with check`;
    }

    // checkmate move
    if(move.includes("#")){
        const piece = move[0] in pieceNames ? pieceNames[move[0] as keyof typeof pieceNames] : "Pawn";
        return `${piece} moves to ${move.slice(1, -1)} and delivers checkmate`;
    }

    if(move.length === 5 && move[0] === "P" && move[4].toLowerCase() === "="){
        const promotionPiece = pieceNames?.[move[4]?.toUpperCase() as keyof typeof pieceNames] ?? "Queen";
        return `Pawn promotes to ${promotionPiece}`;
    }

    const isPawn = !(move[0] in pieceNames);
    return `${pieceNames?.[move[0] as keyof typeof pieceNames] ?? "Pawn"} moves to ${
        isPawn ? move : move.slice(1)
    }`;
}