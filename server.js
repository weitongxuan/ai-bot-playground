require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// 初始化 OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const content = {
  "牛奶": "2瓶",
  "雞蛋": "12顆",
  "蘋果": "6個",
  "香蕉": "4根",
  "蘿蔔": "5根",
  "黃瓜": "2條",
}
// 中間件
app.use(express.json());
app.use(express.static('public'));

// 儲存對話歷史 (簡易版本，實際應用建議使用資料庫)
const conversations = new Map();

// 首頁路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const updateContent = (contentName, amount) => {
  console.log(`Updating ${contentName} to ${amount}`);
  content[contentName] = amount;
}

const adminPrompt = `目前冰箱內容物如下：\n`


// const adminPrompt = `你是一個友善且專業的冰箱AI。請用繁體中文回答問題，態度親切，盡力協助客戶解決問題。只能回答跟冰箱內容物有關的問題。回應格式是html 用<div></div>裝\n目前冰箱內容物如下：\n`

// 聊天 API
app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: '訊息不能為空' });
    }

    

    // 獲取或創建對話歷史
    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, [
        {
          role: 'system',
          content: adminPrompt + JSON.stringify(content, null, 2) + '\n'
        }
      ]);
    }

    const history = conversations.get(sessionId);

    // 添加用戶訊息到歷史
    history.push({
      role: 'user',
      content: message
    });

    // 呼叫 OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: history,
      temperature: 0.7,
      max_tokens: 500,
      tools: [
    {
      "type": "function",
      "function": {
        "name": "update_fridge_contents",
        "description": "更新冰箱的內容物，根據提供的名稱與數量",
        "parameters": {
          "type": "object",
          "required": [
            "name",
            "amount"
          ],
          "properties": {
            "name": {
              "type": "string",
              "description": "要更新的物品名稱"
            },
            "amount": {
              "type": "string",
              "description": "要更新的物品數量"
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
        if (call.function.name === 'update_fridge_contents') {
          const args = JSON.parse(call.function.arguments);
 
          updateContent(args.name, args.amount);
          console.log(content);
          // 添加工具調用結果到歷史
          history.push({
            role: 'system',
            content: adminPrompt + JSON.stringify(content, null, 2) + '\n'
          });
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
    if (history.length > 21) { // system + 10 輪 * 2
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
  conversations.delete(sessionId);
  res.json({ success: true, message: '對話已清除' });
});

app.listen(PORT, () => {
  console.log(`客服系統運行於 http://localhost:${PORT}`);
});
