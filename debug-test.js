// Debug test to investigate failing error handling
const { applyDiff } = require('./dist/worker/agents/diff-formats/search-replace.js');

console.log('=== DEBUG: Testing applyDiff error handling ===');

const original = 'const x = 1;';
const diff = `<<<<<<< SEARCH
const y = 2;
=======
const y = 3;
>>>>>>> REPLACE`;

console.log('Original:', JSON.stringify(original));
console.log('Diff searching for:', JSON.stringify('const y = 2;'));
console.log('With strict: true (should throw error)');
console.log('---');

try {
  const result = applyDiff(original, diff, { strict: true });
  console.log('❌ ERROR: Function returned normally instead of throwing!');
  console.log('Result:', JSON.stringify(result));
  console.log('This should have thrown an error because "const y = 2;" is not in "const x = 1;"');
} catch (error) {
  console.log('✅ SUCCESS: Function properly threw error:', error.message);
}
