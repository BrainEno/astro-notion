import type { APIContext } from "astro";
import type { RoleScopedChatInput } from "../../lib/chatbot-utils";
export const prerender = false;

export async function POST({ request, locals }: APIContext) {
    const payload = (await request.json()) as RoleScopedChatInput[];

    let messages = [
        { role: "system", content: "You are a friendly assistant" },
    ];
    messages = messages.concat(payload);

    const { AI } = locals.runtime.env;
    let eventSourceStream: ReadableStream<Uint8Array> | undefined;
    let retryCount = 0;
    let successfulInference = false;
    let lastError;
    const MAX_RETRIES = 3;

    while (!successfulInference && retryCount < MAX_RETRIES) {
        try {
            eventSourceStream = (await AI.run(
                "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
                {
                    stream: true,
                    messages,
                    max_tokens: 1900
                }
            )) as ReadableStream<Uint8Array>;
            successfulInference = true;
        } catch (err) {
            lastError = err;
            retryCount++;
            console.error(err);
            console.log(`Retrying #${retryCount}...`);
        }
    }

    if (!eventSourceStream) {
        if (lastError) {
            throw lastError;
        }
        throw new Error("Problem with model");
    }

    const response: ReadableStream = new ReadableStream({
        start(controller) {
            let buffer = ""; // Buffer to hold incomplete lines across chunks
            let isClosed = false; // Flag to track if the controller is closed

            eventSourceStream.pipeTo(
                new WritableStream({
                    write(chunk) {
                        const text = new TextDecoder().decode(chunk);
                        buffer += text; // Append new chunk to buffer
                        const lines = buffer.split("\n");
                        buffer = lines.pop() || ""; // Keep the last (possibly incomplete) line

                        for (const line of lines) {
                            if (!line.includes("data: ")) {
                                continue;
                            }

                            const jsonString = line.split("data: ")[1];

                            if (line.includes("[DONE]")) {
                                if (!isClosed) {
                                    controller.close();
                                    isClosed = true;
                                }
                                break;
                            }

                            try {
                                const data = JSON.parse(jsonString);
                                if (data && data.response) {
                                    controller.enqueue(
                                        new TextEncoder().encode(data.response)
                                    );
                                }
                            } catch (err) {
                                console.error(
                                    "Could not parse response",
                                    jsonString,
                                    err
                                );
                            }
                        }
                    },
                    close() {
                        // Process any remaining buffer content on stream close
                        if (buffer && buffer.includes("data: ")) {
                            const jsonString = buffer.split("data: ")[1];
                            try {
                                const data = JSON.parse(jsonString);
                                if (data && data.response) {
                                    controller.enqueue(
                                        new TextEncoder().encode(data.response)
                                    );
                                }
                            } catch (err) {
                                console.error(
                                    "Could not parse response",
                                    jsonString,
                                    err
                                );
                            }
                        }
                        if (!isClosed) {
                            controller.close();
                            isClosed = true;
                        }
                    },
                })
            );

            request.signal.addEventListener("abort", () => {
                if (!isClosed) {
                    controller.close();
                    isClosed = true;
                }
            });
        },
    });

    return new Response(response, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
            "Connection": "keep-alive",
        },
    });
}
