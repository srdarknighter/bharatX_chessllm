"use server";

import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { generateText } from "ai";
import { NextMoveInput } from "../extras/types";

export async function getNextMove(input: NextMoveInput) {
    console.log(`Getting next move from ${input.provider} ${input.model}`);

    const{
        currentStateImage,
        allMoves,
        provider,
        model,
        color,
        apiKey,
        lastMove,
    } = input;

    const llms = {
        OpenAI: createOpenAI,
        Google: createGoogleGenerativeAI,
        Anthropic: createAnthropic,
        Mistral: createMistral,
        Human: null,
    };

    
    const createllm = llms[provider] ?? createOpenAI;
    const llmProvider = createllm({
        apiKey,
    });

    const current_llm = llmProvider.languageModel(model);
    
    const prompt = `You are one of the best chess players in the world.
    You are playing as "${color}". You are gievn the image of the current chessboard state. Carefully think of all the possible moves and consequences.
    The objective is to win the game so come up with the best possible move to give the best chance of winning. After thinking deeply, come up with your next move.`;

    const nextMovePrompt = `The provided image is the current state of the chess game between you and another top player. You are playing as "${color}". Now it is your turn to make a move, which will give you the best chance of winning the game. The moves are in conventional chess algebric notation. The last move was "${lastMove}". The following are all the moves available for you. Each move is numbered from 1 to ${
        allMoves.length
      }.
    ---
    ${allMoves.map((move: any, index: number) => `${index + 1} - ${move}`).join("\n")}
    ---
    Now think very deeply and carefully about all your possible moves and their consequences. After thinking very deeply, just output the number of the move that you think will give you the best chance of winning the game. Your output must be JUST THE NUMBER of the best move, nothing else. No explanation required, JUST OUTPUT THE NUMBER of the best move. The number of the best move for you is(MUST be A NUMBER from 1 to ${
        allMoves.length
      }): `;
      console.log(nextMovePrompt);
      try {
        const nextMove = await generateText({
            model: current_llm,
            messages: [
                {role: "system", content: prompt},
                {
                    role: "user",
                    content: [
                        {type: "image", image: currentStateImage},
                        {type:"text", text: nextMovePrompt},
                    ],
                },
            ],
            maxTokens: 2,
            temperature: 0.75,
        });
        
        console.log(nextMove.text);
        const nextMoveNumber = parseInt(nextMove.text);
        return nextMoveNumber - 1;
      } catch(e) {
        console.error(e);
        throw new Error(`LLM Error, make sure api key is correct,`);
      }
}