require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化 OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


// 中間件
app.use(express.json());
app.use(express.static('public'));

// 儲存對話歷史 (簡易版本，實際應用建議使用資料庫)
const conversations = new Map();

// 儲存 SSE 連接的客戶端
const sseClients = new Set();

// 首頁路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// SSE 端點用於即時通知
app.get('/api/events', (req, res) => {
  // 設置 SSE 標頭
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // 發送初始連接確認
  res.write('data: {"type":"connected","message":"SSE連接已建立"}\n\n');

  // 將客戶端添加到集合中
  sseClients.add(res);

  // 當客戶端斷開連接時清理
  req.on('close', () => {
    sseClients.delete(res);
  });

  req.on('error', () => {
    sseClients.delete(res);
  });
});

// 廣播訊息給所有 SSE 客戶端
function broadcastToClients(data) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  
  sseClients.forEach(client => {
    try {
      client.write(message);
    } catch (error) {
      // 如果寫入失敗，移除這個客戶端
      sseClients.delete(client);
    }
  });
}

const updateContent = async (data) => {
    userData = data;

    // 保存到文件
    const saved = await saveUserData(data);
    
    // 通知所有客戶端資料已更新
    if (saved) {
        broadcastToClients({
            type: 'userDataUpdated',
            message: '使用者資料已更新',
            data: userData
        });
    }
}

// const adminPrompt = `目前冰箱內容物如下：\n`
// 回應格式是html 用<div></div>裝, 並且用emoji加一點圖

// adminPrompt 預設值
let adminPrompt = `你是一個友善且專業的冰箱AI。請用繁體中文回答問題，態度親切，盡力協助客戶解決問題。只能回答跟冰箱內容物有關的問題。回應格式是html 用<div></div>裝, 並且美化排版\n如果使用者想製作食品,列出缺少的食材與數量,務必要有數量!!!\n目前冰箱內容物如下：\n`

// adminPrompt 文件路徑
const ADMIN_PROMPT_FILE = path.join(__dirname, 'adminPrompt.txt');
// 使用者資料文件路徑
const USER_DATA_FILE = path.join(__dirname, 'user-data.txt');

// 使用者資料預設值
let userData = '';

// 從文件載入 adminPrompt
async function loadAdminPrompt() {
  try {
    const data = await fs.readFile(ADMIN_PROMPT_FILE, 'utf-8');
    adminPrompt = data;
    console.log('已從 adminPrompt.txt 載入提示詞');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 文件不存在，使用預設值並創建文件
      console.log('adminPrompt.txt 不存在，使用預設值並創建文件');
      await saveAdminPrompt(adminPrompt);
    } else {
      console.error('載入 adminPrompt.txt 時發生錯誤:', error);
    }
  }
}

// 保存 adminPrompt 到文件
async function saveAdminPrompt(prompt) {
  try {
    await fs.writeFile(ADMIN_PROMPT_FILE, prompt, 'utf-8');
    console.log('已儲存提示詞到 adminPrompt.txt');
    return true;
  } catch (error) {
    console.error('儲存 adminPrompt.txt 時發生錯誤:', error);
    return false;
  }
}

// 從文件載入使用者資料
async function loadUserData() {
  try {
    const data = await fs.readFile(USER_DATA_FILE, 'utf-8');
    userData = data;
    console.log('已從 user-data.txt 載入使用者資料');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // 文件不存在，使用預設值並創建文件
      console.log('user-data.txt 不存在，創建新文件');
      await saveUserData(userData);
    } else {
      console.error('載入 user-data.txt 時發生錯誤:', error);
    }
  }
}

// 保存使用者資料到文件
async function saveUserData(data) {
  try {
    await fs.writeFile(USER_DATA_FILE, data, 'utf-8');
    console.log('已儲存使用者資料到 user-data.txt');
    return true;
  } catch (error) {
    console.error('儲存 user-data.txt 時發生錯誤:', error);
    return false;
  }
}

// 啟動時載入 adminPrompt 和使用者資料
loadAdminPrompt();
loadUserData();

