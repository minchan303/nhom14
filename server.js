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

// Khởi tạo AI
let genAI = null;
if (process.env.GEMINI_API_KEY) {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
}

async function askGemini(prompt) {
    if (!genAI) return "⚠️ Thiếu GEMINI_API_KEY. Hãy cấu hình biến môi trường trên Render.";
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (e) { 
        console.error("Lỗi Gemini:", e);
        return "❌ Không thể nhận phản hồi từ AI. Vui lòng thử lại sau."; 
    }
}

// Hàm đọc text từ file
async function readText(filePath, ext) {
    try {
        if (ext === ".pdf") return (await pdfParse(fs.readFileSync(filePath))).text;
        if (ext === ".docx") return (await mammoth.extractRawText({ path: filePath })).value;
        if (ext === ".txt") return fs.readFileSync(filePath, "utf8");
    } catch (err) { console.error(err); }
    return "";
}

app.post("/api/upload", upload.single("file"), async (req, res) => {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const newPath = req.file.path + ext;
    fs.renameSync(req.file.path, newPath);
    const text = await readText(newPath, ext);
    res.json({ success: true, extractedText: text });
});

app.post("/api/process", async (req, res) => {
    const { text, mode } = req.body;
    if (!text) return res.json({ success: false, error: "Dữ liệu đầu vào trống." });

    const truncated = text.slice(0, 15000);
    let prompt = "";
    
    // Logic cho từng chế độ
    if (mode === "cleanup") {
        prompt = `Sắp xếp lại văn bản sau chuyên nghiệp, sửa lỗi chính tả, chia Header và dùng bullet points. Giữ nguyên nội dung gốc: \n\n${truncated}`;
    } else if (mode === "highlight") {
        prompt = `Phân tích các ý quan trọng nhất theo định dạng [Ý CHÍNH] - Giải thích, kèm theo 5 từ khóa chính: \n\n${truncated}`;
    } else if (mode === "summary") {
        prompt = `Tóm tắt nội dung sau một cách ngắn gọn và đủ ý: \n\n${truncated}`;
    } else {
        prompt = `Phân tích nội dung sau: \n\n${truncated}`;
    }

    const output = await askGemini(prompt);
    res.json({ success: true, output });
});

app.post("/api/export/pdf", (req, res) => {
    const { title, html } = req.body;
    const doc = new PDFDocument({ size: "A4" });
    res.setHeader("Content-Type", "application/pdf");
    doc.pipe(res);
    doc.fontSize(22).text(title, { align: "center" }).moveDown();
    doc.fontSize(12).text(sanitizeHtml(html, { allowedTags: [] }));
    doc.end();
});

app.listen(process.env.PORT || 3000, () => console.log("Server Live!"));
