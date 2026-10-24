export function mergeUsage(usage: string, frequency: string): string {
  return [usage.trim(), frequency.trim()].filter(Boolean).join('，')
}
