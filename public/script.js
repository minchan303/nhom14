const $ = id => document.getElementById(id);

$("uploadBtn").addEventListener("click", async () => {
    const file = $("file").files[0];
    if (!file) return alert("Vui lòng chọn tệp!");
    const formData = new FormData();
    formData.append("file", file);
    $("uploadInfo").textContent = "Đang tải...";
    const res = await fetch("/api/upload", { method: "POST", body: formData });
    const j = await res.json();
    if (j.extractedText) $("text").value = j.extractedText;
    $("uploadInfo").textContent = "Tải xong!";
});

$("generateBtn").addEventListener("click", async () => {
    const textValue = $("text").value.trim();
    const modeValue = $("mode").value;
    if (!textValue) return alert("Hãy nhập văn bản!");

    $("generateBtn").disabled = true;
    $("result").textContent = "Gemini 2.0 Flash đang xử lý...";

    try {
        const res = await fetch("/api/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ textContent: textValue, mode: modeValue })
        });
        const data = await res.json();
        $("generateBtn").disabled = false;
        if (data.success) {
            $("result").textContent = data.output;
            $("exportPdfBtn").style.display = "inline-block";
        } else {
            $("result").textContent = "Lỗi: " + data.error;
        }
    } catch (e) {
        $("generateBtn").disabled = false;
        $("result").textContent = "Lỗi kết nối Render!";
    }
});

$("exportPdfBtn").addEventListener("click", async () => {
    const content = $("result").textContent;
    const res = await fetch("/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Ket qua HappyUni", htmlContent: content })
    });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "HappyUni-Result.pdf";
    a.click();
});
