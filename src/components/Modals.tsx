import React, { useState, useEffect } from 'react';
import { AppData, Category } from '../types';
import { generateIndependentTraderHTML } from '../utils/helpers';
import { X, Globe2, Eye, Download, CalendarRange, Trash2, Share2, Copy, Check, Key, HelpCircle, FileDigit, Smartphone } from 'lucide-react';
import html2canvas from 'html2canvas';
import { toPng, toSvg } from 'html-to-image';
import { jsPDF } from 'jspdf';

// Helper to translate oklch to rgb for html2canvas compatibility
function translateOklchToRgb(val: string): string {
  if (typeof val !== 'string' || !val.includes('oklch')) return val;
  try {
    return val.replace(/oklch\(([^)]+)\)/g, (match, content) => {
      try {
        const parts = content.trim().split('/');
        const colorPart = parts[0].trim();
        const alphaPart = parts[1] ? parts[1].trim() : null;

        const coords = colorPart.split(/\s+/).map((v: string) => {
          if (v.endsWith('%')) {
            return parseFloat(v) / 100;
          }
          return parseFloat(v);
        });

        if (coords.length < 3 || coords.some(isNaN)) {
          return 'rgb(0,0,0)';
        }

        const L = coords[0];
        const C = coords[1];
        const H = coords[2];
        let alpha = 1;

        if (alphaPart) {
          if (alphaPart.endsWith('%')) {
            alpha = parseFloat(alphaPart) / 100;
          } else {
            alpha = parseFloat(alphaPart);
          }
        }

        // Convert OKLCH to sRGB
        const hRad = (H * Math.PI) / 180;
        const lab_a = C * Math.cos(hRad);
        const lab_b = C * Math.sin(hRad);

        // OKLAB to LMS
        const l_ = L + 0.3963377774 * lab_a + 0.2158017574 * lab_b;
        const m_ = L - 0.1055613458 * lab_a - 0.0638541728 * lab_b;
        const s_ = L - 0.0894841775 * lab_a - 1.2914855480 * lab_b;

        // Non-linear LMS
        const l_pow = l_ * l_ * l_;
        const m_pow = m_ * m_ * m_;
        const s_pow = s_ * s_ * s_;

        // LMS to Linear RGB
        const r_l = +4.0767416621 * l_pow - 3.3077115913 * m_pow + 0.2309699292 * s_pow;
        const g_l = -1.2684380046 * l_pow + 2.6097574011 * m_pow - 0.3413193965 * s_pow;
        const b_l = -0.0041960863 * l_pow - 0.7034186147 * m_pow + 1.7076147010 * s_pow;

        // Linear RGB to non-linear sRGB (gamma encoding)
        const gamma = (v: number) => {
          if (v <= 0.0031308) {
            return 12.92 * v;
          } else {
            return 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
          }
        };

        const r = Math.max(0, Math.min(255, Math.round(gamma(r_l) * 255)));
        const g = Math.max(0, Math.min(255, Math.round(gamma(g_l) * 255)));
        const b = Math.max(0, Math.min(255, Math.round(gamma(b_l) * 255)));

        if (alpha === 1 || isNaN(alpha)) {
          return `rgb(${r}, ${g}, ${b})`;
        } else {
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
      } catch (e) {
        return 'rgb(0,0,0)';
      }
    });
  } catch (outerErr) {
    return val;
  }
}

// Injects computed style proxy on cloned document for HTML2Canvas
function patchClonedDocumentStyles(clonedDoc: Document) {
  try {
    const originalGetComputedStyle = clonedDoc.defaultView?.getComputedStyle;
    if (clonedDoc.defaultView && originalGetComputedStyle) {
      clonedDoc.defaultView.getComputedStyle = function (elt, pseudoElt) {
        const style = originalGetComputedStyle.call(this, elt, pseudoElt);
        return new Proxy(style, {
          get(target, prop, receiver) {
            if (prop === 'getPropertyValue') {
              return function(property: string) {
                const innerVal = target.getPropertyValue(property);
                if (typeof innerVal === 'string' && innerVal.includes('oklch')) {
                  return translateOklchToRgb(innerVal);
                }
                return innerVal;
              };
            }
            
            let val = Reflect.get(target, prop, receiver);
            if (typeof val === 'string' && val.includes('oklch')) {
              return translateOklchToRgb(val);
            }
            if (typeof val === 'function') {
              return val.bind(target);
            }
            return val;
          }
        });
      };
    }
  } catch (err) {
    console.error('Error patching cloned document styles:', err);
  }
}

interface LivePreviewModalProps {
  showPreviewModal: boolean;
  onClosePreviewModal: () => void;
  previewAreaId: string;
  previewExportType: 'png' | 'pdf';
  previewFileName: string;
}

