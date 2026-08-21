# DigitShowWebview

ブラウザで DigitShow（DigitShowSide / DigitShowModbus）の計測値を確認できる Web ビューアです。バックエンドを HTTP でポーリングし、Raw / Physical / Parameter の値とチャートを表示します。

🌐 **Demo**: http://dsw.kmakoto.stream/

> ⚠️ **研究室内ネットから Demo アプリ経由で接続する場合は、必ずバックエンドの IP アドレスを `Connection Config` に入力してください。** `localhost` のままではブラウザが動いている端末自身にしか繋がらず、研究室の計測サーバーには届きません。

## 使い方

上記 URL を Chromium 系ブラウザ（Chrome / Edge）で開きます。Service Worker は使用していないため、毎回サーバーから取得します（ブラウザキャッシュは有効です）。

1. メニュー → **Connection Config** でバックエンドの接続先を設定します（IP / ホスト名・ポート・ポーリング周期 1s / 2s / 5s）。`Test Connection` で `/v1/health` への疎通確認ができます。**研究室内ネットから利用する場合は `IP / Hostname` に研究室サーバーの IP アドレス（例: `157.82.159.114`）を入力してください。**
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
| `bun run electronbun:dev` | Electrobun デスクトップアプリの dev 起動 |
| `bun run electronbun:build` | Electrobun デスクトップアプリのビルド（macOS / Windows / Linux 向け） |

### ビルド成果物

`bun run build` を実行すると `dist/` に静的ファイル（SPA 本体）が生成されます。Service Worker / manifest は含まれません。

## デプロイ

カスタムドメイン `http://dsw.kmakoto.stream/` 配下に `dist/` の中身を配置してください。ホスティングの仕組み（VPS + nginx / Cloudflare Pages 等）はこのリポジトリでは管理しません — ビルドした `dist/` を任意の静的ファイル配信先に置けば動きます。

## デスクトップアプリ（Electrobun）

[Bun で組み込みランタイムを配布する](https://github.com/blackboardsh/electrobun)代わりに、[Electrobun](https://github.com/blackboardsh/electrobun) でネイティブウィンドウアプリとしてビルドできます。**OS の WebView を使うためバイナリは 14 MB 程度**（Bun 一本焼きの `serve.exe` は 117 MB）に収まります。

```bash
bun run electronbun:dev    # 開発モード
bun run electronbun:build  # 本番ビルド
```

ビルド要件:

- **macOS**: Xcode Command Line Tools、cmake (`brew install cmake`)
- **Windows**: Visual Studio Build Tools (C++ 開発ツール)、cmake
- **Linux**: build-essential、cmake、`libwebkit2gtk-4.1-dev`、`libgtk-3-dev`、`libayatana-appindicator3-dev`、`librsvg2-dev`

`preBuild` フックで `bun run build` が走り、Vite の `dist/` を Electrobun の `views://mainview/` にコピーしてから packaging します。

⚠️ 現環境（Windows / cmake のみ・VS Build Tools 不在）では `electrobun build` は失敗します。ビルド前に Visual Studio Installer から「C++ によるデスクトップ開発」を追加してください。

## ライセンス

MIT License — [Makoto KUNO](https://github.com/mkt-kuno)