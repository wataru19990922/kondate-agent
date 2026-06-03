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
 * thresholds:
 *   50%  ($15) : 早期警告 — まだ余裕、ただし傾向を確認
 *   90%  ($27) : 上限間近 — 利用パターン要見直し
 *   100% ($30) : 上限到達 — 何かが想定外に動いている可能性
 *   150% ($45) : 暴走検知 — 即時調査
 */

resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account_id
  display_name    = "kondate-agent monthly budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = "30"
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
