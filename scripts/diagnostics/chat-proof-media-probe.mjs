import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateChatRgbNormalization} from '../../partner-portal/chat-proof-rgb-validation.mjs';

export const proofImages = ['parent-confirmed', 'parent-reopened', 'driver-visible'];
export function probeProofMedia(root, {verify = validateChatRgbNormalization,
  emit = row => console.log(JSON.stringify(row))} = {}) {
  emit({phase: 'portable-crop-validation-start', images: proofImages});
  const result = verify(root);
  emit({phase: 'portable-crop-validation-complete', ...result}); return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href)
  console.log(JSON.stringify(probeProofMedia(resolve(import.meta.dirname, '../..'))));
