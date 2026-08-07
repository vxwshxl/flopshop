"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerFormModal } from "@/components/admin/CustomerFormModal";
import type { Customer, Hostel } from "@/lib/types";

/** "Edit details" action for the customer detail page — same form as the table. */
export function CustomerEditButton({ customer, hostels }: { customer: Customer; hostels: Hostel[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" /> Edit details
      </Button>
      <CustomerFormModal
        open={open}
        onClose={() => setOpen(false)}
        customer={customer}
        hostels={hostels}
        onSaved={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
