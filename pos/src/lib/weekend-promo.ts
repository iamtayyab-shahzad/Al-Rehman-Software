/** Thin wrappers — discount math comes from cached Admin rules. */

import {
  anyRuleMatchesToday,
  bestDiscountLabel,
  bestMatchingRule,
  discountFromRules,
  eligiblePromoSubtotal,
  isDealLineName,
  type DiscountRule,
  type PromoLine,
} from "@/lib/discount-rules";

export type { PromoLine };
export { eligiblePromoSubtotal, isDealLineName };
export const WEEKEND_PROMO_END_DATE = "2026-08-31";

let cachedRules: DiscountRule[] = [];

export function setDiscountRulesCache(rules: DiscountRule[]) {
  cachedRules = Array.isArray(rules) ? rules.filter((r) => r.active) : [];
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("discount-rules-updated"));
  }
}

export function getDiscountRulesCache(): DiscountRule[] {
  return cachedRules;
}

function legacyFallbackRules(): DiscountRule[] {
  return [
    {
      name: "Fri & Sun 10% off",
      active: true,
      percent: 10,
      min_subtotal: 1000,
      schedule_type: "weekdays",
      end_date: WEEKEND_PROMO_END_DATE,
      weekdays_json: "[5,0]",
      exclude_deals: true,
    },
  ];
}

function rulesOrLegacy(): DiscountRule[] {
  return cachedRules.length ? cachedRules : legacyFallbackRules();
}

export type ActivePromoInfo = {
  name: string;
  min_subtotal: number;
  percent: number;
};

/** Rule that applies (or would apply) today for UI labels / hints. */
export function activePromoInfo(
  lines?: PromoLine[],
  date = new Date(),
): ActivePromoInfo | null {
  const rule = bestMatchingRule(rulesOrLegacy(), date, lines);
  if (!rule?.name) return null;
  return {
    name: rule.name,
    min_subtotal: rule.min_subtotal || 0,
    percent: rule.percent,
  };
}

export function isWeekendPromoDay(date = new Date()): boolean {
  return anyRuleMatchesToday(rulesOrLegacy(), date);
}

export function weekendDiscount(lines: PromoLine[], date = new Date()): number {
  return discountFromRules(rulesOrLegacy(), lines, date);
}

export function weekendPromoLabel(
  linesOrDate?: PromoLine[] | Date,
  date = new Date(),
): string | null {
  if (linesOrDate instanceof Date) {
    return activePromoInfo(undefined, linesOrDate)?.name || null;
  }
  if (Array.isArray(linesOrDate)) {
    return (
      bestDiscountLabel(rulesOrLegacy(), linesOrDate, date) ||
      activePromoInfo(linesOrDate, date)?.name ||
      null
    );
  }
  return activePromoInfo(undefined, date)?.name || null;
}
