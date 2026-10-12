import bwipjs from 'bwip-js';

/**
 * Generates an SVG string or PNG buffer for a Code 128 barcode
 * @param {string} text - The barcode text
 * @param {string} format - 'svg' | 'png'
 * @returns {Promise<string|Buffer>}
 */
export async function generateBarcodeImage(text, format = 'svg') {
  if (format === 'svg') {
    return bwipjs.toSVG({
      bcid: 'code128',
      text,
      scale: 3,
      height: 15,
      includetext: true,
      textxalign: 'center',
      textsize: 10,
    });
  }

  return bwipjs.toBuffer({
    bcid: 'code128',
    text,
    scale: 3,
    height: 15,
    includetext: true,
    textxalign: 'center',
    textsize: 10,
  });
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
