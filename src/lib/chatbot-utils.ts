import { marked } from "marked";

export type RoleScopedChatInput = { role: 'assistant' | 'user' | 'system', content: string, timestamp: string }

interface Conversation {
    id: number;
    title: string;
    messages: RoleScopedChatInput[];
}

// Retrieve all conversations from sessionStorage
function getConversations(): Conversation[] {
    const convsJSON = sessionStorage.getItem('conversations');
    return convsJSON ? JSON.parse(convsJSON) : [];
}

// Get the ID of the current conversation
function getCurrentConversationId(): number | null {
    const id = sessionStorage.getItem('currentConversationId');
    return id ? parseInt(id, 10) : null;
}

// Set the current conversation ID
function setCurrentConversationId(id: number) {
    sessionStorage.setItem('currentConversationId', id.toString());
}

// Store all conversations in sessionStorage
function storeConversations(convs: Conversation[]) {
    sessionStorage.setItem('conversations', JSON.stringify(convs));
}

// Get the current conversation
function getCurrentConversation(): Conversation | null {
    const convs = getConversations();
    const currentId = getCurrentConversationId();
    return currentId !== null ? convs.find(conv => conv.id === currentId) || null : null;
}

// Delete a conversation by ID
function deleteConversation(id: number) {
    let conversations = getConversations();
    conversations = conversations.filter(conv => conv.id !== id);
    storeConversations(conversations);
    const currentId = getCurrentConversationId();
    if (currentId === id) {
        if (conversations.length > 0) {
            setCurrentConversationId(conversations[0].id);
            loadCurrentConversation();
        } else {
            createNewConversation();
        }
    }
    populateSidebar();
}
// Populate the sidebar with conversation titles
export function populateSidebar() {
    const conversations = getConversations();
    const $conversationList = document.getElementById('conversation-list') as HTMLUListElement;
    $conversationList.innerHTML = '';
    const currentId = getCurrentConversationId();
    conversations.forEach(conv => {
        const $li = document.createElement('li');
        if (conv.id === currentId) {
            $li.classList.add('active');
        }
        $li.dataset.id = conv.id.toString();
        $li.addEventListener('click', () => {
            setCurrentConversationId(conv.id);
            loadCurrentConversation();
            populateSidebar(); // Refresh sidebar to update active class
        });
        const $title = document.createElement('span');
        $title.textContent = conv.title;
        $li.appendChild($title);
        const $deleteBtn = document.createElement('span');
        $deleteBtn.classList.add('delete-conversation');
        $deleteBtn.innerHTML = `<astro-icon icon="heroicons:trash" class="icon" />`;
        $deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the conversation click
            deleteConversation(conv.id);
        });
        $li.appendChild($deleteBtn);
        $conversationList.appendChild($li);
    });
}
// Load the messages of the current conversation into the chat window
function loadCurrentConversation() {
    const currentConv = getCurrentConversation();
    if (currentConv) {
        const $messages = document.getElementById('messages') as HTMLUListElement;
        $messages.innerHTML = '';
        currentConv.messages.forEach(msg => {
            $messages.appendChild(createChatMessageElement(msg).chatElement);
        });
        $messages.scrollTop = $messages.scrollHeight;
    }
}

// Create a new conversation
export function createNewConversation() {
    const conversations = getConversations();
    const newId = Date.now(); // Use timestamp as ID
    const newTitle = `Chat at ${new Date().toLocaleTimeString()}`;
    const newConv: Conversation = { id: newId, title: newTitle, messages: [] };
    conversations.push(newConv);
    storeConversations(conversations);
    setCurrentConversationId(newId);
    populateSidebar();
    loadCurrentConversation();
}

// Initialize the chat
export function initChat() {
    let conversations = getConversations();
    if (conversations.length === 0) {
        createNewConversation();
        conversations = getConversations(); // Refresh after creation
        const currentConv = getCurrentConversation();
        if (currentConv) {
            currentConv.messages.push({
                role: "assistant",
                content: "Hi, welcome to my chat! I am a friendly assistant. Go ahead and send me a message.",
                timestamp: new Date().toISOString()
            });
            storeConversations(conversations);
            loadCurrentConversation();
        }
    } else {
        const currentId = getCurrentConversationId();
        if (currentId === null || !conversations.some(conv => conv.id === currentId)) {
            setCurrentConversationId(conversations[0].id);
        }
        populateSidebar();
        loadCurrentConversation();
    }
}

// Send a message and get the assistant's response
export async function sendMessage() {
    const currentConv = getCurrentConversation();
    if (!currentConv) {
        console.error('No current conversation');
        return;
    }
    const $input = document.getElementById("message") as HTMLInputElement;
    const $messages = document.getElementById('messages') as HTMLUListElement;

    const userMsg: RoleScopedChatInput = { role: "user", content: $input.value, timestamp: new Date().toISOString() };
    currentConv.messages.push(userMsg);
    $messages.appendChild(createChatMessageElement(userMsg).chatElement);

    $input.value = '';

    const assistantMsg: RoleScopedChatInput = { role: 'assistant', content: '', timestamp: new Date().toISOString() };
    const { chatElement, text } = createChatMessageElement(assistantMsg);
    $messages.appendChild(chatElement);
    const assistantResponse = text;

    $messages.scrollTop = $messages.scrollHeight;

    const response = await fetch('/api/chatbot', {
        method: "POST",
        headers: {
            "Content-Type": "text/event-stream"
        },
        body: JSON.stringify(currentConv.messages)
    });

    if (response.body) {
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            assistantMsg.content += value;
            assistantResponse.innerHTML = marked.parse(assistantMsg.content) as string;
            $messages.scrollTop = $messages.scrollHeight; // Auto-scroll during response generation
        }
    }
    currentConv.messages.push(assistantMsg);
    const conversations = getConversations();
    const updatedConvs = conversations.map(conv => conv.id === currentConv.id ? currentConv : conv);
    storeConversations(updatedConvs);
}

// Create a chat message element for display
function createChatMessageElement(msg: RoleScopedChatInput) {
    const $li = document.createElement('li');
    const $header = document.createElement('header');
    const $text = document.createElement('div');
    $text.classList.add('text');
    const timeStamp = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (msg.role === 'assistant') {
        $li.classList.add('bot');
        $header.innerHTML = `<h3>Assistant</h3><span>${timeStamp}</span>`;
        if (msg.content === '') {
            const $loader = document.createElement('span');
            $loader.classList.add('loader');
            $text.appendChild($loader);
        } else {
            $text.innerHTML = marked.parse(msg.content) as string;
        }
    } else if (msg.role === 'user') {
        $li.classList.add('user');
        $header.innerHTML = `<h3>User</h3><span>${timeStamp}</span>`;
        $text.innerHTML = `<p>${msg.content}</p>`;
    } else {
        $header.innerHTML = `<h3>System</h3><span>${timeStamp}</span>`;
        $text.innerHTML = `<p>Error, no role identified</p>`;
    }
    $li.appendChild($header);
    $li.appendChild($text);
    const $copyBtn = document.createElement('span');
    $copyBtn.classList.add('copy-message');
    $copyBtn.innerHTML = `<astro-icon icon="heroicons:clipboard-document" class="icon" />`;
    $copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(msg.content);
        // Optional: Add a visual feedback like a toast if desired
    });
    $li.appendChild($copyBtn);
    return { chatElement: $li, text: $text };
}
