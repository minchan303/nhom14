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
    if (!genAI) return "⚠️ Thiếu GEMINI_API_KEY. Vui lòng kiểm tra cấu hình Render.";
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const out = await model.generateContent(prompt);
        return out.response.text();
    } catch (e) { return "❌ Gemini API bị gián đoạn."; }
}

app.post("/api/upload", upload.single("file"), async (req, res) => {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const newPath = req.file.path + ext;
    fs.renameSync(req.file.path, newPath);
    let text = "";
    if (ext === ".pdf") text = (await pdfParse(fs.readFileSync(newPath))).text;
    if (ext === ".docx") text = (await mammoth.extractRawText({ path: newPath })).value;
    if (ext === ".txt") text = fs.readFileSync(newPath, "utf8");
    res.json({ success: true, extractedText: text });
});

app.post("/api/process", async (req, res) => {
    const { text, mode } = req.body;
    const input = text.slice(0, 15000);
    let prompt = "";
    
    if (mode === "cleanup") prompt = `Định dạng lại văn bản sau chuyên nghiệp, sửa lỗi chính tả, dùng bullet points và Header rõ ràng: \n\n${input}`;
    else if (mode === "highlight") prompt = `Trích xuất các ý cốt lõi quan trọng nhất dưới dạng [Ý CHÍNH] - Giải thích và 5 từ khóa chính: \n\n${input}`;
    else prompt = `Tóm tắt nội dung sau ngắn gọn: \n\n${input}`;

    const output = await askGemini(prompt);
    res.json({ success: true, output });
});

app.listen(process.env.PORT || 3000);
