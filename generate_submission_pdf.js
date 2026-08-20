const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Compiling ApexQueue Submission Documentation into PDF...');

// 1. Read files
const submissionMd = fs.readFileSync(path.join(__dirname, 'SUBMISSION_DOCUMENT.md'), 'utf-8');
const archMd = fs.readFileSync(path.join(__dirname, 'docs/ARCHITECTURE.md'), 'utf-8');
const erMd = fs.readFileSync(path.join(__dirname, 'docs/ER_DIAGRAM.md'), 'utf-8');
const apiMd = fs.readFileSync(path.join(__dirname, 'docs/API_DOCUMENTATION.md'), 'utf-8');
const designMd = fs.readFileSync(path.join(__dirname, 'docs/DESIGN_DECISIONS.md'), 'utf-8');
const patternsMd = fs.readFileSync(path.join(__dirname, 'docs/SOFTWARE_ENGINEERING_PATTERNS.md'), 'utf-8');

// 2. Read images as Base64 for 100% reliable PDF embedding
const archImgBase64 = fs.readFileSync(path.join(__dirname, 'docs/assets/architecture_diagram.png')).toString('base64');
const erImgBase64 = fs.readFileSync(path.join(__dirname, 'docs/assets/er_diagram.png')).toString('base64');

// 3. Compile Master Markdown
const fullMarkdown = `
${submissionMd}

---

# 📚 Detailed Annex Documentation

## Annex A: System Architecture Specification
${archMd}

---

## Annex B: Relational Database Schema & ERD
${erMd}

---

## Annex C: REST & WebSocket API Specification
${apiMd}

---

## Annex D: Architectural Design Trade-Offs
${designMd}

---

## Annex E: Software Engineering & Design Patterns
${patternsMd}
`;

// Simple Markdown to HTML converter with GitHub dark theme styling
function mdToHtml(md) {
  let html = md
    .replace(/^# (.*$)/gim, '<h1 id="$1">$1</h1>')
    .replace(/^## (.*$)/gim, '<h2 id="$1">$1</h2>')
    .replace(/^### (.*$)/gim, '<h3 id="$1">$1</h3>')
    .replace(/^#### (.*$)/gim, '<h4>$1</h4>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/```(\w+)?\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, src) => {
      if (src.includes('architecture_diagram')) {
        return `<div class="img-container"><img src="data:image/png;base64,${archImgBase64}" alt="${alt}" /></div>`;
      }
      if (src.includes('er_diagram')) {
        return `<div class="img-container"><img src="data:image/png;base64,${erImgBase64}" alt="${alt}" /></div>`;
      }
      return `<div class="img-container"><img src="${src}" alt="${alt}" /></div>`;
    })
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>')
    .replace(/\n\n/g, '<br/>');

  return html;
}

const bodyHtml = mdToHtml(fullMarkdown);

const htmlTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ApexQueue — Master Submission Document</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 15mm 18mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #ffffff;
      color: #0f172a;
      line-height: 1.6;
      font-size: 13px;
      padding: 0;
      margin: 0;
    }
    h1 {
      font-size: 24px;
      color: #0284c7;
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 8px;
      margin-top: 24px;
      page-break-before: always;
    }
    h1:first-of-type {
      page-break-before: avoid;
    }
    h2 {
      font-size: 18px;
      color: #334155;
      border-bottom: 1px solid #f1f5f9;
      padding-bottom: 4px;
      margin-top: 20px;
    }
    h3 {
      font-size: 15px;
      color: #475569;
      margin-top: 16px;
    }
    code {
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      background-color: #f1f5f9;
      color: #0284c7;
      padding: 2px 5px;
      border-radius: 4px;
      font-size: 12px;
    }
    pre {
      background-color: #0f172a;
      color: #f8fafc;
      padding: 12px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 11px;
      line-height: 1.4;
    }
    pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 11px;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: 8px 10px;
      text-align: left;
    }
    th {
      background-color: #f8fafc;
      color: #1e293b;
      font-weight: bold;
    }
    blockquote {
      border-left: 4px solid #0284c7;
      background-color: #f0f9ff;
      margin: 12px 0;
      padding: 8px 16px;
      color: #0369a1;
    }
    .img-container {
      text-align: center;
      margin: 16px 0;
    }
    .img-container img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    hr {
      border: none;
      border-top: 1px solid #e2e8f0;
      margin: 24px 0;
    }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

const htmlPath = path.join(__dirname, 'docs', 'ApexQueue_Master_Submission.html');
const pdfPath = path.join(__dirname, 'docs', 'ApexQueue_Master_Submission.pdf');

fs.writeFileSync(htmlPath, htmlTemplate, 'utf-8');
console.log(`✅ Generated HTML document at: ${htmlPath}`);

// 4. Convert HTML to PDF using MS Edge / Chrome CLI
const edgePaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

let browserPath = edgePaths.find(p => fs.existsSync(p));

if (browserPath) {
  console.log(`🖨️ Printing PDF using: ${browserPath}`);
  const cmd = `"${browserPath}" --headless --disable-gpu --print-to-pdf="${pdfPath}" "${htmlPath}"`;
  execSync(cmd);
  console.log(`🎉 Master PDF successfully generated at: ${pdfPath}`);
} else {
  console.log('⚠️ No headless browser found for PDF compilation.');
}
