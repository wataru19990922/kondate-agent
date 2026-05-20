import { useState } from 'react'

/**
 * レシート登録セクション。BE 接続後は POST /receipts/parse でアップロード →
 * Gemini Vision が食材を抽出 → 在庫追加 の流れになる想定。
 * 今は画像プレビューと「解析中」演出だけ。
 */
export function ReceiptSection() {
  const [preview, setPreview] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'parsing' | 'done'>('idle')

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    setStatus('parsing')
    setTimeout(() => setStatus('done'), 1500)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">レシートから在庫追加</h2>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-8 text-center hover:border-emerald-400">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
        <span className="text-sm text-gray-600">
          📸 レシート画像を選択 (または撮影)
        </span>
        <span className="mt-1 text-xs text-gray-400">
          JPEG / PNG / HEIC 対応予定
        </span>
      </label>

      {preview && (
        <div className="space-y-2">
          <img src={preview} alt="preview" className="max-h-64 rounded-md border" />
          {status === 'parsing' && (
            <p className="text-sm text-emerald-700">Gemini Vision が解析中...</p>
          )}
          {status === 'done' && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-800">
              モック: 解析完了。BE 接続後は抽出された食材リストがここに表示され、
              そのまま在庫に追加されます。
            </div>
          )}
        </div>
      )}

      <div className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
        モック実装です。BE 接続後は <code>POST /receipts/parse</code> 経由で
        Gemini Vision (Vertex AI) が画像から食材リストを抽出します。
      </div>
    </div>
  )
}
