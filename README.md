# 献立提案エージェント (kondate-agent)

冷蔵庫の在庫を把握し、その時点で「実際に作れる」献立を栄養バランス込みで提案する AI エージェント。

Google Cloud Hackathon 提出作品。

## 主な機能

- **レシートから在庫登録**: スーパーのレシート画像を Gemini (Vision) で解析し、食材を自動登録
- **在庫ベースの献立提案**: 今ある食材で作れるメニューを栄養情報付きで提案 (PFC・タンパク質を重視)
- **採用 → 在庫減算**: 提案を採用すると使用食材が在庫から自動的に減る

## 技術スタック

- フロントエンド: Vite + React + TypeScript + Tailwind CSS on Firebase Hosting
- バックエンド: Cloud Run + FastAPI + ADK (Python)
- AI: Vertex AI - Gemini 2.5 Flash (multimodal) + Text Embeddings
- ユーザーデータ DB: Firestore
- レシピ検索基盤: Elastic Cloud (Elasticsearch — BM25 + kNN ハイブリッド)
- 認証: Firebase Authentication

詳細仕様・開発ガイドラインは [CLAUDE.md](CLAUDE.md) を参照。
