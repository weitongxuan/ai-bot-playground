# AI 客服系統

使用 Express 和 OpenAI API 建立的簡易客服聊天系統。

## 功能特色

- 美觀的聊天介面
- 即時 AI 對話
- 對話歷史記錄
- 清除對話功能
- 響應式設計（支援手機和電腦）

## 安裝步驟

1. 安裝依賴套件：
```bash
npm install
```

2. 設定環境變數：
   - 複製 `.env.example` 並重新命名為 `.env`
   - 在 `.env` 檔案中填入你的 OpenAI API 金鑰

```bash
cp .env.example .env
```

然後編輯 `.env` 檔案：
```
OPENAI_API_KEY=你的OpenAI金鑰
PORT=3000
```

## 啟動應用程式

開發模式（自動重啟）：
```bash
npm run dev
```

正式啟動：
```bash
npm start
```

## 使用方式

1. 啟動伺服器後，開啟瀏覽器訪問 `http://localhost:3000`
2. 在對話視窗中輸入您的問題
3. AI 客服會即時回覆您的問題
4. 可以隨時點擊「清除對話」按鈕來重新開始對話

## 技術架構

- **後端**: Express.js
- **AI 服務**: OpenAI GPT-3.5-turbo
- **前端**: 原生 HTML/CSS/JavaScript
- **樣式**: 現代化漸層設計，支援響應式佈局

## 專案結構

```
.
├── server.js              # Express 伺服器
├── package.json           # 專案依賴
├── .env.example          # 環境變數範例
├── .env                  # 環境變數（需自行建立）
└── public/               # 靜態檔案
    ├── index.html        # 主頁面
    ├── styles.css        # 樣式表
    └── app.js            # 前端邏輯
```

## 注意事項

- 請確保你有有效的 OpenAI API 金鑰
- API 呼叫會產生費用，請注意使用量
- 對話歷史暫存在記憶體中，重啟伺服器會清空
- 建議在正式環境使用資料庫來儲存對話記錄
