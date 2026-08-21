# DigitShowWebview

DigitShow（DigitShowSide / DigitShowModbus）の計測値を確認できるビューアです。バックエンドを HTTP でポーリングし、Raw / Physical / Parameter の値とチャートを表示します。

> ⚠️ **研究室内ネットから利用する場合は、必ずバックエンドの IP アドレスを `Connection Config` に入力してください。** `localhost` のままではアプリが動いている端末自身にしか繋がらず、研究室の計測サーバーには届きません。

## 使い方

`bun run build` で `dist/` に静的ファイルが生成されます。配信方法は問いません — DigitShowModbus と同じディレクトリに `www/` として配置する（`vite.config.ts` の `build.outDir` を `'www'` に変える）運用も、任意の HTTP サーバで配信する運用も、`bun run preview` でローカルブラウザ確認するのもよし。

メニュー → **Connection Config** でバックエンドの接続先を設定します（IP / ホスト名・ポート・ポーリング周期 1s / 2s / 5s）。`Test Connection` で `/v1/health` への疎通確認ができます。**研究室内ネットから利用する場合は `IP / Hostname` に研究室サーバーの IP アドレス（例: `157.82.159.114`）を入力してください。**

ヘッダーの **Connect** を押すとポーリングを開始します。接続中は **Disconnect** がスワイプ操作（誤操作防止）になります。設定はブラウザの localStorage へ端末ごとに保存されます。既定の接続先は `localhost:8080` です。

表示できる内容:

- AI 16ch の **Raw / Physical** 値と、AO 8ch / Parameter 16ch の値
- X / Y 軸を自由に選択できるチャート 4 枚（`time` / `raw_NN` / `phy_NN` / `par_NN`）
- ダークモードと UI 拡大率（50〜200%）の切り替え（メニューヘッダー）

データは `GET /v1/` および `GET /v1/preview?param=...` を定期的にポーリングして取得します。

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
| `bun run build` | 型チェック + 本番ビルド（`dist/` へ出力） |
| `bun run preview` | ビルド結果のローカルブラウザ確認 |

> VS Code では `Ctrl+Shift+B` で `build` タスクが走ります。配布用の `www.zip` を作るにはコマンドパレット → "Tasks: Run Task" → `build www.zip` を選択（事前に `www/` を生成）。

### ビルド成果物

`bun run build` を実行すると `dist/` に静的ファイル（SPA 本体）が生成されます。Service Worker / manifest は含まれません。

## ライセンス

MIT License — [Makoto KUNO](https://github.com/mkt-kuno)