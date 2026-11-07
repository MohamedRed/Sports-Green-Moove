import {retainChatNetworkRecheck} from './retain-chat-network-replay.mjs';
import {networkRecheckIdentity} from './chat-network-recheck-evidence.mjs';

retainChatNetworkRecheck(process.argv[2], networkRecheckIdentity);
