"""献立提案エージェントの I/O 契約 (Pydantic スキーマ)。

エージェントは自由作文ではなく、ここで宣言した形に従って構造化応答を返す。
評価コード (Phase 1b 以降) はこれらのスキーマに対してメトリクスを書く。
"""
from pydantic import BaseModel, Field


class InventoryItem(BaseModel):
    """冷蔵庫の在庫 1 行。"""

    ingredient: str = Field(..., description="食材名 (例: '鶏むね肉')")
    quantity: float = Field(..., gt=0, description="数量")
    unit: str = Field(..., description="単位 ('g' | '個' | '本' | 'ml' 等)")


class Nutrition(BaseModel):
    """1 食分の栄養情報 (推定値)。"""

    protein_g: float = Field(..., ge=0, description="タンパク質 (g)")
    fat_g: float = Field(..., ge=0, description="脂質 (g)")
    carb_g: float = Field(..., ge=0, description="炭水化物 (g)")
    kcal: float = Field(..., ge=0, description="エネルギー (kcal)")


class MenuSuggestionInput(BaseModel):
    """エージェントへの入力。"""

    inventory: list[InventoryItem] = Field(..., min_length=1, description="現在の在庫")
    household_size: int = Field(..., ge=1, le=10, description="食事人数")
    dietary_prefs: list[str] = Field(default_factory=list, description="食事嗜好 (例: 'ダイエット中')")
    allergies: list[str] = Field(default_factory=list, description="アレルギー食材")


class MenuSuggestionOutput(BaseModel):
    """エージェントからの出力。

    `ingredients_used` は必ず `inventory` の食材名から選び、
    分量はエージェントが家族構成・在庫量から動的算出する (CLAUDE.md 方針)。
    """

    menu_name: str = Field(..., description="提案する献立名")
    recipe_id: str = Field(..., description="採用したレシピの楽天 recipeId")
    ingredients_used: list[InventoryItem] = Field(
        ..., min_length=1, description="使用食材 (在庫から選択)"
    )
    nutrition: Nutrition
    recipe_url: str = Field(..., description="楽天レシピの詳細ページ URL")
    reasoning: str = Field(
        ..., description="この献立を選んだ理由 (在庫整合性・栄養・好みの観点)"
    )
