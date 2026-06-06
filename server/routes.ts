import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

import {
  sendEmailNotification,
  generateLeaveNotificationEmail,
  generatePermissionNotificationEmail,
  generateResetPasswordEmail
} from "./email";

import { getNotificationEmailsServer, supabaseServer } from "./supabaseServerClient";
import crypto from "crypto";


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // Email notification endpoints
  app.post("/api/send-leave-notification", async (req, res) => {
    try {
      const { employeeName, leaveType, startDate, endDate, reason } = req.body;

      // Resolve recipients server-side using Supabase service role (or fall back to ADMIN_EMAIL)
      const { adminEmails, hrEmails } = await getNotificationEmailsServer();
      let recipients = [...(hrEmails || []), ...(adminEmails || [])];

      // Allow a temporary override via FORCE_NOTIFICATION_EMAILS env var
      // e.g. FORCE_NOTIFICATION_EMAILS="E0048-durgadevi@ctint.in,E0053-naveen@ctint.in"
      if (process.env.FORCE_NOTIFICATION_EMAILS) {
        const forced = (process.env.FORCE_NOTIFICATION_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
        if (forced.length > 0) {
          recipients = forced;
        }
      }

      const emailContent = generateLeaveNotificationEmail(employeeName, leaveType, startDate, endDate, reason);

      const sent = await sendEmailNotification({
        to: recipients,
        subject: `New Leave Application from ${employeeName}`,
        html: emailContent,
        type: 'leave'
      });

      res.json({
        success: sent,
        message: sent ? `Notification sent to ${recipients.length || 0} recipient(s)` : "Failed to send notification"
      });
    } catch (error) {
      console.error('Error sending leave notification:', error);
      res.status(500).json({ success: false, message: "Error sending notification" });
    }
  });

  app.post("/api/send-permission-notification", async (req, res) => {
    try {
      const { employeeName, permissionType, date, startTime, endTime, reason, isLOPApplicable } = req.body;

      // Resolve recipients server-side using Supabase service role (or fall back to ADMIN_EMAIL)
      const { adminEmails, hrEmails } = await getNotificationEmailsServer();
      let recipients = [...(hrEmails || []), ...(adminEmails || [])];

      // Allow a temporary override via FORCE_NOTIFICATION_EMAILS env var
      if (process.env.FORCE_NOTIFICATION_EMAILS) {
        const forced = (process.env.FORCE_NOTIFICATION_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
        if (forced.length > 0) {
          recipients = forced;
        }
      }

      const emailContent = generatePermissionNotificationEmail(employeeName, permissionType, date, startTime, endTime, reason, isLOPApplicable);

      const sent = await sendEmailNotification({
        to: recipients,
        subject: `New Permission Request from ${employeeName}${isLOPApplicable ? " (LOP Applicable)" : ""}`,
        html: emailContent,
        type: 'permission'
      });

      res.json({
        success: sent,
        message: sent ? `Notification sent to ${recipients.length || 0} recipient(s)` : "Failed to send notification"
      });
    } catch (error) {
      console.error('Error sending permission notification:', error);
      res.status(500).json({ success: false, message: "Error sending notification" });
    }
  });
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { employeeCode } = req.body;

      if (!employeeCode) {
        return res.status(400).json({ success: false, message: "Employee Code is required" });
      }

      if (!supabaseServer) {
        return res.status(500).json({ success: false, message: "Supabase not configured" });
      }

      // 1️⃣ Find user
      const { data: user, error } = await supabaseServer
        .from("users")
        .select("*")
        .or(`username.eq.${employeeCode},user_id.eq.${employeeCode.toUpperCase()}`)
        .maybeSingle();

      if (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Database error" });
      }

      const safeUser = user as any;

      if (!safeUser) {
        return res.status(404).json({ success: false, message: "Employee not found" });
      }
      console.log("USER FOUND:", safeUser);
      console.log("USER_ID USED FOR UPDATE:", safeUser.user_id);

      const userEmail = safeUser.email;

      if (!userEmail) {
        return res.status(400).json({
          success: false,
          message: "No email registered for this employee"
        });
      }

      // 2️⃣ Generate token + expiry
      const token = crypto.randomBytes(32).toString("hex");
      const expiry = Date.now() + 15 * 60 * 1000; // 15 minutes

      // 3️⃣ Save token in DB
      await (supabaseServer
        .from("users") as any)
        .update({
          reset_token: token,
          reset_expiry: expiry
        })
        .eq("user_id", safeUser.user_id);

      // 4️⃣ Create reset link
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

      // 5️⃣ Send reset email
      const emailHtml = generateResetPasswordEmail(
        safeUser.username,
        resetLink
      );

      await sendEmailNotification({
        to: [userEmail],
        subject: "Reset Your Password",
        html: emailHtml,
        type: "reset"
      });

      console.log(`[AUTH] Reset link sent to ${userEmail}`);

      res.json({
        success: true,
        message: "Reset link sent to your email"
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: "Token and password are required" });
      }

      if (!supabaseServer) {
        return res.status(500).json({ success: false, message: "Supabase not configured" });
      }

      // 1️⃣ Find user with valid token
      const { data: user, error } = await supabaseServer
        .from("users")
        .select("*")
        .eq("reset_token", token)
        .maybeSingle();

      if (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: "Database error" });
      }

      const safeUser = user as any;

      if (!safeUser) {
        return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
      }

      // 2️⃣ Check expiry
      if (safeUser.reset_expiry && Date.now() > safeUser.reset_expiry) {
        // Optionally clear the expired token here
        await (supabaseServer
          .from("users") as any)
          .update({
            reset_token: null,
            reset_expiry: null
          })
          .eq("user_id", safeUser.user_id)

        return res.status(400).json({ success: false, message: "Reset token has expired" });
      }

      // 3️⃣ Update password and clear token
      const { error: updateError } = await (supabaseServer
        .from("users") as any)
        .update({
          password: newPassword, // Note: In a production app, this should be hashed
          reset_token: null,
          reset_expiry: null
        })
        .eq("user_id", safeUser.user_id);

      if (updateError) {
        console.error(updateError);
        return res.status(500).json({ success: false, message: "Failed to update password" });
      }

      console.log(`[AUTH] Password reset successful for user: ${safeUser.username}`);

      res.json({
        success: true,
        message: "Password has been reset successfully"
      });

    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Internal server error" });
    }
  });





  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  return httpServer;
}
