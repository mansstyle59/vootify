/**
 * Send a push notification to a specific user after a playlist is shared
 * or new content is added. Uses the send-push-notification-to-user edge function.
 */

import { supabase } from "@/integrations/supabase/client";

interface NotifyUserOptions {
  targetUserId: string;
  title: string;
  body: string;
  actionUrl?: string;
}

/**
 * Send a push notification to a single user (non-blocking, fire-and-forget).
 * Falls back silently on error.
 */
export async function notifyUser(opts: NotifyUserOptions): Promise<void> {
  try {
    await supabase.functions.invoke("send-push-to-user", {
      body: {
        target_user_id: opts.targetUserId,
        title: opts.title,
        body: opts.body,
        action_url: opts.actionUrl || "/library",
      },
    });
  } catch (e) {
    console.warn("[notifyUser] Push failed (non-critical):", e);
  }
}
