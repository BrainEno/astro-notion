import type { APIContext } from "astro";
import type { RoleScopedChatInput } from "../../lib/chatbot-utils";
export const prerender = false;


export async function POST({ request, locals }: APIContext) {
    const payload = (await request.json()) as RoleScopedChatInput[]

    let messages = [
        { role: 'system', content: "You are a friendly assistant" }
    ]
    messages = messages.concat(payload)

    const { AI } = locals.runtime.env;
    let eventSourceStream: ReadableStream<Uint8Array> | undefined;
    let retryCount = 0;
    let successfulInference = false;
    let lastError;
    const MAX_RETRIES = 3;

    while (successfulInference === false && retryCount < MAX_RETRIES) {
        try {
            eventSourceStream = (await AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
                stream: true,
                messages
            })) as ReadableStream<Uint8Array>
            successfulInference = true;
        } catch (err) {
            lastError = err;
            retryCount++;
            console.error(err)
            console.log(`Retrying #${retryCount}...`)
        }
    }

    if (eventSourceStream === undefined) {
        if (lastError) {
            throw lastError;
        }
        throw new Error('Porblem with model')
    }

    const response: ReadableStream = new ReadableStream({
        start(controller) {
            eventSourceStream.pipeTo(
                new WritableStream({
                    write(chunk) {
                        const text = new TextDecoder().decode(chunk);
                        // console.log("Raw chunk received:", text); // Debugging raw data

                        for (const line of text.split("\n")) {
                            if (!line.includes("data: ")) {
                                continue
                            }

                            const jsonString = line.split("data: ")[1];

                            if (line.includes("[DONE]")) {
                                controller.close()
                                break;
                            }

                            try {
                                const data = JSON.parse(jsonString);
                                if (data && data.response) {
                                    controller.enqueue(new TextEncoder().encode(data.response));
                                }
                            } catch (err) {
                                console.error("Could not parse response", jsonString, err)
                            }
                        }
                    }
                })
            )

            request.signal.addEventListener("abort", () => {
                controller.close()
            })
        },
    })

    return new Response(response, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
            "Connection": "keep-alive"
        }
    })
}
