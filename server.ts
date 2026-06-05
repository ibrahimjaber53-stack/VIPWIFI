import express from "express";
import path from "path";
import fs from "fs";

// Simple in-memory storage to survive across requests for session sharings
interface ReportData {
  image: string;       // base64 data URL
  title: string;
  date: string;
  mime: string;
}

const reportStore = new Map<string, ReportData>();
const backupStore = new Map<string, string>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Copy public/icon-512.png to public/icon-192.png dynamically for standard PWA sizes
  const icon512Path = path.join(process.cwd(), "public", "icon-512.png");
  const icon192Path = path.join(process.cwd(), "public", "icon-192.png");
  
  if (fs.existsSync(icon512Path)) {
    try {
      fs.copyFileSync(icon512Path, icon192Path);
      console.log("Successfully duplicated icon-512.png to icon-192.png in /public");
    } catch (e) {
      console.error("Failed to copy icon in public:", e);
    }
  }

  // Also make sure dist folder is synchronized with both icons if dist exists
  const checkDistPath = path.join(process.cwd(), "dist");
  if (fs.existsSync(checkDistPath)) {
    const distIcon512 = path.join(checkDistPath, "icon-512.png");
    const distIcon192 = path.join(checkDistPath, "icon-192.png");
    
    try {
      if (fs.existsSync(icon512Path)) {
        fs.copyFileSync(icon512Path, distIcon512);
        fs.copyFileSync(icon512Path, distIcon192);
        console.log("Successfully synchronized PWA icons to /dist");
      }
    } catch (e) {
      console.error("Failed to sync icons to /dist:", e);
    }
  }

  // Body parser to accept large base64 image strings
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Route: Save report image to host and get a public URL for WhatsApp sharing
  app.get("/api/download-keystore", (req, res) => {
    const format = (req.query.format as string || "jks").toLowerCase();
    const allowedExtensions = ["jks", "keystore", "p12", "pdf", "txt", "png"];
    const ext = allowedExtensions.includes(format) ? format : "jks";

    let keystorePath = path.join(process.cwd(), "public", "gard_vipwifi.jks");
    if (!fs.existsSync(keystorePath)) {
      keystorePath = path.join(process.cwd(), "dist", "gard_vipwifi.jks");
    }

    if (fs.existsSync(keystorePath)) {
      res.setHeader("Content-Disposition", `attachment; filename=gard_vipwifi.${ext}`);
      
      if (ext === "pdf") {
        res.setHeader("Content-Type", "application/pdf");
      } else if (ext === "png") {
        res.setHeader("Content-Type", "image/png");
      } else if (ext === "txt") {
        res.setHeader("Content-Type", "text/plain");
      } else {
        res.setHeader("Content-Type", "application/octet-stream");
      }
      return res.sendFile(keystorePath);
    }
    res.status(404).set("Content-Type", "text/html; charset=utf-8").send("⚠️ عذراً، لم يتم العثور على ملف الـ Keystore. الرجاء توليده أولاً.");
  });

  app.post("/api/save-report", (req, res) => {
    try {
      const { image, title, date, mime } = req.body;
      if (!image) {
        return res.status(400).json({ success: false, error: "Image data is required" });
      }

      const id = "vip_" + Math.random().toString(36).substring(2, 11);
      reportStore.set(id, {
        image,
        title: title || "تقرير جرد كروت",
        date: date || new Date().toLocaleDateString("ar-EG"),
        mime: mime || "image/png"
      });

      // Construct direct sharing URL
      let host = req.get("host") || "";
      if (host.includes("ais-dev-")) {
        host = host.replace("ais-dev-", "ais-pre-");
      }
      const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? req.protocol : "https";
      const shareUrl = `${protocol}://${host}/report/${id}`;

      res.json({ success: true, id, url: shareUrl });
    } catch (err: any) {
      console.error("Failed to save report:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // API Route: Direct top-level download proxy. Bypass sandbox/iframe restrictions.
  // Sends a POST request, redirects to standard HTTP attachment download
  app.post("/api/download-direct", (req, res) => {
    try {
      const { base64Data, fileName, mimeType } = req.body;
      if (!base64Data) {
        return res.status(400).send("No file data received.");
      }

      // Extract raw base64 string
      const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let contentType = mimeType || "image/png";

      if (matches && matches.length === 3) {
        contentType = matches[1];
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(base64Data, "base64");
      }

      const encodedFileName = encodeURIComponent(fileName || "invoice");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodedFileName}`);
      res.setHeader("Content-Type", contentType);
      res.send(buffer);
    } catch (err: any) {
      console.error("Direct download failed:", err);
      res.status(500).send("Failed to process download due to server error: " + err.message);
    }
  });

  // API Route: Bulletproof standard GET file attachment stream. Highly compatible with Android WebView client and native systems download managers.
  app.get("/api/download-report/:id", (req, res) => {
    const data = reportStore.get(req.params.id);
    if (!data) {
      return res.status(404).set("Content-Type", "text/html; charset=utf-8").send("⚠️ عذراً، لم يتم العثور على التقرير. ربما انتهت صلاحية الجلسة أو تم تفريغ الخادم.");
    }

    try {
      const matches = data.image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let buffer: Buffer;
      let contentType = data.mime || "image/png";

      if (matches && matches.length === 3) {
        contentType = matches[1];
        buffer = Buffer.from(matches[2], "base64");
      } else {
        buffer = Buffer.from(data.image, "base64");
      }

      const fileExtension = contentType.includes("pdf") ? "pdf" : contentType.includes("svg") ? "svg" : "png";
      const cleanTitle = data.title || "invoice_report";
      const fileNameStr = cleanTitle.endsWith(`.${fileExtension}`) ? cleanTitle : `${cleanTitle}.${fileExtension}`;
      const encodedFileName = encodeURIComponent(fileNameStr);

      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodedFileName}`);
      res.setHeader("Content-Type", contentType);
      return res.send(buffer);
    } catch (err: any) {
      console.error("GET download failed:", err);
      res.status(500).send("Server download process error: " + err.message);
    }
  });

  // API Route: Save JSON backup content for high compatibility direct file download
  app.post("/api/save-backup", (req, res) => {
    try {
      const { payload } = req.body;
      if (!payload) {
        return res.status(400).json({ success: false, error: "No payload received" });
      }
      const id = "bk_" + Math.random().toString(36).substring(2, 11);
      backupStore.set(id, payload);
      // Automatically purge backup after 10 minutes from server memory
      setTimeout(() => {
        backupStore.delete(id);
      }, 600000);
      res.json({ success: true, id });
    } catch (e: any) {
      console.error("Save backup failure:", e);
      res.status(500).json({ success: false, error: e.message });
    }
  });

  // API Route: Highly compatible download GET endpoint for Backup JSON 
  app.get("/api/download-backup/:id", (req, res) => {
    const payload = backupStore.get(req.params.id);
    if (!payload) {
      return res.status(404).set("Content-Type", "text/html; charset=utf-8").send("⚠️ عذراً، انتهت صلاحية رابط التحميل للنسخة الاحتياطية. يرجى إعادة محاولة الضغط على تصدير البيانات لتوليد رمز جديد.");
    }
    const cleanFileName = "نسخة_احتياطية_كاملة_للبرنامج.json";
    const encodedFileName = encodeURIComponent(cleanFileName);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodedFileName}`);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(payload);
  });

  // API Route: Serve raw image buffer for OpenGraph WhatsApp preview crawler or direct rendering
  app.get("/api/image/:id", (req, res) => {
    const data = reportStore.get(req.params.id);
    if (!data) {
      return res.status(404).send("Image not found");
    }

    try {
      const matches = data.image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const buffer = Buffer.from(matches[2], "base64");
        res.setHeader("Content-Type", data.mime || "image/png");
        res.setHeader("Cache-Control", "public, max-age=31536000"); // cache 1 year as it's static
        return res.send(buffer);
      }
      return res.status(400).send("Invalid image encoding");
    } catch (err) {
      return res.status(500).send("Error rendering image file");
    }
  });

  // UI Web Route: Beautiful viewport for shared reports to WhatsApp
  app.get("/report/:id", (req, res) => {
    const id = req.params.id;
    const data = reportStore.get(id);
    if (!data) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <title>حساب كروت الواي فاي - تقرير غير موجود</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">>
          <style>
            body { font-family: 'Cairo', sans-serif; background-color: #0f172a; color: #f8fafc; text-align: center; padding: 50px 20px; }
            .content { max-width: 500px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 16px; border: 1px solid #334155; }
            h2 { color: #f43f5e; }
            p { color: #94a3b8; }
          </style>
        </head>
        <body>
          <div class="content">
            <h2>⚠️ الكشف غير موجود</h2>
            <p>قد يكون هذا الكشف قد انتهت صلاحيته أو تم توليده في جلسة تصفية حسابات سابقة.</p>
            <p>يرجى النقر داخل التطبيق لتوليد كود مشاركة جديد فوراً.</p>
          </div>
        </body>
        </html>
      `);
    }

    const host = req.get("host") || "";
    const protocol = host.includes("localhost") || host.includes("127.0.0.1") ? req.protocol : "https";
    const rawImageUrl = `${protocol}://${host}/api/image/${id}`;

    // Return the elegant web layout with WhatsApp meta tags
    res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        
        <!-- OpenGraph (WhastApp / Telegram / Facebook) Rich Previews -->
        <meta property="og:title" content="🧾 كشف حساب كروت الواي فاي - للتاجر: ${data.title}">
        <meta property="og:description" content="تصفية حسابات كروت جرد الواي فاي وتاريخ الجرد: ${data.date}. اضغط لتحميل كارت الفاتورة بدقة ممتازة ورؤية الكشف.">
        <meta property="og:image" content="${rawImageUrl}">
        <meta property="og:image:type" content="${data.mime}">
        <meta property="og:image:width" content="1200">
        <meta property="og:image:height" content="630">
        <meta property="og:url" content="${protocol}://${host}/report/${id}">
        <meta property="og:type" content="website">
        
        <title>كشف حساب كروت الواي فاي - ${data.title}</title>
        
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
        <style>
          body {
            font-family: 'Cairo', sans-serif;
            background: radial-gradient(circle at top, #1e1b4b 0%, #0f172a 100%);
            color: #f8fafc;
            margin: 0;
            padding: 24px 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            min-height: 100vh;
          }
          .app-header {
            text-align: center;
            margin-bottom: 24px;
          }
          .logo {
            font-size: 28px;
            font-weight: 900;
            background: linear-gradient(135deg, #10b981, #3b82f6);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: 1px;
            margin: 0;
          }
          .tagline {
            font-size: 11px;
            color: #94a3b8;
            margin-top: 4px;
            letter-spacing: 0.5px;
          }
          .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 20px;
            padding: 20px;
            max-width: 480px;
            width: 100%;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.4);
            box-sizing: border-box;
            text-align: center;
          }
          .title {
            font-size: 18px;
            font-weight: 900;
            color: #34d399;
            margin-bottom: 4px;
          }
          .subtitle {
            font-size: 13px;
            color: #94a3b8;
            margin-bottom: 16px;
          }
          .image-container {
            position: relative;
            background: #ffffff;
            border-radius: 12px;
            padding: 10px;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.06);
            margin-bottom: 20px;
          }
          .preview-img {
            max-width: 100%;
            height: auto;
            border-radius: 8px;
            display: block;
            margin: 0 auto;
          }
          .btn-group {
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            font-weight: 700;
            padding: 14px 20px;
            border-radius: 14px;
            text-decoration: none;
            transition: all 0.2s ease;
            cursor: pointer;
            border: none;
            font-size: 14px;
          }
          .btn-primary {
            background: linear-gradient(135deg, #10b981, #059669);
            color: #ffffff;
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
          }
          .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3);
          }
          .btn-secondary {
            background: #cbd5e1;
            color: #0f172a;
          }
          .btn-secondary:hover {
            transform: translateY(-2px);
            background: #e2e8f0;
          }
          .tip-badge {
            font-size: 11px;
            color: #34d399;
            background: rgba(16, 185, 129, 0.1);
            padding: 6px 12px;
            border-radius: 9999px;
            margin-top: 16px;
            display: inline-block;
          }
          .footer {
            margin-top: 30px;
            font-size: 11px;
            color: #64748b;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="app-header">
          <div class="logo" style="font-size: 22px;">حساب كروت الواي فاي</div>
          <div class="tagline">بواسطة م/ ابراهيم جابر</div>
        </div>

        <div class="card">
          <div class="title">🧾 تصفية مستحقات الموزع</div>
          <div class="subtitle">👤 ${data.title} | 📅 ${data.date}</div>
          
          <div class="image-container">
            <img src="${data.image}" class="preview-img" alt="فاتورة كشف جرد الكروت">
          </div>

          <div class="btn-group">
            <form action="/api/download-direct" method="POST" target="_self" style="margin: 0; padding: 0;">
              <input type="hidden" name="base64Data" value="${data.image}">
              <input type="hidden" name="fileName" value="فاتورة_${data.title || "التاجر"}.png">
              <input type="hidden" name="mimeType" value="${data.mime}">
              <button type="submit" class="btn btn-primary w-full" style="width: 100%;">
                📥 تنزيل كارت الصورة بجودة كاملة على جهازك
              </button>
            </form>
            
            <a href="${rawImageUrl}" target="_blank" class="btn btn-secondary">
              🔍 فتح الصورة كملف مباشر بملء الشاشة
            </a>
          </div>

          <div class="tip-badge">
            💡 تلميح: اضغط مطولاً على الصورة إذا كنت تستعمل هاتف آيفون لحفظها الفوري باستوديو الصور الخاص بك!
          </div>
        </div>

        <div class="footer">
          جميع الحقوق محفوظة لبرنامج حساب كروت الواي فاي © 2026
        </div>
      </body>
      </html>
    `);
  });

  let distPath = path.join(process.cwd(), "dist");
  if (typeof __dirname !== "undefined" && (__dirname.endsWith("dist") || __dirname.endsWith("dist/"))) {
    distPath = __dirname;
  } else if (typeof __filename !== "undefined" && (__filename.includes("server.cjs") || __filename.includes("dist/"))) {
    distPath = path.dirname(__filename);
  }
  const distExists = fs.existsSync(path.join(distPath, "index.html"));

  const isCjsBundle = typeof __filename !== "undefined" && (__filename.endsWith(".cjs") || __filename.includes("server.cjs"));
  const isProduction = process.env.NODE_ENV === "production" || isCjsBundle;
  const isDevMode = !isProduction;

  let viteInstance: any = null;
  if (isDevMode && !isCjsBundle) {
    try {
      const { createServer: createViteServer } = await import("vite");
      viteInstance = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(viteInstance.middlewares);
      console.log("Vite development middleware loaded successfully");
    } catch (err) {
      console.warn("Failed to load Vite dev middleware, falling back to serving static dist:", err);
    }
  }

  if (viteInstance) {
    console.log("Dev mode active, using Vite middleware");
  } else {
    app.use(express.static(distPath));
    console.log(`Serving production app assets directly from: ${distPath} (index.html exists: ${distExists})`);
  }

  // Fallback catch-all route for any requests not handled by API or static files
  app.get("*", async (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/report")) {
      return next();
    }

    if (viteInstance) {
      try {
        const url = req.originalUrl;
        const htmlPath = path.join(process.cwd(), "index.html");
        if (fs.existsSync(htmlPath)) {
          let template = fs.readFileSync(htmlPath, "utf-8");
          template = await viteInstance.transformIndexHtml(url, template);
          return res.status(200).set({ "Content-Type": "text/html" }).end(template);
        }
      } catch (err: any) {
        viteInstance.ssrFixStacktrace(err);
        return next(err);
      }
    }

    // Default to serving production index.html
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      return res.sendFile(indexPath);
    } else {
      return res.status(404).send("Application shell (index.html) not found. Please build the application.");
    }
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server runs on port ${PORT}`);
  });
}

startServer();
