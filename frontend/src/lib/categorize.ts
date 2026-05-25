import type { IngredientCategory } from '../types'

/**
 * 食材名から自動カテゴリ判定。完全一致ではなく部分一致で判定する。
 * 上から順に評価し、最初にマッチしたカテゴリを返す。
 * どれにも当てはまらなければ 'other'。
 *
 * BE 接続後はサーバ側で再判定 (Gemini など) するか、この辞書を共有する想定。
 */
const CATEGORY_KEYWORDS: { category: IngredientCategory; keywords: string[] }[] = [
  // 加工品は肉系より先に判定 (ハム/ベーコン/ソーセージは肉ベースだが加工扱い)
  {
    category: 'processed',
    keywords: [
      '豆腐', '納豆', '油揚げ', '厚揚げ', 'がんもどき', '湯葉',
      'ハム', 'ベーコン', 'ソーセージ', 'ウインナー', 'チャーシュー',
      'かまぼこ', 'ちくわ', 'はんぺん', 'さつま揚げ', '練り物',
      'ツナ缶', '缶詰',
    ],
  },
  {
    category: 'meat_fish',
    keywords: [
      '鶏', '豚', '牛', '挽肉', 'ひき肉', 'ミンチ', 'もも肉', 'むね肉', 'ささみ',
      'ロース', 'バラ', 'カルビ', 'ホルモン', 'レバー',
      '魚', '鮭', 'サケ', '鯖', 'サバ', 'マグロ', 'ぶり', 'ブリ', 'たら', 'タラ', 'サンマ', 'さんま',
      'イカ', 'タコ', 'エビ', '海老', 'カニ', '貝', 'ホタテ', 'あさり', 'しじみ',
      '刺身', '切り身',
    ],
  },
  {
    category: 'dairy_egg',
    keywords: ['卵', 'たまご', '牛乳', 'ヨーグルト', 'チーズ', 'バター', '生クリーム', '豆乳'],
  },
  {
    category: 'staple',
    keywords: [
      '米', 'ご飯', 'ごはん', '玄米', 'もち米',
      'パン', '食パン', 'バゲット',
      'うどん', 'そば', 'パスタ', 'スパゲッティ', 'ラーメン', '中華麺', '焼きそば麺', '麺',
      '餅', '春雨',
    ],
  },
  {
    category: 'seasoning',
    keywords: [
      '醤油', 'しょうゆ', '砂糖', '塩', '味噌', 'みそ', '酒', 'みりん', '酢',
      'こしょう', 'コショウ', 'マヨネーズ', 'ケチャップ', 'ソース', 'ドレッシング',
      '油', 'サラダ油', 'ごま油', 'オリーブオイル', 'バター',
      'めんつゆ', 'だし', '出汁', 'だしの素', 'コンソメ', '鶏ガラ',
      'にんにく', 'しょうが', '生姜', 'わさび', 'からし',
      '片栗粉', '小麦粉', 'パン粉',
      '七味', '一味', 'カレー粉', '香辛料',
    ],
  },
  {
    category: 'dry_goods',
    keywords: ['海苔', 'のり', 'わかめ', 'ひじき', '昆布', '鰹節', 'かつお節', '干し椎茸', '切り干し大根'],
  },
  {
    category: 'vegetable',
    keywords: [
      '玉ねぎ', 'たまねぎ', 'ねぎ', 'ネギ', '長ねぎ', '青ねぎ',
      'にんじん', '人参', 'じゃがいも', 'ジャガイモ', 'さつまいも', 'サツマイモ',
      'キャベツ', 'レタス', '白菜', 'はくさい', 'ほうれん草', '小松菜', '春菊', '水菜', 'チンゲン菜',
      'ピーマン', 'パプリカ', 'ナス', 'なす', '長ナス', 'トマト', 'ミニトマト', 'きゅうり',
      '大根', 'だいこん', 'かぶ', 'ごぼう', 'れんこん',
      'もやし', 'にら', 'ニラ', 'アスパラ', 'ブロッコリー', 'カリフラワー', 'いんげん', 'えだまめ',
      'きのこ', 'しいたけ', 'えのき', 'しめじ', 'まいたけ', 'エリンギ', 'マッシュルーム',
      'りんご', 'みかん', 'バナナ', 'いちご', 'ぶどう', '柿', '梨', 'キウイ',
      'アボカド', 'コーン',
    ],
  },
]

const CATEGORY_LABELS: Record<
  IngredientCategory,
  { label: string; dot: string; tint: string; tintText: string }
> = {
  meat_fish: {
    label: '肉・魚',
    dot: '#e11d48',
    tint: '#fff1f2',
    tintText: '#be123c',
  },
  vegetable: {
    label: '野菜・果物',
    dot: '#65a30d',
    tint: '#f7fee7',
    tintText: '#4d7c0f',
  },
  dairy_egg: {
    label: '卵・乳製品',
    dot: '#0284c7',
    tint: '#f0f9ff',
    tintText: '#0369a1',
  },
  staple: {
    label: '主食',
    dot: '#d97706',
    tint: '#fffbeb',
    tintText: '#b45309',
  },
  processed: {
    label: '加工品・豆製品',
    dot: '#7c3aed',
    tint: '#f5f3ff',
    tintText: '#6d28d9',
  },
  seasoning: {
    label: '調味料',
    dot: '#ea580c',
    tint: '#fff7ed',
    tintText: '#c2410c',
  },
  dry_goods: {
    label: '乾物・常備品',
    dot: '#78716c',
    tint: '#fafaf9',
    tintText: '#57534e',
  },
  other: {
    label: 'その他',
    dot: '#a3a3a3',
    tint: '#fafafa',
    tintText: '#525252',
  },
}

export const CATEGORY_ORDER: IngredientCategory[] = [
  'meat_fish',
  'vegetable',
  'dairy_egg',
  'staple',
  'processed',
  'seasoning',
  'dry_goods',
  'other',
]

export function categorizeIngredient(name: string): IngredientCategory {
  const trimmed = name.trim()
  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((kw) => trimmed.includes(kw))) {
      return category
    }
  }
  return 'other'
}

export function getCategoryMeta(category: IngredientCategory) {
  return CATEGORY_LABELS[category]
}
