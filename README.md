# DigitShowWebview

ブラウザで DigitShow（DigitShowSide / DigitShowModbus）の計測値を確認できる Web ビューアです。バックエンドを HTTP でポーリングし、Raw / Physical / Parameter の値とチャートを表示します。

🌐 **Demo**: http://dsw.kmakoto.stream/

## 使い方

上記 URL を Chromium 系ブラウザ（Chrome / Edge）で開きます。初回訪問時に Service Worker がアプリ一式をプリキャッシュするため、以降はオフラインでも起動できます（アプリの更新は起動直後と Application Info の「Check for Updates」で確認できます。接続中は更新確認が停止します）。

1. メニュー → **Connection Config** でバックエンドの接続先を設定します（IP / ホスト名・ポート・ポーリング周期 1s / 2s / 5s）。`Test Connection` で `/v1/health` への疎通確認ができます。
2. ヘッダーの **Connect** を押すとポーリングを開始します。接続中は **Disconnect** がスワイプ操作（誤操作防止）になります。
3. 設定はブラウザの localStorage へ端末ごとに保存されます。既定の接続先は `localhost:8080` です。

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
| `bun run preview` | ビルド結果のローカル確認 |
| `bun run deploy` | ビルドして GitHub Pages（`gh-pages` ブランチ）へ公開 |

### ビルド成果物

`bun run build` を実行すると `dist/` に静的ファイル（SPA 本体・Service Worker・manifest など）が生成されます。`dist/sw.js` にはビルド時にプリキャッシュ対象一覧・キャッシュバージョン・アプリバージョンが注入されます（`vite.config.ts` の `precache-manifest` プラグイン）。

## デプロイ（Web 版公開）

`bun run deploy` は `bun run build` → `scripts/deploy-gh-pages.ts` の順に実行します。Pages の Source は **`gh-pages` ブランチ / `(root)`** で、CI での自動デプロイは行いません（公開されるのは手元でビルドした `dist/` です）。

- スクリプトは `git checkout` を一切使わず、使い捨ての index に `dist/` を登録して orphan commit を作り、`gh-pages` へ force push します（常に1コミット。作業ツリーが汚れていても安全）
- `dist/sw.js` の `APP_VERSION` と `package.json` の version が食い違う場合は中断します（古い `dist/` を新バージョンの名前で公開する事故防止）
- Jekyll 抑止の `.nojekyll` はスクリプトが自動で入れます
- 反映には push 後 1〜2 分かかります

## ライセンス

MIT License — [Makoto KUNO](https://github.com/mkt-kuno)