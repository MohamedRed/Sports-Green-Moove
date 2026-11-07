import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = (name) => readFileSync(new URL('../admin/src/' + name, import.meta.url), 'utf8');
const compile = (value) => ts.transpileModule(value, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const url = (value) => `data:text/javascript;base64,${Buffer.from(value).toString('base64')}`;
const labels = url(compile(source('teamReviewTypes.ts'))), token = url(compile(source('membershipPageToken.ts')));
export const { TeamReviewController } = await import(url(compile(source('TeamReviewController.ts')).replace('"./teamReviewTypes"', JSON.stringify(labels))));
export const wire = await import(url(compile(source('teamReviewWire.ts')).replace('"./membershipPageToken"', JSON.stringify(token))));
export const team = () => ({ id: 'team', clubId: 'club', teamInstanceId: 'b'.repeat(64), name: 'Équipe QA', open: true });
export const item = () => ({ id: 'a'.repeat(64), clubId: 'club', teamId: 'team', teamInstanceId: 'b'.repeat(64),
  subjectKind: 'child', subjectId: 'child', subjectName: 'Enfant QA', status: 'requested', revision: 1, allowedActions: ['approve', 'refuse'] });
export const page = (items, nextCursor = null) => ({ items, nextCursor });
export const requests = (items, nextCursor = null) => ({ ...page(items, nextCursor), teamName: 'Équipe QA' });
export const operationId = 'f131f1e4-f80a-4305-bd38-251d1e738146';
export const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
export async function ready(overrides = {}) {
  const pending = item(), selected = team();
  const gateway = { clubs: async () => page([{ id: 'club', name: 'Club QA' }]), teams: async () => page([selected]),
    requests: async () => requests([pending]), decide: async () => 'approved', ...overrides };
  const controller = new TeamReviewController(gateway, () => operationId);
  await controller.loadClubs(); await controller.selectClub('club'); await controller.selectTeam('team');
  return { controller, gateway, pending, selected };
}
