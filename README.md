# 七人團隊出席排程

保留原始設計於 `團隊出席排程網站/`；正式前端為 `public/index.html`。七個姓名按鈕搭配各自固定密碼，訪客（含教授）無須登入。姓名、空檔及備註均公開。

## 架構

Firebase Hosting + Authentication（Email/Password）+ Cloud Firestore，使用 Spark，不使用 Functions、Storage、自訂伺服器或計費帳戶。

學生只看得到姓名與密碼欄位。內部帳號識別值為 `<memberId>@<projectId>.invalid`，這是不可收信的識別值，不是真實信箱。UID 與成員的綁定由管理初始化工具建立。網站沒有註冊、修改或找回密碼介面；Firebase 原生 API 的本人改密碼能力並未被禁止。

| 成員 ID | 姓名 | 組別 |
| --- | --- | --- |
| ta | 魏提安 | A |
| fe | 徐法恩 | A |
| jy | 陳俊佑 | A |
| yl | 鄞永力 | A |
| sx | 陳書璿 | B |
| yx | 鄭源勳 | B |
| dx | 郭東旭 | B |

## 本機安裝與驗證

需要 Node.js 22+、Java 21+；瀏覽器測試預設使用已安裝的 Google Chrome。

```sh
npm ci
npm test
npm run test:rules
npm run test:browser
```

- `npm test`：台北時區、週界／年界、重疊異動與部署 HTML 檢查。
- `test:rules`：真正啟動 Auth／Firestore Emulator，檢查公開讀取、本人權限、惡意欄位、版本衝突及監聽同步。
- `test:browser`：啟動 Auth／Firestore／Hosting Emulator，產生僅供測試的隨機密碼，驗證七人登入、初始化重跑不換密碼、不同時區裝置同步、清空／回復、斷線與手機畫面；截圖在 `artifacts/`。
- 以上全數只用 `demo-team-availability`，不接觸正式專案。

互動預覽先執行 `npm run emulators`，再於另一個終端執行 `npm run seed:demo`，開啟 `http://127.0.0.1:5057/?emulator=1`。測試密碼會在本機 `secrets/demo-passwords.json`，不顯示於日誌、不發布到網站。Emulator 資料預設關閉即丟棄，重開後可再次 seed。

## 正式設定（僅在指定的獨立專案執行）

1. 在 Firebase Console 建立／確認獨立專案，方案維持 **Spark**，不連結 Cloud Billing。
2. 註冊 Web App，取得 Firebase SDK 設定，將純 JSON 存入 `public/firebase-config.json`：

```json
{
  "apiKey": "從 Firebase Web App 設定取得",
  "authDomain": "YOUR_PROJECT_ID.firebaseapp.com",
  "projectId": "YOUR_PROJECT_ID",
  "appId": "從 Firebase Web App 設定取得"
}
```

這是可公開的 Web SDK 設定，不可放入服務帳戶私鑰或學生密碼。檔案列入 gitignore，是為避免誤用其他專案。

3. 啟用 Authentication 的 **Email/Password**，關閉 Email Link；密碼政策採 enforce，最少六字元、至少小寫英文字母與數字。確認預設 Hosting 網域在 Authorized domains 中。
4. 建立 Firestore **Standard／Native mode**，選擇 `asia-east1`（台灣）；以正式模式建立，稍後套用本專案規則。不要選會要求連結計費的功能。
5. 建立私密密碼 JSON，七個 key 為 `ta`、`fe`、`jy`、`yl`、`sx`、`yx`、`dx`。每個 value 為該學生的固定密碼。存於 `secrets/passwords.json`，設定檔案權限 `chmod 600 secrets/passwords.json`。不要放入 `public/`、提交版本庫、截圖或貼入聊天。
6. 初始化工具使用 Application Default Credentials。具專案管理權限的本機帳號可使用 `gcloud auth application-default login`；若使用服務帳戶憑證，放在 `secrets/` 並以 `GOOGLE_APPLICATION_CREDENTIALS` 指定，不得打包進網站。
7. 明確指定專案部署規則與索引：

```sh
npx firebase login
npx firebase deploy --project YOUR_PROJECT_ID --only firestore:rules,firestore:indexes
```

8. 確認正式初始化環境**沒有** `FIREBASE_AUTH_EMULATOR_HOST` 或 `FIRESTORE_EMULATOR_HOST`，再執行：

```sh
GCLOUD_PROJECT=YOUR_PROJECT_ID TEAM_PASSWORD_FILE=secrets/passwords.json npm run seed
```

初始化使用固定 UID（例如 `team-ta`）；如遇到同識別信箱但 UID 不符的既有帳號會停止，不會把陌生帳號綁為成員。初始化只建立缺少的帳號、姓名、帳號綁定與預設空檔；既有帳號密碼及排程不覆蓋。重跑成功不代表既有帳號密碼與輸入檔相同；原密碼始終保留。所有新帳號密碼先驗證後才開始寫入。若中途因網路失敗，修復後可重跑。

9. 等待 Firestore 索引完成，建置後發布：

```sh
npm run build
npx firebase deploy --project YOUR_PROJECT_ID --only hosting
```

Hosting 部署前會自動重建，並檢查 Web SDK 設定的專案 ID 與部署目標一致；未設定時會阻止部署。

正式網址為 `https://YOUR_PROJECT_ID.web.app`。用無痕視窗測試公開查看，再用兩個瀏覽器測試本人修改與同步。不要使用 `?emulator=1`；該參數只在 localhost／127.0.0.1 生效。

## 操作與資料行為

- 七人的初始常規空檔取自原設計，不匯入舊 `localStorage` 修改。
- 常規空檔目前是一套循環週設定，沒有學期歷史版控；修改後適用於目前所有週次。
- 台北時區，週一為一週起點，08:00–21:00，一小時一格。
- 臨時異動只要與格子有交集就覆蓋整格，沿用原設計；較晚建立者優先，同時以文件 ID 固定排序。撤銷後依剩餘資料重算。
- 只訂閱目前週次相交的異動，因此學生的「已登記的異動」也顯示目前週次資料；要撤銷其他週的異動，先切換到該週。
- 常規空檔採版本交易，衝突時重新取得伺服器版本並提示重試，不靜默覆蓋。
- 儲存須經伺服器確認才顯示成功；離線時停用編輯，既有畫面會標示可能過期。
- 規則禁止學生修改成員、預設空檔及帳號綁定；僅本人可讀自己的綁定，不能列舉他人綁定。
- Firestore listener 與公開存取會消耗免費額度；在 Firebase Console 查看用量，Spark 額度耗盡時服務可能受限，不自動付費。

## 回復與維護

部署前保留前一版 Hosting release，畫面問題可從 Hosting release history 回復；此操作不回復資料庫。規則與索引使用此目錄的檔案重新部署。公開網站沒有維護入口；只有專案擁有者透過 Firebase Console／可信本機工具維護固定名單和帳號。

原始前端副本包含示範 PIN，僅供設計留存，**不得將原始資料夾部署**；`firebase.json` 僅部署 `public/`。
