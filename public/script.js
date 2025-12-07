const $ = id => document.getElementById(id);
const generateBtn = $("generateBtn");
const resultEl = $("result");
const exportPdfBtn = $("exportPdfBtn");

$("uploadBtn").addEventListener("click", async () => {
  const f = $("file").files[0];
  if (!f) return alert("Chọn file!");
  const fd = new FormData();
  fd.append("file", f);
  $("uploadInfo").textContent = "Đang tải...";
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const j = await res.json();
  if (j.extractedText) $("text").value = j.extractedText;
  $("uploadInfo").textContent = "Tải file xong!";
});

generateBtn.addEventListener("click", async () => {
  const text = $("text").value;
  const mode = $("mode").value;
  if (!text) return alert("Vui lòng nhập nội dung!");
  
  generateBtn.disabled = true;
  resultEl.textContent = "AI đang xử lý...";
  
  const res = await fetch("/api/process", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, mode })
  });
  
  const j = await res.json();
  generateBtn.disabled = false;
  if (j.success) {
    resultEl.textContent = j.output;
    exportPdfBtn.style.display = "inline-block";
  } else {
    resultEl.textContent = "Lỗi: " + j.error;
  }
});

exportPdfBtn.addEventListener("click", async () => {
  const html = resultEl.textContent;
  const title = "Tai-lieu-sach";
  const res = await fetch("/api/export/pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, html })
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "HappyUni-Result.pdf"; a.click();
});
