import {chatPreparationFolder as folder} from '../scripts/qa/chat-preparation-failure-evidence.mjs';

export const chatPreparationFailure = {source: folder + 'review.json', checkedAt: '2026-11-02', checksums: folder + 'artifact-sha256.json'};
export const chatPreparationFailureProgress = {date: '2026-11-02', title: 'Le nouvel essai réseau bloque en simulation',
  text: 'La connexion mobile manque pendant la préparation. Aucun envoi n’a été testé dans cet essai.',
  flow: 'messages', source: folder + 'README.md', checksums: folder + 'artifact-sha256.json'};
