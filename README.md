# DigitShowWebview

DigitShow（DigitShowSide / DigitShowModbus）の計測値を確認できるビューアです。バックエンドを HTTP でポーリングし、Raw / Physical / Parameter の値とチャートを表示します。

> ⚠️ **研究室内ネットから利用する場合は、必ずバックエンドの IP アドレスを `Connection Config` に入力してください。** `localhost` のままではアプリが動いている端末自身にしか繋がらず、研究室の計測サーバーには届きません。

## 使い方

`bun run build` で `dist/` に静的ファイルが生成されます。配信方法は問いません — DigitShowModbus と同じディレクトリに `www/` として配置する（`vite.config.ts` の `build.outDir` を `'www'` に変える）運用も、任意の HTTP サーバで配信する運用も、`bun run preview` でローカルブラウザ確認するのもよし。

メニュー → **Connection Config** でバックエンドの接続先を設定します（IP / ホスト名・ポート・ポーリング周期 1s / 2s / 5s）。`Test Connection` で `/v1/heartbeat` への疎通確認ができます。**研究室内ネットから利用する場合は `IP / Hostname` に研究室サーバーの IP アドレス（例: `157.82.159.114`）を入力してください。**

ヘッダーの **Connect** を押すとポーリングを開始します。接続中は **Disconnect** がスワイプ操作（誤操作防止）になります。設定はブラウザの localStorage へ端末ごとに保存されます。既定の接続先は `localhost:8080` です。

表示できる内容:

- AI 16ch の **Raw / Physical** 値と、AO 8ch / Parameter 16ch の値
- X / Y 軸を自由に選択できるチャート 4 枚（`time` / `raw_NN` / `phy_NN` / `par_NN`）
- ダークモードと UI 拡大率（50〜200%）の切り替え（メニューヘッダー）

データは `GET /v1/realtime` および `GET /v1/preview?param=...` を定期的にポーリングして取得します。

## 開発

### 必要環境

- [Bun](https://bun.sh)
- Chromium 系最新ブラウザ（Chrome / Edge）

### コマンド

| コマンド | 内容 |
| --- | --- |
| `bun install` | 依存関係のインストール |
| `bun run dev` | 開発サーバ起動 (HMR) |
| `bun run typecheck` | 型チェック（`tsc --noEmit`） |
| `bun run build` | 型チェック + 本番ビルド（`www/` へ出力） |
| `bun run build:exe` | 型チェック + 本番ビルド + Windows exe 化（`DigitShowWebview.exe` 出力） |
| `bun run build:all` | 全プラットフォーム向け一括クロスビルド（Windows / macOS / Linux 全 7 種類） |
| `bun run preview` | ビルド結果のローカルブラウザ確認 |

> VS Code のタスク:
> - `Ctrl+Shift+B` → `build`（typecheck + Vite production build）
> - コマンドパレット → "Tasks: Run Task" → `build exe`（`DigitShowWebview.exe` を生成）
> - コマンドパレット → "Tasks: Run Task" → `build all platforms`（全 OS/アーキテクチャの実行ファイルを `dist/` に生成）
> - コマンドパレット → "Tasks: Run Task" → `build www.zip`（`build` 後に `www/` を zip 化）
> - 同 → `Release`（`build www.zip` と `build all platforms` を一発で実行）

### ビルド成果物

- `bun run build` を実行すると `www/` に静的ファイル（SPA 本体）が生成されます。
- `bun run build:exe` を実行すると、静的ファイルを内包した単一実行ファイル `DigitShowWebview.exe`（約 11MB）が生成されます。
- `bun run build:all` を実行すると、`dist/` 配下に以下の全 7 プラットフォーム向け単一バイナリが一括生成されます：
  - Windows: `DigitShowWebview-windows-x64.exe`, `DigitShowWebview-windows-arm64.exe`
  - macOS: `DigitShowWebview-darwin-arm64` (Apple Silicon M1〜M4), `DigitShowWebview-darwin-x64` (Intel)
  - Linux: `DigitShowWebview-linux-x64`, `DigitShowWebview-linux-arm64` (Raspberry Pi 4/5), `DigitShowWebview-linux-armv7` (Raspberry Pi 32bit)

## ライセンス

MIT License — [Makoto KUNO](https://github.com/mkt-kuno)