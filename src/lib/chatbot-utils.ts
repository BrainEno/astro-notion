import { marked } from "marked";

export type RoleScopedChatInput = { role: 'assistant' | 'user' | 'system', content: string }

const date = new Date()

export function initChat() {
    const $messages = document.getElementById('messages') as HTMLUListElement
    const messages = retrieveMessages();
    $messages.innerHTML = ""
    if (messages.length === 0) {
        messages.push({
            role: "assistant",
            content: "Hi,welcome to my chat! I am a friendly assistant. Go ahead and send me a message."
        })
        storeMessages(messages)
    }
    for (const msg of messages) {
        $messages.appendChild(createChatMessageElement(msg).chatElement);
    }
}

function retrieveMessages() {
    const msgJSON = sessionStorage.getItem('messages')
    if (!msgJSON) {
        return []
    }
    return JSON.parse(msgJSON)
}

function storeMessages(msgs: RoleScopedChatInput[]) {
    sessionStorage.setItem("messages", JSON.stringify(msgs))
}

export async function sendMessage() {
    const $input = document.getElementById("message") as HTMLInputElement
    const $messages = document.getElementById('messages') as HTMLUListElement
    const messages = retrieveMessages()

    const userMsg: RoleScopedChatInput = { role: "user", content: $input.value }
    messages.push(userMsg)
    $messages.appendChild(createChatMessageElement(userMsg).chatElement);

    const payload = messages;
    $input.value = ''

    const assistantMsg: RoleScopedChatInput = { role: 'assistant', content: '' }
    const { chatElement, text } = createChatMessageElement(assistantMsg)
    $messages.appendChild(chatElement)
    const assistantResponse = text;

    $messages.scrollTop = $messages.scrollHeight

    const response = await fetch('/api/chatbot', {
        method: "POST",
        headers: {
            "Content-Type": "text/event-stream"
        },
        body: JSON.stringify(payload)
    })

    if (response.body) {
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader()

        while (true) {
            const { value, done } = await reader.read()
            if (done) {
                break;
            }

            assistantMsg.content += value
            assistantResponse.innerHTML = marked.parse(assistantMsg.content) as string;
            $messages.scrollTop = $messages.scrollHeight
        }
    }
    messages.push(assistantMsg)
    storeMessages(messages)
}

function createChatMessageElement(msg: RoleScopedChatInput) {
    const $li = document.createElement('li')
    const $header = document.createElement('header')
    const $text = document.createElement('div')
    $text.classList.add('text')
    const timeStamp = `${date.getHours()}:${("00" + date.getMinutes()).slice(-2)}`

    if (msg.role === 'assistant') {
        $li.classList.add('bot')
        $header.innerHTML = `<h3>Assistant</h3><span>${timeStamp}</span>`;
        if (msg.content === '') {
            const $loader = document.createElement('span')
            $loader.classList.add('loader')
            $text.appendChild($loader)
        } else {
            $text.innerHTML = marked.parse(msg.content) as string;
        }
    } else if (msg.role === 'user') {
        $li.classList.add('user')
        $header.innerHTML = `<h3>User</h3><span>${timeStamp}</span>`
        $text.innerHTML = `<p>${msg.content}</p>`
    } else {
        $header.innerHTML = `<h3>System</h3><span>${timeStamp}</span>`;
        $text.innerHTML = `<p>Error, no role identified</p>`
    }
    $li.appendChild($header);
    $li.appendChild($text)
    return { chatElement: $li, text: $text }
}
