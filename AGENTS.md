# AGENTS.md

このリポジトリで作業するエージェント向けの簡易ガイドです。

## プロジェクト概要

- **React 19 + TypeScript 7 + Vite 8 + Tailwind CSS 4** で構成された DigitShow（DigitShowModbus）向け HTTP ポーリングビューア SPA
- 通信は **HTTP API ポーリング**（バックエンドサーバー `http://<ip>:<port>/v1/` 等を定期取得）
- AI 16ch（Raw / Physical）/ AO 8ch / Parameter 32ch の値表示および制御（Zero / AO 出力）
- Plotly.js（`react-plotly.js`）によるリアルタイムチャート表示（X/Y 軸の自由選択、時系列 / パラメトリック曲線）
- Web Serial / WebUSB は使用していません（バックエンドサーバーとの HTTP 通信に一本化）

## 主要コマンド

```bash
bun install
bun run dev              # 開発サーバー (HMR)
bun run build            # typecheck -> vite build (www/ へ出力)
bun run build:exe        # typecheck -> vite build -> Windows exe (DigitShowWebview.exe 出力)
bun run build:all        # 全プラットフォーム向け一括クロスビルド (Windows/macOS/Linux 全7種類を dist/ へ出力)
bun run typecheck        # 型チェック (tsc --noEmit)
bun run preview          # ビルド結果のローカルプレビュー
```

- **`bun run build` は `tsc --noEmit` を先に通す**。vite は型を見ないため、型チェックを必ず通してからビルドする
- `bun run build:exe` は `www/` を埋め込んだ Windows 用デスクトップランチャー `DigitShowWebview.exe`（約 11MB）を出力します
- `bun run build:all` は Pure Go のクロスコンパイル機能を使い、Windows (x64/ARM64), macOS (Apple Silicon/Intel), Linux (x64/ARM64/ARMv7) の全 7 プラットフォーム向けバイナリを `dist/` へ一括生成します
- `noUnusedLocals` / `noUnusedParameters` 有効。未使用の import や変数はビルドを止める

## ディレクトリ構造

```
src/
├── App.tsx                          # UI・ポーリング・状態管理の中枢
├── main.tsx                         # エントリポイント + Error Boundary
├── index.css                        # Tailwind + カスタムクラス
├── types.ts                         # 型定義（ConnectionConfig, ApiData, ApiPreview, DataPoint 等）
├── types/
│   └── modules.d.ts                 # 型定義を持たない依存の宣言
├── constants.ts                     # 一元化された定数（AI_CHANNELS, AO_CHANNELS, PARAM_CHANNELS 等）
├── apiConfig.ts                     # 接続設定 (ConnectionConfig) の localStorage 永続化と URL 解決
├── plotly.ts                        # Plotly カスタム最小バンドル（core + scattergl）
├── hooks/
│   ├── useTheme.ts                  # テーマ管理（localStorage 永続化、dark/light）
│   └── useChartAxes.ts              # チャート軸設定（localStorage 永続化）
├── components/
│   ├── ChartPanel.tsx               # Plotly チャート（X/Y 軸切替、4枚グリッド）
│   ├── CollapseButton.tsx           # チャートエリアの折りたたみボタン
│   ├── ConnectionConfigPanel.tsx    # 接続設定ウィンドウ（IP/Host, Port, Poll Interval, Test Connection）
│   ├── FooterBar.tsx                # 画面下端固定のバー（レスポンス時間・ポーリング周期表示）
│   ├── HamburgerMenu.tsx            # スライドインメニュー（Connection Config, App Info 等）
│   ├── AppInfoPanel.tsx             # バージョン・依存ライブラリ情報表示
│   ├── ThemeToggle.tsx              # ライト/ダーク切替スイッチ
│   ├── UiScaleControl.tsx           # UI 拡大率（[-], [100%], [+]）
│   ├── SlideToConfirm.tsx           # スワイプ確定コントロール（Disconnect 操作等の誤操作防止）
│   ├── SlidePanel.tsx               # 共通スライドインパネル（HamburgerMenu 専用）
│   └── FloatingWindow.tsx           # 共通フローティングウィンドウ（react-rnd）
└── utils/
    ├── appMode.ts                   # 実行形態判定
    ├── cookies.ts                   # 設定の永続化（localStorage 本体 + fallback）
    ├── interopDefault.ts            # ESM/CJS interop ヘルパー
    └── uiScale.ts                   # UI 拡大率（#root の CSS zoom）管理
public/
└── icon.png                         # アプリアイコン（DSMv6）
```

## アーキテクチャ上の重要点

### HTTP バックエンド通信
- バックエンド（DigitShowModbus）の REST API を定期的にポーリングします：
  - `GET /v1/realtime`: 全チャンネル（raw, phy, par, out, label）の最新値
  - `GET /v1/preview?param=...`: 直近の時系列プレビューデータ
  - `GET /v1/heartbeat`: 疎通確認・ヘルスチェック
  - `POST /v1/zero`: ゼロ点リセット（Tare）
  - `POST /v1/out`: AO 出力値設定
- **Mixed Content の回避**:
  - 本アプリを HTTPS でホストすると、ローカルネットワーク内の HTTP バックエンド（`http://192.168.x.x:8080` 等）への通信がブラウザの Mixed Content 制約でブロックされます。
  - そのため、本アプリ自体を HTTP（`http://127.0.0.1:...` 等）で配信・起動するか、HTTP デスクトップランチャー経由で利用します。

### チャート描画
- X 軸・Y 軸に `time`, `raw_00..15`, `phy_00..15`, `par_00..31` を任意に選択可能
- 応力-ひずみヒステリシスループなどのパラメトリック曲線 (x(t), y(t)) の描画に対応するため、Plotly の `scattergl` を採用
- 間引き前の点列を適切に管理し、再描画負荷を抑制

## package.json のバージョン更新ルール

- バージョンを上げるのは「push」「リリース」時のみ
- 採番は小規模修正でパッチ更新、機能追加でマイナー更新
