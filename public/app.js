// 生成唯一的 session ID
const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

// SSE 連接
let eventSource = null;

// 預設對話按鈕列表
const quickMessages = [
    "隨機產生五個代辦事項",
    "列出代辦事項",
    "新增代辦事項：重要 寫報告 今天晚上九點前 ",
    "寫報告已完成",
    "移除已經完成的項目"
];

// DOM 元素
const chatForm = document.getElementById('chatForm');
const messageInput = document.getElementById('messageInput');
const sendButton = document.getElementById('sendButton');
const clearButton = document.getElementById('clearButton');
const chatMessages = document.getElementById('chatMessages');
const quickActionsContainer = document.querySelector('.quick-actions');
const adminPromptTextarea = document.getElementById('adminPromptTextarea');
const savePromptButton = document.getElementById('savePromptButton');
const saveStatus = document.getElementById('saveStatus');
const userDataTextarea = document.getElementById('userDataTextarea');
const saveUserDataButton = document.getElementById('saveUserDataButton');
const userDataStatus = document.getElementById('userDataStatus');

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

// 初始化快捷按鈕
function initQuickButtons() {
    // 清空現有按鈕
    quickActionsContainer.innerHTML = '';

    // 為每個預設訊息創建按鈕
    quickMessages.forEach(message => {
        const button = document.createElement('button');
        button.className = 'quick-button';
        button.textContent = message;

        // 添加點擊事件
        button.addEventListener('click', async () => {
            // 顯示用戶訊息
            addMessage(message, true);

            // 發送訊息
            await sendMessage(message);
        });

        quickActionsContainer.appendChild(button);
    });
}

// 載入 adminPrompt
async function loadAdminPrompt() {
    try {
        const response = await fetch('/api/admin-prompt');
        const data = await response.json();

        if (data.success) {
            adminPromptTextarea.value = data.prompt;
        } else {
            saveStatus.textContent = '載入提示詞失敗';
            saveStatus.className = 'save-status error';
        }
    } catch (error) {
        console.error('Error loading admin prompt:', error);
        saveStatus.textContent = '載入提示詞時發生錯誤';
        saveStatus.className = 'save-status error';
    }
}

// 保存 adminPrompt
async function saveAdminPrompt() {
    try {
        savePromptButton.disabled = true;
        saveStatus.textContent = '儲存中...';
        saveStatus.className = 'save-status';

        const response = await fetch('/api/admin-prompt', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt: adminPromptTextarea.value
            })
        });

        const data = await response.json();

        if (data.success) {
            saveStatus.textContent = '儲存成功！';
            saveStatus.className = 'save-status success';

            // 3秒後清除狀態
            setTimeout(() => {
                saveStatus.textContent = '';
                saveStatus.className = 'save-status';
            }, 3000);
        } else {
            saveStatus.textContent = '儲存失敗';
            saveStatus.className = 'save-status error';
        }
    } catch (error) {
        console.error('Error saving admin prompt:', error);
        saveStatus.textContent = '儲存時發生錯誤';
        saveStatus.className = 'save-status error';
    } finally {
        savePromptButton.disabled = false;
    }
}

// 保存按鈕點擊事件
savePromptButton.addEventListener('click', saveAdminPrompt);

// 載入使用者資料
async function loadUserData() {
    try {
        const response = await fetch('/api/user-data');
        const result = await response.json();

        if (result.success) {
            userDataTextarea.value = result.data;
        } else {
            userDataStatus.textContent = '載入資料失敗';
            userDataStatus.className = 'save-status error';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        userDataStatus.textContent = '載入資料時發生錯誤';
        userDataStatus.className = 'save-status error';
    }
}

// 保存使用者資料
async function saveUserData() {
    try {
        saveUserDataButton.disabled = true;
        userDataStatus.textContent = '儲存中...';
        userDataStatus.className = 'save-status';

        const response = await fetch('/api/user-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                data: userDataTextarea.value
            })
        });

        const result = await response.json();

        if (result.success) {
            userDataStatus.textContent = '儲存成功！';
            userDataStatus.className = 'save-status success';

            // 3秒後清除狀態
            setTimeout(() => {
                userDataStatus.textContent = '';
                userDataStatus.className = 'save-status';
            }, 3000);
        } else {
            userDataStatus.textContent = '儲存失敗';
            userDataStatus.className = 'save-status error';
        }
    } catch (error) {
        console.error('Error saving user data:', error);
        userDataStatus.textContent = '儲存時發生錯誤';
        userDataStatus.className = 'save-status error';
    } finally {
        saveUserDataButton.disabled = false;
    }
}

// 保存使用者資料按鈕點擊事件
saveUserDataButton.addEventListener('click', saveUserData);

// 初始化 SSE 連接
function initSSE() {
    if (eventSource) {
        eventSource.close();
    }
    
    eventSource = new EventSource('/api/events');
    
    eventSource.onopen = function() {
        console.log('SSE 連接已建立');
    };
    
    eventSource.onmessage = function(event) {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'userDataUpdated') {
                console.log('收到使用者資料更新通知:', data.message);
                
                // 重新載入使用者資料
                loadUserData();
                
                // 顯示通知訊息
                showNotification('使用者資料已更新！');
            }
        } catch (error) {
            console.error('解析 SSE 訊息時發生錯誤:', error);
        }
    };
    
    eventSource.onerror = function(event) {
        console.error('SSE 連接錯誤:', event);
        
        // 嘗試重新連接
        setTimeout(() => {
            if (eventSource.readyState === EventSource.CLOSED) {
                console.log('嘗試重新連接 SSE...');
                initSSE();
            }
        }, 5000);
    };
}

// 顯示通知訊息
function showNotification(message) {
    // 創建通知元素
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    // 添加到頁面
    document.body.appendChild(notification);
    
    // 3秒後移除通知
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}

// 初始化時載入 adminPrompt 和使用者資料
initSSE();
loadAdminPrompt();
loadUserData();
initQuickButtons();

// 初始化時聚焦輸入框
messageInput.focus();

// 當頁面關閉時關閉 SSE 連接
window.addEventListener('beforeunload', () => {
    if (eventSource) {
        eventSource.close();
    }
});
