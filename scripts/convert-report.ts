import { mdToDocx } from '../src/utils/md-to-docx';

(async () => {
  try {
    const input = 'report.md';
    const output = 'report.docx';
    console.log(`Converting ${input} -> ${output}...`);
    await mdToDocx(input, output);
    console.log('Conversion complete:', output);
  } catch (err) {
    console.error('Conversion failed:', err);
    process.exit(1);
  }
})();
