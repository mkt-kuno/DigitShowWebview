# DigitShowWebview

ブラウザで DigitShow の計測値を確認できる Web ビューアです。

## 使い方

Releases ページから最新の `www.zip` をダウンロードし、解凍した内容を任意の Web サーバーに配置してください。

`www/` 配下を配信すると、ブラウザからアクセスするだけで以下が確認できます:

- 現在の Raw / Physical / Parameter / Voltage 値
- X 軸・Y 軸を選択してのチャート表示
- 起動している GPU が WebGL 対応の場合は scattergl で描画

データは `GET /v1/` および `GET /v1/preview?param=...` を定期的にポーリングして取得します。

## 開発

### 必要環境

- [Bun](https://bun.sh)

### コマンド

| コマンド | 内容 |
| --- | --- |
| `bun install` | 依存関係のインストール |
| `bun run dev` | 開発サーバ起動 (HMR) |
| `bun run build` | 型チェック + 本番ビルド + gzip 成果物生成 |
| `bun run lint` | ESLint 実行 |
| `bun run preview` | ビルド結果のローカル確認 |

### ビルド成果物

`bun run build` を実行すると `dist/` に静的ファイルが生成されます。`dist/assets/*.gz` も同時に出力されるため、`Content-Encoding: gzip` を返せるサーバー (cpp-httplib など) ではそのまま利用可能です。

## リリース

タグを push すると GitHub Actions (`.github/workflows/release-www.yml`) が `dist/` を `www.zip` にパッケージ化し、GitHub Release へ自動添付します。

```sh
git tag v1.2.3
git push origin v1.2.3
```

## ライセンス

このプロジェクトは GNU Lesser General Public License v3.0 のもとで提供されています。詳細は `/home/runner/work/DigitShowWebview/DigitShowWebview/LICENSE` を参照してください。
