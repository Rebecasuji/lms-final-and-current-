// Email notification service — production-ready via Resend
import { Resend } from "resend";

export interface EmailNotification {
  to: string[];
  subject: string;
  html: string;
  type: "leave" | "permission" | "reset";
}

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || "leave@timestrap.space";
const VERIFIED_FROM_EMAIL = process.env.VERIFIED_FROM_EMAIL || undefined;
const DEFAULT_ADMIN_EMAILS = (process.env.ADMIN_EMAIL || "naveen@ctint.in").split(",").map((s) => s.trim()).filter(Boolean);

function sanitizeSubject(subject: string | undefined): string {
  if (!subject) return '';
  // Remove newlines/carriage returns and backticks, collapse whitespace, trim and cap length
  return subject
    .replace(/[\r\n]+/g, ' ')
    .replace(/`+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

let resendClient: Resend | null = null;
if (RESEND_API_KEY) {
  try {
    resendClient = new Resend(RESEND_API_KEY);
  } catch (err) {
    console.error("[EMAIL] Failed to initialize Resend client:", err);
    resendClient = null;
  }
} else {
  console.warn("[EMAIL] RESEND_API_KEY is not set — emails will not be sent");
}

export async function sendEmailNotification(notification: EmailNotification): Promise<boolean> {
  try {
    const toRecipients = (notification.to && notification.to.length > 0) ? notification.to : DEFAULT_ADMIN_EMAILS;

    if (!toRecipients || toRecipients.length === 0) {
      console.warn("[EMAIL] No recipients configured for notification");
      return false;
    }

    if (!resendClient) {
      console.log(`[EMAIL] (dry-run) Would send ${notification.type} email to: ${toRecipients.join(", ")}`);
      console.log(`[EMAIL] Subject: ${notification.subject}`);
      return true;
    }

    const safeSubject = sanitizeSubject(notification.subject);
    let resp: any = await resendClient.emails.send({
      from: FROM_EMAIL,
      to: toRecipients,
      subject: safeSubject,
      html: notification.html,
    });

    // If Resend rejects due to unverified domain, optionally retry with a
    // VERIFIED_FROM_EMAIL provided in the environment.
    if (resp && resp.error && resp.error.name === 'validation_error' && VERIFIED_FROM_EMAIL && VERIFIED_FROM_EMAIL !== FROM_EMAIL) {
      console.warn('[EMAIL] Resend rejected FROM_EMAIL; retrying with VERIFIED_FROM_EMAIL', VERIFIED_FROM_EMAIL);
      try {
        const safeRetrySubject = sanitizeSubject(notification.subject);
        resp = await resendClient.emails.send({
          from: VERIFIED_FROM_EMAIL,
          to: toRecipients,
          subject: safeRetrySubject,
          html: notification.html,
        });
      } catch (e) {
        console.error('[EMAIL] Retry with VERIFIED_FROM_EMAIL failed:', e);
      }
    }

    console.log(`[EMAIL] Sent ${notification.type} email to ${toRecipients.join(", ")}`);
    try {
      console.log('[EMAIL] Resend response:', JSON.stringify(resp, null, 2));
    } catch (e) {
      console.log('[EMAIL] Resend response (raw):', resp);
    }
    return true;
  } catch (error) {
    console.error("[EMAIL] Failed to send notification:", error);
    return false;
  }
}

export function generateLeaveNotificationEmail(employeeName: string, leaveType: string, startDate: string, endDate: string, reason: string, duration?: string, fromTime?: string, toTime?: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Leave Application Submitted</h2>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      
      <p style="margin: 10px 0;"><strong>Employee Name:</strong> ${employeeName}</p>
      <p style="margin: 10px 0;"><strong>Leave Type:</strong> ${leaveType}</p>
      <p style="margin: 10px 0;"><strong>Start Date:</strong> ${startDate}</p>
      <p style="margin: 10px 0;"><strong>End Date:</strong> ${endDate}</p>
      ${duration ? `<p style="margin: 10px 0;"><strong>Duration:</strong> ${duration}</p>` : ''}
      ${duration === 'Hourly' && fromTime && toTime ? `<p style="margin: 10px 0;"><strong>OD Hours:</strong> ${fromTime} to ${toTime}</p>` : ''}
      <p style="margin: 10px 0;"><strong>Reason:</strong> ${reason}</p>
      
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">Please review and take action on this leave request in the Leave Manager application.</p>
    </div>
  `;
}

export function generatePermissionNotificationEmail(
  employeeName: string,
  permissionType: string,
  date: string,
  startTime: string,
  endTime: string,
  reason: string,
  isLOPApplicable?: boolean
): string {
  const lopBadge = isLOPApplicable
    ? `<div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin: 15px 0; border-radius: 4px;">
        <p style="margin: 0; color: #b45309; font-weight: bold;">⚠️ Loss of Pay (LOP) Applicable</p>
        <p style="margin: 5px 0 0 0; font-size: 13px; color: #92400e;">This permission request exceeds the monthly limit and has been marked as LOP.</p>
      </div>`
    : "";

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Permission Request Submitted</h2>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      
      <p style="margin: 10px 0;"><strong>Employee Name:</strong> ${employeeName}</p>
      <p style="margin: 10px 0;"><strong>Permission Type:</strong> ${permissionType}</p>
      <p style="margin: 10px 0;"><strong>Permission Date:</strong> ${date}</p>
      <p style="margin: 10px 0;"><strong>Start Time:</strong> ${startTime}</p>
      <p style="margin: 10px 0;"><strong>End Time:</strong> ${endTime}</p>
      <p style="margin: 10px 0;"><strong>Reason:</strong> ${reason}</p>
      
      ${lopBadge}
      
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="color: #666; font-size: 12px;">Please review and take action on this permission request in the Leave Manager application.</p>
    </div>
  `;
}

export function generateResetPasswordEmail(username: string, resetLink: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Password Reset Request</h2>
      <p>Hello ${username},</p>
      <p>You requested to reset your password.</p>

      <p>
        <a href="${resetLink}" 
           style="display:inline-block;padding:12px 20px;background:#2563eb;color:white;text-decoration:none;border-radius:6px;">
          Reset Password
        </a>
      </p>

      <p>This link will expire in 15 minutes.</p>

      <p style="font-size:12px;color:#666;">
        If you didn’t request this, ignore this email.
      </p>
    </div>
  `;
}
