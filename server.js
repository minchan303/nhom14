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
  if (!genAI) return "⚠️ Vui lòng cấu hình GEMINI_API_KEY trên Render.";
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
  if (ext === ".txt") text = fs.readFileSync(newPath, "utf8");
  res.json({ success: true, fileUrl: "/uploads/" + path.basename(newPath), extractedText: text });
});

app.post("/api/process", async (req, res) => {
  let { text, mode } = req.body;
  if (!text) return res.json({ success: false, error: "Nội dung trống" });
  
  const truncated = text.slice(0, 15000);
  let prompt = "";
  
  switch(mode) {
    case "cleanup": 
      prompt = `Sắp xếp lại văn bản sau thành tài liệu cực kỳ sạch sẽ, sửa lỗi chính tả, dùng Header và Bullet points: \n\n${truncated}`; 
      break;
    case "highlight": 
      prompt = `Làm nổi bật ý quan trọng dưới định dạng [Ý CHÍNH] - Giải thích và 5 từ khóa cốt lõi: \n\n${truncated}`; 
      break;
    case "summary": 
      prompt = `Tóm tắt nội dung ngắn gọn, dễ hiểu: \n\n${truncated}`; 
      break;
    case "qa": 
      prompt = `Tạo bộ câu hỏi và trả lời dựa trên nội dung bài học: \n\n${truncated}`; 
      break;
    default: 
      prompt = `Phân tích nội dung này: \n\n${truncated}`;
  }

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
