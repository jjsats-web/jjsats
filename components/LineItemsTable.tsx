"use client";

import { formatCurrency } from "@/lib/format";

export type LineItem = {
  id: string;
  description: string;
  qty: number;
  price: number;
  locked?: boolean;
};

type LineItemsTableProps = {
  items: LineItem[];
  onChangeItem: <K extends keyof LineItem>(
    id: string,
    field: K,
    value: LineItem[K],
  ) => void;
  onRemoveItem: (id: string) => void;
};

export default function LineItemsTable({
  items,
  onChangeItem,
  onRemoveItem,
}: LineItemsTableProps) {
  return (
    <table id="itemsTable">
      <thead>
        <tr>
          <th>รายละเอียด</th>
          <th>จำนวน</th>
          <th>ราคา/หน่วย</th>
          <th>รวม</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const lineTotal = Math.max(item.qty * item.price, 0);
          const isLocked = Boolean(item.locked);
          return (
            <tr key={item.id}>
              <td>
                <input
                  value={item.description}
                  readOnly={isLocked}
                  aria-readonly={isLocked}
                  onChange={(e) =>
                    onChangeItem(item.id, "description", e.target.value)
                  }
                  placeholder="รายละเอียดงานหรือสินค้า"
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={item.qty}
                  onChange={(e) =>
                    onChangeItem(item.id, "qty", Number(e.target.value) || 0)
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={item.price}
                  readOnly={isLocked}
                  aria-readonly={isLocked}
                  onChange={(e) =>
                    onChangeItem(
                      item.id,
                      "price",
                      Number(e.target.value) || 0,
                    )
                  }
                />
              </td>
              <td>{formatCurrency(lineTotal)}</td>
              <td>
                <button
                  type="button"
                  className="remove"
                  onClick={() => onRemoveItem(item.id)}
                  aria-label="ลบรายการ"
                >
                  ลบ
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
