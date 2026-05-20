# ELASTIC_SCHEMA.md

Elasticsearch (Elastic Cloud) のインデックス設計。

## インデックス名: `recipes`

## マッピング

| フィールド | 型 | 用途 |
|---|---|---|
| `recipe_id` | keyword | 楽天 `recipeId` (主キー、ES の `_id` にも使う) |
| `title` | text (kuromoji) | レシピ名。BM25 検索の主要対象 |
| `description` | text (kuromoji) | レシピ説明文。補助検索対象 |
| `ingredient_names` | text (kuromoji) + keyword | 食材名の配列。在庫照合の主要対象 |
| `ingredient_names_embedding` | dense_vector (768 dim) | kNN ハイブリッド検索用。Vertex AI Text Embeddings で生成 |
| `cooking_time` | keyword | `recipeIndication` 例: "約10分" |
| `cost` | keyword | `recipeCost` 例: "100円以下" |
| `image_url` | keyword (index=false) | 表示用、検索対象外 |
| `recipe_url` | keyword (index=false) | 詳細ページ URL、検索対象外 |
| `category_ids` | keyword | 取得元カテゴリ ID。検索フィルタ用 |
| `description_short` | text (kuromoji) | (将来用) 短縮説明、検索精度向上用 |

### 日本語解析: kuromoji

Elastic Cloud 標準で `kuromoji` プラグインが利用可能。以下のカスタムアナライザを定義:

```json
"analysis": {
  "analyzer": {
    "kuromoji_analyzer": {
      "type": "custom",
      "tokenizer": "kuromoji_tokenizer",
      "filter": [
        "kuromoji_baseform",
        "kuromoji_part_of_speech",
        "ja_stop",
        "kuromoji_number",
        "kuromoji_stemmer",
        "lowercase"
      ]
    }
  }
}
```

### 埋め込み (embedding) のフェーズ

- **Phase 1 (今回)**: 埋め込みなしで投入。BM25 のみで検索動作確認
- **Phase 2 (Vertex AI 接続後)**: 食材名を `text-multilingual-embedding-002` (768 dim) で埋め込み生成 → 再投入または部分更新

## 検索パターン

### A. 在庫食材から候補レシピを抽出 (BM25)

```json
GET /recipes/_search
{
  "size": 20,
  "query": {
    "match": {
      "ingredient_names": {
        "query": "鶏もも肉 玉ねぎ 卵",
        "operator": "or"
      }
    }
  }
}
```

### B. ハイブリッド検索 (BM25 + kNN, Phase 2)

```json
GET /recipes/_search
{
  "size": 20,
  "query": {
    "match": { "ingredient_names": "鶏もも肉 玉ねぎ" }
  },
  "knn": {
    "field": "ingredient_names_embedding",
    "query_vector": [...],
    "k": 20,
    "num_candidates": 100
  },
  "rank": { "rrf": {} }
}
```

RRF (Reciprocal Rank Fusion) で BM25 と kNN の結果を統合する。

## 投入ツール

- `data/index_to_elastic.py` — `data/recipes.json` を読んで `recipes` インデックスに投入
- 既存インデックスがあれば再作成 (MVP の間はシンプルに)
