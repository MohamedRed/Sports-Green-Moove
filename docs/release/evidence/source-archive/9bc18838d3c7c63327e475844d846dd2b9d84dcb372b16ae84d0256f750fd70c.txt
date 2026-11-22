import {teamPushAlertSources} from './team-push-alert-sources.mjs';
export const teamPushDispatchSources=[...new Set([...teamPushAlertSources,
  'functions/src/domain/teamPushDispatch.ts','functions/src/teamPushDispatch.ts',
  ...['teamPushDispatchAuthority','teamPushDispatchPlan','teamPushDispatchDelivery','teamPushDispatch','teamPushProvider']
    .map(name=>'functions/src/services/'+name+'.ts'),
  'functions/src/__tests__/team-push-dispatch.test.ts',
  'scripts/qa/team-push-dispatch-sources.mjs','scripts/qa/local-team-push-dispatch-suite.mjs',
])];
