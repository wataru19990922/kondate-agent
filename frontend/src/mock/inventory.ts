import { categorizeIngredient } from '../lib/categorize'
import type { InventoryItem } from '../types'

// デモ用の冷蔵庫在庫データ。category は categorizeIngredient で自動付与。
// 注意: 提案レシピのうち最低 3 件が「すべて在庫あり」になるように構成している。
//   - レシピ 1 (ナス・ピーマン)     → 長ナス / ピーマン / 砂糖 / 醤油 / ゴマ油 / だしの素 / 白いりゴマ
//   - レシピ 7 (タルタルソース)    → 卵 / 玉ねぎ / マヨネーズ / 酢 / 砂糖 / 塩
//   - レシピ 10 (鮭の切り身)       → 鮭の切り身 / 酒
const RAW: Omit<InventoryItem, 'category'>[] = [
  // 肉・魚
  { id: '1', ingredient: '鶏もも肉', quantity: 300, unit: 'g', expiresAt: '2026-05-27', source: 'receipt' },
  { id: '2', ingredient: '鮭の切り身', quantity: 2, unit: '枚', expiresAt: '2026-05-26', source: 'receipt' },
  // 野菜・果物
  { id: '3', ingredient: '玉ねぎ', quantity: 2, unit: '個', expiresAt: '2026-06-05', source: 'receipt' },
  { id: '4', ingredient: 'にんじん', quantity: 1, unit: '本', expiresAt: '2026-05-30', source: 'manual' },
  { id: '5', ingredient: 'ピーマン', quantity: 3, unit: '個', expiresAt: '2026-05-28', source: 'receipt' },
  { id: '6', ingredient: '長ナス', quantity: 2, unit: '本', expiresAt: '2026-05-26', source: 'manual' },
  // 卵・乳製品
  { id: '7', ingredient: '卵', quantity: 6, unit: '個', expiresAt: '2026-06-02', source: 'receipt' },
  // 加工品・豆製品
  { id: '8', ingredient: '木綿豆腐', quantity: 1, unit: '丁', expiresAt: '2026-05-27', source: 'manual' },
  // 主食
  { id: '9', ingredient: 'ご飯', quantity: 3, unit: 'パック', source: 'manual' },
  // 調味料
  { id: '10', ingredient: '醤油', quantity: 500, unit: 'ml', source: 'manual' },
  { id: '11', ingredient: '砂糖', quantity: 1, unit: 'kg', source: 'manual' },
  { id: '12', ingredient: '塩', quantity: 200, unit: 'g', source: 'manual' },
  { id: '13', ingredient: '酢', quantity: 300, unit: 'ml', source: 'manual' },
  { id: '14', ingredient: '酒', quantity: 500, unit: 'ml', source: 'manual' },
  { id: '15', ingredient: 'ゴマ油', quantity: 200, unit: 'ml', source: 'manual' },
  { id: '16', ingredient: 'マヨネーズ', quantity: 1, unit: '本', source: 'manual' },
  { id: '17', ingredient: 'だしの素', quantity: 1, unit: '袋', source: 'manual' },
  // 乾物・常備品
  { id: '18', ingredient: '白いりゴマ', quantity: 1, unit: '袋', source: 'manual' },
]

export const mockInventory: InventoryItem[] = RAW.map((r) => ({
  ...r,
  category: categorizeIngredient(r.ingredient),
}))
