import type { InventoryItem } from '../types'

// デモ用の冷蔵庫在庫データ
export const mockInventory: InventoryItem[] = [
  { id: '1', ingredient: '鶏もも肉', quantity: 300, unit: 'g', expiresAt: '2026-05-23', source: 'receipt' },
  { id: '2', ingredient: '玉ねぎ', quantity: 2, unit: '個', expiresAt: '2026-06-01', source: 'receipt' },
  { id: '3', ingredient: '卵', quantity: 6, unit: '個', expiresAt: '2026-05-28', source: 'receipt' },
  { id: '4', ingredient: 'にんじん', quantity: 1, unit: '本', expiresAt: '2026-05-30', source: 'manual' },
  { id: '5', ingredient: 'ピーマン', quantity: 3, unit: '個', expiresAt: '2026-05-25', source: 'receipt' },
  { id: '6', ingredient: '長ナス', quantity: 2, unit: '本', expiresAt: '2026-05-24', source: 'manual' },
  { id: '7', ingredient: '醤油', quantity: 500, unit: 'ml', source: 'manual' },
  { id: '8', ingredient: '砂糖', quantity: 1, unit: 'kg', source: 'manual' },
]
