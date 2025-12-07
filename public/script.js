const $ = id => document.getElementById(id);
const resultEl = $("result");
const textEl = $("text");
const exportPdfBtn = $("exportPdfBtn");

// Xử lý upload file
$("uploadBtn").addEventListener("click", async () => {
    const fileInput = $("file");
    if (!fileInput.files[0]) return alert("Hãy chọn file!");
    
    const formData = new FormData();
    formData.append("file", fileInput.files[0]);
    $("uploadInfo").textContent = "Đang trích xuất dữ liệu...";

    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const data = await res.json();
    
    if (data.extractedText) {
        textEl.value = data.extractedText;
        $("uploadInfo").textContent = "Đã tải dữ liệu thành công!";
    }
});

// Xử lý nút Generate
$("generateBtn").addEventListener("click", async () => {
    const content = textEl.value.trim();
    const selectedMode = $("mode").value;

    if (!content) return alert("Vui lòng nhập hoặc tải tài liệu!");

    $("generateBtn").disabled = true;
    resultEl.textContent = "Hệ thống AI đang xử lý, vui lòng đợi...";

    try {
        const response = await fetch("/api/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: content, mode: selectedMode })
        });
        
        const data = await response.json();
        $("generateBtn").disabled = false;

        if (data.success) {
            resultEl.textContent = data.output;
            exportPdfBtn.style.display = "inline-block";
        } else {
            resultEl.textContent = "Lỗi xử lý: " + data.error;
        }
    } catch (err) {
        $("generateBtn").disabled = false;
        resultEl.textContent = "Không thể kết nối với máy chủ.";
    }
});

// Xử lý xuất PDF
exportPdfBtn.addEventListener("click", async () => {
    const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Tai lieu sach HappyUni", html: resultEl.textContent })
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "HappyUni-Cleanup.pdf"; a.click();
});
