// 生成唯一的 session ID
const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

// DOM 元素
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const clearButton = document.getElementById('clearButton');
const chatMessages = document.getElementById('chatMessages');

// 添加訊息到聊天視窗
function addMessage(content, isUser = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    const paragraph = document.createElement('div');
    paragraph.innerHTML = content;

    messageContent.appendChild(paragraph);
    messageDiv.appendChild(messageContent);
    chatMessages.appendChild(messageDiv);

    // 滾動到最底部
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 顯示輸入中指示器
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message';
    typingDiv.id = 'typingIndicator';

    const typingContent = document.createElement('div');
    typingContent.className = 'message-content';

    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';

    typingContent.appendChild(typingIndicator);
    typingDiv.appendChild(typingContent);
    chatMessages.appendChild(typingDiv);

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 移除輸入中指示器
function removeTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// 發送訊息
async function sendMessage(message) {
    try {
        // 禁用輸入
        sendButton.disabled = true;
        messageInput.disabled = true;

        // 顯示輸入中指示器
        showTypingIndicator();

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                sessionId: sessionId
            })
        });

        const data = await response.json();

        // 移除輸入中指示器
        removeTypingIndicator();

        if (data.success) {
            addMessage(data.message, false);
        } else {
            addMessage('抱歉，發生錯誤：' + (data.error || '未知錯誤'), false);
        }

    } catch (error) {
        removeTypingIndicator();
        console.error('Error:', error);
        addMessage('抱歉，無法連接到服務器。請稍後再試。', false);
    } finally {
        // 重新啟用輸入
        sendButton.disabled = false;
        messageInput.disabled = false;
        messageInput.focus();
    }
}

// 表單提交事件
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const message = messageInput.value.trim();

    if (!message) return;

    // 顯示用戶訊息
    addMessage(message, true);

    // 清空輸入框
    messageInput.value = '';

    // 發送訊息
    await sendMessage(message);
});

// 清除對話
clearButton.addEventListener('click', async () => {
    if (confirm('確定要清除所有對話記錄嗎？')) {
        try {
            await fetch('/api/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: sessionId
                })
            });

            // 清空聊天視窗
            chatMessages.innerHTML = `
                <div class="message bot-message">
                    <div class="message-content">
                        <p>對話已清除。有什麼可以幫助您的嗎？</p>
                    </div>
                </div>
            `;

        } catch (error) {
            console.error('Error clearing chat:', error);
            alert('清除對話時發生錯誤');
        }
    }
});

// Enter 鍵發送，Shift+Enter 換行（可選功能）
messageInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
});

// 初始化時聚焦輸入框
messageInput.focus();
