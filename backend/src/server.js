import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./auth/auth.routes.js";
import { verifyToken, checkRole } from "./auth/auth.middleware.js";
import studentsRoutes from "./students/students.routes.js";
import announcementsRoutes from "./announcements/announcements.routes.js";
import companiesRoutes from "./companies/companies.routes.js";
import internshipsRoutes from "./internships/internships.routes.js";
import applicationsRoutes from "./applications/applications.routes.js";
import logbookReportsRoutes from "./logbook_reports/logbook_reports.routes.js";
import progressReportsRoutes from "./progress_reports/progress_reports.routes.js";
import reviewsRoutes from "./reviews/reviews.routes.js";
import notificationsRoutes from "./notifications/notifications.routes.js";
import reportDeadlinesRoutes from "./report_deadlines/report_deadlines.routes.js";
import systemSettingsRoutes from "./system_settings/system_settings.routes.js";
import usersRoutes from "./users/users.routes.js";
import uploadsRoutes from "./uploads/uploads.routes.js";
import supervisorsRoutes from "./supervisors/supervisors.routes.js";
import trainingMonitoringRoutes from "./training_monitoring/training-monitoring.routes.js";
import conductRoutes from "./conduct/conduct.routes.js";

dotenv.config();

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Origin not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "100kb" }));

app.use("/auth", authRoutes);
app.use("/students", verifyToken, studentsRoutes);
app.use("/announcements", verifyToken, announcementsRoutes);
app.use("/companies", verifyToken, companiesRoutes);
app.use("/internships", verifyToken, internshipsRoutes);
app.use("/applications", verifyToken, applicationsRoutes);
app.use("/logbook_reports", verifyToken, logbookReportsRoutes);
app.use("/progress_reports", verifyToken, progressReportsRoutes);
app.use("/reviews", verifyToken, reviewsRoutes);
app.use("/notifications", verifyToken, notificationsRoutes);
app.use("/report_deadlines", verifyToken, reportDeadlinesRoutes);
app.use("/system_settings", verifyToken, systemSettingsRoutes);
app.use("/users", verifyToken, usersRoutes);
app.use("/uploads", verifyToken, uploadsRoutes);
app.use("/supervisors", verifyToken, supervisorsRoutes);
app.use("/training-monitoring", verifyToken, trainingMonitoringRoutes);
app.use("/conduct", verifyToken, conductRoutes);

app.get("/", (req, res) => {
  res.send("Backend Running");
});

app.get("/student/dashboard", verifyToken, checkRole("student"), (req, res) => {
  res.json({ success: true, message: "Welcome Student", user: req.user });
});

app.get("/admin/dashboard", verifyToken, checkRole("admin"), (req, res) => {
  res.json({ success: true, message: "Welcome Admin", user: req.user });
});

app.get("/supervisor/dashboard", verifyToken, checkRole("supervisor"), (req, res) => {
  res.json({ success: true, message: "Welcome Supervisor", user: req.user });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
