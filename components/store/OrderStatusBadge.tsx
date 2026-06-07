import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/utils/orderHelpers";
import type { OrderStatus } from "@/lib/types";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge>;
}
