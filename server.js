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
app.use(bodyParser.json({ limit: "50mb" }));
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
  if (!genAI) return "⚠️ Cấu hình GEMINI_API_KEY thiếu trên Render.";
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (e) {
    return "❌ Lỗi kết nối Gemini: " + e.message;
  }
}

app.post("/api/upload", upload.single("file"), async (req, res) => {
  const ext = path.extname(req.file.originalname).toLowerCase();
  const newPath = req.file.path + ext;
  fs.renameSync(req.file.path, newPath);
  let text = "";
  try {
    if (ext === ".pdf") text = (await pdfParse(fs.readFileSync(newPath))).text;
    else if (ext === ".docx") text = (await mammoth.extractRawText({ path: newPath })).value;
    else text = fs.readFileSync(newPath, "utf8");
    res.json({ success: true, extractedText: text });
  } catch (err) {
    res.json({ success: false, error: "Lỗi đọc file" });
  }
});

app.post("/api/process", async (req, res) => {
  const { textContent, mode } = req.body;
  if (!textContent) return res.json({ success: false, error: "Nội dung trống" });

  const input = textContent.slice(0, 15000);
  let prompt = "";

  if (mode === "cleanup") prompt = `Dọn dẹp và định dạng lại văn bản sau chuyên nghiệp, sửa lỗi chính tả, chia mục lục rõ ràng: \n\n${input}`;
  else if (mode === "highlight") prompt = `Trích xuất ý chính quan trọng dưới dạng [Ý CHÍNH] - Giải thích và liệt kê 5 từ khóa: \n\n${input}`;
  else prompt = `Tóm tắt nội dung sau ngắn gọn: \n\n${input}`;

  const output = await askGemini(prompt);
  res.json({ success: true, output });
});

app.post("/api/export/pdf", (req, res) => {
  const { title, htmlContent } = req.body;
  const doc = new PDFDocument({ size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);
  doc.fontSize(20).text(title, { align: "center" }).moveDown();
  doc.fontSize(12).text(sanitizeHtml(htmlContent, { allowedTags: [] }));
  doc.end();
});

app.listen(process.env.PORT || 3000);
