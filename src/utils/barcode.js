import bwipjs from 'bwip-js';

/**
 * Generates an SVG string or PNG buffer for a barcode or QR code
 * @param {string} text - The barcode text
 * @param {string} format - 'svg' | 'png'
 * @param {string} type - 'code128' | 'qrcode'
 * @returns {Promise<string|Buffer>}
 */
export async function generateBarcodeImage(text, format = 'svg', type = 'code128') {
  const bcid = type === 'qrcode' ? 'qrcode' : 'code128';
  const options = {
    bcid,
    text,
    scale: type === 'qrcode' ? 4 : 3,
    height: type === 'qrcode' ? 20 : 15,
    includetext: type !== 'qrcode',
    textxalign: 'center',
    textsize: 10,
  };

  if (format === 'svg') {
    return bwipjs.toSVG(options);
  }

  return bwipjs.toBuffer(options);
}

/**
 * Helper to generate a standardized Code 128 barcode value for a CS student
 * format: CS{level}-{random4DigitsOrMatricTail}
 */
export function generateStudentBarcodeValue(level, matricNumber) {
  const cleanLevel = String(level).replace(/\D/g, '') || '100';
  const cleanMatric = matricNumber.replace(/[^A-Za-z0-9]/g, '').slice(-4);
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `CS${cleanLevel}-${cleanMatric || randomSuffix}`;
}
