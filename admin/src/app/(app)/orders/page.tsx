"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/utils";
import {
  ordersApi,
  type BackendOrder,
} from "@/services/api";

export default function OrdersPage() {
  const [orders, setOrders] = useState<BackendOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [status, setStatusFilter] = useState("ALL");
  const [editing, setEditing] = useState<BackendOrder | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const refresh = async () => {
    const list = await ordersApi.list();
    setOrders(list);
  };

  useEffect(() => {
    refresh()
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Failed to load orders"),
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders
      .filter((o) => status === "ALL" || o.order_status === status)
      .filter(
        (o) =>
          !q ||
          o.order_number.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          o.customer_name.toLowerCase().includes(q) ||
          o.phone.includes(q),
      );
  }, [orders, query, status]);

  const openEdit = (order: BackendOrder) => {
    if (order.order_status !== "PENDING") {
      toast.error("Only pending orders can be edited");
      return;
    }
    setEditing(order);
    setEditName(order.customer_name);
    setEditPhone(order.phone);
  };

  const saveEdit = async () => {
    if (!editing) return;
    try {
      await ordersApi.update(editing.id, {
        customer_name: editName,
        phone: editPhone,
      });
      await refresh();
      toast.success("Pending order updated");
      setEditing(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  const changeStatus = async (
    id: string,
    next: "COMPLETED" | "CANCELLED",
  ) => {
    try {
      if (next === "COMPLETED") await ordersApi.complete(id);
      else await ordersApi.cancel(id);
      await refresh();
      toast.success(`Order marked ${next.toLowerCase()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Update failed");
    }
  };

  return (
    <div>
      <PageHeader
        title="Orders"
        description="Search, edit pending, complete, or cancel orders"
      />

      <div className="mb-4 flex items-center gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            className="pl-10"
            placeholder="Search by order #, name, or phone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {["ALL", "PENDING", "COMPLETED", "CANCELLED"].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={status === value ? "default" : "secondary"}
            onClick={() => setStatusFilter(value)}
          >
            {value}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-800">
        <table className="w-full min-w-[1050px] text-left">
          <thead className="bg-zinc-950 text-sm uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-3">Order</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((order) => (
              <tr key={order.id} className="border-t border-zinc-800">
                <td className="px-4 py-3">
                  <p className="font-bold">{order.order_number}</p>
                  <p className="text-xs text-zinc-500">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold">{order.customer_name}</p>
                  <p className="text-sm text-zinc-400">{order.phone}</p>
                </td>
                <td className="px-4 py-3 text-sm text-zinc-300">
                  {(order.items || [])
                    .map((item) => {
                      const name = item.product?.name || item.product_id;
                      const size = item.product_size?.size;
                      return `${item.quantity}× ${name}${size ? ` (${size})` : ""}`;
                    })
                    .join(", ") || "—"}
                </td>
                <td className="px-4 py-3 capitalize text-zinc-300">
                  {order.payment_method}
                </td>
                <td className="px-4 py-3 font-bold text-orange-400">
                  <p>{formatPrice(order.grand_total)}</p>
                  <p className="text-xs font-normal text-zinc-500">
                    Subtotal {formatPrice(order.subtotal)} · Delivery{" "}
                    {formatPrice(order.delivery_charge)}
                    {order.cash_on_delivery_fee > 0
                      ? ` · COD ${formatPrice(order.cash_on_delivery_fee)}`
                      : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    tone={
                      order.order_status === "COMPLETED"
                        ? "success"
                        : order.order_status === "CANCELLED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {order.order_status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {order.order_status === "PENDING" ? (
                      <>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => openEdit(order)}
                        >
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => changeStatus(order.id, "COMPLETED")}
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => changeStatus(order.id, "CANCELLED")}
                        >
                          <XCircle className="h-4 w-4" />
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <span className="text-sm text-zinc-600">—</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!loading && !filtered.length ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                  No orders found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={() => setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Pending Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Customer Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button onClick={saveEdit}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