// 聊天 API
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: '訊息不能為空' });
    }

    

    // 獲取或創建對話歷史
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, []);
    }

    const history = conversations.get(sessionId);

    // 構建最新的系統訊息
    const currentSystemMessage = {
      role: 'system',
      content: adminPrompt + "\n調用update_user_data以儲存使用者資料\nuser data: " + userData + '\n'
    };

    // 移除舊的系統訊息（如果存在）
    const systemMessageIndex = history.findIndex(msg => msg.role === 'system');
    if (systemMessageIndex !== -1) {
      history.splice(systemMessageIndex, 1);
    }

    // 在歷史記錄開頭插入最新的系統訊息
    history.unshift(currentSystemMessage);

    // 添加用戶訊息到歷史
    history.push({
      role: 'user',
      content: message
    });

    // 呼叫 OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: history,
      temperature: 0.7,
      max_tokens: 500,
      parallel_tool_calls: false ,
      tools: [
    {
      "type": "function",
      "function": {
        "name": "update_user_data",
        "description": "更新使用者資料，只會保留最後一次的更新結果",
        "parameters": {
          "type": "object",
          "required": [
            "data"
          ],
          "properties": {
            "data": {
              "type": "string",
              "description": "使用者的所有資料"
            }
          
          },
          "additionalProperties": false
        },
        "strict": true
      }
    }
  ],
    });

    const assistantMessage = completion.choices[0].message.content;
    const toolCalls = completion.choices[0].message.tool_calls;

    // 處理工具調用
    if (toolCalls && toolCalls.length > 0) {
      for (const call of toolCalls) {
        if (call.function.name === 'update_user_data') {
          
          const args = JSON.parse(call.function.arguments);
 
          updateContent(args.data);
          console.log('使用者資料已更新為:', args.data);
          
          // 更新系統訊息為最新內容
          const updatedSystemMessage = {
            role: 'system',
            content: adminPrompt + "\nuser data: " + userData + '\n'
          };
          
          // 移除舊的系統訊息並添加更新後的系統訊息
          const systemMsgIndex = history.findIndex(msg => msg.role === 'system');
          if (systemMsgIndex !== -1) {
            history[systemMsgIndex] = updatedSystemMessage;
          }
        }
      }
      res.json({
      message: "更新完成！",
      success: true
    });
    }
    else {
    // 添加 AI 回覆到歷史
    history.push({
      role: 'assistant',
      content: assistantMessage
    });
  

    // 限制歷史長度（保留最近 10 輪對話）
    // 系統訊息始終在索引 0，所以從索引 1 開始計算用戶和助手訊息
    const nonSystemMessages = history.slice(1);
    if (nonSystemMessages.length > 20) { // 10 輪對話 * 2（用戶+助手）
      // 移除最舊的一輪對話（用戶+助手訊息）
      history.splice(1, 2);
    }

    res.json({
      message: assistantMessage,
      success: true
    });
  }

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({
      error: '處理請求時發生錯誤',
      details: error.message
    });
  }
});

// 清除對話歷史
app.post('/api/clear', (req, res) => {
  const { sessionId } = req.body;
  // 清除特定會話的對話歷史，下次對話時會自動使用最新的系統訊息
  conversations.delete(sessionId);
  res.json({ success: true, message: '對話已清除' });
});

// 獲取 adminPrompt
app.get('/api/admin-prompt', (req, res) => {
  res.json({
    success: true,
    prompt: adminPrompt
  });
});

// 更新 adminPrompt
app.post('/api/admin-prompt', async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt && prompt !== '') {
      return res.status(400).json({
        success: false,
        error: '提示詞不能為空'
      });
    }

    // 更新內存中的 adminPrompt
    adminPrompt = prompt;

    // 保存到文件
    const saved = await saveAdminPrompt(prompt);

    if (saved) {
      // 不需要清除對話歷史，因為每次對話都會使用最新的 adminPrompt
      res.json({
        success: true,
        message: '提示詞已更新並儲存，將在下次對話時生效'
      });
    } else {
      res.status(500).json({
        success: false,
        error: '儲存提示詞時發生錯誤'
      });
    }
  } catch (error) {
    console.error('Error updating admin prompt:', error);
    res.status(500).json({
      success: false,
      error: '更新提示詞時發生錯誤',
      details: error.message
    });
  }
});

// 獲取使用者資料
app.get('/api/user-data', (req, res) => {
  res.json({
    success: true,
    data: userData
  });
});

// 更新使用者資料
app.post('/api/user-data', async (req, res) => {
  try {
    const { data } = req.body;

    if (data === undefined || data === null) {
      return res.status(400).json({
        success: false,
        error: '資料不能為空'
      });
    }

    // 更新內存中的使用者資料
    userData = data;

    // 保存到文件
    const saved = await saveUserData(data);

    if (saved) {
      // 通知所有客戶端資料已更新
      broadcastToClients({
        type: 'userDataUpdated',
        message: '使用者資料已更新',
        data: userData
      });
      
      res.json({
        success: true,
        message: '使用者資料已更新並儲存，將在下次對話時生效'
      });
    } else {
      res.status(500).json({
        success: false,
        error: '儲存使用者資料時發生錯誤'
      });
    }
  } catch (error) {
    console.error('Error updating user data:', error);
    res.status(500).json({
      success: false,
      error: '更新使用者資料時發生錯誤',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`客服系統運行於 http://localhost:${PORT}`);
});
