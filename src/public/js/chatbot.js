document.addEventListener('DOMContentLoaded', () => {
    const fab = document.getElementById('beeChatFab');
    const windowEl = document.getElementById('beeChatWindow');
    const closeBtn = document.getElementById('beeChatCloseBtn');
    const sendBtn = document.getElementById('beeChatSendBtn');
    const input = document.getElementById('beeChatInput');
    const messagesContainer = document.getElementById('beeChatMessages');

    if (!fab || !windowEl) return;

    // Chat State
    let isOpen = false;
    let chatHistory = [];

    // Toggle Chat
    const toggleChat = () => {
        isOpen = !isOpen;
        if (isOpen) {
            windowEl.style.display = 'flex';
            fab.style.display = 'none';
            input.focus();
        } else {
            windowEl.style.display = 'none';
            fab.style.display = 'flex';
        }
    };

    fab.addEventListener('click', toggleChat);
    closeBtn.addEventListener('click', toggleChat);

    const appendMessage = (text, sender) => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `bee-message bee-message-${sender}`;
        
        // Handle basic markdown/formatting if needed, but for now simple text
        // If it's the bot, we can use marked.js if available, else plain text
        const bubble = document.createElement('div');
        bubble.className = 'bee-bubble';
        
        // Very basic linkification and line breaks
        let formattedText = text.replace(/\n/g, '<br>');
        bubble.innerHTML = formattedText;
        
        msgDiv.appendChild(bubble);
        messagesContainer.appendChild(msgDiv);
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const showTyping = () => {
        const msgDiv = document.createElement('div');
        msgDiv.className = `bee-message bee-message-bot bee-typing-indicator`;
        msgDiv.id = 'beeTypingIndicator';
        
        const bubble = document.createElement('div');
        bubble.className = 'bee-bubble';
        bubble.style.padding = '0.5rem 1rem';
        bubble.innerHTML = `
            <div style="display: flex; gap: 4px; align-items: center; height: 14px;">
                <span class="bee-typing-dot"></span>
                <span class="bee-typing-dot"></span>
                <span class="bee-typing-dot"></span>
            </div>
        `;
        
        msgDiv.appendChild(bubble);
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    const hideTyping = () => {
        const indicator = document.getElementById('beeTypingIndicator');
        if (indicator) indicator.remove();
    };

    const sendMessage = async () => {
        const text = input.value.trim();
        if (!text) return;

        // UI Update
        input.value = '';
        appendMessage(text, 'user');
        
        // Prepare payload
        const payload = {
            question: text,
            history: chatHistory
        };

        // Update local history
        chatHistory.push({ role: 'user', content: text });

        showTyping();

        try {
            const response = await fetch('/api/v1/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            hideTyping();

            if (data.success && data.reply) {
                appendMessage(data.reply, 'bot');
                chatHistory.push({ role: 'assistant', content: data.reply });
            } else {
                appendMessage('Sorry, I encountered an error connecting to my brain.', 'bot');
            }
        } catch (error) {
            console.error('Chat error:', error);
            hideTyping();
            appendMessage('Network error. Please try again later.', 'bot');
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Ensure icons render if injected after main lucide call
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
});
