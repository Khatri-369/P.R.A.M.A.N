import "dotenv/config";
import { connectDB } from "./config/db.js";
import { createApp } from "./app.js";
try {
  const app = createApp();
  await connectDB();
  app.listen(process.env.PORT || 5000, () =>
    console.log(`PRAMAN: http://localhost:${process.env.PORT || 5000}`),
  );
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exitCode = 1;
}
