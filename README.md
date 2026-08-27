# DigitShowWebview

DigitShowModbus のリアルタイム計測値や時系列チャートを手元の PC で遠隔監視・確認できるクロスプラットフォーム対応の HTTP ビューアです。

---

## 運用構成

同一ネットワーク（プライベート LAN / 同一サブネット内）において、**試験機 PC（ターゲット）** と **監視 PC（ホスト）** を接続して運用します。

```
+------------------------------------+          +------------------------------------+
|        試験機 PC (ターゲット)        |          |          監視 PC (ホスト)          |
|                                    |   HTTP   |                                    |
|  DigitShowModbus                   | <──────> |  DigitShowWebview.exe (本アプリ)    |
|  (HTTP API: 192.168.x.x:8080 等)    |  (LAN)   |  (手元の PC でダブルクリック起動)   |
+------------------------------------+          +------------------------------------+
```

- **試験機 PC（ターゲット）**: センサーや Modbus デバイスと接続され、DigitShowModbus が動作している計測用 PC。
- **監視 PC（ホスト）**: 手元で計測データを確認・監視する作業用 PC。**本アプリ（実行バイナリ）はこちらの監視 PC で起動します。**
  - ※ 以前のように静的ファイルを試験機の `www/` に配置する必要はありません。

---

## 使い方

### 1. アプリの起動
監視 PC 上で各 OS 向けの実行ファイル（Windows の場合は `DigitShowWebview.exe`）を起動します。
ローカル HTTP サーバーが自動起動し、アドレスバーのない専用アプリウィンドウ（Edge / Chrome `--app` モード）が立ち上がります。

### 2. バックエンド接続先の設定 (`Connection Config`)
1. 右上のメニューアイコン（☰） $\rightarrow$ **Connection Config** を開きます。
2. **`IP / Hostname`** に **試験機 PC（ターゲット）の IP アドレス**（例: `192.168.1.50` や `157.82.xxx.xxx`）を入力します。
3. **`Port`** にバックエンドのポート（既定: `8080`）を入力します。
4. **`Test Connection`** を押して、`/v1/heartbeat` への疎通（OK 200）を確認します。
   - ※ 設定内容は監視 PC のブラウザ（localStorage）に自動保存されます。

### 3. 計測データの監視開始
ヘッダーの **Connect** ボタンを押すと、試験機 PC からの定期ポーリング（`/v1/realtime` および `/v1/preview`）が開始されます。
接続中は誤操作防止のため、**Disconnect** がスワイプ操作（ドラッグ確定）になります。

---

## 主な機能・表示内容

- **AI 16ch**: アナログ入力生値（Raw）およびキャリブレーション後の物理量（Physical）表示
- **AO 8ch / Parameter 32ch**: アナログ出力値および内部パラメータの表示・監視
- **リアルタイムチャート 4 枚**:
  - X 軸 / Y 軸を任意に選択可能（`time`, `raw_00..15`, `phy_00..15`, `par_00..31`）
  - 応力-ひずみヒステリシスループなどのパラメトリック曲線 (x(t), y(t)) の高速描画に対応
- **UI 調整**: ダークモード切替、UI 拡大縮小（50% 〜 200%）

---

## 開発・ビルド

### 必要環境
- [Bun](https://bun.sh)
- [Go](https://go.dev) 1.22+（シングルバイナリ生成用）

### コマンド

| コマンド | 内容 |
| --- | --- |
| `bun install` | 依存関係のインストール |
| `bun run dev` | 開発サーバー起動 (HMR) |
| `bun run typecheck` | TypeScript 型チェック（`tsc --noEmit`） |
| `bun run build` | フロントエンド本番ビルド（`www/` 出力） |
| `bun run build:exe` | フロントエンドビルド ＋ Windows 向け単一 exe 生成（`DigitShowWebview.exe`） |
| `bun run build:all` | **全 OS / 全アーキテクチャ向け一括クロスビルド**（`dist/` 出力） |
| `bun run preview` | Web ビルド結果のローカルプレビュー |

### VS Code タスク
- `Ctrl + Shift + B` $\rightarrow$ `build`（型チェック ＋ Web ビルド）
- コマンドパレット $\rightarrow$ **Tasks: Run Task** $\rightarrow$ **`build all platforms`**（全 7 種類のバイナリを一括生成）
- コマンドパレット $\rightarrow$ **Tasks: Run Task** $\rightarrow$ **`Release`**（`www.zip` ＋ 全プラットフォームバイナリ生成）

### ビルド成果物（`build:all` 時の生成ファイル一覧）
`dist/` 配下に各環境向けの単一バイナリが出力されます：
- **Windows**: `DigitShowWebview-windows-x64.exe`, `DigitShowWebview-windows-arm64.exe`
- **macOS**: `DigitShowWebview-darwin-arm64` (Apple Silicon M1〜M4), `DigitShowWebview-darwin-x64` (Intel)
- **Linux**: `DigitShowWebview-linux-x64`, `DigitShowWebview-linux-arm64` (Raspberry Pi 4/5), `DigitShowWebview-linux-armv7` (Raspberry Pi 32bit)

---

## ライセンス

MIT License — [Makoto KUNO](https://github.com/mkt-kuno)