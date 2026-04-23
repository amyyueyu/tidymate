import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY ?? "";
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST ?? "https://us.i.posthog.com";

export function initAnalytics() {
  if (typeof window === "undefined") return;
  if (!POSTHOG_KEY) return; // Skip if key not configured
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    // Never send image data or file contents
    sanitize_properties: (properties) => {
      const sanitized = { ...properties };
      // Strip any base64 data URLs that could accidentally be included
      for (const key of Object.keys(sanitized)) {
        if (typeof sanitized[key] === "string" && sanitized[key].startsWith("data:")) {
          delete sanitized[key];
        }
      }
      return sanitized;
    },
    persistence: "localStorage",
    autocapture: false,
  });
}

export function identifyUser(userId: string, properties: { email?: string; signup_date?: string }) {
  posthog.identify(userId, properties);
}

export function resetAnalyticsUser() {
  posthog.reset();
}

// ─── Generic track helper ─────────────────────────────────────────────────────

export function track(event: string, properties?: Record<string, unknown>) {
  posthog.capture(event, properties);
}

// ─── Event tracking helpers ───────────────────────────────────────────────────

export const analytics = {
  landingView: () =>
    posthog.capture("landing_view"),

  signupStarted: () =>
    posthog.capture("signup_started"),

  signupCompleted: (properties?: { email?: string }) =>
    posthog.capture("signup_completed", properties),

  photoUploaded: (properties?: { room_type?: string; source_channel?: string }) =>
    posthog.capture("photo_uploaded", properties),

  visionGenerationStarted: (properties?: { room_type?: string }) =>
    posthog.capture("vision_generation_started", properties),

  visionGenerated: (properties?: { room_type?: string }) =>
    posthog.capture("vision_generated", properties),

  challengeStarted: (properties?: { room_type?: string; tasks_completed?: number }) =>
    posthog.capture("challenge_started", properties),

  taskCompleted: (properties?: { room_type?: string; tasks_completed?: number; session_length?: number }) =>
    posthog.capture("task_completed", properties),

  roomFinished: (properties?: { room_type?: string; tasks_completed?: number; session_length?: number }) =>
    posthog.capture("room_finished", properties),

  bodyDoubleClicked: () =>
    posthog.capture("body_double_clicked"),

  bodyDoubleStarted: () =>
    posthog.capture("body_double_started"),

  bodyDoubleCompleted: (properties?: { session_length?: number }) =>
    posthog.capture("body_double_completed", properties),

  premiumPageViewed: () =>
    posthog.capture("premium_page_viewed"),

  premiumCtaClicked: () =>
    posthog.capture("premium_cta_clicked"),

  premiumSubscribed: () =>
    posthog.capture("premium_subscribed"),

  feedbackSubmitted: () =>
    posthog.capture("feedback_submitted"),

  shareClicked: (properties?: { source_channel?: string }) =>
    posthog.capture("share_clicked", properties),

  /** TODO: Remove after verifying PostHog integration */
  testEvent: () =>
    posthog.capture("posthog_test_event"),

  // ─── Premium / KonMari Decision Coach ─────────────────────────────────────
  premiumEntryClicked: (properties?: { source?: string }) =>
    posthog.capture("premium_entry_clicked", properties),

  decisionPhotoUploaded: (properties?: { intent?: string }) =>
    posthog.capture("decision_photo_uploaded", properties),

  decisionSessionStarted: (properties?: { intent?: string; item_count?: number }) =>
    posthog.capture("decision_session_started", properties),

  decisionMade: (properties?: { user_action?: string; ai_action?: string; accepted_ai?: boolean; category?: string }) =>
    posthog.capture("decision_made", properties),

  decisionSkipped: (properties?: { ai_action?: string; category?: string }) =>
    posthog.capture("decision_skipped", properties),

  decisionSessionCompleted: (properties?: { items_decided?: number; items_skipped?: number }) =>
    posthog.capture("decision_session_completed", properties),
};
