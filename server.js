import express from "express";
import cors from "cors";
import multer from "multer";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import sanitizeHtml from "sanitize-html";
import PDFDocument from "pdfkit";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "60mb" }));
app.use(express.static("public"));

const __dirname = path.resolve();
const UPLOADS = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS);
const upload = multer({ dest: UPLOADS });

let genAI = null;
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

async function askGemini(prompt) {
  if (!genAI) return "⚠️ Thiếu GEMINI_API_KEY";
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const out = await model.generateContent(prompt);
    return out.response.text();
  } catch (e) { return "❌ Lỗi AI: " + e.message; }
}

app.post("/api/upload", upload.single("file"), async (req, res) => {
  const ext = path.extname(req.file.originalname).toLowerCase();
  const newPath = req.file.path + ext;
  fs.renameSync(req.file.path, newPath);
  let text = "";
  if (ext === ".pdf") text = (await pdfParse(fs.readFileSync(newPath))).text;
  if (ext === ".docx") text = (await mammoth.extractRawText({ path: newPath })).value;
  res.json({ success: true, fileUrl: "/uploads/" + path.basename(newPath), extractedText: text });
});

app.post("/api/process", async (req, res) => {
  let { text, mode } = req.body;
  const truncated = text.slice(0, 15000);

  let prompt = "";
  if (mode === "cleanup") prompt = `Sắp xếp lại văn bản này cực kỳ chuyên nghiệp, sửa lỗi chính tả, dùng bullet points và Header: \n\n${truncated}`;
  if (mode === "highlight") prompt = `Làm nổi bật các ý quan trọng nhất trong văn bản dưới định dạng [Ý CHÍNH] - Giải thích. Sau đó liệt kê 5 từ khóa: \n\n${truncated}`;
  if (mode === "summary") prompt = `Tóm tắt nội dung ngắn gọn bằng gạch đầu dòng: \n\n${truncated}`;

  const output = await askGemini(prompt);
  res.json({ success: true, type: "text", output });
});

app.post("/api/export/pdf", (req, res) => {
  const { title, html } = req.body;
  const doc = new PDFDocument({ size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);
  doc.fontSize(20).text(title, { align: "center" }).moveDown();
  doc.fontSize(12).text(sanitizeHtml(html, { allowedTags: [] }));
  doc.end();
});

app.listen(process.env.PORT || 3000);
