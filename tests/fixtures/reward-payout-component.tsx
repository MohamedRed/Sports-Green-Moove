import { createRoot } from "react-dom/client";
import { RewardPayoutRow } from "../../admin/src/RewardPayoutRow";
import { TableSection } from "../../admin/src/AdminTable";
import type { RewardPayoutRequest } from "../../admin/src/rewardPayoutRequest";
import "../../admin/src/styles.css";
import "../../admin/src/controls.css";

const state = { calls: [] as RewardPayoutRequest[], resolve: () => {}, reject: () => {} };
Object.assign(window, { payoutFixture: state });
const send = (request: RewardPayoutRequest) => {
  state.calls.push(structuredClone(request));
  return new Promise<void>((resolve, reject) => { state.resolve = resolve; state.reject = () => reject(new Error("Synthetic lost confirmation")); });
};
const amount = new URLSearchParams(location.search).get("amount") === "1500" ? 1500 : 750;
createRoot(document.getElementById("root")!).render(<main className="content">
  <TableSection id="payouts" title="Versements" className="payout-table"><thead><tr><th>Bénéficiaire</th><th>Solde</th><th>Compte</th><th>Action</th></tr></thead><tbody>
    <RewardPayoutRow candidate={{ userId: "driver-1", balanceCents: amount, stripeReady: true }} scope="component:admin" send={send} />
  </tbody></TableSection>
</main>);
