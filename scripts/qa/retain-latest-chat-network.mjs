import {retainChatNetworkRecheck} from './retain-chat-network-replay.mjs';
import {latestNetworkRecheckIdentity} from './chat-network-latest-evidence.mjs';

retainChatNetworkRecheck(process.argv[2], latestNetworkRecheckIdentity);
