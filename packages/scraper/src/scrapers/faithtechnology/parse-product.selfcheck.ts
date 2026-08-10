import assert from 'node:assert/strict';
import { parseFaithTechnologyProductPage } from './parse-product.js';

function parsePriceFixture(rawPrice: string) {
  return parseFaithTechnologyProductPage(
    'https://faithtechnologycr.com/producto/test/',
    '<h1 class="product_title entry-title wd-entities-title">Kingston Fury 8GB DDR5 5600MT/s</h1>' +
      `<p class="price"><span class="woocommerce-Price-amount amount">${rawPrice}</span></p>`,
  );
}

const result = parsePriceFixture('₡71 100');

assert.deepEqual(result, {
  url: 'https://faithtechnologycr.com/producto/test/',
  name: 'Kingston Fury 8GB DDR5 5600MT/s',
  price: 71100,
  brand: null,
});

assert.equal(parsePriceFixture('₡65,000')?.price, 65000);
assert.equal(parsePriceFixture('₡71\u00a0100')?.price, 71100);
assert.equal(parsePriceFixture('₡71.100')?.price, 71100);
assert.equal(parsePriceFixture('Precio no disponible')?.price, null);

assert.equal(
  parseFaithTechnologyProductPage(
    'https://faithtechnologycr.com/producto/test/',
    '<h1 class="product_title entry-title wd-entities-title">Test RAM</h1>' +
      '<span class="woocommerce-Price-amount amount">₡0</span>' +
      '<p class="price"><span class="woocommerce-Price-amount amount">₡33 000</span></p>',
  )?.price,
  33000,
);
