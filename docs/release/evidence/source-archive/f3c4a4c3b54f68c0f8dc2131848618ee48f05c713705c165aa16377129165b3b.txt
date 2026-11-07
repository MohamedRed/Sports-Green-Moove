import {teamPushAlertSources} from './team-push-alert-sources.mjs';
export const teamPushDispatchSources=[...new Set([...teamPushAlertSources,
  'functions/src/domain/teamPushDispatch.ts','functions/src/teamPushDispatch.ts',
  ...['teamPushDispatchAuthority','teamPushDispatchPlan','teamPushDispatchDelivery','teamPushDispatch','teamPushProvider','teamPushInvalidation']
    .map(name=>'functions/src/services/'+name+'.ts'),
  'functions/src/__tests__/team-push-dispatch.test.ts','functions/src/__tests__/team-push-invalidation.test.ts',
  'scripts/qa/team-push-dispatch-sources.mjs','scripts/qa/local-team-push-dispatch-suite.mjs','scripts/qa/team-push-invalidation-checks.mjs',
])];
