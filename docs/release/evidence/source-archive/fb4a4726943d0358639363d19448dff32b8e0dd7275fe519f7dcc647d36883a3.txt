import {teamPushRegistrationSources} from './team-push-registration-sources.mjs';

export const teamPushAlertSources = [...new Set([...teamPushRegistrationSources,
  'functions/src/domain/teamPushAlert.ts', 'functions/src/services/teamPushAlert.ts',
  'functions/src/callables/teamPushAlert.ts', 'functions/src/domain/teamConversationAlerts.ts',
  'functions/src/domain/teamConversation.ts', 'functions/src/services/teamEnrollmentAuthority.ts',
  'scripts/qa/local-team-push-alert-suite.mjs', 'scripts/qa/team-push-alert-sources.mjs',
  'scripts/qa/team-alert-fixture.mjs', 'scripts/qa/local-flow-client.mjs',
])];
