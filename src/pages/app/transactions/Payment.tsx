import { MoneyMoveList } from "./MoneyMoveList";
export default function Payment() {
  return <MoneyMoveList title="Payments" subtitle="Money paid to suppliers and others." partyLabel="Payee" kind="payments" />;
}
