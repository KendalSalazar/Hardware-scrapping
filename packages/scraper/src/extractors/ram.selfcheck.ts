import assert from 'node:assert/strict';
import { extractRamSpecs } from './ram.js';

assert.deepEqual(extractRamSpecs('Kingston Fury Beast 16GB DDR4 3200MHz'), {
  capacity_gb: 16,
  ram_type: 'DDR4',
  speed_mhz: 3200,
  is_kit: false,
});

assert.deepEqual(extractRamSpecs('Corsair Vengeance 2x8GB DDR4 3600MHz'), {
  capacity_gb: 16,
  ram_type: 'DDR4',
  speed_mhz: 3600,
  is_kit: true,
});

assert.deepEqual(extractRamSpecs('G.Skill Trident Z5 RGB 32GB (2x16GB) DDR5 6000MHz'), {
  capacity_gb: 32,
  ram_type: 'DDR5',
  speed_mhz: 6000,
  is_kit: true,
});

assert.deepEqual(
  extractRamSpecs('Patriot Signature Line – 8GB DDR5 – 5600MT/s'),
  {
    capacity_gb: 8,
    ram_type: 'DDR5',
    speed_mhz: 5600,
    is_kit: false,
  },
);
