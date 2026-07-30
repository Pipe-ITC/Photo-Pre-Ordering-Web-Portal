"use client";

import { track } from "@vercel/analytics";

type AnalyticsValue = string | number | boolean | undefined;
type AnalyticsProperties = Record<string, AnalyticsValue>;

const customEventsEnabled =
  process.env.NEXT_PUBLIC_ENABLE_VERCEL_CUSTOM_EVENTS === "true";

function cleanProperties(properties: AnalyticsProperties = {}) {
  return Object.fromEntries(
    Object.entries(properties).filter(([, value]) => value !== undefined)
  ) as Record<string, string | number | boolean>;
}

export function trackInteraction(name: string, properties?: AnalyticsProperties) {
  if (!customEventsEnabled) return;
  track(name, cleanProperties(properties));
}
