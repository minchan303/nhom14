import express from "express";
import cors from "cors";
import multer from "multer";
import bodyParser from "body-parser";
import fs from "fs";
import path from "path";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import sanitizeHtml from "sanitize-html";
import XLSX from "xlsx";
import { parse as csvParse } from "csv-parse/sync";
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

async function readText(filePath, ext) {
  try {
    if (ext === ".pdf") return (await pdfParse(fs.readFileSync(filePath))).text || "";
    if (ext === ".docx") return (await mammoth.extractRawText({ path: filePath })).value || "";
    if (ext === ".txt") return fs.readFileSync(filePath, "utf8");
  } catch (err) { console.log(err); }
  return "";
}

async function askGemini(prompt) {
  if (!genAI) return "GEMINI_API_KEY chưa được thiết lập.";
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const out = await model.generateContent(prompt);
    return out.response.text();
  } catch (e) { return "❌ Gemini lỗi: " + e.message; }
}

app.post("/api/upload", upload.single("file"), async (req, res) => {
  const ext = path.extname(req.file.originalname).toLowerCase();
  const newPath = req.file.path + ext;
  fs.renameSync(req.file.path, newPath);
  let text = await readText(newPath, ext);
  res.json({ success: true, fileUrl: "/uploads/" + path.basename(newPath), extractedText: text });
});

app.post("/api/process", async (req, res) => {
  let { inputType, text, url, fileUrl, mode } = req.body;
  let content = text || "";

  if (inputType === "url") {
    const r = await fetch(url);
    content = sanitizeHtml(await r.text(), { allowedTags: [] });
  } else if (inputType === "file") {
    const filename = path.join(UPLOADS, path.basename(fileUrl));
    content = await readText(filename, path.extname(filename));
  }

  const truncated = content.slice(0, 20000);

  // LOGIC CŨ
  if (mode === "summary") {
    const output = await askGemini(`Tóm tắt nội dung sau bằng gạch đầu dòng ngắn gọn:\n\n${truncated}`);
    return res.json({ success: true, type: "text", output });
  }
  if (mode === "qa") {
    const output = await askGemini(`Tạo bộ câu hỏi và trả lời (Q&A) dựa trên nội dung:\n\n${truncated}`);
    return res.json({ success: true, type: "text", output });
  }

  // LOGIC MỚI THEO YÊU CẦU
  if (mode === "highlight") {
    const output = await askGemini(`Phân tích văn bản và liệt kê các ý chính. Định dạng: [Ý CHÍNH] - Giải thích. Sau đó liệt kê 5 từ khóa cốt lõi.\n\n${truncated}`);
    return res.json({ success: true, type: "text", output });
  }
  if (mode === "cleanup") {
    const output = await askGemini(`Sắp xếp lại văn bản input sau thành tài liệu chuyên nghiệp: sửa lỗi chính tả, chia Header rõ ràng, dùng bullet points. Giữ nguyên nội dung nhưng trình bày sạch sẽ để in ấn.\n\n${truncated}`);
    return res.json({ success: true, type: "text", output });
  }

  // MINDMAP & PHẦN CÒN LẠI (Tương tự như script cũ của bạn)
  res.json({ success: false, error: "Mode không hợp lệ" });
});

app.post("/api/export/pdf", (req, res) => {
  const { title, html } = req.body;
  const doc = new PDFDocument({ size: "A4" });
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);
  doc.fontSize(18).text(title, { align: "center" });
  doc.moveDown().fontSize(12).text(sanitizeHtml(html, { allowedTags: [] }));
  doc.end();
});

app.listen(process.env.PORT || 3000);
