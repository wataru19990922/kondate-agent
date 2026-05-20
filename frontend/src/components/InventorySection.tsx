import { mockInventory } from '../mock/inventory'

/**
 * 冷蔵庫の在庫一覧。MVP では追加・編集 UI は最小限。
 * BE 接続後は GET /inventory から取得する想定。
 */
export function InventorySection() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">冷蔵庫の在庫</h2>
        <span className="text-sm text-gray-500">{mockInventory.length} 件</span>
      </div>

      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {mockInventory.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm"
          >
            <div className="flex items-baseline justify-between">
              <span className="font-medium text-gray-900">{item.ingredient}</span>
              <span className="text-sm text-gray-600">
                {item.quantity} {item.unit}
              </span>
            </div>
            {item.expiresAt && (
              <div className="mt-1 text-xs text-gray-500">
                消費期限: {item.expiresAt}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
        モックデータです。BE 接続後は <code>GET /inventory</code> から取得します。
      </div>
    </div>
  )
}
