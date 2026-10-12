import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBarcodeImage, generateStudentBarcodeValue } from '../src/utils/barcode.js';

test('Barcode Utility - generateStudentBarcodeValue', () => {
  const code100 = generateStudentBarcodeValue('100', 'CSC/2025/1001');
  assert.match(code100, /^CS100-1001$/);

  const code300 = generateStudentBarcodeValue('300 Level', 'CSC/2023/3002');
  assert.match(code300, /^CS300-3002$/);

  const codeFallback = generateStudentBarcodeValue('400', '');
  assert.match(codeFallback, /^CS400-\d{4}$/);
});

test('Barcode Utility - generateBarcodeImage SVG', async () => {
  const svg = await generateBarcodeImage('CS100-1001', 'svg');
  assert.equal(typeof svg, 'string');
  assert.ok(svg.includes('<svg'));
  assert.ok(svg.includes('</svg>'));
});

test('Barcode Utility - generateBarcodeImage PNG', async () => {
  const png = await generateBarcodeImage('CS100-1001', 'png');
  assert.ok(Buffer.isBuffer(png));
  assert.ok(png.length > 500); // Valid PNG buffer size
});
