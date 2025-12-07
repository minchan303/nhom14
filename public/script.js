const $ = id => document.getElementById(id);
const generateBtn = $("generateBtn");
const resultEl = $("result");
const exportPdfBtn = $("exportPdfBtn");

$("uploadBtn").addEventListener("click", async () => {
    const f = $("file").files[0];
    if (!f) return alert("Vui lòng chọn file!");
    const fd = new FormData();
    fd.append("file", f);
    $("uploadInfo").textContent = "Đang tải dữ liệu...";
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const j = await res.json();
    if (j.extractedText) $("text").value = j.extractedText;
    $("uploadInfo").textContent = "Tải file hoàn tất!";
});

generateBtn.addEventListener("click", async () => {
    const textContent = $("text").value.trim();
    const processMode = $("mode").value;
    if (!textContent) return alert("Nội dung không được để trống!");

    generateBtn.disabled = true;
    resultEl.textContent = "AI đang phân tích bài học...";

    try {
        const res = await fetch("/api/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: textContent, mode: processMode })
        });
        
        const data = await res.json();
        generateBtn.disabled = false;
        
        if (data.success) {
            resultEl.textContent = data.output;
            exportPdfBtn.style.display = "inline-block";
        } else {
            resultEl.textContent = "Lỗi từ AI: " + data.error;
        }
    } catch (err) {
        generateBtn.disabled = false;
        resultEl.textContent = "Lỗi kết nối máy chủ!";
    }
});
