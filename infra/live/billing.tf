/*
 * 月次予算アラート。
 *
 * 月の累積実費が以下のしきい値に達すると、billing administrator (= プロジェクト Owner)
 * にメール通知が飛ぶ。明示的な通知チャネルを設定しなければデフォルトで billing admin
 * の登録メールアドレスへ自動配信される。
 *
 * 通知だけで自動シャットダウンはしない (誤検知時のサービス影響を避けるため)。
 * 暴走時の自動対応が必要になったら Pub/Sub + Cloud Functions で API 無効化等を
 * 追加する。
 *
 * 通貨: 請求アカウントが JPY 建てなので予算も JPY で指定する
 * (currency_code を省略すると billing account の通貨を自動採用する仕様)。
 *
 * thresholds (月 ¥4500, $30 相当):
 *   50%  (¥2,250) : 早期警告 — まだ余裕、ただし傾向を確認
 *   90%  (¥4,050) : 上限間近 — 利用パターン要見直し
 *   100% (¥4,500) : 上限到達 — 何かが想定外に動いている可能性
 *   150% (¥6,750) : 暴走検知 — 即時調査
 */

resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account_id
  display_name    = "kondate-agent monthly budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      # currency_code は省略 (billing account の通貨 = JPY を採用)
      units = "4500"
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 0.9
  }
  threshold_rules {
    threshold_percent = 1.0
  }
  threshold_rules {
    threshold_percent = 1.5
  }

  depends_on = [google_project_service.required["billingbudgets.googleapis.com"]]
}
