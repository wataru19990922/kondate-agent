const LOCALE = 'ja-JP'

const monthDayFmt = new Intl.DateTimeFormat(LOCALE, {
  month: 'long',
  day: 'numeric',
})

const shortDateFmt = new Intl.DateTimeFormat(LOCALE, {
  month: 'numeric',
  day: 'numeric',
})

const weekdayNarrowFmt = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'narrow',
})

const numberFmt = new Intl.NumberFormat(LOCALE)

function parseIsoDate(iso: string): Date {
  return new Date(iso + 'T00:00:00')
}

export function formatMonthDay(iso: string): string {
  return monthDayFmt.format(parseIsoDate(iso))
}

export function formatShortDate(iso: string): string {
  return shortDateFmt.format(parseIsoDate(iso))
}

export function formatWeekdayNarrow(iso: string): string {
  return weekdayNarrowFmt.format(parseIsoDate(iso))
}

export function formatNumber(n: number): string {
  return numberFmt.format(n)
}