interface ExportTraderAppModalProps {
  appData: AppData;
  showExportModal: boolean;
  onCloseExportModal: () => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function LivePreviewModal({
  showPreviewModal,
  onClosePreviewModal,
  previewAreaId,
  previewExportType,
  previewFileName,
}: LivePreviewModalProps) {
  const [exportError, setExportError] = useState<string | null>(null);
  const [generatedImg, setGeneratedImg] = useState<string | null>(null);
  const [loadingImg, setLoadingImg] = useState<boolean>(false);

  // Clear error when modal opens
  useEffect(() => {
    if (showPreviewModal) {
      setExportError(null);
    }
  }, [showPreviewModal]);

  // Synchronize HTML clone
  let rawHtmlSnippet = '';
  const sourceElement = document.getElementById(previewAreaId);
  if (sourceElement) {
    rawHtmlSnippet = sourceElement.innerHTML;
  }

  // Auto-generate PNG preview when loading so user can visually save it directly
  useEffect(() => {
    if (showPreviewModal) {
      setExportError(null);
      setGeneratedImg(null);
      setLoadingImg(true);

      const timer = setTimeout(async () => {
        const element = document.getElementById(previewAreaId);
        if (!element) {
          setLoadingImg(false);
          return;
        }
        try {
          const dataUrl = await toPng(element, {
            pixelRatio: 2.2,
            backgroundColor: '#ffffff',
            cacheBust: true,
            style: {
              transform: 'scale(1)',
              transformOrigin: 'top left',
            }
          });
          setGeneratedImg(dataUrl);
        } catch (err: any) {
          console.warn('Auto-generation of canvas via html-to-image failed, retrying via html2canvas...', err);
          try {
            const canvas = await html2canvas(element, {
              scale: 1.8,
              useCORS: true,
              backgroundColor: '#ffffff',
            });
            const dataUrl = canvas.toDataURL('image/png');
            setGeneratedImg(dataUrl);
          } catch (fallbackErr: any) {
            console.error('Fallback html2canvas auto image generation failed:', fallbackErr);
            setExportError(fallbackErr?.message || String(fallbackErr));
          }
        } finally {
          setLoadingImg(false);
        }
      }, 400);

      return () => clearTimeout(timer);
    }
  }, [showPreviewModal, previewAreaId]);

  const [savingHostedReport, setSavingHostedReport] = useState<boolean>(false);

  const handleOpenHostedReport = async () => {
    const element = document.getElementById(previewAreaId);
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجزء الخاص بالتقرير للتصدير.');
      return;
    }

    setSavingHostedReport(true);
    try {
      const dataUrl = generatedImg || await toPng(element, {
        pixelRatio: 2.2,
        backgroundColor: '#ffffff',
        cacheBust: true,
      });

      const response = await fetch('/api/save-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: dataUrl,
          title: previewFileName.replace('كارت_حساب_', '').replace('كشف_الأرشيف_بـ_', '').replace(/_/g, ' '),
          date: new Date().toLocaleDateString('ar-EG'),
          mime: 'image/png'
        })
      });

      const resData = await response.json();
      if (resData && resData.success) {
        window.open(resData.url, '_top') || (window.location.href = resData.url);
      } else {
        alert('تعذر توليد صفحة الاستعراض والتحميل المباشرة الفورية. يرجى المحاولة لاحقاً.');
      }
    } catch (err: any) {
      console.error(err);
      alert('حدث خطأ في الاتصال بالخادم لتوليد الصفحة الفردية خارج الإطار: ' + err.message);
    } finally {
      setSavingHostedReport(false);
    }
  };

  const handleDownloadSVG = async () => {
    const element = document.getElementById(previewAreaId);
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجزء الخاص بالتقرير للتصدير.');
      return;
    }

    try {
      setExportError(null);
      const dataUrl = await toSvg(element, {
        backgroundColor: '#ffffff',
      });
      
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = '/api/download-direct';
      form.target = '_self';
      
      const input1 = document.createElement('input');
      input1.type = 'hidden';
      input1.name = 'base64Data';
      input1.value = dataUrl;
      form.appendChild(input1);

      const input2 = document.createElement('input');
      input2.type = 'hidden';
      input2.name = 'fileName';
      input2.value = `${previewFileName}.svg`;
      form.appendChild(input2);

      const input3 = document.createElement('input');
      input3.type = 'hidden';
      input3.name = 'mimeType';
      input3.value = 'image/svg+xml';
      form.appendChild(input3);

      document.body.appendChild(form);
      form.submit();
      document.body.removeChild(form);
    } catch (e: any) {
      console.error('Export SVG failure:', e);
      setExportError(e?.message || String(e));
    }
  };

  const handleCopySVGCode = async () => {
    const element = document.getElementById(previewAreaId);
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجزء الخاص بالتقرير للتصدير.');
      return;
    }

    try {
      const dataUrl = await toSvg(element, {
        backgroundColor: '#ffffff',
      });
      
      const prefix = 'data:image/svg+xml;charset=utf-8,';
      let svgCode = '';
      if (dataUrl.startsWith(prefix)) {
        svgCode = decodeURIComponent(dataUrl.slice(prefix.length));
      } else {
        const base64Prefix = 'data:image/svg+xml;base64,';
        if (dataUrl.startsWith(base64Prefix)) {
          svgCode = atob(dataUrl.slice(base64Prefix.length));
        } else {
          svgCode = dataUrl;
        }
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(svgCode);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = svgCode;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      alert('📋 تم نسخ كود الفاتورة المتجهي (SVG XML) بالكامل لحافظة جهازك بنجاح! البديل الرقمي الذكي والنهائي لحماية وتحميلات المتصفح!\nيمكنك الآن مشاركة الكود البرمجي مباشرة أو حفظه بأي ملف صيغة .svg ليفتح كصورة متجهة فائقة الوضوح!');
    } catch (e: any) {
      console.error('Copy SVG failure:', e);
      alert('تعذر نسخ كود الـ SVG تلقائياً: ' + e?.message);
    }
  };

  const handleDownloadPNG = async () => {
    const element = document.getElementById(previewAreaId);
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجزء الخاص بالتقرير للتصدير.');
      return;
    }

    try {
      setExportError(null);
      
      // Use the exact excellent image generation parameters:
      // Reuse the already generated 2.2 ratio preview image if available, otherwise render fresh at 2.2
      const dataUrl = generatedImg || await toPng(element, {
        pixelRatio: 2.2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }
      });
      
      // Save report image on server first to get an ID for standard GET request. 
      // GET download prevents Android Webview from blocking form-submission POST raw downloads!
      const saveRes = await fetch('/api/save-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: dataUrl,
          title: previewFileName,
          date: new Date().toLocaleDateString('ar-EG'),
          mime: 'image/png'
        })
      });

      const resData = await saveRes.json();
      if (resData && resData.success) {
        window.location.href = `/api/download-report/${resData.id}`;
      } else {
        // Client-side fallback download
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${previewFileName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      onClosePreviewModal();
    } catch (e: any) {
      console.error('Export PNG failure:', e);
      setExportError(e?.message || String(e));
    }
  };

  const handleDownloadPDF = async () => {
    const element = document.getElementById(previewAreaId);
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجزء الخاص بالتقرير للتصدير.');
      return;
    }

    try {
      setExportError(null);
      const dataUrl = generatedImg || await toPng(element, {
        pixelRatio: 2.2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }
      });
      
      // Calculate aspect ratio dynamically based on the element dimensions to have ZERO blank margins!
      const elementWidth = element.offsetWidth || 500;
      const elementHeight = element.offsetHeight || 800;
      const imgWidth = 115; // standard compact width in mm
      const imgHeight = (elementHeight * imgWidth) / elementWidth;
      
      const pdf = new jsPDF({
        orientation: imgWidth > imgHeight ? 'landscape' : 'portrait',
        unit: 'mm',
        format: [imgWidth, imgHeight], // Custom layout size fits content exactly!
      });
      
      pdf.addImage(dataUrl, 'PNG', 0, 0, imgWidth, imgHeight);
      const pdfBase64 = pdf.output('datauristring');

      // Save report image on server first to get an ID for standard GET request. 
      // GET download prevents Android Webview from blocking form-submission POST raw downloads!
      const saveRes = await fetch('/api/save-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: pdfBase64,
          title: previewFileName,
          date: new Date().toLocaleDateString('ar-EG'),
          mime: 'application/pdf'
        })
      });

      const resData = await saveRes.json();
      if (resData && resData.success) {
        window.location.href = `/api/download-report/${resData.id}`;
      } else {
        // Client-side fallback download
        const link = document.createElement('a');
        link.href = pdfBase64;
        link.download = `${previewFileName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
      onClosePreviewModal();
    } catch (e: any) {
      console.error('Export PDF failure:', e);
      setExportError(e?.message || String(e));
    }
  };

  const parseHtmlSnippetToWhatsAppText = (htmlSnippet: string, fileName: string): string => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlSnippet, 'text/html');
      
      let traderName = '';
      const nameEl = doc.querySelector('p.font-bold, h3, p.text-slate-800');
      if (nameEl) traderName = nameEl.textContent?.trim() || '';
      if (!traderName) {
        traderName = fileName.replace('كارت_حساب_', '').replace('كشف_الأرشيف_بـ_', '').replace(/_/g, ' ');
      }
      
      const dateEl = doc.querySelector('#display-month-s4') || doc.querySelector('#display-month-s5') || doc.querySelector('#display-filter-date') || doc.querySelector('#txt-timestamp');
      const dateText = dateEl ? dateEl.textContent?.trim() : '';
      
      let text = `🧾 *تقرير تصفية حسابات كروت الشبكة* 🧾`;
      text += `\n----------------------------------------\n`;
      text += `👤 *التاجر:* ${traderName}\n`;
      if (dateText) {
        text += `📅 *الفترة:* ${dateText}\n`;
      }
      text += `----------------------------------------\n\n`;
      
      text += `📊 *تفاصيل جرد الفئات:* \n`;
      
      const tables = doc.querySelectorAll('table');
      tables.forEach((table) => {
        const rows = table.querySelectorAll('tr');
        rows.forEach((row) => {
          const cells = row.querySelectorAll('th, td');
          if (cells.length === 5) {
            const category = cells[0].textContent?.trim();
            const inv = cells[1].textContent?.trim();
            const rem = cells[2].textContent?.trim();
            const sold = cells[3].textContent?.trim();
            const price = cells[4].textContent?.trim();
            if (category && category !== 'الفئة') {
              text += `🔹 *${category}*:\n`;
              text += `   [مخزون: ${inv} | متبقي: ${rem} | مباع: ${sold}] -> *${price}*\n`;
            }
          } else if (cells.length === 2) {
            const label = cells[0].textContent?.trim();
            const price = cells[1].textContent?.trim();
            if (label && label.indexOf('البيان المالي') === -1) {
              text += `\n💵 *${label}:* ${price}\n`;
            }
          }
        });
      });

      const totalSalesEl = doc.querySelector('#txt-total-sales') || doc.querySelector('#txt-filter-total-sales');
      if (totalSalesEl) {
        text += `\n💵 *إجمالي المبيعات:* ${totalSalesEl.textContent?.trim()}\n`;
      }

      const discountValEl = doc.querySelector('#txt-discount-val') || doc.querySelector('#txt-filter-discount-val');
      if (discountValEl) {
        const rateEl = doc.querySelector('#txt-filter-discount-rate');
        const rateStr = rateEl ? ` (${rateEl.textContent?.trim()}%)` : '';
        text += `🎁 *الخصم المالي المعتمد${rateStr}:* -${discountValEl.textContent?.trim()}\n`;
      }

      const netAmountEl = doc.querySelector('#txt-net-amount') || doc.querySelector('#txt-filter-net-amount');
      if (netAmountEl) {
        text += `👑 *الصافي المستحق:* *${netAmountEl.textContent?.trim()}*\n`;
      }

      const grandTotalEl = doc.querySelector('#txt-grand-total');
      if (grandTotalEl) {
        text += `👑 *إجمالي كشف المستحقات الكلي للشهور:* *${grandTotalEl.textContent?.trim()}*\n`;
      }

      text += `\n----------------------------------------\n`;
      text += `💡 تاريخ ووقت التصدير: ${new Date().toLocaleString('ar-EG')}\n`;
      text += `_تم التوليد بنجاح بواسطة برنامج حساب كروت الواي فاي_\n`;
      text += `_إعداد وتصميم م/ ابراهيم جابر_`;
      return text;
    } catch (err) {
      console.error('Failed to parse html snippet:', err);
      return `تقرير جرد حساب كروت الواي فاي لـ ${fileName}`;
    }
  };

  const handleShareReceipt = async () => {
    const element = document.getElementById(previewAreaId);
    if (!element) {
      alert('حدث خطأ أثناء محاولة جلب الجزء الخاص بالتقرير للمشاركة.');
      return;
    }

    try {
      setExportError(null);
      
      // Use existing rendered image or generate a new high-quality PNG
      const dataUrl = generatedImg || await toPng(element, {
        pixelRatio: 2.2,
        backgroundColor: '#ffffff',
        cacheBust: true,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        }
      });

      // Convert the data URL to an actual File Object & Blob to support sharing the primary IMAGE file directly!
      let file: File | null = null;
      let imgBlob: Blob | null = null;
      try {
        const blobRes = await fetch(dataUrl);
        imgBlob = await blobRes.blob();
        const cleanedTitle = previewFileName
          .replace('كارت_حساب_', '')
          .replace('كشف_الأرشيف_بـ_', '')
          .replace(/_/g, ' ') || 'فاتورة';
        file = new File([imgBlob], `${cleanedTitle}.png`, { type: 'image/png' });
      } catch (fileErr) {
        console.warn('Could not create sharing File object from image:', fileErr);
      }

      // 1. First priority: Try native Web Share API with the PNG File ONLY (strictly no text parameters to prevent apps like WhatsApp from skipping the file)
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
          });
          onClosePreviewModal();
          return;
        } catch (shareErr: any) {
          console.warn('Native file share failed or dismissed, trying other methods...', shareErr);
        }
      }

      // 2. Second priority: If native file sharing fails or is not supported, copy the PICTURE (PNG Blob) directly to clipboard!
      if (imgBlob && navigator.clipboard && window.ClipboardItem) {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              'image/png': imgBlob
            })
          ]);
          alert(
            "📋 تم نسخ صورة كارت الفاتورة المتكاملة مباشرة إلى حافظة جهازك بنجاح! \n\n" +
            "💡 يمكنك الآن الانتقال إلى واتساب أو أي تطبيق آخر، والضغط مطولاً (أو Ctrl+V) في مكان الكتابة ومن ثم اختيار (لصق / Paste) لتظهر الصورة الحقيقية فوراً وترسلها بدون أي روابط!"
          );
          onClosePreviewModal();
          return;
        } catch (clipImgErr) {
          console.warn('Clipboard image write failed:', clipImgErr);
        }
      }

      // 3. Third priority: Fallback download if everything else fails (to at least give them the image file)
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${previewFileName}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      alert("📥 تم تحميل كارت الفاتورة كملف صورة بدلاً من المشاركة المباشرة لتخطي قيود الأمان بمتصفحك.");
      onClosePreviewModal();
    } catch (e: any) {
      console.warn('Failed sharing flow:', e);
      alert('حدث خطأ أثناء محاولة مشاركة الفاتورة كصورة: ' + (e?.message || String(e)));
    }
  };

  const handleOpenReportInNewTab = () => {
    try {
      const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${previewFileName || 'تقرير جرد الكروت'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    body {
      font-family: 'Cairo', sans-serif;
      direction: rtl;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-top: 10px !important;
      background: white !important;
      border-radius: 12px !important;
      overflow: hidden !important;
    }
    th {
      background-color: #f1f5f9 !important;
      color: #334155 !important;
      font-weight: 800 !important;
      padding: 8px !important;
      border: 1px solid #e2e8f0 !important;
      font-size: 11px !important;
    }
    td {
      padding: 8px !important;
      border: 1px solid #e2e8f0 !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #1e293b !important;
    }
    @media print {
      .no-print { display: none !important; }
      body { background: white !important; padding: 0 !important; }
      .shadow-sm, .shadow-md, .shadow-xl, .shadow-2xl, .shadow-inner, .border {
        box-shadow: none !important;
        border-color: #cbd5e1 !important;
      }
    }
  </style>
</head>
<body class="bg-slate-50 p-4 md:p-8 min-h-screen flex flex-col items-center justify-center">
  <div class="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200/60 p-6 md:p-8">
    ${rawHtmlSnippet}
  </div>

  <div class="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-lg no-print">
    <button onclick="window.print()" class="w-full sm:w-2/3 bg-indigo-950 text-white font-black py-4 rounded-xl shadow-md hover:bg-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer">
      🖨️ طباعة الفاتورة أو حفظها كـ PDF
    </button>
    <button onclick="window.close()" class="w-full sm:w-1/3 border border-slate-300 bg-white text-slate-700 font-bold py-4 rounded-xl shadow-xs hover:bg-slate-50 transition flex items-center justify-center gap-1 cursor-pointer">
      إغلاق النافذة
    </button>
  </div>
</body>
</html>`;

      const newWindow = window.open('', '_blank');
      if (newWindow) {
        newWindow.document.write(fullHtml);
        newWindow.document.close();
      } else {
        alert('يرجى السماح بفتح النوافذ المنبثقة (Popups) لتسهيل استعراض وطباعة الفواتير مباشرة.');
      }
    } catch (err) {
      console.error(err);
      alert('تعذر فتح صفحة الطباعة النظيفة للفاتورة.');
    }
  };

  const handleDownloadHTMLReport = () => {
    try {
      const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${previewFileName || 'تقرير جرد الكروت'}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
    body {
      font-family: 'Cairo', sans-serif;
      direction: rtl;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      margin-top: 10px !important;
      background: white !important;
      border-radius: 12px !important;
      overflow: hidden !important;
    }
    th {
      background-color: #f1f5f9 !important;
      color: #334155 !important;
      font-weight: 800 !important;
      padding: 8px !important;
      border: 1px solid #e2e8f0 !important;
      font-size: 11px !important;
    }
    td {
      padding: 8px !important;
      border: 1px solid #e2e8f0 !important;
      font-size: 11px !important;
      font-weight: 700 !important;
      color: #1e293b !important;
    }
    @media print {
      .no-print { display: none !important; }
      body { background: white !important; padding: 0 !important; }
      .shadow-sm, .shadow-md, .shadow-xl, .shadow-2xl, .shadow-inner, .border {
        box-shadow: none !important;
        border-color: #cbd5e1 !important;
      }
    }
  </style>
</head>
<body class="bg-slate-50 p-4 md:p-8 min-h-screen flex flex-col items-center justify-center">
  <div class="w-full max-w-lg bg-white rounded-3xl shadow-xl border border-slate-200/60 p-6 md:p-8">
    ${rawHtmlSnippet}
  </div>

  <div class="mt-8 flex flex-col sm:flex-row gap-3 w-full max-w-lg no-print">
    <button onclick="window.print()" class="w-full sm:w-2/3 bg-indigo-950 text-white font-black py-4 rounded-xl shadow-md hover:bg-slate-900 transition flex items-center justify-center gap-1.5 cursor-pointer">
      🖨️ طباعة الفاتورة أو حفظها كـ PDF
    </button>
    <button onclick="window.close()" class="w-full sm:w-1/3 border border-slate-300 bg-white text-slate-700 font-bold py-4 rounded-xl shadow-xs hover:bg-slate-50 transition flex items-center justify-center gap-1 cursor-pointer">
      إغلاق النافذة
    </button>
  </div>
</body>
</html>`;

      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const link = document.createElement('a');
      link.download = `${previewFileName}.html`;
      link.href = URL.createObjectURL(blob);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      
      onClosePreviewModal();
    } catch (err) {
      console.error(err);
      alert('تعذر تصدير كتقرير مستقل.');
    }
  };

  const handleCopyReportText = () => {
    try {
      const textSummary = parseHtmlSnippetToWhatsAppText(rawHtmlSnippet, previewFileName);
      navigator.clipboard.writeText(textSummary);
      alert('تم بنجاح نسخ تقرير الحساب بالكامل كـ نص منسق ومدجج بالرموز التعبيرية جاهز للصق الفوري والمشاركة في واتساب والجروبات!');
      onClosePreviewModal();
    } catch (err) {
      console.error(err);
      alert('تعذر كتابة وفتح ميزة الحافظة بالمتصفح.');
    }
  };

  if (!showPreviewModal) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-9999 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col justify-between shadow-2xl border border-slate-200 overflow-hidden text-right leading-relaxed animate-scale-up">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="font-black text-sm text-slate-900 flex items-center gap-1">
            <Eye className="w-4 h-4 text-indigo-600" />
            <span>معاينة وتصدير الفاتورة</span>
          </h3>
          <button onClick={onClosePreviewModal} className="text-slate-400 hover:text-slate-600 font-bold text-xl px-1.5 focus:outline-none cursor-pointer">
            ×
          </button>
        </div>
        
        {/* Scrollable Area */}
        <div className="p-4 overflow-y-auto bg-slate-100 flex flex-col gap-3.5 flex-1 max-h-[65vh]">
          {/* Styled report preview */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-250 p-3 space-y-2">
            <div className="flex justify-between items-center pb-1 border-b border-slate-100">
              <span className="text-[11px] text-slate-800 font-black">📝 الفاتورة الحالية:</span>
            </div>
            <div 
              className="w-full bg-white select-text text-slate-800 overflow-x-auto text-[11px]"
              dangerouslySetInnerHTML={{ __html: rawHtmlSnippet }}
            />
          </div>

          {/* Render PNG Auto Preview */}
          <div className="bg-white rounded-xl shadow-xs border border-slate-250 p-3 space-y-2">
            <p className="text-[10.5px] text-slate-500 font-black">🖼️ كارت الفاتورة المصور:</p>
            {loadingImg ? (
              <div className="py-8 text-center text-xs text-slate-400 font-bold flex flex-col items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-indigo-605 border-t-transparent rounded-full animate-spin"></span>
                <span>جاري توليد الصورة التلقائية...</span>
              </div>
            ) : generatedImg ? (
              <div className="space-y-1">
                <img 
                  src={generatedImg} 
                  alt="كارت الفاتورة المصور" 
                  className="max-h-[250px] object-contain mx-auto border border-slate-200 rounded-lg shadow-inner pointer-events-auto"
                />
              </div>
            ) : (
              <div className="bg-rose-50 border border-rose-100 p-2 rounded-lg">
                <p className="text-center text-[10px] text-rose-600 font-bold">تعذر توليد المعاينة التلقائية للصورة.</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Modal Buttons Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex flex-col gap-2.5 w-full">
          {/* Main Direct Share Button */}
          <button 
            onClick={handleShareReceipt}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer leading-none"
          >
            <Share2 className="w-4 h-4" />
            <span>مشاركة مباشرة وسريعة (واتساب) 📲</span>
          </button>
          
          <button 
            onClick={onClosePreviewModal} 
            className="w-full border border-slate-300 bg-white text-slate-700 font-bold py-3 rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer text-center"
          >
            إلغاء وإغلاق
          </button>
        </div>
      </div>
    </div>
  );
}

export function ExportTraderAppModal({
  appData,
  showExportModal,
  onCloseExportModal,
  onShowToast,
}: ExportTraderAppModalProps) {
  const [selectedTrader, setSelectedTrader] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('6');
  const [selectedYear, setSelectedYear] = useState('2026');

  // Load defaults
  useEffect(() => {
    const listWithoutDefault = appData.savedTradersList.filter(t => t !== 'اختر تاجر من القائمة');
    if (listWithoutDefault.length > 0) {
      setSelectedTrader(listWithoutDefault[0]);
    } else {
      setSelectedTrader('');
    }
    setSelectedMonth(appData.selectedMonthNum || '6');
    setSelectedYear(appData.selectedYearNum || '2026');
  }, [showExportModal, appData.savedTradersList, appData.selectedMonthNum, appData.selectedYearNum]);

  if (!showExportModal) return null;

  const handleExportSubmit = () => {
    if (!selectedTrader) {
      alert('الرجاء اختيار تاجر حسابي معتمد لتوليد الملف له.');
      return;
    }

    try {
      const periodStr = `شهر ${selectedMonth} - ${selectedYear}`;
      const generatedHtml = generateIndependentTraderHTML(
        selectedTrader, 
        periodStr, 
        selectedMonth, 
        selectedYear, 
        appData
      );

      // Trigger standard file download in browser
      const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
      const link = document.createElement('a');
      link.download = `برنامج_حسابات_${selectedTrader}.html`;
      link.href = URL.createObjectURL(blob);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      onCloseExportModal();
      onShowToast(`تم بنجاح تصدير نسخة مستقلة ممتازة ومعدّة وجاهزة للمحل وجرد التاجر (${selectedTrader})!`, 'success');
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء توليد أو تنزيل ملف التاجر المستقل البنيوي.');
    }
  };

  const handleExportCopy = () => {
    if (!selectedTrader) {
      alert('الرجاء اختيار تاجر حسابي معتمد لتوليد الملف له.');
      return;
    }

    try {
      const periodStr = `شهر ${selectedMonth} - ${selectedYear}`;
      const generatedHtml = generateIndependentTraderHTML(
        selectedTrader, 
        periodStr, 
        selectedMonth, 
        selectedYear, 
        appData
      );

      navigator.clipboard.writeText(generatedHtml);
      onCloseExportModal();
      onShowToast(`تم بنجاح نسخ الكود المصدري لبرنامج التاجر (${selectedTrader})! يمكنك لصقه في ملف تيكست عادي وحفظه بصيغة .html لتشغيله.`, 'success');
    } catch (e) {
      console.error(e);
      alert('حدث خطأ أثناء محاولة نسخ الكود.');
    }
  };

  const handleExportShare = async () => {
    if (!selectedTrader) {
      alert('الرجاء اختيار تاجر حسابي معتمد لتوليد الملف له.');
      return;
    }

    try {
      const periodStr = `شهر ${selectedMonth} - ${selectedYear}`;
      const generatedHtml = generateIndependentTraderHTML(
        selectedTrader, 
        periodStr, 
        selectedMonth, 
        selectedYear, 
        appData
      );

      const blob = new Blob([generatedHtml], { type: 'text/html;charset=utf-8' });
      const file = new File([blob], `برنامج_حسابات_${selectedTrader}.html`, { type: 'text/html;charset=utf-8' });

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `برنامج_حسابات_${selectedTrader}`,
          text: `تطبيق حسابات مستقل للتاجر ${selectedTrader} لبرنامج حساب كروت الواي فاي`,
        });
        onCloseExportModal();
        onShowToast(`تم بنجاح فتح قائمة المشاركة لملف التاجر (${selectedTrader})!`, 'success');
      } else {
        alert('ميزة المشاركة المباشرة للملفات غير مدعومة بمتصفحك حالياً. تم تنزيل الملف تلقائياً بدلاً من ذلك!');
        handleExportSubmit();
      }
    } catch (e: any) {
      console.error(e);
      alert('حدث خطأ أثناء محاولة مشاركة الملف: ' + (e?.message || String(e)));
    }
  };

  const tradersFilteredList = appData.savedTradersList.filter(t => t !== 'اختر تاجر من القائمة');
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  const years = Array.from({ length: 10 }, (_, i) => 2026 + i);

  return (
    <div className="fixed inset-0 bg-black/60 z-9999 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 p-5 space-y-4 text-right animate-scale-up">
        <div>
          <h3 className="font-black text-sm text-slate-900 flex items-center gap-1">
            <Globe2 className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>تصدير نسخة محل مستقلة للتاجر</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-bold mt-1 leading-normal">
            حدد التاجر والفترة المستهدفة لسحب بياناتها بالكامل وتوليد تطبيق HTML مستقل ومقفل على صلاحياته ليكون التاجر قادراً على جرد كروته وإصدار تقارير مبيعاته بنفسه عبر جهازه وبشكل آمن وسري تماماً.
          </p>
        </div>

        {/* Browser Iframe Warning Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 p-2.5 rounded-xl text-[9.5px] text-amber-800 font-bold leading-relaxed space-y-1">
          <p>⚠️ تنبيه فني للمعاينة (iFrame):</p>
          <p className="font-normal text-[9px] text-slate-600">
            إذا تم حظر التحميل التلقائي للملف بواسطة المتصفح، يرجى الضغط على زر <span className="font-bold text-slate-950">"فتح في نافذة مستقلة/خارجية"</span> في الشريط العلوي لتشغيل النظام في صفحة كاملة، أو استخدام زر <span className="font-bold text-slate-950">"نسخ كود البرنامج مباشرة"</span> كحل بديل فوري!
          </p>
        </div>
        
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="block font-bold mb-1.5 text-slate-700">قائمة التجار المتاحة:</label>
            <select
              value={selectedTrader}
              onChange={(e) => setSelectedTrader(e.target.value)}
              className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-extrabold focus:outline-none focus:ring-1 focus:ring-indigo-600"
            >
              {tradersFilteredList.length === 0 ? (
                <option value="">لا تتوفر أسماء تجار لفرزهم</option>
              ) : (
                tradersFilteredList.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))
              )}
            </select>
          </div>
          
          <div className="grid grid-cols-2 gap-3 pb-1 border-t border-slate-50 pt-3">
            <div>
              <label className="block font-bold mb-1.5 text-slate-700 flex items-center gap-0.5">
                <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
                <span>اختر الشهر:</span>
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {months.map((m) => (
                  <option key={m} value={m.toString()}>
                    شهر {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1.5 text-slate-700 flex items-center gap-0.5">
                <CalendarRange className="w-3.5 h-3.5 text-slate-400" />
                <span>اختر السنة:</span>
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="w-full p-2.5 border border-slate-300 rounded-xl bg-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {years.map((y) => (
                  <option key={y} value={y.toString()}>
                    سنة {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-3 border-t border-slate-100">
          <button 
            onClick={handleExportShare}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
            title="إرسال هذا البرنامج مباشرة للتاجر عبر واتساب أو تليغرام أو بلوتوث"
          >
            <Share2 className="w-4 h-4" />
            <span>إرسال ومشاركة البرنامج مباشرة (واتساب / شيريت) 🚀💚</span>
          </button>

          <div className="flex gap-2">
            <button 
              onClick={onCloseExportModal} 
              className="w-[30%] border border-slate-300 bg-white text-slate-700 font-bold py-2.5 rounded-xl text-xs hover:bg-slate-50 transition cursor-pointer"
            >
              إلغاء
            </button>
            <button 
              onClick={handleExportSubmit} 
              className="w-[70%] bg-blue-600 text-white font-black py-2.5 rounded-xl text-xs shadow-md hover:bg-blue-700 transition cursor-pointer whitespace-nowrap"
            >
              📥 تحميل كملف منفصل
            </button>
          </div>
          <button 
            onClick={handleExportCopy} 
            className="w-full bg-slate-900 text-amber-300 font-black py-2.5 rounded-xl text-xs shadow-sm hover:bg-slate-800 transition cursor-pointer flex items-center justify-center gap-1"
          >
            📋 نسخ كود البرنامج مباشرة (بديل فوري)
          </button>
        </div>
      </div>
    </div>
  );
}

interface PwaInstallGuideModalProps {
  showModal: boolean;
  onClose: () => void;
  deferredPrompt: any;
  onTriggerInstall: () => void;
}

export function PwaInstallGuideModal({
  showModal,
  onClose,
  deferredPrompt,
  onTriggerInstall,
}: PwaInstallGuideModalProps) {
  if (!showModal) return null;

  const [activeTab, setActiveTab] = useState<'pwa' | 'keystore'>('keystore');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopyText = (text: string, fieldName: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (e) {
      alert("تم النسخ: " + text);
    }
  };

  const getPublicOrigin = () => {
    let origin = window.location.origin;
    if (origin.includes('ais-dev-')) {
      origin = origin.replace('ais-dev-', 'ais-pre-');
    }
    return origin;
  };

  const handleOpenAppDirectly = () => {
    window.open(window.location.origin, '_blank');
  };

  const isIframe = window.self !== window.top;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-55 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden text-right flex flex-col my-auto" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-900 to-indigo-950 p-5 text-white flex justify-between items-center relative">
          <div className="flex flex-col">
            <h3 className="font-black text-sm tracking-wide">⚙️ مركز رفع وتثبيت التطبيق 📱</h3>
            <p className="text-[10px] text-indigo-200 font-bold mt-0.5">خطوات تثبيت الـ PWA وتوليد ملفات الـ Keystore</p>
          </div>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dynamic Navigation Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50 p-1">
          <button
            onClick={() => setActiveTab('keystore')}
            className={`flex-1 py-2.5 text-center text-xs font-black transition-all rounded-xl cursor-pointer ${
              activeTab === 'keystore'
                ? 'bg-white text-indigo-950 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            🔑 ملف الـ Keystore للمتجر
          </button>
          <button
            onClick={() => setActiveTab('pwa')}
            className={`flex-1 py-2.5 text-center text-xs font-black transition-all rounded-xl cursor-pointer ${
              activeTab === 'pwa'
                ? 'bg-white text-indigo-950 shadow-xs border border-slate-200/50'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            📲 تثبيت البرنامج السريع (PWA)
          </button>
        </div>

        {/* Content Panel */}
        <div className="p-5 space-y-4 max-h-[65vh] overflow-y-auto">
          
          {activeTab === 'keystore' && (
            <div className="space-y-4">
              {/* Context Notice about hidden files on Android */}
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200/70 shadow-3xs space-y-2">
                <div className="flex items-center gap-1.5 text-amber-800">
                  <span className="font-extrabold text-xs">⚠️ سبب عدم رؤية ملف الـ JKS بالهاتف:</span>
                </div>
                <p className="text-[11px] font-bold text-slate-700 leading-relaxed">
                  نظام الأندرويد ومتصفحات الهواتف (مثل كروم وأوبرا) تخفي افتراضياً الملفات التي تنتهي بصيغة <span className="underline">.jks</span> في مستعرض الرفع، لأن الأندرويد يعتبرها صيغة نظام غير مدرجة ومخفية عن الفولدرات العامة للفيديو والصور!
                </p>
                <div className="bg-white/80 rounded-xl p-2.5 border border-amber-200/50 text-[11px] font-black text-indigo-950 leading-relaxed">
                  💡 <strong>الحل الأكيد والبسيط:</strong> حمّل الملف بالأسفل بصيغة <strong>PDF الكاذب (.pdf)</strong> أو <strong>Certificate (.p12)</strong> ليظهر لهاتفك بوضوح، ثم قم برفعه مباشرة أو امسح الامتداد الزائد!
                </div>
              </div>

              {/* Developer Store Credentials Card */}
              <div className="bg-slate-50 border border-slate-200/60 rounded-2xl p-4 space-y-3">
                <span className="text-[10px] text-indigo-600 font-black block border-b border-slate-100 pb-1">🔑 بيانات مفتاح التوقيع لرفعها على AppMySite:</span>
                
                <div className="space-y-2.5">
                  {/* Key Alias */}
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-3xs">
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-slate-400 font-bold">اسم المستعار للمفتاح (Key Alias)</span>
                      <span className="text-xs font-mono font-bold text-slate-900 select-all">gard_vipwifi_alias</span>
                    </div>
                    <button
                      onClick={() => handleCopyText('gard_vipwifi_alias', 'alias')}
                      className="p-1.5 hover:bg-slate-100 text-indigo-600 rounded-lg transition cursor-pointer"
                    >
                      {copiedField === 'alias' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Key Password */}
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-3xs">
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-slate-400 font-bold">كلمة مرور المفتاح (Key Password)</span>
                      <span className="text-xs font-mono font-bold text-slate-950 select-all">vipwifi123</span>
                    </div>
                    <button
                      onClick={() => handleCopyText('vipwifi123', 'keypass')}
                      className="p-1.5 hover:bg-slate-100 text-indigo-600 rounded-lg transition cursor-pointer"
                    >
                      {copiedField === 'keypass' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* KeyStore Password */}
                  <div className="flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-slate-100 shadow-3xs">
                    <div className="flex flex-col text-right">
                      <span className="text-[10px] text-slate-400 font-bold">كلمة مرور مخزن المفتاح (KeyStore Password)</span>
                      <span className="text-xs font-mono font-bold text-slate-950 select-all">vipwifi123</span>
                    </div>
                    <button
                      onClick={() => handleCopyText('vipwifi123', 'storepass')}
                      className="p-1.5 hover:bg-slate-100 text-indigo-600 rounded-lg transition cursor-pointer"
                    >
                      {copiedField === 'storepass' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Multi-Format Downloads buttons list */}
              <div className="space-y-2">
                <span className="text-[10px] text-slate-500 font-extrabold block">📥 حمّل ملف المفتاح الموقّع بالامتداد المناسب لهاتفك:</span>
                
                {/* 1. Format P12 */}
                <a
                  href="/api/download-keystore?format=p12"
                  className="flex items-center justify-between p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/50 rounded-2xl transition cursor-pointer group text-right"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-indigo-950">1. صيغة Certificate الأمنية (.p12) 🔥 موصى به</span>
                    <span className="text-[10px] text-indigo-600 font-bold mt-0.5">معروف للأندرويد وسيظهر فوراً بالمتصفح أثناء الرفع ومقبول جداً بالرفع.</span>
                  </div>
                  <Download className="w-5 h-5 text-indigo-600 group-hover:translate-y-0.5 transition" />
                </a>

                {/* 2. Format PDF (Trick) */}
                <a
                  href="/api/download-keystore?format=pdf"
                  className="flex items-center justify-between p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/50 rounded-2xl transition cursor-pointer group text-right"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-black text-emerald-950">2. ملف PDF كاذب (.pdf) 💡 حيلة مرئية فائقة</span>
                    <span className="text-[10px] text-emerald-700 font-bold mt-0.5">سيظهر بالتأكيد في تحميلات هاتفك، نزلّه ثم قم بتغيير اسم الملف إلى .jks بالهاتف!</span>
                  </div>
                  <Download className="w-5 h-5 text-emerald-600 group-hover:translate-y-0.5 transition font-bold" />
                </a>

                {/* 3. Format Keystore */}
                <a
                  href="/api/download-keystore?format=keystore"
                  className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer group text-right text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">3. صيغة المفتاح المباشر (.keystore)</span>
                    <span className="text-[9.5px] text-slate-500 font-semibold">تنسيق أندرويد المعياري للمتاجر والمطورين.</span>
                  </div>
                  <Download className="w-4 h-4 text-slate-600" />
                </a>

                {/* 4. Format JKS */}
                <a
                  href="/api/download-keystore?format=jks"
                  className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition cursor-pointer group text-right text-xs"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800">4. الصيغة الأولى الخام الأصلية (.jks)</span>
                    <span className="text-[9.5px] text-slate-500 font-semibold">قد يختفي في متصفحات الأندرويد لعدم دعم الصيغة بمستعرض النظام.</span>
                  </div>
                  <Download className="w-4 h-4 text-slate-600" />
                </a>
              </div>

              {/* Visual guides step-by-step to rename file */}
              <div className="bg-sky-50 rounded-2xl p-4 border border-sky-100 text-right space-y-2">
                <span className="text-xs font-black text-sky-950 block">💡 خطوات تفعيل ملف الـ PDF الكاذب وحل مشكلة الاختفاء:</span>
                <ol className="list-decimal list-inside text-[11px] text-slate-700 font-bold space-y-1.5 pr-1 leading-relaxed">
                  <li>اضغط فوق زر <span className="text-emerald-700">"ملف PDF كاذب"</span> لتنزيل الملف في ثانية واحدة.</li>
                  <li>افتح تطبيق <span className="underline">"ملفاتي" (My Files)</span> أو <span className="underline">"Files by Google"</span> في هاتفك.</li>
                  <li>اذهب لمجلد <span className="font-bold">"التحميلات" (Downloads)</span>، ستجد ملف <strong className="text-slate-900">gard_vipwifi.pdf</strong> موجوداً وحجمه تقريباً 2KB.</li>
                  <li>اضغط عليه مطولاً (أو الثلاث نقاط بجانبه)، واختر <span className="font-bold text-indigo-950">"إعادة تسمية" (Rename)</span>.</li>
                  <li>امسح امتداد <span className="font-bold text-red-600">.pdf</span> واكتب مكانه <span className="font-bold text-emerald-700">.jks</span> ليصبح كلياً: <strong className="bg-emerald-100 text-emerald-900 px-1 py-0.5 rounded border border-emerald-200">gard_vipwifi.jks</strong> ثم احفظ.</li>
                  <li>الآن ارجع لمتصفح الرفع بموقع AppMySite وافتحه، ستجد الملف ظاهراً ونشطاً كملف JKS حقيقي وصالح 100%!</li>
                </ol>
              </div>
            </div>
          )}

          {activeTab === 'pwa' && (
            <div className="space-y-4">
              {/* Important context notice */}
              {isIframe && (
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200/60 shadow-3xs">
                  <span className="text-[10px] font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md inline-block mb-1.5 border border-amber-200">
                    ملاحظة هامة جداً ⚠️
                  </span>
                  <p className="text-xs font-bold text-slate-700 leading-relaxed">
                    أنت الآن تقوم بمعاينة وتصفح البرنامج داخل بيئة عمل التطوير المؤقتة (إطار iframe). المتصفحات تمنع تثبيت البرامج من داخل هذا الإطار.
                  </p>
                  <button
                    onClick={handleOpenAppDirectly}
                    className="mt-3 w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <span>افتح الرابط المباشر الآن في صفحة جديدة 🔗</span>
                  </button>
                  <div className="text-[10px] font-bold text-amber-600 mt-2 text-center select-all">
                    رابط التشغيل الحقيقي لجهازك: <br/>
                    <span className="underline select-all text-indigo-950">{window.location.origin}</span>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-amber-200 mt-3 text-[11px] text-slate-600 font-medium leading-relaxed">
                    📢 <strong>لتشغيل البرنامج على أجهزة وهواتف أخرى:</strong><br />
                    رابط التطوير الحالي محمي ومغلق بحساب جوجل الخاص بك فقط. لتفعيل الرابط العام ليتمكن زبائنك وتجارك الآخرين من فتحه من هواتفهم وتنزيل الإشعارات، يرجى الضغط على زر <strong>"Share" (مشاركة)</strong> في أعلى شريط أدوات Google AI Studio ومتابعة خطوات النشر لتفعيل الرابط العام.
                  </div>
                </div>
              )}

              {/* Action to trigger prompt if available */}
              {!isIframe && deferredPrompt ? (
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-center">
                  <p className="text-xs font-black text-indigo-950 mb-3 leading-relaxed">
                    🎉 جهازك يدعم التثبيت المباشر الفوري كبرنامج كامل يعمل أوفلاين!
                  </p>
                  <button
                    onClick={onTriggerInstall}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-3 px-4 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <span>تثبيت البرنامج الفوري على جهازي 🖥️📱</span>
                  </button>
                </div>
              ) : null}

              {/* Detailed step guidance */}
              <div className="space-y-4">
                <h4 className="font-extrabold text-xs text-slate-900 border-b border-slate-100 pb-1.5">خطوات التثبيت السهلة للأجهزة المختلفة:</h4>
                
                {/* Case Android/Chrome */}
                <div className="flex gap-3 items-start">
                  <div className="p-2.5 bg-sky-50 rounded-xl text-sky-600 font-bold text-xs shrink-0 select-none">
                    أندرويد
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-extrabold text-slate-800">هواتف أندرويد (متصفح كروم Chrome أو متصفح سامسونج):</p>
                    <ol className="list-decimal list-inside text-slate-600 font-semibold space-y-1 pr-1">
                      <li>افتح الرابط المباشر للبرنامج في متصفحك.</li>
                      <li>اضغط على زر <span className="font-bold text-indigo-950">"الخيارات" (الثلاث نقاط ⋮)</span> في أعلى أو أسفل الشاشة.</li>
                      <li>بما أن متصفحك باللغة العربية، ابحث عن أحد الخيارات التالية واضغط عليه:</li>
                      <ul className="list-disc list-inside pr-4 text-indigo-900 font-black space-y-1 my-1">
                        <li>✨ <span className="underline">"تثبيت التطبيق"</span></li>
                        <li>✨ <span className="underline">"إضافة إلى الشاشة الرئيسية"</span></li>
                        <li>✨ <span className="underline">"تثبيت VIP WIFI"</span></li>
                      </ul>
                      <li>
                        <span className="font-bold text-indigo-950">ملاحظة هامة (للأندرويد):</span> عند الضغط على تثبيت، يقوم المتصفح ببناء التطبيق وتنزيله في الخلفية (وقد يعرض رسالة "يتم إضافة..." أو "يتم تثبيت..."). يُرجى الانتظار لمدة دقيقة واحدة ثم إغلاق المتصفح (أو الخروج للشاشة الرئيسية) وستجد أيقونة البرنامج الجديدة الرائعة باسم <span className="text-emerald-700 font-extrabold text-[13px] bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">Gard VIPWIFI</span> قد ظهرت لك مع تطبيقاتك وتعمل بمفردها كلياً!
                      </li>
                    </ol>
                  </div>
                </div>

                {/* Case iOS/Safari */}
                <div className="flex gap-3 items-start">
                  <div className="p-2.5 bg-rose-50 rounded-xl text-rose-600 font-bold text-xs shrink-0 select-none">
                    أيفون
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-extrabold text-slate-800">هواتف آيفون iPhone (متصفح سفاري Safari):</p>
                    <ol className="list-decimal list-inside text-slate-600 font-semibold space-y-1 pr-1">
                      <li>افتح الرابط في متصفح <span className="font-bold text-rose-600">سفاري (Safari)</span> حصرياً.</li>
                      <li>اضغط على زر <span className="font-bold text-indigo-950">"مشاركة" (Share - مربع ومندفع منه سهم لأعلى)</span>.</li>
                      <li>انزل لأسفل القائمة قليلاً واضغط على <span className="font-bold text-indigo-950">"إضافة إلى الشاشة الرئيسية" (Add to Home Screen ➕)</span>.</li>
                      <li>اضغط على موافقة أو إضافة في الأعلى لإنشاء أيقونة البرنامج فوراً.</li>
                    </ol>
                  </div>
                </div>

                {/* Case Windows/Mac */}
                <div className="flex gap-3 items-start">
                  <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 font-bold text-xs shrink-0 select-none">
                    كمبيوتر
                  </div>
                  <div className="text-xs space-y-1">
                    <p className="font-extrabold text-slate-800">أجهزة الكمبيوتر واللاب توب (Chrome / Edge):</p>
                    <ol className="list-decimal list-inside text-slate-600 font-semibold space-y-1 pr-1">
                      <li>افتح الرابط المباشر للبرنامج.</li>
                      <li>ستجد أيقونة صغيرة <span className="font-bold text-indigo-950">بشكل شاشة أو سهم بجانب شريط العنوان في الأعلى</span> تطلب منك التثبيت.</li>
                      <li>أو من القائمة الجانبية للمتصفح اختر <span className="font-bold text-indigo-950">تثبيت (Install)</span>.</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3.5 space-y-1.5">
                <span className="text-[10px] text-slate-500 font-bold">لماذا الأسلوب السريع للـ PWA؟ 🤔</span>
                <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                  هذه التقنية الحديثة هي البديل الأكثر أماناً وسرعة للـ APK، فهي تعمل على جميع الهواتف (أندرويد وآيفون) في نفس الوقت، وتوفر لك تشغيلاً أوفلاين 100% دون الحاجة لسرعة إنترنت، وتخزن بياناتك سرياً ومحلياً على هاتفك تماماً!
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button 
            onClick={onClose} 
            className="w-full bg-slate-900 border border-slate-800 text-white font-extrabold py-3 rounded-2xl text-xs hover:bg-slate-800 transition cursor-pointer"
          >
            إغلاق الدليل والرجوع
          </button>
        </div>
      </div>
    </div>
  );
}
